---
id: 081M0BVAV2H087G0R000VXRYRQ
type: task
state: backlog
priority: P2
slug: decide-whether-the-windows-build-and-test-legs-should-block
title: "Decide whether the Windows build-and-test legs should block the gate floor"
created: 2026-08-19T01:49:20.849Z
depends_on: []
composes_with: []
---

# Decide whether the Windows build-and-test legs should block the gate floor

Maintainer decision, not a workflow edit. Filed with evidence so the decision is
cheap to make rather than left as a standing "someone should look at this".

## The residue

`.github/workflows/gate.yml` sets, inside `build-and-test`:

```yaml
continue-on-error: ${{ startsWith(matrix.os, 'windows-') }}
```

`build-and-test` IS in the `gate-required` floor. So a Windows build or test
failure reaches `gate (required)` as SUCCESS. The flag is declared and
deliberate; what was not deliberate is that the outcome was invisible. The
rollup now names such legs in its step summary and emits a warning annotation
(PR that filed this item), so the question below can be answered from data
instead of from memory.

## Evidence (measured 2026-08-19)

Method: Actions API, all completed `gate` runs on `push` + `workflow_dispatch`
(the only events whose matrix carries Windows), conclusion not `cancelled`.
Window 2026-04-25 .. 2026-08-19, **152 runs**.

| leg | failures | rate |
|---|---|---|
| `build-and-test (windows-2025)` | 12 | 7.9% |
| `build-and-test (windows-11-arm)` | 9 | 5.9% |
| runs with at least one Windows failure | 14 | 9.2% |

Since `gate-required` has existed (2026-08-01 onward), **11 of 11** Windows-leg
failures sat beside a green `gate (required)`. Failures cluster in bursts rather
than arriving uniformly — five on 2026-08-16 alone.

Failing steps in the four most recent: `Test` (×3) and
`Install toolchain via three-way-parity script (Windows; GOVERNANCE §24)` (×1).
So the population is a mix of genuine test failures and installer maturity —
not one cause with one fix.

A captured instance is committed as a fixture:
`src/Core.TypeScript/ci/fixtures/gate-run-jobs-windows-failed.json`
(run 31978270082 — `windows-2025` failed, `gate (required)` succeeded).

## The part that changes the question

**Windows legs do not run on pull requests at all.** `matrix-setup` emits
Linux + macOS for `pull_request` and `merge_group`; Windows appears only on
push-to-main and `workflow_dispatch`. So flipping `continue-on-error` today
would not block a single merge — it would turn main red *after* the fact.

The decision is therefore two decisions, and the first one costs money:

1. **Add Windows to the pre-merge matrix?** Measured on run 32203290237:
   `windows-2025` 11m03s, `windows-11-arm` 10m00s. Both run in parallel with
   `ubuntu-24.04` (11m40s), so wall-clock time-to-green is roughly unchanged,
   but it adds ~21 runner-minutes per PR run. At current PR volume that is the
   dominant cost line in the whole gate.
2. **Then**: make it blocking?

## Recommendation (Dejan, 2026-08-19) — not yet, with a stated criterion

Do not flip it now. At a 9.2% run-level failure rate, blocking would red the
floor on roughly one in eleven merges for causes that are mostly platform and
installer maturity, and a floor that is red for reasons the author cannot fix is
how a floor stops being read — the same mechanism that let a real regression
ride sixteen merges inside `test (TS suite)` (see the header of
`test-typescript-hermetic`).

Proposed promotion criterion, checkable from the annotations this PR adds:

- **30 consecutive completed push runs with zero Windows-leg failure** → propose
  the flip, together with the decision on adding Windows to the PR matrix.
- Until then each failure is named in the `gate (required)` summary, so the
  counter is maintained by reading, not by an audit.

## Not in scope here

Reducing the Windows failure rate itself (installer path, ARM64 package
coverage) is the peer-harness milestone's work, not this item's.
