# Cluster-join boot path in NixOS VM tests — what moved, what is costed, and the irreducible hardware remainder

Companion to
`docs/research/2026-08-26-usb-boot-verification-in-qemu-what-moved-what-is-costed-and-the-irreducible-hardware-remainder.md`,
whose three-bucket classification and **Disputable if:** clause this document
borrows unchanged. Same discipline, different subsystem: that one covers the USB
path, this one covers **a control plane joining an existing cluster**.

The frame this list exists inside is already stated in the repo, in four places,
and it is sharper than "things are unproven"
(`docs/history/pr-reviews/PR-13064-design-the-zeta-bootstrap-usb-full-design-doc-for-review-and-it-corrects-proven-.md:45`):

> **The true claim is narrower and sharper: nothing built after 2026-06-21 has
> ever run on metal.** Eight weeks of correct safety work landed on a working
> pipeline with QEMU as the only witness. That is **regression risk on an
> unexercised path** — worse than "never worked", because the June evidence makes
> the current path *feel* proven.

Every row below is written so it can be **argued with**. If a HARDWARE-ONLY
reason is wrong, that row moves to COSTED and Aaron does less physical work.

---

## 1. What moved

PR #15668 shipped the multi-node join — `injected-server-join.nix` (a control
plane joins rather than always `--cluster-init`), CIDR derivation, and a
`k3s-datastore-preflight` unit that fails closed on a dirty disk — and its author
stated plainly that **nothing had booted**. Three items were listed as unverified.
Two of the three are VM-observable and are now wired; the third is not what it
first appeared to be.

| # | JoinBlocker item | verdict |
|---|---|---|
| 1 | systemd unit ordering — does the preflight run *before* k3s, and does `requiredBy` fail the boot? | **now wired** (§2.1, §2.2) |
| 2 | `/etc/zeta` symlink visibility at install-eval time | **misfiled** — see §4.1; it is an *installer-environment* property, not a boot property |
| 3 | segment-addressing chain — does a second node reach the founder and join? | **now wired** (§2.1) |

Two things were also found that were not on anyone's list.

### 1.1 #15668 broke every existing k3s VM test, at evaluation

`k3s-server.nix` and `k3s-agent.nix` both **set** `zeta.k3sDatastorePreflight.enable`,
and `k3s-server.nix` additionally **reads** `config.zeta.cluster.{podCidr,serviceCidr}`.
Neither imported the module defining either option — `k3s-datastore-preflight.nix`
and `cluster-network.nix` are imported only by `common.nix`. Every NixOS VM test
imports the role module *directly*, by design, because that is what makes
`nixosTest` non-vacuous here: it exercises the shipped file rather than a
transcription of it.

Measured, `nix eval .#checks.x86_64-linux.<check>.drvPath`:

| tree | `k3s-control-plane-cluster-init` | `k3s-agent-join` |
|---|---|---|
| `main` (`da6f3ccc02`) | `.drv` | `.drv` |
| #15668 head (`4f7b95eeb3`) | ``error: The option `nodes.server.zeta' does not exist`` | ``error: The option `nodes.agent.zeta.k3sDatastorePreflight' does not exist`` |
| with the fix | `.drv` | `.drv` |

The existing lane **did** catch this — `build-iso` was red on #15668 at its
`Check flake evaluates` step. Worth recording because it is the good case: a
lane that nobody had promoted to blocking caught a regression in the subsystem
it covers, before any hardware was touched.

### 1.2 Two checks that nothing ran

`cluster-cidr-derivation` and `k3s-server-join-model` were added to
`flake.checks` by #15668 and referenced by **no workflow** — no lane runs
`nix flake check` with builds, and the VM steps name each check individually.
Both were checks that could not fail because nothing invoked them. Their
TypeScript twins under `src/Core.TypeScript/hygiene/` *do* run in the bun sweep,
which is why the gap was survivable and also why it was invisible.

---

## 2. What is now wired

Both extend the existing harness in `full-ai-cluster/nixos/tests/`; both are
built by the existing `build-ai-cluster-iso.yml` `build-iso` job, beside the
five VM checks already there. Neither is in `gate (required)`'s `needs`.

### 2.1 `k3s-server-join` — two `role=server` nodes, hermetic

`k3s-agent-join.nix` already boots a server and an **agent** — which has no
datastore, no etcd and no CA. `--server` on a `role=server` node joins an **etcd**
cluster; that is a different code path and it is the one that failed on hardware.

