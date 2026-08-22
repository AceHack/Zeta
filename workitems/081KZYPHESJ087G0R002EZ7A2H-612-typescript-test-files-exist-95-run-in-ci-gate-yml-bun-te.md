---
id: 081KZYPHESJ087G0R002EZ7A2H
type: bug
state: backlog
priority: P2
slug: 612-typescript-test-files-exist-95-run-in-ci-gate-yml-bun-te
title: "612 TypeScript test files exist, ~95 run in CI - gate.yml bun test covers two directories and nine named files"
created: 2026-08-13T23:15:27.154Z
depends_on: []
composes_with: []
---

# 612 TypeScript test files exist, ~95 run in CI - gate.yml bun test covers two directories and nine named files

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYPHESJ087G0R002EZ7A2H-*.md` glob. -->

## The measurement

**CHECKED**, 2026-08-13, against `origin/main`:

- `*.test.ts` under `src/` + `tests/`: **612**
- Covered by a `bun test` invocation in `.github/workflows/gate.yml`: **~95**
  - `src/Core.TypeScript/hygiene/` and `src/Core.TypeScript/ace/` (86 files, the only two directory globs)
  - 9 individually-named files (4 Q# reference-oracle, 5 algebra-tower harness)

Everything else — including all of `src/Core.TypeScript/discovery/` (**32 test files**),
`src/Core.TypeScript/planning/`, `browser-node/`, `ferry-throttler/`, `model-backend/`, `observe/`,
`oracle/` — **is never executed by CI.** The files are real, they pass locally, and nothing runs them.

## Why this is the repo's own named defect class

`.github/workflows/zflash-harness-lint.yml` states the rule: *"a green check that implies more than it
tested is worse than no check."* A PR touching `discovery/` today goes green having executed **zero** of
that directory's tests. The green is about the two directories that happen to be globbed.

## Two live instances, both from today

1. **The UDP chaos harness (PR #10417)** — 32 assertions across a Gilbert–Elliott burst-loss model,
   including four tests that deliberately **pin currently-broken behaviour** so it cannot silently
   regress. Those pins are inert: nothing runs them, so nothing will notice the regression they exist to
   catch. Filed with full awareness that this work-item's author shipped it.
2. **`src/Core.TypeScript/planning/orbital-independent-check.test.ts`** — the independent check that
   *falsified* the first proposed remedy for the light-time asymmetry defect. It never re-runs, so the
   falsification cannot be regression-protected.

The light-time theorem itself is fine and this is worth stating precisely rather than alarmingly:
`src/Core.Lean4/Lean4/LightTimeAsymmetry.lean` **is** imported by `Lean4.lean` (line 17) and `src/Core.Lean4/` **is**
gated, so the proof genuinely runs. What is missing is the second oracle — `tools/Z3Verify/*.smt2`
(9 files) is referenced by **no** workflow at all. Loss of cross-check redundancy, not loss of the
property.

## Why it is probably not a simple "add a glob"

Two honest obstacles, both of which should be measured before anyone edits the workflow:

- **Runtime.** 612 test files is a different wall-clock budget than 95. `lint (TS)` is capped at
  `timeout-minutes: 12`. Someone must measure the full-suite time before proposing where it runs.
- **Unknown pass rate.** If tests have been un-run for months, an unknown number are already red.
  Enabling them all at once turns the gate red on unrelated PRs — the 2026-07-08 priority-inversion /
  2026-08-01 six-rebuild race the gate flip was designed to avoid. A staged adoption (measure → fix or
  quarantine with a named reason → enable) is the shape that respects that history.

**PROPOSED** — and note this parallels `lean-orphan-modules.ts` exactly: a Lean module outside
`lake build` is invisible, and an allow-list with a mandatory reason makes deliberate exclusion cheap
and accidental exclusion loud. The same instrument for `*.test.ts` is the obvious answer, and it is
already a proven pattern here.

## Acceptance

- A count of which `*.test.ts` files CI executes, derived rather than asserted, failing on drift.
- Every un-run test file either runs or is listed with a **non-empty reason** (the `ORPHANS.json` shape).
- Measured full-suite runtime and current pass rate recorded before any gate change.

## Note on the workflow-edit constraint

Fixing this requires editing `.github/workflows/gate.yml`, and PRs touching `.github/workflows/**` do not
get the `gate` check scheduled and are unmergeable through the normal path. The measurement + the
allow-list checker can land as ordinary code first; the workflow edit is a separate, gated step.

## MEASURED — both obstacles above are resolved, favourably (2026-08-13, same day)

The work-item named two unknowns as reasons this is "probably not a simple add-a-glob." Both were then
measured on `origin/main`:

```
bun test src/Core.TypeScript/
  7339 pass
  0 fail
  17205670 expect() calls
  Ran 7339 tests across 568 files. [210.39s]
```

- **Runtime: 210 s.** The `lint (TS)` cap is `timeout-minutes: 12` (720 s). The full suite fits with
  ~3.4× headroom.
- **Pass rate: 100%.** Zero failures. The fear that long-unrun tests had rotted red is **wrong** —
  nothing has to be quarantined, and enabling them cannot turn the gate red on unrelated PRs.

**So the staged-adoption caution in this item was over-cautious and should not be used to defer the
fix.** The change really is close to "add the glob," and the two obstacles that justified staging do
not exist. Correcting this in place rather than leaving a work-item that argues for slowness on
grounds since disproved.

Note what this also means: **568 test files and 7,339 assertions have been passing invisibly.** The
suite is healthy; it is simply not connected to anything. That is a better problem than a rotten
suite, and a worse one than it looks — every one of those 7,339 assertions is currently decorative.

Two caveats that survive the measurement, both honest:

- The run was on macOS (this operator's machine); CI is `ubuntu-24.04`. Runtime and pass rate should be
  confirmed on the CI runner before the cap is trusted. Some tests spawn `kind`/ArgoCD scaffolding
  (`src/Core.TypeScript/cluster/dev-cluster/use-cases.test.ts`) whose behaviour differs there.
- 568 files ran, against 612 counted under `src/` + `tests/`. The difference is `tests/` (not under
  `src/Core.TypeScript/`), so that tree still needs its own measurement.

**The allow-list-with-reason instrument is still the right shape** — not because tests need quarantine
today, but because it is what keeps a *future* directory from silently falling outside the glob, which
is the actual recurring defect.
