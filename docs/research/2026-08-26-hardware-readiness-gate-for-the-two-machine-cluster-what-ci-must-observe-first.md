# The hardware-readiness gate for the two-machine cluster — what CI must OBSERVE before a physical session is worth the time

**2026-08-26.** Companion to
[`2026-08-26-usb-boot-verification-in-qemu-what-moved-what-is-costed-and-the-irreducible-hardware-remainder.md`](2026-08-26-usb-boot-verification-in-qemu-what-moved-what-is-costed-and-the-irreducible-hardware-remainder.md)
(same buckets, same `Disputable if:` discipline) and to
[`2026-08-26-multi-node-cluster-on-the-next-flash-derived-cidrs-server-join-and-the-dirty-disk-refusal.md`](2026-08-26-multi-node-cluster-on-the-next-flash-derived-cidrs-server-join-and-the-dirty-disk-refusal.md)
(the design this gates).

The question is **not** "is CI green". It is: *what must be observed in CI
before standing at two machines is worth an hour that could have been spent
in CI instead?* Every row below is either a thing CI can answer more cheaply
than hardware can, or a thing hardware alone can answer — and the second list
is the deliverable, because each of its rows converts directly into physical
work.

---

## 0. The bucket that matters most, and why this document exists

The USB-boot companion uses three buckets. This one needs **four**, and the
new one is the whole point:

- **OBSERVED** — a test ran, asserted it, and the assertion could have failed.
- **WIRED, NOT YET OBSERVED** — the test *exists*, is committed, is referenced
  by a workflow step — and **has never executed even once**.
- **COSTED, NOT BUILT** — known how, not done, with an estimate.
- **HARDWARE-ONLY** — with a physical reason a reader could dispute.

**WIRED is not a weaker OBSERVED. It is a different kind of thing, and
conflating them is the failure this repo is built to prevent.** A committed
test that has never run is indistinguishable, from the outside, from one that
passes: both appear in the workflow, both appear in the file tree, and neither
appears in a failure count. It is the vacuity class at the level of a *suite* —
a check that did not run looking exactly like a check that passed.

As of this writing **every cluster-join VM assertion is WIRED, not OBSERVED**,
and that was invisible until someone read the step list rather than the
conclusion count.

---

## 1. Why nothing has been observed yet — the mechanism, not the blame

`build-ai-cluster-iso.yml` orders the `build-iso` job as:

```
step 7   Show flake metadata
step 8   Check flake evaluates        <-- nix flake check --no-build
steps 9-16  the eight NixOS VM tests
step 17  Build installer ISO
```

Steps 9–16 are `if: success()` descendants of step 8. **A flake-evaluation
failure therefore skips all eight VM tests**, and a skipped step reports no
failure. The job goes red at step 8 and at step 36 (`Locate ISO`), and the
eight assertions in between contribute *nothing at all* — not a pass, not a
fail. On the run inspected (`33014474710`) that is exactly what the per-step
conclusions show: `failure` at 8, then `skipped` ×8.

Two distinct evaluation defects have held that gate shut:

| defect | what it was | status |
|---|---|---|
| `The option 'nodes.server.zeta' does not exist` | `k3s-server.nix` **set** `zeta.k3sDatastorePreflight.enable` and **read** `config.zeta.cluster.{podCidr,serviceCidr}` while importing neither definer. It evaluated only via `common.nix`, which happens to supply both — and threw in every VM test, all of which import the role module directly. | **fixed** on #15668; controlled locally (eval cache cleared, exit 1 → exit 0) |
| `path '/nix/store/…-zeta-vm-cluster-join-server-url' is not valid` | an eval-time path carrying store context that `--no-build` never realises | fix pushed on #15673, **not yet CI-confirmed** |

**A note on the local-verification trap, because it cost three false greens.**
`nix flake check --no-build --all-systems` can pass on a machine whose store
already holds objects from an earlier evaluation of the same command —
realising an already-valid path is a no-op. *A green whose truth depends on
residue from a previous run of the same command is not evidence.* Both nix
results quoted in this document were produced after `rm -rf
~/.cache/nix/eval-cache-v*`, and the fix was checked against a **control**: the
same command on the same tree with the two `imports` blocks reverted exits 1
with CI's exact message.

---

## 2. OBSERVED — a test ran and asserted it

| # | claim | evidence |
|---|---|---|
| `HW-OBS-01` | the CIDR derivation is identical in TypeScript and in Nix | `cluster-cidr-golden-vectors.json` replayed by both `cluster-cidr.ts` and `nixos/lib/cluster-cidr.nix`; a byte-lock, not two implementations agreeing by luck |
| `HW-OBS-02` | the pod CIDR agrees across all four surfaces it is restated on | `lint-cluster-cidr-agreement.ts` + its test |
| `HW-OBS-03` | pool membership is address arithmetic, not a text prefix | `10.143.128.0` is **outside** `10.143.0.0/17` while textually matching it; that case is a test, and it fails under the `startsWith` version this PR replaced |
| `HW-OBS-04` | the flake evaluates at all, for x86_64-linux | `nix flake check --no-build --all-systems`, exit 0, eval cache cleared, with a failing control |
| `HW-OBS-05` | a single-node control plane reaches `active` and serves `/readyz` | the `--cluster-init` token-deadlock regression test, green on main before this branch |

