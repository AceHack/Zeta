# Multi-node cluster on the next from-scratch flash: derived CIDRs, a server-side join, and the dirty-disk refusal

**Date:** 2026-08-26 · **Register:** Mirror, with the Beacon anchors named in §7
**Scope:** `full-ai-cluster/nixos/`, `full-ai-cluster/k8s/`, `zeta-install.sh`, and two new CI-executed falsifiers
**Status of every claim below is labelled `metered` (I ran it) or `speculative` (designed against records, not run).**

Aaron, 2026-08-26: *"yes please make the cidr and other changes needed for a
multi node cluster."*

---

## 0. The finding that has to come first, because it burned three agents today

Two k3s control planes answer on the LAN right now — `192.168.4.152` and
`192.168.4.153`, CA founding epochs twelve days apart, both returning 401.
`cluster-bringup`'s `shape` verb reports them as **"2 sovereign clusters"**, and
that report is *correct about the wire and wrong about the world*: the hardware
is a setup attempt from over a month ago, scheduled to be reformatted.

Aaron: *"this is likely the hardware we already have setup from a long time ago.
The plan is to reformat it once the USB is ready. Anything on my network k8s
related is old and should be disregarded for now… we are working on setting all
that up from scratch on next USB test."*

**The generalisable point, and it is not about these two boxes:**

> **A reachability probe cannot distinguish a current estate from abandoned
> hardware that is still powered on.** Both answer 401 identically. There is no
> packet that carries the fact "nobody intends this any more."

So any conclusion drawn from probing a LAN needs an **out-of-band "is this
intended?" input that no probe supplies**. A probe measures *presence*;
"intended" is a fact about people. Reading one as the other is the same error as
reading a passing assertion as a verification — and it cost three agents a day
of reconciliation work against debris.

Nothing in this change probed, joined, or reasoned about those hosts. The target
is the **NixOS configuration the next USB flash produces**: a clean build, no
existing state, nothing to migrate.

---

## 1. The measured defect, verified against the tree rather than taken on report

`metered` — `full-ai-cluster/nixos/modules/k3s-server.nix` (before this change):

```nix
"--cluster-cidr=10.42.0.0/16"
"--service-cidr=10.43.0.0/16"
```

and a repo-wide grep finds the pod half restated twice more, in
`k8s/bootstrap/cilium-install.yaml` and `k8s/applications/cilium/Application.yaml`.

That single fact produces **two different problems**, and they need different
fixes. Conflating them is why "hardcoded CIDR" reads as one bug when it is two.

### Consequence 1 — multi-node within ONE cluster

**The CIDR is not the blocker here.** Nodes joining one cluster are *supposed*
to share the cluster CIDRs; that is what a cluster CIDR is. The blocker is the
**join path**, and specifically its server half:

| flashed as | what happens on `main` |
|---|---|
| worker (`worker-template` / `worker-gpu`, `role = agent`) | `injected-join-server.nix` reads `/etc/zeta/cluster-join-server-url` and joins. **Already works.** |
| control plane (`control-plane`, `role = server`) | `clusterInit = mkDefault true`, no `serverAddr`, no token. **Founds its own cluster, silently, whatever the medium said.** |

`metered` — `injected-join-server.nix` guards its override with
`config.services.k3s.role == "agent"`, so the server branch does not exist. Two
CAs twelve days apart is exactly this row's signature.

**This is what "multi node cluster" most directly needs**, and it is §3 below.

### Consequence 2 — distinct clusters that may later federate

Cilium ClusterMesh requires **disjoint pod and service CIDRs and distinct
cluster ids**. Identical literals make federation impossible by construction, no
matter how the join works. That is §2 below, sequenced by PR #15661 as F0.

They are done together because they touch the same file, and kept separate in
the design because they are separate defects with separate falsifiers.

---

## 2. Consequence 2 — CIDRs derived from cluster identity, no allocator

### 2.1 The single declaration

`full-ai-cluster/cluster-identity.json`:

