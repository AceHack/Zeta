---
id: 081M3BYVX0R087G0R0025VPVVS
type: task
state: in-progress
priority: P2
slug: first-boot-replica-a-constrained-resource-mode-matching-the
title: "first-boot replica: a constrained resource mode matching the installed-disk guest envelope"
created: 2026-09-25T09:38:11.096Z
depends_on: []
composes_with: []
---

# first-boot replica: a constrained resource mode matching the installed-disk guest envelope

## The gap

Two lanes boot the same roster and report very different numbers.

| lane | most recent full run | result |
|---|---|---|
| Docker replica (`cluster/first-boot-replica.ts`) | run 36108486753, 2026-09-25, 65 min | 42 Applications: **35 Healthy, 5 DIVERGENCE, 2 FAIL**; stages 1-5, 7, 8 PASS incl. a hard `docker kill -s KILL` recovery |
| installed disk (`ci/qemu-full-install-test.ts`) | dispatch 36097310492 | peak **25 of 35** Synced+Healthy, regressed to **13 of 35**; ArgoCD repo-server timing out on manifest generation |

MEASURED cause of the divergence, recorded by WP32 in `buildDockerRunArgs`' own
docstring: the replica sets **no `--cpus`, no `--memory`, no `--cpuset-cpus`**.
The container gets the whole runner with no hypervisor tax; the installed-disk
guest gets `-m 12288 -smp 4` inside a 4-vCPU runner that is *also* running QEMU.
So a green replica run is evidence the roster is **internally consistent** and is
**not** evidence that it converges on constrained hardware — and asking the
constrained question costs a ~90-minute ISO build every time.

## What landed

A **second mode**, not a replacement. `--constrained` applies the installed-disk
guest's own envelope; the default argv is byte-identical to the pre-WP33 one, so
no baseline recorded in that file moves.

1. **Derived, never hardcoded.** `K3S_VERIFY_CPU_COUNT` / `K3S_VERIFY_MEMORY_MB`
   are now exported from `ci/qemu-full-install-test.ts` and imported.
   `resolveConstrainedLimits` **REFUSES** (exit 2, before anything expensive
   starts) rather than substituting a guess if they stop being usable numbers.
   A falsifier pins that no second copy exists: re-type the number in the
   replica and drift the source and the test goes red in milliseconds.
2. **Swap denied, and that is derived too.** `--memory-swap` equals `--memory`
   because `hosts/control-plane/hardware-configuration.nix` declares
   `swapDevices = [ ]`. Docker's default (2x) would hand the container 12 GiB of
   the runner's swapfile the real node does not have, and memory pressure would
   surface as thrash instead of the OOM kill the guest would take.
3. **The mode is reported on every run** — stdout, the JSON report, and the top
   of the step-summary table: `mode=constrained cpus=4 memory=12288m host-cpus=N
   host-memory=Nm cpu-limit-binds=... memory-limit-binds=...`.
4. **And the `*-binds` verdict is load-bearing, not decoration.** Both lanes run
   on `ubuntu-24.04` (4 vCPU / ~15.9 GiB), so `--cpus=4` there is at or above
   what the host would give anyway and **does not bind**. Printing
   `mode=constrained cpus=4` and stopping would let a green read as "converges
   under the installed-disk CPU budget" when CPU was never restricted — a check
   indistinguishable from its own absence. The memory limit *does* bind, and so
   does the swap denial.

## Where it runs, and the measurement behind the choice

Schedule + `workflow_dispatch` only; **not** on `pull_request`. The five most
recent completed runs of the unconstrained job took **64-70 minutes** each
(36108486753: 07:36:19Z -> 08:41:16Z = 65 min). The constrained job runs the same
eight stages with strictly less memory and no swap, so it cannot be cheaper.
Neither job is in the required gate, so a per-PR constrained run would buy no
blocking signal for ~65 extra runner-minutes on every roster PR. On schedule and
dispatch **both** jobs run in parallel on the **same commit** — that is the
controlled side-by-side, and it is what makes the two numbers comparable.

## The prediction this lane is the cheap way to test

From WP32 (#17666): the roster over-commits the guest's **memory** at both rungs
(dev 1.47x), and that never bit only because CPU starvation stopped 14 of 49
Applications from ever being created. So after that fix the failure mode should
**move to memory, not vanish**. This lane binds memory and denies swap while
leaving CPU effectively unbound — which is precisely the configuration in which
that prediction is falsifiable.

Three outcomes, all findings, none of them relaxed to get a green:

- converges **as well as** unconstrained -> the installed-disk regression has a
  cause other than the resource envelope, and that is worth knowing;
- fails **with memory pressure** -> WP32's prediction confirmed from a third
  substrate, in minutes rather than 90;
- fails **some other way** -> a named per-Application verdict either way.