**Note what `HW-OBS-05` does and does not cover:** it is a *single* node. It
says nothing about a second one.

---

## 3. WIRED, NOT YET OBSERVED — committed, referenced by a workflow step, never executed

**This is the gate.** Each row is a step that exists in
`build-ai-cluster-iso.yml` and has never run to a conclusion.

| # | workflow step | what it would prove | why it matters for the physical session |
|---|---|---|---|
| `HW-WIRE-01` | *k3s agent JOINS the server* | a worker's join lands on one virtual segment | the worker half of the two-machine plan |
| `HW-WIRE-02` | **a second CONTROL PLANE joins (one cluster CA, not two)** | the joiner adopts the founder's CA instead of founding a rival cluster | **the single highest-value row.** Two machines that each found a cluster look healthy individually and are not one cluster |
| `HW-WIRE-03` | *dirty disk FAILS CLOSED* | a surviving server datastore stops k3s rather than silently resuming as a server | both target machines are ex-cluster debris slated for reformat — this is the exact case |
| `HW-WIRE-04` | *cluster comes ALL the way up* | node `Ready` + CoreDNS, online | distinguishes "k3s started" from "Kubernetes works" |
| `HW-WIRE-05` | *node platform fixes are live* | rpfilter / iscsi / storage flags actually applied | Cilium requires rp_filter off; a silent revert breaks the CNI |
| `HW-WIRE-06` | *a longhorn PVC BINDS and data survives* | storage is real, not just installed | the first thing a real workload needs |
| `HW-WIRE-07` | *Nix eval checks — CIDR derivation + server-join model* | the model the ISO ships is the model that was checked | the step's own name says "**were unrun**" |

**None of these has produced a single assertion.** Until they do, the correct
statement about the multi-node join path is *"it has never been run"*, not
*"it works"* and not *"it is broken"*.

### 3.1 Two suspected defects the join tests exist to adjudicate

Both were found **by reading** and deliberately left unpatched, because
pre-emptively fixing them would destroy the evidence the VM test exists to
produce. Both are confirmed *present in the source*; **neither has been
observed behaving**, and the distinction is the whole discipline.

**Suspect A — `networking.hosts."127.0.0.1" = [ "control-plane" ];` is
unconditional in `k3s-server.nix`** (line 282), a module every server imports,
founder and joiner alike.

Reading the code narrows the hypothesis rather than confirming it, and the
narrowing is worth recording:

- It is **not** a k3s-join defect. A joining server does not dial the name:
  `injected-server-join.nix` sets `serverAddr := injectedUrl` (an endpoint from
  the flash) together with `clusterInit := false`. The k3s handshake never
  resolves `control-plane`.
- It **is** an open question for **Cilium**, which is pointed at
  `k8sServiceHost: control-plane`. On a *joining* server that name resolves to
  its own loopback, so during bootstrap — before the local API server is
  serving — the joiner's Cilium agent would dial a dead local endpoint rather
  than the founder's live one. Whether that self-heals once the local API comes
  up, or deadlocks because the CNI is what the API needs, is **exactly what
  `HW-WIRE-02` would show and nothing currently does.**

*Do not "fix" this before it runs.* The refined hypothesis is more valuable
than the patch, and a patch would erase the observation.

**Suspect B — etcd 2379/2380 are closed between servers.** `k3s-server.nix`
lines 292–299 exclude them from `allowedTCPPorts` with a stated reason (k3s
embedded etcd binds loopback by default; opening them host-wide risks LAN
exposure if the bind address ever drifts) and an explicit note that multi-server
HA needs them added *with* `interfacesIn`/source-IP scoping.

So this is not an oversight — it is a **single-node decision that the
two-machine plan outgrows**, and the comment says so. The open question is
whether a second control plane can complete its etcd handshake at all with
those ports closed. `HW-WIRE-02` answers it in a VM, in minutes, for free.

**If either suspect is real, the join path cannot work on hardware** — and
learning that in a VM instead of at the machines is the entire reason to run
CI first.

---

## 4. COSTED, NOT BUILT — CI could do it; here is the price