```json
{ "clusterName": "zeta" }
```

Everything network-shaped is a **pure function of that string**: the k3s
`--cluster-cidr` and `--service-cidr`, and Cilium's ClusterMesh
`cluster.name` / `cluster.id`. A second, federatable cluster is a second
checkout with a different name. **There is no registry to ask and no node that
hands out ranges** — manifesto §1, and the reason a per-federation allocator was
never on the table.

### 2.2 The derivation

```
hash16      = first 4 hex digits of sha256(clusterName)        -- 0..65535
clusterId   = 1 + (hash16 mod 255)                             -- 1..255, Cilium's range
slot        = clusterId - 1                                    -- 0..254
podCidr     = 10.(128 + slot/2).((slot%2)*128).0/17            -- from 10.128.0.0/9
serviceCidr = 10.(96  + slot/8).((slot%8)*32).0/19             -- from 10.96.0.0/11
```

Sixteen bits rather than eight because `65536 = 255·257 + 1`: the modulo bias is
one extra preimage on a single residue (~0.4%), where an 8-bit draw would put
two residues on one slot.

`metered` — `clusterName = "zeta"` derives id **31**, pod **`10.143.0.0/17`**,
service **`10.99.192.0/19`**, and the real `control-plane` NixOS configuration
evaluates to exactly those flags:

```
$ nix eval --impure --json '.#nixosConfigurations.control-plane.config.services.k3s.extraFlags'
  … "--cluster-cidr=10.143.0.0/17"
    "--service-cidr=10.99.192.0/19"
```

### 2.3 Collision-resistant, NOT collision-free — and the ceiling is Cilium's

This is the honest limit and it is load-bearing, so it is stated rather than
implied:

> **Cilium's ClusterMesh cluster-id is EIGHT BITS** (1..255; 0 means unset).
> 2^128 identities do not fit in 255 slots. **No allocator-free scheme can be
> collision-free**, and no hash function repeals the pigeonhole principle.

Birthday bound over 255 slots: ~3.9% chance of any collision at four federated
clusters, ~50% at nineteen. The mitigation is **detection plus renaming**, not
avoidance: two clusters that federate exchange identity anyway, the derivation is
total, so each side can compute the other's values from its name alone and
compare **before a packet is exchanged**. `clusterNetworksCollide` reports the
**fact**, not a verdict (`dual-use-detection-is-neutral-oracle-decides`).

Note what this does *not* claim: it is not a proof that four clusters are safe.
It is a stated probability with a named detector.

### 2.4 The reserved-range walk found a real bug in the first draft

`metered`, and the most useful thing in this section.

The first draft put the service space at **`10.64.0.0/10`** carved into /18s.
That looks entirely reasonable. It is wrong: **slot 96 lands on `10.88.0.0/18`,
which CONTAINS `10.88.0.0/24`** — the cluster segment every joiner is addressed
on (`zflash/cluster-address.ts`). One cluster name in 255 would have made the
segment unroutable, and the symptom would have read as a hardware fault.

No amount of reading the constant would have shown it. What showed it was
enumerating the reserved ranges **as data** and walking all 255 slots against
them exhaustively — on the very first run. The service space moved to
`10.96.0.0/11` with /19 blocks; the walk now reports **0 clashes** across
255 × (6 reserved ranges × 2 CIDRs + self-overlap), and the killed mutant is
pinned as its own test so the walk cannot quietly stop meaning anything.

The reserved list, each entry with its reason:

| range | why it is reserved |
|---|---|
| `10.0.2.0/24` | QEMU SLIRP user-mode NAT in the multi-VM harness |
| `10.42.0.0/16` | k3s default cluster CIDR |
| `10.43.0.0/16` | k3s default service CIDR |
| `10.88.0.0/24` | the cluster segment |
| `192.168.0.0/16` | home LANs |
| `172.16.0.0/12` | docker/podman default bridge pools |

