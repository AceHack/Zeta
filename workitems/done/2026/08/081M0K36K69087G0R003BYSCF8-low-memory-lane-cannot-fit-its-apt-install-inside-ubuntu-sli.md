---
id: 081M0K36K69087G0R003BYSCF8
type: bug
state: done
priority: P2
slug: low-memory-lane-cannot-fit-its-apt-install-inside-ubuntu-sli
title: "low-memory lane cannot fit its apt install inside ubuntu-slim's hard 15-minute cap -- no apt cache, and the budget cannot grow"
created: 2026-08-21T21:21:31.337Z
completed: 2026-08-22T01:22:59.736Z
depends_on: []
composes_with: []
---

# low-memory lane cannot fit its apt install inside ubuntu-slim's hard 15-minute cap -- no apt cache, and the budget cannot grow

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0K36K69087G0R003BYSCF8-*.md` glob. -->

## Measured

`low-memory.yml` job `core-smoke (ubuntu-slim, low-memory)` failed TWICE on the
same commit `b213b8f8` — attempt 1 and attempt 2 of run 32526035691 — with the
identical mechanism:

    E: dpkg was interrupted, you must manually run 'sudo dpkg --configure -a'
    apt-get install failed rc=100
    apt-get install did not succeed within the 420s apt budget

Two attempts, one commit, same failure: **not a flake.** The lane's recent
history is mixed (fail 20:55, ok 20:36, fail 20:35, ok 20:24, ok 20:20), which
is what a MARGINAL budget looks like rather than a random one — it sometimes
fits and often does not.

## Why the obvious fix is unavailable

The script's own refusal names the remedy: raise `ZETA_APT_BUDGET_SECONDS`, but
"in CI the budget is sized to fit inside the job's `timeout-minutes`, so raise
that first." **That lever does not exist here.** `low-memory.yml:99` sets
`timeout-minutes: 14` with the comment "fail gracefully before the 15-minute
runner-class hard cap", and the file header (`:45`) states the constraint
directly: the budget is sized "while staying inside ubuntu-slim's hard
15-minute job limit". The job cannot grow, so neither can the budget inside it.

## The lever nobody pulled

The lane caches **four** things — .NET SDK (`:105`), mise runtimes (`:111`),
elan (`:119`), NuGet (`:125`) — and does **not** cache apt. The one step that
fails is the only expensive step with no cache. Every run re-downloads the whole
apt set (cvc5, the GHC libs, llvm-18, qemu-utils, …) from scratch inside a
budget that cannot be raised.

## Why it matters beyond one red lane

The header records that ubuntu-slim takes ~10+ minutes against ~1.5 on a normal
runner, and that ubuntu-slim was REMOVED from `gate.yml`'s matrix for that
reason — so this lane exists specifically as the slim-runner canary. A canary
that fails a large fraction of the time on its own toolchain install is one
people learn to skim, and a skimmed lane is how the `Synced+Healthy` job hid a
real defect for 4.5 days earlier today. The failure mode is not "red lane"; it
is "lane nobody reads".

## Options, none of them chosen here

1. **Cache the apt archives** — the missing member of a set of four. Needs
   `/var/cache/apt/archives` plus dpkg state, or an action that does both.
   Highest value, real work, and the only option that keeps the canary honest.
2. **Shrink what this lane installs** — it mirrors `gate.yml`'s sequence by
   design, so diverging costs the parity the lane exists to test.
3. **Move it off `ubuntu-slim`** — which deletes the thing being tested.
4. **Accept and mark it non-blocking** — cheapest, and the one that produces the
   skimmed lane described above.

Filed rather than fixed because (1) is a real piece of work and the other three
each trade away something the lane exists for. Not a knob to turn.


## Resolved — PR #13476, merged as `119a5e88` (2026-08-22)

Option **2** was taken, and the objection recorded above ("it mirrors gate.yml's
sequence by design, so diverging costs the parity the lane exists to test") does
not apply to what was actually done: the lane still runs the same
`./tools/setup/install.sh` through the same code path. What changed is that
`linux.sh` now honours the `tier=` token on `manifests/apt` rows — the mechanism
`macos.sh` has applied to `manifests/brew` since `081KTWQZY7F`, and which
`manifests/apt` had filed against itself in prose ("The right fix is a tier= gate
for apt, which does not exist yet -- filed as DEBT"). `low-memory.yml` already
declared `ZETA_HOST_TIER: slim`; nothing was reading it for apt.

### The measurement above was a budget, not a timing

Worth correcting before the after-numbers, because it changes the diagnosis. The
`420s` in the failure text is the **apt phase budget**, not what apt cost. Read
off the step timings of run `32539360563` (a *passing* run), the apt phase was
**148s**. `linux.sh` sizes the 420s default against its own recorded measurement
of **38.2s** on `ubuntu-24.04` and calls that "~11x" headroom. On a 1-vCPU runner
the identical work costs 148s, so the real headroom on *this* runner was **2.8x**
— which is the whole defect, stated exactly. The budget was sized on a 4-vCPU
measurement and applied to a 1-vCPU host.

### Measured before / after, from step timings on real runs

| | before (`32539360563`) | after (`32542476788`) |
|---|---|---|
| apt phase | **148s** | **46.8s** |
| packages newly installed | 234 | **41** |
| bytes fetched | 626 MB | **40.8 MB** |
| install step | 353s | **245s** |
| whole job vs the 840s cap | 637s = **75.8%** | 483s = **57.5%** |
| apt headroom against the 420s budget | 2.8x | **9.0x** |

Three post-fix runs (`32542476788`, `32542506735`, `32542696797`), all green, apt
phase **46.8s / 66.2s / 36.8s** — 6.3x to 11.4x budget headroom, back in line with
the ubuntu-24.04 ratio the budget was designed around.

Resolved package sets, measured on `ubuntu:24.04` amd64 with universe enabled and
`--no-install-recommends`: every row **388 packages / 713.0 MiB**; slim rows only
**149 packages / 139.7 MiB**. Cold-installed both in a `--cpus 1 --memory 5g`
container through the shipped filter: **271s** full vs **152s** slim, and the slim
set resolves and installs with nothing missing.

### Honest residual — the lane is no longer apt-bound, and it is not yet roomy

`32542506735` used **683s of 840s (81.3%)** while three slim jobs ran
concurrently. Its apt phase was 66s; the extra went to `dotnet build` (239s vs
151s) and the rest of the install step. So the remaining margin is consumed by
runner contention, not by apt — and before this fix that same contention would
have pushed the job past the cap rather than to 81% of it. The next levers, if
the lane tightens again, are the `eprover` autotools **source build (76s)** and
the best-effort agent-CLI installs (**29s**), both inside the same install step
and both irrelevant to a `dotnet build`. Option 1 (cache apt) remains available
and is now cheaper to size. Option 3 (raise the cap) was not taken.

### What this stops detecting

Recorded in `low-memory.yml` beside the declaration rather than left to be
rediscovered: the lane no longer proves the standard-tier packages (agda,
emscripten, llvm, r-base, pandoc, podman, qemu, opam) install on a 1-vCPU / 5 GB
host. They are still installed and exercised on every `ubuntu-24.04` gate job, so
package coverage is unchanged; only that pairing is uncovered, and nothing claims
it — `manifests/brew` has declared those tools out of scope for a slim host since
`081KTWQZY7F`.

### Second defect, found in the same log and fixed in the same PR

The `DPKG RECOVERY` block added 2026-08-18 (`081M096T3AN087G0R0008JZQ7B`) exists so
one mid-`dpkg` kill does not cost all three attempts. It could not work: `timeout`
signals `sudo apt-get`, not the `dpkg` apt-get forked, so the orphan kept
`/var/lib/dpkg/lock` and the recovery ran 40 ms after the kill straight into "lock
was locked by another process with pid 1072". Attempts 2 and 3 lost to the same
lock; by the time it cleared, nothing tried again. It now polls for the lock inside
the same 30s cap and the same shared deadline. That is why run `32526035691` failed
twice on one commit and looked like a hard package error rather than a recoverable
interruption.

### Falsifiers

`src/Core.TypeScript/ci/apt-manifest-host-tier.test.ts` — calls the real
`zeta_filter_manifest_by_tier` through real bash, so it cannot drift from the
installer. Mutation-checked: untagging `agda` fails 3 tests; tagging `libicu74`
tier=standard (cheap, and would leave a slim lane unable to run dotnet) fails 1;
making the filter pass everything through fails 4. It also asserts `low-memory.yml`
still carries `ZETA_HOST_TIER: slim`, because deleting that line silently restores
this bug with nothing red to explain it.
