# ADR: A home router reaches the NODE, not a LoadBalancer address, so the node serves :443 itself

Date: 2026-10-02
Status: Accepted for what is implemented below (the OS-layer half, in this change; the GitOps half is
already on `main` or in PR #17867). The alternatives in "Options not taken" are recorded with the reason each was
not taken, not as rejected-forever: two of them are unmeasured here and could be revisited with a measurement.
Authors: installer-parity pass over the 2026-10-02 runtime fixes on `node-5b2dfa`. Not a maintainer
ratification; the owner may overrule any row.

## The question

Public HTTPS worked at cutover and then production vanished from the internet while every in-cluster
check stayed green. The runtime fix lives in a DaemonSet (`node-lan-hosts`, PR #17867). What should the
*installer* do so the NEXT node does not need that fix applied by hand: change the address layout so the
router cannot be confused, ship the relay as base GitOps, or both?

## Facts (all MEASURED 2026-10-02 on `node-5b2dfa`, 192.168.1.79; none invented here)

1. The node announces several LoadBalancer addresses from ONE NIC (Cilium L2 announcements): `192.168.1.240`
   public gateway (`zeta-public-gateway`, :80 + :443), `.241` `zeta-gateway` (:80), `.242` `gmod` (27015),
   `.250` `gitlab-lan` (:80 only). The host address is `.79`. All of them share **one MAC**.
2. The home router (AT&T) can port-forward only to a **device**, never to an IP. The owner's forward for :443
   was bound to `.250` (the `gitlab-lan` Gateway, which has no :443 listener). Outside SYNs for `.250:443`
   arrived and every connection hung. The router had also earlier landed a :80 forward on `.250`
   (`docs/ops/ROUTER-PORT-FORWARD-AMBIGUITY.md`), so it can change its mind between the node's addresses.
3. An iptables DNAT on the node cannot repair it: Cilium's eBPF datapath owns the LoadBalancer addresses before
   netfilter (the rule saw 0 packets).
4. The NixOS firewall (`nixos-fw`) had no rule for TCP 443, so even a forward that reached the node's own address
   was dropped. That a :80 forward reached `.250` while the firewall carried no 80 rule is consistent with the eBPF datapath
   answering LoadBalancer addresses before netfilter (an inference from those two facts, not a separate measurement).
5. Nothing listened on the node's own :443 until the `node-lan-hosts` relay (hostNetwork; first a `socat` passthrough, then, in #17872, an SNI-routing haproxy edge whose default
   backend is that same TLS passthrough to the public Gateway; only the API hostnames are terminated there) did. A Service `https-relay` with `externalIPs` = every LoadBalancer address that does not
   already serve :443 makes `<ip>:443` a Cilium frontend for that relay.

## Decision

Make **every address the router could pick end up at the same listener**, instead of trying to make the router pick
the right one:

| layer | what | where |
| --- | --- | --- |
| OS | inbound TCP **443** open on every node; **80 stays closed** | `nixos/modules/node-public-https.nix`, imported by `k3s-server.nix` and `k3s-agent.nix` |
| OS | the node resolves `gitlab.<domain>` / `registry.<domain>` to its own loopback relay | `nixos/lib/public-hosts.nix` + `nixos/modules/injected-public-hosts.nix` |
| GitOps | the relay Service + host relay + discovery of the Gateway's current address | `k8s/applications/cluster-hygiene/node-lan-hosts.yaml` (PR #17867, in the base set the root Application applies) |
| docs | the router forward goes to the **node**, and the doc says which addresses and which ports | `DOMAIN-SETUP.md`, `INJECTION-POINTS.md` §10 |

**The relay is deliberately not re-implemented in NixOS.** The Gateway's address is cluster state: Cilium LB-IPAM
hands it out in Service-creation order (fact 1 is the evidence: .240, .241, .242 in creation order, .250 pinned),
nothing pins it, and the relay *discovers* it every 30 seconds. A NixOS-rendered relay would need that address at
evaluation time, where it does not exist. GitOps is the right home for the part that follows cluster state; the OS
owns the part that does not (the firewall, and a name that cannot be wrong).

**Why the node's names resolve to loopback and not to the Gateway's address** is argued in
`nixos/lib/public-hosts.nix`'s header: a static line naming a wrong address would *shadow* the relay's correct
runtime answer (glibc and Go take the first match), whereas `127.0.0.1` cannot be wrong while the relay runs.

## Options not taken

| option | why not |
| --- | --- |
| **Announce only the public Gateway's address** (a `CiliumL2AnnouncementPolicy` `serviceSelector`) so the router sees one IP | The other three addresses are for LAN clients with no DNS (`.250` is GitLab's LAN address by design, `INJECTION-POINTS.md` §11); un-announcing them removes that reachability. And it is **unmeasured** whether this router keys its device on ARP-announced addresses at all. Revisit with a measurement. |
| **Share ONE address by port** (`io.cilium/lb-ipam-sharing-key`) | Sharing needs distinct ports per Service, and three of the Gateways want :80 (`.240`, `.241`, `.250`). `.250` is also the address GitLab's values and its `gitlab-lan` Gateway are pinned to (`k8s/lb-ipam/gitlab-lan-address.yaml`). A redesign of the address layout, not a setting; unmeasured. |
| **Router DMZ / "all ports to the node"** | Router-specific, forwards every port rather than 80/443, and widens exposure on the one box. Documented as a router-side alternative in `DOMAIN-SETUP.md` with that caution; not something an installer can arrange. |
| **Open TCP 80 as well** | Nothing on the host listens on :80 (the relay is :443-only); a hole with no listener is attack surface for nothing. HTTP-01 on :80 reaches the Gateway through the eBPF path with no firewall rule (fact 4). If a :80 relay is added, open 80 in `node-public-https.nix` in the same change. |
| **Pin the Gateway's address from the LB pool** (`lbipam.cilium.io/ips` via `spec.infrastructure.annotations`) so the OS could hard-code it | Would let `networking.hosts` name the real address, but needs a change to the live-tracked `k8s/public-tls/` base or the rendered template, and **nothing here verifies that Cilium 1.20.1 honours it on a Gateway**. A wrong pin takes production off the air; the loopback design needs no such assumption. |