k3s's own defaults are excluded **on purpose**: a node that never received the
derivation keeps `10.42/10.43`, and that must not silently coincide with a
derived cluster's space. A misconfigured node is then *visibly* on the wrong
network instead of *invisibly* on the right one.

### 2.5 The part that would have made this change worse than the bug

Deriving the k3s flag alone and leaving the Cilium manifests at `10.42.0.0/16`
would have produced a cluster whose **kubelet and CNI disagree about where pods
live**. Nothing crashes in that state: pods come up, get addresses, and their
traffic goes nowhere. It reads as a network fault — the hardest class of bug to
trace back to a config edit.

And one of the two Cilium surfaces is **reconciled by ArgoCD from git with
selfHeal**, where no Nix module can reach it. A stale value there is not a
one-time disagreement; it is re-applied over the bootstrap manifest on every
sync, forever. That is the same two-owners-disagree shape `k3s-server.nix`
already records for Vault (two reconcilers, two storage backends, conversion on
a loop, data loss on the secrets backend).

So both manifests were regenerated, and **agreement is checked twice**:

- `metered` — three assertions in `nixos/modules/cluster-network.nix`, which
  `builtins.readFile` both YAMLs at evaluation time. Renaming the cluster to
  `zeta-lab` without regenerating fails the `control-plane` build with:

  > `k8s/bootstrap/cilium-install.yaml does not mention the derived pod CIDR 10.154.128.0/17 for cluster "zeta-lab"…`
  > `k8s/applications/cilium/Application.yaml … ArgoCD reconciles that file FROM GIT with selfHeal…`

- `metered` — `src/Core.TypeScript/hygiene/lint-cluster-cidr-agreement.ts`, and
  this is the half CI actually runs (§6).

### 2.6 Why cluster identity is deliberately NOT injectable from the flash medium

Hostname, join endpoint, and segment address are all injected per-USB. Cluster
identity is not, and the asymmetry is reasoned rather than an oversight: the
Cilium values live in **checked-in YAML that ArgoCD reconciles from git**. A
per-USB cluster name could not move them. An injected name would put the CNI on
one network and the control plane on another with nothing in the boot output to
say so — the silent-divergence class this tree keeps paying for. Changing cluster
identity is a repo edit, re-checked across every surface.

---

## 3. Consequence 1 — one node founds, the others join

### 3.1 What stays exactly as it was

`clusterInit = lib.mkDefault true` **is not changed**. Sovereign-by-default is
the intent: a machine flashed with no join endpoint founds its own cluster,
which is right for the first node and for any standalone one. `metered` — a
`control-plane` config with no injected files still evaluates to
`clusterInit = true`.

What was missing is that **joining was not expressible for a server at all**.

### 3.2 `nixos/modules/injected-server-join.nix`

| state on the installed system | result |
|---|---|
| endpoint **and** token present, `role == "server"` | `clusterInit := false`, `serverAddr := <endpoint>`, `tokenFile := /etc/zeta/k3s-join-token` |
| neither present | nothing set — byte-identical to today's founding |
| exactly one present | **assertion failure at Nix evaluation**, naming which half is missing |
| `role == "agent"` | contributes nothing (`injected-join-server.nix` owns that path) |

`mkOverride 50` beats `k3s-server.nix`'s `mkDefault` (1000) while still losing to
an explicit operator `mkForce` — the same priority choice, for the same reason,
as `injected-hostname.nix`.

**All-or-none, and the token is why.** A server told to join with no token
cannot authenticate, and k3s's failure there ("token is required") reads nothing
like "the flash carried no token". Worse, `clusterInit = false` with no
reachable server leaves a node that founds nothing and joins nothing. A refusal
at evaluation costs an eval; the alternative costs a cluster.

**The token path is `/etc/zeta/k3s-join-token`, not
`/var/lib/rancher/k3s/server/token`.** k3s manages and writes the latter itself;
pre-seeding it conflates *the credential I present to join* with *the credential
I hand out*.

