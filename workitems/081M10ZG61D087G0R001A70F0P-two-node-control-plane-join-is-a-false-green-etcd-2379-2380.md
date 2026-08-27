---
id: 081M10ZG61D087G0R001A70F0P
type: bug
state: backlog
priority: P1
slug: two-node-control-plane-join-is-a-false-green-etcd-2379-2380
title: "Two-node control-plane join is a FALSE GREEN: etcd 2379/2380 open only in the test harness, closed in the product"
created: 2026-08-27T06:46:13.293Z
depends_on: []
composes_with: ["081M10ZG624087G0R003JW3K8E", "081M10ZG62W087G0R002X76P1D", "081M10ZG63M087G0R000SG5KV6"]
---

# Two-node control-plane join is a FALSE GREEN: etcd 2379/2380 open only in the test harness, closed in the product

## The defect in one sentence

`checks.x86_64-linux.k3s-server-join` passes because **the test opens two
firewall ports the shipped product keeps closed**, so CI proves a join that a
real control plane cannot perform.

## The exact chain (verified 2026-08-27, not inferred)

```
full-ai-cluster/nixos/hosts/control-plane/configuration.nix:12
    imports ../../modules/k3s-server.nix
full-ai-cluster/nixos/modules/k3s-server.nix:324
    # etcd ports 2379/2380 intentionally NOT in this list.
full-ai-cluster/nixos/modules/common.nix:223
    networking.firewall.enable = true;
full-ai-cluster/nixos/tests/k3s-server-join.nix:190,277
    networking.firewall.allowedTCPPorts = lib.mkAfter [ 2379 2380 ];   <- HARNESS ONLY
```

`git grep '2379\|2380' -- 'full-ai-cluster/**'` returns exactly two non-test
hits, and both are the comment saying the ports are closed. **The prescribed
host override has zero instances.**

The failure it hides is already measured — run 33035015161 step 13, before the
harness ports were added by #15792:

```
Adding member joiner-6aba2ae3=https://192.168.1.2:2380
       to etcd cluster [founder-dce5ce45=https://192.168.1.1:2380]
refused connection: IN=eth1 SRC=192.168.1.2 DST=192.168.1.1 DPT=2379
Retrying etcd cluster join: MemberAdd request timed out
```

That is what a real two-node bring-up will do.

## This is DELIBERATE, not an oversight — and that matters for the fix

`k3s-server.nix:324` reasons it out and prescribes the alternative: *"For
multi-server HA, add 2379/2380 to a host-specific override that ALSO scopes them
with `interfacesIn`/source-IP filtering to the other control-plane nodes only."*
`k3s-server-join.nix:153` independently refuses to change the product: *"Do NOT
silently add 2379/2380 to the product firewall."* Closing etcd is defensible —
etcd is the cluster's crown jewels and a LAN-wide open is real exposure. Note the
sibling `infra/nixos/modules/k3s-server.nix` **does** open them, LAN-wide and
unscoped, which is precisely what the comment above argues against; the two
modules disagreeing on a security-relevant default is a concrete cost of the
unconsolidated `infra/` ÷ `full-ai-cluster/` split.

**So the bug is not the closed port.** It is that (a) the prescribed override has
never been written, (b) nothing tells an operator which one to write, and (c)
nothing detects the omission.

## Why this outranks the argv oracle it was found beside

The argv oracle (#15810) produced a **false red** for four hours and everyone
noticed immediately. This produces a **false green**, and nobody would notice
until hardware. That asymmetry is the whole argument for
081M10ZG63M087G0R000SG5KV6 being worth its cost.

## The fix — the test already contains the preflight the product lacks

`k3s-server-join.nix:409,412` already probes the endpoint before joining:

```python
joiner.succeed(f"timeout 5 bash -c 'echo >/dev/tcp/{FOUNDER_IP}/2379'")
joiner.succeed(f"timeout 5 bash -c 'echo >/dev/tcp/{FOUNDER_IP}/2380'")
```

Promote those two lines into a **product preflight** on the existing
`k3s-datastore-preflight.nix` pattern — a oneshot with `before = [ "k3s.service" ]`
and `requiredBy = [ "k3s.service" ]`, which is what makes it fail closed
(`wantedBy` would let k3s start anyway). Then `MemberAdd request timed out`
becomes *"the endpoint you were given does not accept etcd peer traffic on
2379/2380."*

Writing the scoped override itself is a **separate, gated decision** — it is a
firewall default on the hardware path. Do not open the ports as part of closing
this item without maintainer sign-off.

## Two design caveats that will bite an implementer

**1. The joiner is statically detectable; the founder is not.** A joiner has
`services.k3s.serverAddr` set, so "this node WILL join etcd" is known at
evaluation time and an eval assertion works — `injected-server-join.nix` already
has exactly that shape in its `halfProvisioned` all-or-none check, and this is
the same shape with a different predicate. The **founder's** missing ports are a
property of a *different machine*, unknowable from its own config, so only the
runtime probe can catch that half. Both halves are needed.

**2. Reading `allowedTCPPorts` alone FALSE-POSITIVES.** `trustedInterfaces`
(already used at `k3s-server.nix:335`) and
`networking.firewall.interfaces.<name>.allowedTCPPorts` also admit traffic, so a
check that inspects only the flat port list will refuse a correctly-scoped
override — exactly the override the module prescribes. Consider all three.

## Falsifier that closes this

A test asserting that a role=server node provisioned to join (endpoint + token
present) but whose firewall cannot admit an etcd peer **fails before k3s
starts**, with a message naming the ports — and that the assertion goes green
only when the scoped override is present. Mutation check: remove the override and
it must go red; the current tree must NOT satisfy it.

## Lineage

- #15810 — the argv-oracle fix that first got this step green end-to-end, and where this was found
- #15792 — added the harness ports (correctly scoped to the harness); the fix that made CI green and left the product gap
- #15746 — pinned `--node-ip` in the harness; named the related product gap it did not fix (081M10ZG624087G0R003JW3K8E)
- #15673 — introduced the two-control-plane test
- 081M10ZG62W087G0R002X76P1D — arguably the root: no second control-plane host exists to carry the override
- 081M10ZG63M087G0R000SG5KV6 — the general check that would have caught this class; landing it and fixing this are ONE change