## Consequences, stated plainly

- **A fresh node needs no hand-applied workaround for 443 or the registry names**, provided the relay is in the base
  set. That dependency is real and is pinned by `src/Core.TypeScript/cluster/installer-parity.test.ts`: if
  `node-lan-hosts.yaml` stops listening on :443 on the host network, a test fails instead of a node.
- **The node's `gitlab.<domain>` / `registry.<domain>` now depend on the relay being up.** Before, a LAN whose router
  *does* hairpin could pull with no relay. After, the relay is required. This is the price of a name that cannot be wrong.
- **Source addresses seen behind the relay are the node's,** not the internet's (a property of the relay, in the
  GitOps layer, not of this change).
- **The OS half reaches a node only by an ISO built after this merges**, or a `nixos-rebuild switch --impure` of the
  pinned tree: the OS is pinned to the ISO commit while the cluster tracks `main`
  (`2026-10-01-the-cluster-tracks-main-while-the-os-is-pinned-to-the-iso-commit.md`). The live node keeps its
  GitOps/runtime fixes meanwhile; the DaemonSet's `-C`-then-`-I` firewall step is idempotent against the native rule.

## What is proven and what is not

Proven (static, `bun test`; each test fails without the change): 443 declared and 80 not, on both roles; the two names
and only those, on loopback, from the same file the TLS module reads; the hostname shape refuses a newline-smuggled
second line; the relay still listens on :443 on the host network and is in the base set; image GC starts below the
eviction line it is compared against, read from the generator script.

Pinned for CI only (`nix flake check`, `installer-parity-model`; **not run on the authoring machine, which has no
nix**): that the REAL `control-plane` and `worker-gpu` hosts evaluate to those values, and that key-based sudo defaults off.

**Not proven by anything here:** that NixOS renders the firewall rule and the `/etc/hosts` line on a real node; that
containerd then pulls through the relay; that this router delivers to the node. Only an install and a pull show those.