| # | claim | recipe | estimate |
|---|---|---|---|
| `HW-COST-01` | the joiner's Cilium reaches the **founder's** API, not its own loopback | extend the two-server VM test to assert the joiner's `cilium-dbg status` names the founder's endpoint | ~1h on top of `HW-WIRE-02`; needs that test running first |
| `HW-COST-02` | etcd peer traffic actually crosses between servers | add a `nixosTest` assertion on `ss -tnp` peer connections on 2380 | ~1h, same dependency |
| `HW-COST-03` | two servers survive a **restart** of the founder | `machine.shutdown()` / boot in the existing two-node harness | ~2h |
| `HW-COST-04` | the injected-endpoint path is exercised end-to-end from a flashed image | drive `injected-server-join.nix` from a fixture rather than test-supplied values | ~3h |
| `HW-COST-05` | a joiner with a **wrong** token fails closed and loudly | negative case beside `HW-WIRE-03` | ~1h; cheap, and negative cases are where fail-closed claims usually die |

`HW-COST-05` is the one to build first if any are built: every "fails closed"
claim in this tree is unfalsified until something has watched it refuse.

---

## 5. HARDWARE-ONLY — with a reason you could dispute

Each row is physical work at the machines. **This is the list that converts
directly into Aaron's time**, so each says why a VM cannot stand in.

| # | claim | why no VM reaches it | **Disputable if:** |
|---|---|---|---|
| `HW-ONLY-01` | real disk + firmware behaviour: this NVMe/SATA controller enumerates, this firmware boots the written stick | QEMU supplies an idealised virtio/AHCI device and OVMF, not this board's firmware or this controller's quirks | the exact board firmware were obtainable as a QEMU image — then most of this becomes COSTED |
| `HW-ONLY-02` | actual NIC and switch behaviour: link speed, offloads, VLAN/MTU, and whether the switch passes what Cilium needs | a virtual segment has no PHY, no switch ASIC, no offload engine; MTU/VXLAN interactions are where real networks bite | someone runs the same image against a physical switch in CI — i.e. it stops being CI |
| `HW-ONLY-03` | secure-boot **key enrolment**: this firmware accepts these keys and refuses a tampered loader | OVMF can *model* the policy; it cannot tell you this vendor's setup-mode UI enrols correctly, and vendor deviation is the norm | a second emulated firmware that enforces enrolment identically were available — it would then be COSTED, per the USB-boot doc §6.2 |
| `HW-ONLY-04` | USB write endurance: the stick survives repeated flashes | wear is a property of this NAND and controller | you accept "a different stick of the same model" as the subject — a real but weaker claim |
| `HW-ONLY-05` | physical power-cycle retention: state survives a real power cut, not a clean shutdown | a VM `shutdown()` flushes; pulling a plug does not, and that is where fsync bugs and dirty etcd live | a QEMU harness that kills the process **without** flushing host page cache is accepted as equivalent — arguably it is, for the filesystem layer, but not for the drive's own write cache |
| `HW-ONLY-06` | **`/etc/zeta` is visible at `nixos-install --impure` time** | this is an **installer-environment** property, not a booted-guest one: it concerns what the installer process can see *while installing*, before any target system boots. **No booted-guest test can reach it** — a guest test observes the machine after the installer has finished, which is the wrong side of the boundary | someone builds a harness that runs `nixos-install` itself under test and inspects its view of the filesystem — that is COSTED, not impossible, and it is the honest way to move this row |

`HW-ONLY-06` was previously mis-filed as VM-testable. It is recorded here with
the reason, because a row in the wrong bucket is worse than a missing row: it
promises coverage that no test delivers.

---

## 6. The gate, stated as a decision

**A physical session is worth the time once `HW-WIRE-02`, `HW-WIRE-03`, and
`HW-WIRE-04` have produced real assertions** — the second control plane joining
one cluster, the dirty-disk refusal firing, and the cluster reaching Ready with
CoreDNS. Those three are the ones whose failure would send Aaron home from the
machines having learned something CI could have told him for free.

The rest of §3 is worth having and does not gate: a worker join, platform
flags, and a Longhorn PVC all fail in ways that are diagnosable *at* the
hardware.

**What the gate explicitly does not claim:** passing it does not mean the
hardware will work. It means the *known-checkable* failures have been checked,
so a failure at the machines is likely to be one of the §5 rows — which is the
only kind of failure a physical session is the right instrument for.

---

## Pointers

- `full-ai-cluster/nixos/tests/k3s-server-join.nix` — the second-control-plane test (`HW-WIRE-02`), on PR #15673
- `full-ai-cluster/nixos/modules/k3s-server.nix` — suspects A (line 282) and B (lines 292–299)
- `full-ai-cluster/nixos/modules/injected-server-join.nix` — why a joiner dials the injected URL, not the name
- `.github/workflows/build-ai-cluster-iso.yml` — the step ordering that makes an eval failure look like eight silent passes
- [`.claude/rules/toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — WIRED is `unmetered`; only OBSERVED is `metered`
- [`.claude/rules/never-assume-malice-where-mistake-is-possible.md`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md) — the missing imports and the closed etcd ports are single-node decisions the multi-node plan outgrew, not defects anyone hid
