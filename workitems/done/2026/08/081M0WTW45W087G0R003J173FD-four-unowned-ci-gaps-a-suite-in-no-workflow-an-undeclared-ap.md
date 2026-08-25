---
id: 081M0WTW45W087G0R003J173FD
type: task
state: done
priority: P2
slug: four-unowned-ci-gaps-a-suite-in-no-workflow-an-undeclared-ap
title: "four unowned CI gaps: a suite in no workflow, an undeclared apt payload, a frozen ledger, and a reporter that could go green without looking"
created: 2026-08-25T16:08:23.996Z
depends_on: []
composes_with: []
---

# four unowned CI gaps: a suite in no workflow, an undeclared apt payload, a frozen ledger, and a reporter that could go green without looking

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WTW45W087G0R003J173FD-*.md` glob. -->

## What was verified, and what turned out to be wrong

All four were reported as instances of one class -- a check that did not run reading as a
check that passed. Two were confirmed as reported; two were NOT, and the disconfirmation
is recorded here because it is as much of the result as the fixes are.

**1. CONFIRMED. The `agentic-organization` suite ran in no workflow.** 1,595 tests whose
only invoker was the nested `ci.yml` file under that package's former workflow directory.
GitHub Actions reads workflows only from the repository root, so it had never executed. The
suite now runs from `.github/workflows/agentic-organization-tests.yml`; the other root
workflow references had only checked `agentic-organization/deploy`, never the code.

**2. CONFIRMED, and worse than reported.** `ci-cache-paths-lint.yml` failed **5 of its last
20** completed runs (25%, not 20%), and **all five** failed inside "Install toolchain via
three-way-parity script" -- none inside the audit step the check is named for. Job
97860804880 stalled on `pandoc` (26.9 MB) and `r-base-core` (27.1 MB), both `tier=standard`
and neither used by that job, and died at `exit code 124` after the full 420s apt budget.

**3. PARTLY WRONG.** `data/platform-drift.json` IS pinned at run 32816944713 and IS older
than every run in the folded window (oldest 32818935566). But the staleness was NOT silent:
`drift (loud)` was already printing `::error title=drift publication not landing::` and
exiting 1 -- verified in job 97862170100 at 15:31:42Z. The root cause is outside
`drift-loud.ts`: flush PR #15276 has been open since 06:37Z with `gate (required)` red on
it (`lint (semgrep)`, `lint (tick-shard relative-paths)`, `lint (archive header §33)`), so
every later tick parks on `heartbeat/drift-sweep-buffer`.

**4. WRONG AS STATED.** The canary had not gone quiet. Same job, same second:
`Detector liveness: OK -- detector live: the canary's swallowed step was observed in run
32864087075 via the annotation channel`. What WAS true is that two other paths through
`drift-loud.ts` reached green without ever consulting it -- a missing credential returned
0, and an unreadable ledger asserted "publication landing". Both are closed.

## Falsifiers added

- `src/Core.TypeScript/hygiene/lint-no-nested-workflow-dirs.ts` (AH004)
- `src/Core.TypeScript/hygiene/audit-install-tier-declared.ts` (AH003)
- `readPublishedWatermark` three-state read + five falsifiers in `drift-loud.test.ts`

## Left open, on purpose

- `081M0WTVZNA087G0R0024Z5QZR` -- the `agentic-organization` typecheck failure.
- Seven jobs now declare `ZETA_HOST_TIER: full` because their payload has NOT been measured
  down, not because it was measured up: `arc-lane`, `codeql:analyze`, `lean-proof`,
  `accelerator-local-llm-validate`, `helm-validate:structural`,
  `gate:test-typescript-environment`, `gate:full-verify`. Each is a candidate for a
  measured reduction; declaring the tier is what makes them findable.
- `gate:build-and-test` is out of the audit's scope (`runs-on: ${{ matrix.os }}` spans
  macOS/Windows legs whose detected tier is not constant). No .NET source or test in the
  tree names pandoc, Rscript, r-base, emcc, podman, qemu, mtools, opam, llc or llvm-as as
  a process to start -- so it looks slimmable, but a 45-minute job on the blocking path
  should be changed by one measured run, not by a grep.