**Only PRESENCE is read at evaluation time.** A NixOS module evaluates into the
world-readable Nix store, so `builtins.readFile` on a cluster credential would
copy it there. The `K10<64 hex>::…` content check stays in `zeta-install.sh`, on
the machine, where the bytes already are.

**This invents no join.** k3s's join is the join (Aaron 2026-08-13, closing PR
#10493's open question). Every line is a `services.k3s` option k3s already
honours.

### 3.3 How a joining node learns the founder's address

The task named `control-plane` not resolving as the current breakage. **That
half already landed** and was verified by reading the tree rather than assumed:

```
zflash  cluster-address.ts   derives founder .1 / joiner .2+ in 10.88.0.0/24
  ->    /zeta-firstboot.conf on the boot ESP
  ->    zeta-install.sh stages /mnt/etc/zeta/cluster-{segment-address,segment-mac,control-plane-address}
  ->    injected-cluster-address.nix writes a NetworkManager keyfile AND the
        `control-plane -> <founder ip>` /etc/hosts entry, on JOINERS ONLY
```

The **name** is dialled, not the address, because `--tls-san=control-plane` is
the only name in the API certificate; the address is only what makes the name
resolve. Two values that cannot drift apart, both derived from one role.

What this change adds is the missing token leg: `zeta-install.sh` now stages the
join token to `/mnt/etc/zeta/k3s-join-token` **in addition to** the agent path
`/mnt/var/lib/rancher/k3s/agent/token`, and symlinks it so Nix evaluation sees
what the installed system will see. Both paths unconditionally, because the
script does not know the flake host at that point and a spare 0600 file costs
nothing while guessing wrong costs a node that boots, runs, and never joins.

`speculative` — the whole segment-addressing chain remains unbooted. It is
`JoinBlocker`-listed and stays listed.

---

## 4. The dirty-disk case, made loud

k3s, verbatim from its own documentation:

> *"If an etcd datastore is found on disk … the datastore arguments
> (`--cluster-init`, `--server`, `--datastore-endpoint`, etc) are **ignored**."*

**Every option §3.2 sets is a datastore argument.** So on a node that already
holds a k3s server datastore, a declarative join is a **silent no-op**: the unit
starts, the flags parse, the disk wins, and the node quietly resumes being the
cluster it already was. `systemctl status k3s` is green throughout.

On a genuinely from-scratch flash that never happens. This guard is for every
other case — a re-flash that reused a partition, an install onto surviving
state, a `nixos-rebuild` onto a node that founded once.

`nixos/modules/k3s-datastore-preflight.nix` runs
`k3s-datastore-preflight.sh` as a oneshot **`before` k3s.service and
`requiredBy` it**. `requiredBy`, not `wantedBy`: `wantedBy` would let k3s start
anyway, which is the vacuity class in unit-file form — a guard that is present,
runs, reports, and gates nothing.

| provisioned to join | datastore exists | result |
|---|---|---|
| no | no | clear, exit 0 |
| no | **yes** | clear, exit 0 — *a founding node that founded; refusing here would brick every reboot of a healthy cluster* |
| yes | no | clear, exit 0 — the from-scratch flash |
| **yes** | **yes** | **REFUSED, exit 1**, k3s fails with it |

**It deletes nothing, and that is the design, not an omission.** A boot-path
`rm -rf /var/lib/rancher/k3s/server` would "fix" this in one line and would be
**confiscation we introduced** — irreversible destruction of the one thing on
the machine that cannot be regenerated (manifesto §5). k3s already fails closed
here; the only thing missing was somebody saying so out loud. The refusal names
both facts it refuses on, prints both ways forward, and says which one is
irreversible.

The datastore path names `…/server/db/etcd`, not its parent
`/var/lib/rancher/k3s/server` — the parent is created by k3s's own tmpfiles rule
and by a partial install with no cluster state in it, so checking it would refuse
boots that are perfectly fine. That is the cry-wolf failure that gets a guard
disabled.