The load-bearing assertion is **not node count**. Two nodes that each founded are
also both "up" — precisely the state of the two machines on the LAN whose CA
founding epochs are twelve days apart. It asserts both nodes hold the **same
cluster CA** (`sha256sum` of `server-ca.crt`), which is the check that told those
two apart, and it reads the **running process's `/proc/<pid>/cmdline`** to pin
that the joiner carries `--server` + `--token-file` and *not* `--cluster-init`,
while the founder carries the opposite — so a join that happened for some other
reason cannot be mistaken for the module working.

Ordering (JoinBlocker 1) is asserted from the **running system**, not by reading
the unit file: preflight `ExecMainExitTimestampMonotonic` < k3s
`ExecMainStartTimestampMonotonic`, with **both asserted non-zero first**, because
a unit that never ran reports `0` and `0 < anything` would pass while proving
nothing.

### 2.2 `k3s-datastore-preflight-fail-closed` — one node, dirty disk

The highest-value row here, because it is the only failure mode in this
subsystem with **no symptom at all**. k3s, verbatim from its own docs: *"If an
etcd datastore is found on disk … the datastore arguments (`--cluster-init`,
`--server`, `--datastore-endpoint`, etc) are IGNORED."* Every option
`injected-server-join.nix` sets is a datastore argument, so a declarative join
onto a dirty disk is a silent no-op with `systemctl status k3s` green throughout.

`lint-k3s-datastore-preflight.test.ts` already executes the refusal *script* over
fixtures. What it structurally cannot reach is whether **systemd honours
`before` + `requiredBy` on a boot**. Rewire that unit `wantedBy` and k3s starts
anyway, the script still exits 1, and every existing assertion still passes — the
vacuity class in unit-file form. So the assertion is that **`k3s.service` never
started**, not that the preflight failed. A canary file seeded inside the
datastore turns the module's "IT DELETES NOTHING" promise into a check.

---

## 3. Classification

Buckets identical to the USB doc, and the third is deliberately not merged into
the second:

- **COVERED** — runs in CI today, with a falsifier.
- **COSTED** — QEMU/CI *can* do it; not built.
- **HARDWARE-ONLY** — a stated physical reason someone could dispute.

A fourth label appears below for this change's own additions: **WIRED, not yet
observed** — built and in the lane, but not yet seen to pass or fail even once.
It is kept distinct from COVERED on purpose, because a check whose colour nobody
has seen is exactly the thing this repository refuses to count. See §6.

