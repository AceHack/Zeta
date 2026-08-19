---
id: 081M0CPEH40087G0R0016GDSB6
type: task
state: done
priority: P2
slug: make-the-macos-build-and-test-leg-non-blocking-floor-amendme
title: "Make the macOS build-and-test leg non-blocking (floor amendment following Aaron's drift-check classification)"
created: 2026-08-19T09:43:13.280Z
completed: 2026-08-19T17:14:38.568Z
depends_on: []
composes_with: []
---

# Make the macOS build-and-test leg non-blocking (floor amendment following Aaron's drift-check classification)

Split out of `081M0BVAV2H087G0R000VXRYRQ` (the Windows decision) because Aaron named
both platforms in one sentence and they turned out **not** to be in the same state.
Reporting the actual state rather than assuming symmetry is the whole point of this
row.

## What Aaron said

> "windows and mac are drift checks, it's fine to check per pr if we want but we
> don't want to block on them. Also we are moving more and more away from PRs and
> more into sovereign mode without PRs."
>
> — Aaron, 2026-08-19

## The actual state, measured — macOS BLOCKS today

|                          | Windows legs                                  | macOS leg         |
| ------------------------ | --------------------------------------------- | ----------------- |
| `continue-on-error`      | **yes** (`startsWith(matrix.os, 'windows-')`) | **no**            |
| runs on `pull_request`   | no — push-to-main / dispatch only             | **yes, every PR** |
| a failure blocks a merge | no                                            | **yes**           |

Mechanism, precisely, because the comment in `gate.yml` was wrong about it until
2026-08-19: `macos-26` is **not** an independently required status check. The
`CI Gate` ruleset requires exactly one context, `gate (required)`. macOS blocks
_transitively_ — it is a leg of `build-and-test`, `build-and-test` is in the
`gate-required` floor, and the leg carries no `continue-on-error`, so its failure
reds the job, which reds the rollup, which is the required context.

Observed live rather than reasoned about: **run 32138908732** (2026-08-18, commit
`a08891616`) — `build-and-test (macos-26)` the only failed leg, `gate (required)`
concluded `failure`.

Rate, over the seeded window in `data/platform-drift.json` (500 completed push runs,
of which **82 executed** their matrix — 2026-08-15 .. 2026-08-19): `macos-26` failed
**1** time, 1.2%, clean streak 19. `ubuntu-24.04` failed 2 (2.4%) over the same runs.
So macOS is not a noisy leg being tolerated; it is a quiet leg that currently holds
gate authority. For contrast, the two legs Aaron classified as drift checks measured
`windows-11-arm` 12/82 (14.6%) and `windows-2025` 6/82 (7.3%) — non-blocking, all of
it, and none of it blocked anything.

## Why it was not just flipped

Three reasons, in order of weight:

1. **It is a floor amendment, not a workflow edit.** Removing macOS's blocking
   authority narrows what `gate (required)` covers. The `gate-required` header names
   the consent path for exactly this ("Re-adding a job to this list = adding to the
   floor = treaty-amendment consent path"); the same path governs subtracting.
2. **It is a different change from the Windows one.** The Windows decision
   _documents_ a flag that already exists and changes no behaviour. This one changes
   what can block a merge, on the majority platform for the maintainer's own
   development. Landing both in one PR would have made a behaviour change ride along
   inside a documentation change.
3. **macOS runs pre-merge, so the flip has real consequences.** Unlike Windows —
   where flipping `continue-on-error` would change nothing about merges, because the
   legs do not run on `pull_request` at all — a non-blocking macOS leg means a macOS
   break can land. That is a legitimate reading of "drift check", and it is a
   maintainer's call to make with that consequence stated, not inferred.

## What a decision needs to settle

- Non-blocking **and** still per-PR (drift visible early, blocks nothing), or
  non-blocking and moved to push-only (cheaper, one merge of latency)?
- Where the drift is read once it stops blocking. The surface exists —
  `data/platform-drift.json` → the fleet monitor's Platform drift panel — and would
  reclassify `macos-26` from `blocking` to `non-blocking` automatically the first
  time it failed beside a green rollup, because that classification is **observed**,
  not configured.

## Execution, if approved

One-line change in `.github/workflows/gate.yml`:

```yaml
continue-on-error: ${{ startsWith(matrix.os, 'windows-') || startsWith(matrix.os, 'macos-') }}
```

plus updating the asymmetry note in that file's header comment, which currently
states the split as fact.

## Decision (2026-08-19) — approved, both open questions settled

Aaron, closing the row directly:

> "we are moving away from anything that blocks into drift checks instead."

That is the floor amendment this row was waiting on. Landed as written: the
`continue-on-error` expression on `build-and-test` now reads

```yaml
continue-on-error: ${{ startsWith(matrix.os, 'windows-') || startsWith(matrix.os, 'macos-') }}
```

**Q1 — non-blocking AND still per-PR, or moved to push-only?** Non-blocking and
**still per-PR**, and the reason is measured rather than preferred. The two
post-merge read surfaces (`drift-sweep.yml`'s BD001 detector and
`platform-drift-report.ts`) both query `branch=main&event=push`, and **418 of the
last 500 completed push runs were cancelled by the concurrency group before a
single leg executed — 16.4% coverage** (`data/platform-drift.json`, 2026-08-19).
Push-only would have cut macOS observation by ~84% to save minutes the leg was
already spending. The PR run is the one that reliably executes and the one a
human already has open.

**Q2 — where the drift is read once it stops blocking.** Four surfaces, in the
order a human meets them:

0. **The leg's own check run still concludes `failure`** — a red X in the PR's
   checks list beside a green `gate (required)`. Verified against the live API
   rather than assumed: `GET /commits/54492c95ec2e6e31105d698c7ef68d5884daaf38/
   check-runs` reports `build-and-test (windows-2025)` conclusion=`failure` for
   run 31978270082 while that commit's `gate (required)` is `success`. A
   `continue-on-error` job is *not* reported as skipped or neutral. This is the
   surface that makes the macOS flip safe, and macOS gets it in a way Windows
   never did, because macOS runs where humans look.
1. `gate (required)`'s step summary row (`**FAILED (non-blocking)**`), its
   `::warning title=non-blocking failure::` annotation, and its
   `nonblocking-failures` job output — `gate-scope-summary.ts`, which needed
   **no edit** for macOS. That it was already platform-agnostic is the evidence
   it was built as a mechanism rather than a Windows patch.
2. `drift-sweep.yml` BD001 → `docs/drift-events/` post-merge (level, not rate;
   leg name lost to the `Zeta.sln` key).
3. `platform-drift-report.ts` → `data/platform-drift.json` → `data/monitor.html`:
   per-leg rate, clean streak, coverage. It will reclassify `macos-26` from
   `blocking` to `non-blocking` the first time it fails beside a green rollup —
   observed, never read off the flag, so the ledger disagrees with the workflow
   until evidence arrives. That is correct; do not "fix" it.

**The cost, stated not implied.** A macOS-only break now merges. Concretely: run
32138908732 (2026-08-18) would have been a green gate carrying a named
non-blocking failure, and the break would be on main. Measured frequency 1/82
executed runs (1.2%). The Linux leg that still blocks, `ubuntu-24.04`, failed 2
(2.4%) over the same window.

**Guarded against silent re-drift.** Two tests in
`src/Core.TypeScript/ci/gate-scope-summary.test.ts` — one pins the drift-check
platform set against the maintainer's classification and asserts every matrix leg
is classified (so a new leg fails there rather than at a merge); one asserts a
failed `macos-26` leg is *named* by the reporting path. Both were mutation-checked:
reverting the flag fails the first, stubbing `nonBlockingFailure` to `false` fails
the second.