**A cost this change pays, stated rather than hidden:** it adds one file to the
bash-retirement surface (`check-bash-retirement-inventory.ts`, category
*host-service wrappers*, 2 → 3). The boot path on a NixOS node genuinely has no
`bun` and an `ExecStart` cannot wait for one. It is kept as a tracked `.sh`
rather than an inline Nix string **on purpose**: an inline string would drop off
that inventory while still being bash, and it could not be *executed* by a test.

---

## 5. What is metered and what is speculative

### `metered` — I ran these

| evidence | result |
|---|---|
| `nix eval` of `cluster-cidr-eval-test.nix` | 8 golden vectors reproduced by the **Nix** derivation, independently of the TypeScript that minted them |
| mutant: `serviceSpaceFirstSecondOctet` 96 → 64 | throws `serviceCidr = "10.67.192.0/19", golden vector says "10.99.192.0/19"` |
| `nix eval` of `k3s-server-join-eval-test.nix` | 5 scenarios pinned |
| mutant: `mkOverride 50` → `2000` | `joining/clusterInit = true, expected false` |
| mutant: drop the `role == "server"` guard | `agent/clusterInit = false, expected true` |
| `nix flake check --no-build --impure ./full-ai-cluster` | all checks pass, including both new ones; the full `control-plane` config evaluates |
| `nix eval` of the real `control-plane` `extraFlags` | `--cluster-cidr=10.143.0.0/17`, `--service-cidr=10.99.192.0/19` |
| mutant: rename to `zeta-lab` without regenerating | build fails, naming **both** Cilium files and the remediation command |
| `bun test lint-cluster-cidr-agreement.test.ts` | 17 pass / 0 fail |
| `bun test lint-k3s-datastore-preflight.test.ts` | 11 pass / 0 fail — the script **executed** over fixtures, all four states |
| mutant: preflight always reports "no datastore" | the REFUSED test fails |
| mutant: `requiredBy` → `wantedBy` | the fail-closed test fails |
| all 255 slots × 6 reserved ranges | 0 clashes; 255 distinct pod blocks, 255 distinct service blocks |
| `bash -n` + `shellcheck` on both shell files | rc=0 |
| `yq` parse of both Cilium YAMLs | both parse; `cluster: {name: zeta, id: 31}`, pod and native-routing CIDR both `10.143.0.0/17` |
| `lint-check-then-use-file-races.ts` | 0 findings (it caught 2 in my first draft; fixed to single-syscall `try/catch ENOENT`) |
| `lint-cluster-cidr-agreement.ts` exit codes, read **directly, not through a pipe** | `0` at repo root, `2` from the wrong cwd — a check that could not run must never look like one that passed |

### `speculative` — designed against records, not run

- **Nothing has booted.** No `nixos-install`, no `nixos-rebuild`, no hardware.
  Every claim about what a node *does* is an inference from option values.
- That k3s honours `--server` + `--token-file` on a server whose `clusterInit`
  is false is read from k3s's documented behaviour, not observed here.
- That systemd honours `before` + `requiredBy` on a real boot.
- That the `/etc/zeta` symlinks make the two new files visible at
  `nixos-install` evaluation time — the same mechanism the existing
  `cluster-join-server-url` symlink uses, extended by one line.
- The whole segment-addressing chain (NetworkManager keyfile pickup, MAC-based
  NIC selection, 6443 reachable across the segment) remains `JoinBlocker`-listed.
- Whether the derived `/17` pod CIDR interacts with Cilium's default
  `clusterPoolIPv4MaskSize: 24` as expected (it should give 128 node blocks).

---

## 6. What CI can check versus what needs real hardware

The USB lane is gated behind exhaustive CI testing at Aaron's explicit
instruction, so the placement of each check matters more than usual.

**A finding worth its own line:** `nix flake check` on
`full-ai-cluster/flake.nix` **is run by no workflow in this repository**. Its
assertions and eval tests are real, and in CI they are *unexecuted*. Treating
them as coverage would be a check that never ran wearing a passing badge. Both
new Nix checks are wired into `flake.checks` anyway — they are cheap, they run
on every system, and they are what a local `nix flake check` gets — but the
CI-side falsifier is duplicated in TypeScript on purpose.