| capability | what it asserts | verdict |
|---|---|---|
| founder reaches a working API | `--cluster-init` generates the token, `/readyz` answers | **COVERED** (`k3s-control-plane-cluster-init`) |
| agent joins a server | membership + serial markers | **COVERED** (`k3s-agent-join`) |
| **second control plane joins** | two nodes, **one cluster CA**, correct flags on each | **WIRED, not yet observed** (§2.1, new — see §6) |
| **preflight ordering on a real boot** | `before` + `requiredBy` honoured by systemd | **WIRED, not yet observed** (§2.1/§2.2, new — see §6) |
| **dirty disk fails closed** | k3s does not start; nothing deleted | **WIRED, not yet observed** (§2.2, new — see §6) |
| exactly-one-half refusal | endpoint without token (and vice versa) fails at eval | **COVERED** (`k3s-server-join-model`, now actually run — §1.2) |
| founding is unchanged when neither is supplied | `clusterInit` still true, no `--server` | **COVERED** (§2.1 asserts the founder's cmdline) |
| node reaches `Ready` + CoreDNS | real CNI pulled and running | **COVERED** (`k3s-cluster-online`, online lane) |
| first-boot manifest roster applies | all 11 manifests, no `mkForce` | **COVERED but not on PR** — `k3s-first-boot-roster.nix` is manual/nightly (needs internet + KVM) |
| `/etc/zeta` visible to **`nixos-install`** eval | the installer's own evaluation sees the staged symlinks | **COSTED** (§4.1) |
| three-node etcd quorum / HA | quorum survives one loss | **COSTED** (§4.2) |
| joining by **IP** rather than by name | endpoint form the installer actually stages | **COSTED** (§4.3) |
| etcd peer ports between servers | 2379/2380 reachable server-to-server | **COSTED** (§4.4) |
| real NIC / switch / link behaviour | the join survives the physical L2 | **HARDWARE-ONLY** (§5.1) |
| **serial console carries the evidence** | the markers are observable on the target | **HARDWARE-ONLY** (§5.2) |
| disk durability under power loss | etcd WAL survives a real power cut | **HARDWARE-ONLY** (§5.3) |
| internal-vs-USB disk discrimination | installer picks the right disk | **HARDWARE-ONLY** (§5.4) |
| secure-boot enrolment | firmware is in Setup Mode and keys enrol | **HARDWARE-ONLY** (§5.5) |
| TPM presence / sealing to real PCRs | a TPM exists and seals | **HARDWARE-ONLY** (§5.6) |
| GPU node labelling verdict | the PCI probe's answer on real silicon | **HARDWARE-ONLY** (§5.7) |

---

## 4. COSTED — QEMU/CI can do this; it is not built

### 4.1 `/etc/zeta` visibility during `nixos-install` evaluation

**This is JoinBlocker 2, and it was filed against the wrong layer.**
`injected-server-join.nix` reads its inputs at **Nix evaluation** time. On
hardware that evaluation happens *on the target*, inside `zeta-install.sh`'s
`nixos-install --impure`, against the `/etc/zeta/*` symlinks the installer just
staged (`zeta-install.sh:3064-3074`, `maybe_symlink`, commented "so Nix
evaluation sees what the installed system will see").

A booted-guest test **cannot** speak to this, and not because of any hardware
limit: in a `nixosTest` the evaluation happens on the *build machine*, where
`/etc/zeta` does not exist and never will. The subject is the **installer
environment**, so the lane that owns it is the installer lane
(`docker-nixos-install-sh-test.yml`), not a VM boot test. Recorded here so the
item is not mistaken for covered by §2.1, which drives the module through its
options instead.

This is also the single most dangerous item in the family, by the module's own
header: pure eval makes `builtins.pathExists` return **false**, which reverts a
joining server to a **founding** one — re-founding a sovereign cluster on a node
that was a member.

### 4.2 Three-node etcd quorum

§2.1 boots **two** control planes, which is enough to prove *join*, and is
deliberately not a claim about HA — two members is an even quorum and strictly
worse than one for availability. A three-node test would cost roughly one more
VM boot (~30–60 s on the measured runner) and would assert quorum survival.

### 4.3 Joining by IP rather than by name

§2.1 uses `https://control-plane:6443`, matching the committed fixture and the
shipped `--tls-san=control-plane`. `zeta-install.sh:1983` accepts any
`^https://[A-Za-z0-9._:-]+$`, so an IP endpoint is expressible and untested;
whether the API certificate's SANs cover it is a real question and a cheap one.

### 4.4 etcd peer ports between servers

`k3s-server.nix:266-278` deliberately omits 2379/2380 from `allowedTCPPorts`,
with a comment saying multi-server HA should add them *scoped by source IP*.
Whether a second control plane can join with them closed is exactly what §2.1
exercises; if it goes red there, this row is the reason and the fix is scoped
per that comment. **At the time of writing this has not yet been observed either
way** — see §6.

---

## 5. HARDWARE-ONLY, with a per-item reason

The repo already has a house sentence form for this, and it is better than
"QEMU cannot" because it says *why* in the same breath:

> **X is a measured fact, not a declared one.**

Verbatim at `secure-boot.nix:62-64` and `tpm2-seal-prereqs.nix:69-74`.

### 5.1 Real NIC, switch and link behaviour

QEMU's shared segment is described in the repo's own words as
*"a bare QEMU socket in the harness; a plain switch on hardware"*
(`injected-cluster-address.nix:9`). Link negotiation, MTU/jumbo behaviour, VLAN
tagging, and spanning-tree convergence delay at boot have no model in that
socket. §2.1 proves the join works over *a* segment; it cannot prove it works
over Aaron's switch.

**Disputable if:** the specific failure suspected is one QEMU can express (packet
loss, reordering, delay are all injectable via netem in a guest) — in which case
that failure moves to COSTED. What stays here is *this switch's* behaviour.

Note what is **not** in this row: name resolution and address assignment on the
segment. `injected-cluster-address.nix:57-69` says its unverified items need
*"a booted guest on a real segment"* — a **guest**, which two concurrent QEMU
VMs satisfy. That is COSTED, not hardware.

### 5.2 The serial console may not exist on the target

An **observability** row rather than a functionality one, and it constrains the
test *method* rather than the system. `k3s-join-observer.nix:143-147`, verbatim:

> No serial device present (**bare metal with no UART**) is not an error — the
> journal still carries every line.

Every VM test in this family asserts through a channel the metal node may lack.
The mitigation already exists (the journal carries the same lines) but the
*equivalence* is asserted, not measured. Stated because it is currently unstated
anywhere as a limit on the method.

The same shape appears one layer down: `zeta-creds-restore.nix:266-284` marks
`qemu-fw_cfg` as **"HYPERVISOR ONLY — metal has no such node, ever"**, with the
metal path being `systemd-ask-password` on tty1, and records
`metal-capable=no … this run proves NOTHING about the tty1 path on hardware`.
That is the discipline this row imitates.

**Disputable if:** the target machines do have a UART, which is a fact about
those boxes and answerable by looking at them.

### 5.3 Disk durability under power loss

etcd's WAL correctness under an abrupt power cut depends on drive write-cache
behaviour, barrier/FUA honouring, and power-loss-protection capacitors. QEMU can
simulate an abrupt *VM* kill — which covers the software half — but models no
storage device's cache semantics. Durability is a measured fact about the drive,
not a declared one.

**Disputable if:** the claim is narrowed to "etcd recovers from an unclean
shutdown", which *is* QEMU-observable and would then be COSTED. The irreducible
half is whether the device lied about having flushed.

### 5.4 Internal-vs-USB disk discrimination

A case where emulation fidelity **actively blocks** a correctness tightening.
Per `docs/research/2026-08-21-one-pipeline-end-to-end-where-the-usb-to-cluster-chain-actually-stops.md:21-25`, the installer's
internal-disk filter is `$5 != "usb"` — *not known to be USB* rather than *known
to be internal* — and `/dev/vda` is exactly that case, so tightening it *"would
red the entire QEMU lane"*. The mitigation is physical: unplug external drives
before first boot.

**Disputable if:** a QEMU disk can be made to report a `tran` string that
distinguishes it. Then the filter tightens and the lane stays green.

### 5.5 Secure-boot key enrolment

`secure-boot.nix:62-64`: *"no software can put its own firmware into UEFI Setup
Mode, so enrolment is a measured fact, not a declared one."* The desired-state
model is already checked in CI (`secure-boot-desired-state-model`) and refuses to
carry a custody decision at all.

**Disputable if:** OVMF's own varstore is accepted as a stand-in for *policy*
testing — the USB companion doc argues in its §5.2 that half of this is COSTED,
not hardware, and that argument applies here unchanged. What no emulator settles
is whether *this* machine's firmware enrols.

### 5.6 TPM presence and sealing to real PCRs

`tpm2-seal-prereqs.nix:69-74`: *"no OS can enable its own firmware TPM (Intel PTT
/ AMD fTPM is a setup-console setting), so presence is a measured fact, not a
declared one."* `swtpm` makes a *simulated* TPM available, so the sealing
mechanism is testable; what is not is sealing to PCR values produced by this
machine's real firmware measurements.

**Disputable if:** the claim is only "the seal/unseal code path works" — that is
COSTED via `swtpm`.

### 5.7 GPU node-label verdict

`nvidia-open-guard.nix:55-58`: the unit's *"VERDICT needs real NVIDIA silicon,
which CI does not have."* `gpu.nix:95-97`: *"NixOS cannot condition this at eval
time — GPU presence is a runtime fact about the target box."* The label's
*generation* and its consumer's `nodeSelector` are already checked
(`gpu-node-label-preflight`).

### 5.8 Two rows deliberately NOT on this list

Stated because their absence is a finding, not an oversight:

- **PCI/VFIO passthrough.** `gpu-passthrough.nix` is configuration only; no
  hardware-impossibility claim exists anywhere in the repo. Not added without
  evidence.
- **WiFi on the cluster path.** No hardware-impossibility claim for the cluster
  path. `INJECTION-POINTS.md:101-111` files WiFi-on-ESP as *"a divergence, not an
  exception"* — a **secrets-policy** matter scoped to the USB installer lane, not
  an emulation gap here.

Both are **absence of evidence from a bounded search**, not proof of absence.

---

## 6. Register

**Metered.** The evaluation results: all twenty `checks.x86_64-linux.*` evaluate
under `nix flake check --no-build --all-systems`, the command CI runs, verified
locally. The before/after in §1.1 (`nix eval … .drvPath` on three trees). The
per-step runtime measurements in the cost table below, read from run
`33005347047`.

**A local green that was a check passing for the wrong reason.** Worth recording
because it is this document's own subject matter turned on the author. Two
successive spellings of the test's eval-time inputs went green under
`nix flake check --no-build --all-systems` on this machine and then red on CI
with `error: path '/nix/store/…' is not valid`. The mechanism, from CI's trace:
`builtins.pathExists` on a string carrying **store context** must *realise* that
context, and `--no-build` realises nothing. Both `"${./fixture}"` and
`builtins.toFile` attach context; `toString` does not. The local runs passed only
because this machine's store already held the objects from earlier evaluations —
realising an already-valid path is a no-op. Deleting those paths first reproduces
CI's failure exactly, **same store hash and all**, and the fixed version then
passes the same faithful check. The lesson generalises past Nix: a green whose
truth depends on residue from a previous run of the same command is not evidence.

**NOT yet metered — and this is the honest state of §2.** The two new VM checks
have **not yet been observed green**. This machine is `aarch64-darwin` with no
`/dev/kvm` and no Linux builder, so their assertions cannot run locally at all;
first green/red comes from the lane itself. Three CI attempts (runs `33013286101`,
`33014165993`, and the one following this document's last commit) went **red at
evaluation** on the string-context defect described above — a defect in my own
test scaffolding, not in the modules under test — and every VM step behind it was
**skipped**, so no VM assertion in §2 has executed even once. Treat §2's rows in the §3 table as
*wired*, not as *observed*, until a run shows otherwise. The designed mutation
proof (rewire `requiredBy` → `wantedBy`, expect red on §2.2) is likewise
**not yet executed**.

**Consistent with, not metered.** That a second control plane joins over a
physical switch as it does over the QEMU segment. One segment implementation is
one data point — the same caution the USB doc applies to OVMF.

**Speculative.** The costs in §4, extrapolated from the measured per-step times
rather than built.

**Cost, measured** (run `33005347047`, `build-iso`, `ubuntu-24.04`):
cluster-init **70 s**, platform-fixes **54 s**, agent-join (two nodes) **67 s**,
cluster-online **130 s**, longhorn-volume-binds **256 s**. Two VMs booting k3s in
67 s is not TCG, so `/dev/kvm` is live on these runners. That settles a
disagreement inside this repo: `build-ai-cluster-iso.yml:207` asserts KVM is
present, `k8s-argocd-health-test.yml:1258-1262` cites GitHub's docs saying nested
virtualization *"is not officially supported"*. Both are defensible as written;
the empirical answer is that the accelerated path is what runs today, and every
VM step carries `--fallback` regardless.

**A note on this file's own lint status.** `markdownlint` ignores
`docs/research/2026-*-*.md`, so a green lint run here is a check that did not
run, and no claim is made from it.

**Pointers.**

- `full-ai-cluster/nixos/tests/k3s-server-join.nix` ·
  `k3s-datastore-preflight-fail-closed.nix` — the two new checks
- `full-ai-cluster/nixos/tests/k3s-agent-join.nix` · `k3s-cluster-init.nix` ·
  `k3s-cluster-online.nix` · `k3s-first-boot-roster.nix` — the harness extended
- `.github/workflows/build-ai-cluster-iso.yml` — the lane; **not** in
  `gate (required)`'s `needs`, per the tiering rule (promotion is the
  maintainer's call)
- `docs/research/2026-08-26-usb-boot-verification-in-qemu-*.md` — the companion
  this borrows its buckets and its **Disputable if:** clause from
- `docs/research/2026-08-26-k8s-pre-hardware-verification-census-four-depths-*`
  (PR #15592, **in flight at time of writing, not on `main`**) — the four-depth
  census the USB doc cites; this document does not restate its rows
- `docs/research/2026-08-13-cluster-joining-is-blocked-on-an-absent-join-not-on-qemu-networking.md`
  — the earlier finding that the blocker was the absent join, not the emulated
  network, which §5.1's scoping preserves
- `docs/runbooks/2026-08-16-first-metal-bringup-preflight.md` — where the
  HARDWARE-ONLY rows become physical work
