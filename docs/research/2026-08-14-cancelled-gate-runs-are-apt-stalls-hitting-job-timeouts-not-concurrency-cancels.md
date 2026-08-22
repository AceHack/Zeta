# Cancelled `gate` runs are apt stalls hitting job timeouts — not concurrency cancels

**Date:** 2026-08-14 · **Author:** Dejan (devops-engineer) · **Status:** diagnosis complete;
fix + bounded recovery in the same PR. Awaiting maintainer sign-off per round-29 discipline.
**Work-item:** `081M0104E7Y087G0R002X9A6NB`

> **Sibling, independent:** workflow runs also stall in `action_required`, which produces the
> same observable (a check that never ran, presented as one that did) via a completely
> different mechanism — the heartbeat push credential. Diagnosis:
> `docs/research/2026-08-14-action-required-holds-are-a-push-credential-identity-problem-not-the-cancellation-root-cause.md`
> (`081M010H4KE087G0R00092AYZS`). The merge queue has TWO independent silent-stall mechanisms;
> this document covers one of them.

## The brief's hypothesis, and why it was wrong

The task named a leading hypothesis: a `concurrency:` group too coarse, with
`cancel-in-progress: true`, letting unrelated runs cancel each other. It asked for evidence
from run metadata rather than from reading YAML. The evidence **refutes it for the class
that matters**, and the refutation is the useful part of this document.

`gate.yml` already keys concurrency per-PR and only cancels for PR events:

```yaml
group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

That is not a coarse key. Narrowing it further would have changed nothing, and shipping
that narrowing would have been a fix aimed at a cause that was not operating.

## What the data actually says

Population: 100 `gate` runs over 2h18m (2026-08-14 18:14Z–20:32Z), captured with
`gh api repos/:owner/:repo/actions/workflows/gate.yml/runs`. Fixture:
`src/Core.TypeScript/ci/fixtures/gate-runs-2026-08-14.json`.

| conclusion      | n      |
| --------------- | ------ |
| success         | 44     |
| **cancelled**   | **37** |
| action_required | 17     |
| failure         | 2      |

The 37 cancellations split cleanly on one test — _does a newer run exist for the same
branch?_

- **27 superseded.** A newer run replaces them. This is `cancel-in-progress` doing its job,
  and it is benign: the branch still gets a verdict. The concurrency hypothesis explains
  **this** class, which is the class that was never a problem.
- **10 orphans.** Cancelled with no replacement. These are the ones that block a merge, and
  none of them is a concurrency cancel.

### Every orphan is a job timeout

Each orphan's cancelled job ran for its own declared `timeout-minutes`, plus the runner's
graceful-shutdown window:

| job                        | timeout-minutes | budget | observed | delta |
| -------------------------- | --------------- | ------ | -------- | ----- |
| lint (Rust)                | 15              | 900s   | 916s     | +16s  |
| lint (Python)              | 15              | 900s   | 916s     | +16s  |
| lint (no conflict markers) | 15              | 900s   | 916s     | +16s  |
| lint (markdownlint)        | 12              | 720s   | 737s     | +17s  |
| lint (TS)                  | 12              | 720s   | 735s     | +15s  |
| lint (shellcheck)          | 12              | 720s   | 736s     | +16s  |
| lint (§33 migration xrefs) | 12              | 720s   | 736s     | +16s  |
| lint (archive header §33)  | 12              | 720s   | 736s     | +16s  |
| lint (Go)                  | 15              | 900s   | 915s     | +15s  |
| lint (semgrep drift)       | 20              | 1200s  | 1215s    | +15s  |

**10 of 10**, each against its _own_ differing budget. Three distinct timeout values
(12/15/20) each reproduced exactly. That is an identification, not a coincidence of counts:
a concurrency cancel arrives when a _sibling run_ starts, which has no reason to coincide
with three different per-job budgets.

Note also that these are **lint** jobs — short ones. The brief expected
`full-verify (7-lang oracle + cost + proofs)` and
`cross-verify (trust-core oracles + ace suite)`, the long lanes. They were not the
victims; in the orphan runs `cross-verify` finished successfully in 373s. **Correction to
the brief.**

### Where they hang

12 of the 14 hung jobs stalled in the same step, `Install toolchain via three-way-parity
script (GOVERNANCE §24)`. The other two were `Run Semgrep` and `Run markdownlint`. Step
trace from run `31835308075`, job `lint (Rust)`:

```
19:53:48  Checkout                                    success
19:54:07  Cache install.sh outputs                    success
19:54:07  Install toolchain via three-way-parity ...  CANCELLED  (19:54:07 -> 20:08:35)
20:08:35  Run Rust Lint Script                        skipped
```

Inside that step, from the job log:

```
19:56:34  Get:123 opam-installer   [1256 kB]
19:57:09  Get:124 opam            [2584 kB]
19:58:08  Get:125 pandoc-data      [92.4 kB]     <-- 59s for 92 KB
19:58:11  Get:126 pandoc          [26.9 MB]      <-- never completes
20:08:35  ##[error]The operation was canceled.
```

`azure.archive.ubuntu.com` decayed from 8083 kB/s (during `apt-get update`, seconds
earlier) to roughly 1.5 kB/s, then stopped without closing the connection.

## Why both existing guards missed it

Two mechanisms already existed and neither could act:

1. **apt's own timeouts.** `Acquire::http::Timeout` is an _inactivity_ timer. A slow trickle
   keeps resetting it, so the transfer is never idle long enough to trip. The socket is
   alive; it is just not making progress.
2. **The 5-attempt retry wrapper in `gate.yml`.** It guards **failure** —
   `if ./tools/setup/install.sh; then exit 0; fi`. A hung `apt-get` never returns, so the
   loop never reaches its second iteration. The retry was not broken; it was
   **unreachable**.

This is the general shape worth keeping: _a retry bounds failure, not duration._ Only a
wall-clock bound converts a hang into a state a retry can act on.

## The fix

**Root cause — `tools/setup/linux.sh`.** Wrap `apt-get install` in coreutils `timeout`
(default 600s, `ZETA_APT_TIMEOUT_SECONDS`) with 3 attempts and explicit
`Acquire::Retries` / `Acquire::*::Timeout`. A stall now exits 124 and retries; exhaustion
still fails loudly, so the assert is preserved and no package error degrades to a
false-green. It lands in `linux.sh` rather than in the workflow so the dev laptop, the CI
runner and the devcontainer all get the identical bound (GOVERNANCE §24).

**Residual — `.github/workflows/rerun-cancelled-gate.yml`.** Two of the 14 hangs were in
other steps, and infra cancellations will always exist, so a bounded recovery is still
warranted. Policy in `src/Core.TypeScript/ci/rerun-cancelled-gate-run.ts`, four guards:

| guard | rule                             | why                                                                                                     |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1     | `conclusion == "cancelled"` only | re-running a genuine `failure` converts a real red into a flaky green — strictly worse than the bug     |
| 2     | `run_attempt == 1` only          | one automatic rerun per run id, enforced by GitHub's own counter, so the ceiling needs no state of ours |
| 3     | not superseded                   | 27 of 37 had a newer run; re-running those is pure waste (~73% of all reruns)                           |
| 4     | not stale (>180 min)             | an old cancellation is history, not a stuck merge                                                       |

It re-runs via `rerun-failed-jobs`, not `rerun`: the orphan runs had 26–28 jobs already
green and 1–2 cancelled, so a full re-run would burn ~28× the minutes and discard good
results.

## Evidence that the recovery both fires and declines

A recovery that cannot fail is the thing this repo is trying to stop building, so both
directions are demonstrated rather than asserted.

- **Mutation testing.** Each of the four guards was deleted in turn, plus the safety
  property inverted. All 5 mutants were caught by the test suite (5/5).
- **Live dry-run against production runs.** Fires on real orphans
  (`31835308075`, `31832877793`, `31830257631`); declines on the two real failures
  (`31833438504`, `31836978023`), on a superseded cancel (`31827721951`), on an
  already-retried cancel (`31831794385`), and on a success (`31827822179`).
- The apt guard was exercised against a stalling stub: bounded exit 124; a genuine package
  error still exits 100; a transient stall recovers on attempt 2.

## Open questions for the maintainer

1. **`main`-push concurrency.** `push` runs on `main` share one group
   (`gate-refs/heads/main`) with `cancel-in-progress: false`. GitHub keeps at most **one
   pending run per group**, so rapid successive commits cancel each other's _pending_ runs
   — this is 20 of the 37 cancellations. The header comment states the intent as "main
   pushes queue so every main commit gets a record", and the current key does **not**
   deliver that. Options: (a) per-SHA group — a record per commit, more minutes; (b) accept
   the coalescing and correct the comment. **This is the one place the "coarse concurrency
   group" hypothesis is genuinely right** — but it explains the benign class, not the
   merge-blocking one.
2. **Retry-wrapper coverage.** ~15 of ~64 `install.sh` call sites in `gate.yml` have the
   5-attempt wrapper; none has a hang guard. Extract to a composite action?
3. **`timeout-minutes` values.** Several lint jobs budget 12–20 minutes for work that
   normally takes seconds. Generous budgets turn a stall into a long, expensive
   cancellation. Worth a pass once the apt fix is measured.

## Anchors

- Goguen & Meseguer (1982), noninterference — the policy takes its clock by injection
  (`options.now`) rather than reading it ambiently, so decisions replay deterministically.
- GitHub Actions docs, `concurrency` — "any previously pending job or workflow in the
  concurrency group will be cancelled", the semantics behind open question 1.

## 2026-08-18 correction — the guard above could not run to completion

The fix this document records was correct in mechanism and wrong in budget, and the
wrongness made it **unreachable**. Recorded here rather than in a new document because it
is the same defect one layer up, and splitting it would hide that.

**The arithmetic, measured.** The guard bounded each `apt-get install` at
`ZETA_APT_TIMEOUT_SECONDS=600` and retried three times with 15s + 30s of backoff:

|                                     | worst case                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 3 × 600s attempts                   | 1800s                                                                                                      |
| backoff                             | 45s                                                                                                        |
| **retry budget**                    | **1845s = 30.75 min**                                                                                      |
| tightest job that runs `install.sh` | **300s = 5 min** (`ci-cache-paths-lint`, `budget-snapshot-cadence`, `manifesto-citation-snapshot-cadence`) |
| tightest `gate` job                 | 720s = 12 min (`cross-verify`, `lint-shell`, `lint-typescript`, `lint-markdown`, …)                        |

A single attempt already exceeded the tightest job. So on a stalling mirror `apt-get`
returned — the guard worked — into a loop the job never lived long enough to finish, and
the job was still killed at `timeout-minutes` and still reported `cancelled`. **A guard
that cannot run to completion is the vacuity class**: it looks like protection and
constrains nothing. Live instances: `95796893156`, `95796898144`, `95797644804`,
`95797644737`, `95796898139`, and `ci-cache-paths-lint` at 2026-08-18T18:26Z killed at its
5-minute mark. And `apt-get update` was never wrapped at all, so a stall there had no
ceiling of any kind.

**The fix: one shared deadline, not a per-attempt timeout.** `tools/setup/linux.sh` now
takes a single wall-clock deadline for the whole apt phase; `update`, every install
attempt, the `dpkg --configure -a` recovery and every backoff draw a slice of what is
_left_ of it. Three attempts therefore cannot exceed the budget whatever each one does,
and the arithmetic survives a later change to the attempt count, the backoff, or
`timeout-minutes` — which a fixed per-attempt timeout does not. Defaults:
**420s under `GITHUB_ACTIONS`**, 1800s elsewhere, `ZETA_APT_BUDGET_SECONDS` overrides
both. The healthy phase measures **38.2s** on `ubuntu-24.04` (run `32151321559`, 553 MB
fetched), so the CI default is ~11x observed cost.

**The slice is WEIGHTED, and the first draft was wrong about that.** It shipped at a
150s budget split evenly across the attempts, and job `95859213848` measured the result
live: slices of **45s / 38s / 8s**. 45s against a 38.2s healthy cost bounds a _stall_
correctly and false-fails a mirror that is merely _slow_ — a worse trade than the bug it
replaced, because the two failure modes want opposite things. A slow mirror needs
continuous time (one long attempt succeeds where three short ones all fail); a wedged one
needs a fresh connection (only a retry gives that). So the first attempt now takes 60% and
the retries share the rest, the last takes everything still on the clock, and backoff
never spends more than a quarter of what remains — clamping backoff only to `remaining`
let the sleeps drain the budget before the last attempt, which is the retry loop going
decorative again by another route.

What pinned the budget at 150s was three **five-minute** cadence jobs
(`budget-snapshot-cadence`, `ci-cache-paths-lint`, `manifesto-citation-snapshot-cadence`),
whose `timeout-minutes` is the ceiling on the whole fleet's apt budget. They were raised
to 12 minutes: a timeout is a cap, not a reservation, and they finish in ~2.5 minutes, so
on the healthy path it costs zero additional CI minutes. The binding job is now the 10
minute `git-hotspot-cadence`: `420 + 10 + 120 = 550 ≤ 600`.

Two defaults is not parity drift (GOVERNANCE §24): both legs run the identical deadline
code and honour the identical override. Only the _constant_ differs, because the
constraint being reconciled — an outer job timeout that converts an overrun into
`cancelled` — exists only in CI. A laptop has no outer killer, and a CI-sized 150s would
false-fail a cold 553 MB fetch over a home link.

**Falsifiers** (`.claude/rules/toy-is-free-metered-must-be-earned.md` — the 2026-08-14
guard shipped with none, which is why nothing was red):

- `src/Core.TypeScript/hygiene/apt-phase-wall-budget.test.ts` runs the real `linux.sh`
  against a simulated stalled mirror and asserts it returns, non-zero and readable, inside
  its budget. Verified to FAIL against the pre-fix script — it times out, which is the
  symptom itself.
- `src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts` parses the budget out
  of `linux.sh` and every `timeout-minutes` out of every workflow that runs the installer,
  and asserts `budget + kill-grace + 120s pre-apt reserve ≤ tightest job`, **per budget
  class**: `docker build` passes no `GITHUB_ACTIONS`, so a containerized install leg gets
  the local default and must be judged against it, and its `run:` names a Dockerfile
  rather than the installer — checking only the direct-`run:` jobs against only the CI
  number would have left that class silently unaudited, which is this document's own
  defect wearing a checker's face. Currently `ci: 280s ≤ 300s`,
  `local: 1930s ≤ 2700s`, 45 jobs. NixOS containers are excluded because `/etc/NIXOS`
  short-circuits the whole apt phase. It is the edge between numbers that live in
  different files and were never diffed together; open question 3 above is now
  machine-checked rather than "worth a pass".