| lane | what it covers |
|---|---|
| **`bun test src/Core.TypeScript/hygiene/`** (gate, already runs — `gate.yml` untouched) | golden vectors; the 255-slot reserved walk; name validation; the agreement audit over the real tree **and** over mutated fixtures; the preflight script **executed** over four fixture states; the never-delete property; the unit's fail-closed wiring |
| **`nix flake check --no-build`** (local only today) | the Nix half of the derivation replayed against the same vectors; the five server-join scenarios; the three Cilium-agreement assertions on every host build |
| **`nix build .#nixosConfigurations.*`** (ISO lane) | that the whole closure builds with the new modules |
| **QEMU two-VM lane** (`nixos/tests/k3s-agent-join.nix`) | an agent join over a virtual segment. **Does not cover a joining SERVER** — a companion VM test is the obvious next step and is not in this change |
| **real hardware, from-scratch flash** | that a second control plane actually joins; that the segment addressing works; that systemd's ordering holds; that Cilium accepts a /17; that the preflight fires on a genuinely dirty disk |

The honest summary: **CI can prove the configuration says what we meant. Only a
flash can prove a cluster forms.** This change moves as much as possible into
the first category and does not pretend the second is covered.

---

## 7. Anchors (Beacon)

- **RFC 1918** (Rekhter et al., 1996) — private address space; both derived
  spaces sit inside `10.0.0.0/8`.
- **RFC 1123** (Braden, 1989) — host-name label syntax, which is the shape
  Cilium requires of a ClusterMesh cluster name.
- **Cilium ClusterMesh** (Isovalent/Cilium, *Setting up Cluster Mesh*) — the
  `cluster.id` 1..255 constraint that is the actual ceiling on §2.3, and the
  disjoint-CIDR requirement that makes §2 necessary at all.
- **k3s** (Rancher/SUSE) — the join being provisioned for, and the
  datastore-arguments-are-ignored behaviour §4 exists for. Aaron 2026-08-13:
  *"k3s's join is the join, don't invent our own."*
- **Birthday problem** (von Mises, 1939) — the collision figures in §2.3.
- **Hanlon's razor / missing context** —
  `.claude/rules/never-assume-malice-where-mistake-is-possible.md`: the two
  abandoned control planes in §0 are debris, not a conspiracy, and the fix is to
  supply the out-of-band context a probe cannot carry.

## 8. Pointers

- `full-ai-cluster/cluster-identity.json` — the one declaration
- `src/Core.TypeScript/cluster/cluster-cidr.ts` — the derivation (TypeScript)
- `full-ai-cluster/nixos/lib/cluster-cidr.nix` — the derivation (Nix twin)
- `full-ai-cluster/nixos/tests/cluster-cidr-golden-vectors.json` — the byte-lock
  between them; text, diffable, replayable
  (`.claude/rules/no-binary-in-proof-lineage.md`)
- `full-ai-cluster/nixos/modules/cluster-network.nix` — options + the three
  Cilium-agreement assertions
- `full-ai-cluster/nixos/modules/injected-server-join.nix` — found vs join
- `full-ai-cluster/nixos/modules/k3s-datastore-preflight.{nix,sh}` — the
  dirty-disk refusal
- `src/Core.TypeScript/hygiene/lint-cluster-cidr-agreement.{ts,test.ts}` ·
  `lint-k3s-datastore-preflight.test.ts` — the CI-executed falsifiers
- `full-ai-cluster/INJECTION-POINTS.md` §5c — the new injection point
- PR #15661 — the analysis that sequenced the CIDR work as F0 and named
  `ssh-ca.nix` as inert. **Nothing in this change depends on `ssh-ca.nix`**; the
  join is authenticated by the k3s token that already travels on the medium, so
  activating the SSH CA is not a prerequisite here and is not claimed to be done.
