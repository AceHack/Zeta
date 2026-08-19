---
id: 081M0BVAV2H087G0R000VXRYRQ
type: task
state: closed
priority: P2
slug: decide-whether-the-windows-build-and-test-legs-should-block
title: "Decide whether the Windows build-and-test legs should block the gate floor"
created: 2026-08-19T01:49:20.849Z
depends_on: []
composes_with: []
---

# Decide whether the Windows build-and-test legs should block the gate floor

**ANSWERED 2026-08-19 by Aaron: no — they are drift checks and stay non-blocking
by intent.** Jump to [DECIDED](#decided--2026-08-19-aaron-maintainer-non-blocking-is-the-steady-state).
Everything above that section is the evidence the decision was made on and is kept
verbatim; the recommendation that used to sit at the end (hold, then promote after
30 clean runs) is withdrawn there, with the reason.

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

| leg                                    | failures | rate |
| -------------------------------------- | -------- | ---- |
| `build-and-test (windows-2025)`        | 12       | 7.9% |
| `build-and-test (windows-11-arm)`      | 9        | 5.9% |
| runs with at least one Windows failure | 14       | 9.2% |

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
would not block a single merge — it would turn main red _after_ the fact.

The decision is therefore two decisions, and the first one costs money:

1. **Add Windows to the pre-merge matrix?** Measured on run 32203290237:
   `windows-2025` 11m03s, `windows-11-arm` 10m00s. Both run in parallel with
   `ubuntu-24.04` (11m40s), so wall-clock time-to-green is roughly unchanged,
   but it adds ~21 runner-minutes per PR run. At current PR volume that is the
   dominant cost line in the whole gate.
2. **Then**: make it blocking?

## DECIDED — 2026-08-19, Aaron (maintainer). Non-blocking is the steady state

> "windows and mac are drift checks, it's fine to check per pr if we want but we
> don't want to block on them. Also we are moving more and more away from PRs and
> more into sovereign mode without PRs."
>
> — Aaron, 2026-08-19

That answers the question this item was filed to ask, and it answers it in a
different register than the item was written in. The item framed
`continue-on-error` as a **tolerance** — something being put up with, to be worked
off against a criterion. The decision is that it is a **classification**: these
legs are drift checks. Drift checks are observed and are not gates. There is no
promotion pending.

**Consequences, stated so nothing is left implicitly open:**

1. The Windows legs stay non-blocking **permanently and by intent**. Flipping
   `continue-on-error` would now be reversing a maintainer decision, not tidying a
   leftover — so the flag is documented at its site as a classification with the
   quote attached (`.github/workflows/gate.yml`, `build-and-test`).
2. **Per-PR is allowed but not required** — "fine to check per pr if we want".
   Priced and declined below; the permission stands if the price ever changes.
3. macOS was named in the same sentence and is **not** in the same state — it
   blocks today. Split out as its own decision: `081M0CPEH40087G0R0016GDSB6`.

### The promotion criterion is withdrawn, and it was about to misfire

The recommendation this section replaces (Dejan, 2026-08-19) was: hold, and
propose the flip after **30 consecutive completed push runs with zero Windows-leg
failure**. Two things retire it, and the second is the more useful one to record.

**It is the wrong frame.** A drift check has no promotion path to reach. The
criterion measured "has it earned the right to block", a question the maintainer
has now answered with "that is not what it is for".

**And it had already fired.** Measured 2026-08-19 from the seeded ledger in
`data/platform-drift.json` (500 completed push runs, 82 of which executed their
matrix): `windows-2025` clean streak **58**, `windows-11-arm` clean streak **57** —
consecutive *executed* runs with no failure. The 30-run threshold was met roughly
twice over. Left in place, this item would have mechanically produced a proposal to
make the legs **blocking** — the exact opposite of the decision Aaron just made —
and it would have done so on the strength of a criterion whose own denominator was
wrong (see COVERAGE below: "runs" was counting pushes, most of which never ran the
legs at all). A criterion nobody re-reads is a decision on a timer.

_Nothing above deletes the measurements._ The failure rates in the Evidence
section are why the decision is informed rather than assumed, and the committed
fixture stays as the reproducible instance.

## The per-PR question, priced (decided by the shadow, 2026-08-19)

Aaron left this one open ("if we want"), so it is decided here rather than
silently skipped, and it is decided **against**, with the number in front:

|                                      | measured                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------- |
| PR-event `gate` runs                 | **100 completed in 6h45m** (2026-08-19) → **~355/day**                      |
| Windows legs, wall clock             | `windows-2025` 11m03s + `windows-11-arm` 10m00s = **~21 runner-min/PR run** |
| Cost of adding them to the PR matrix | **~124 runner-hours/day**                                                   |

Against that: **the marginal detection is close to zero.** The same legs already
run on push-to-main, so for a check whose job is to notice drift — not to attribute
it to an author — the detection latency is at most one merge. Paying ~124
runner-hours/day to move a non-blocking signal one merge earlier is not a trade
worth making, and it buys a second hazard for free: a red leg on the PR page that
cannot block and that the author usually cannot fix is precisely the mechanism this
item already cites (a floor that goes unread; the regression that rode sixteen
merges inside `test (TS suite)`).

**The cheaper win is in the runs we already pay for** — see the coverage finding
below. Reopen this if PR volume collapses or the Windows legs get materially
faster; the permission from Aaron does not expire.

## The finding that came out of implementing the decision — COVERAGE

Non-blocking is only honest if the drift is seen, so the observation surfaces were
audited. Two existed:

- `gate (required)`'s executed-scope summary names any leg that failed
  non-blockingly (`gate-scope-summary.ts`, derived — it knows no platform names).
  Per-run only, and Windows legs run on push-to-main, whose runs nobody opens.
- `drift-sweep.yml`'s **BD001** detector files any failed `build-and-test` leg on
  main into the drift ledger. Real routing — and it does catch the non-blocking
  legs, because the Actions API reports `conclusion: failure` for a
  `continue-on-error` job (the committed fixture proves it). But the ledger key is
  `Zeta.sln` + `BD001`, so **which platform** is lost, it cannot tell a red
  blocking Linux build from a drift leg doing its job, and it reads **one** run, so
  it measures a level and never a rate.

Then the number that reframes all of it. Of the **300** most recent completed
`gate` push runs on main, **265 were `cancelled`** (88%). Main pushes arrive faster
than a gate run completes, and GitHub keeps at most one _pending_ run per
concurrency group, cancelling the older one. A cancelled run's legs never execute.

So: **the Windows drift check executes on roughly one merge in eight**, and a
detector that reads only the latest completed run will usually read a cancelled one
and find nothing. Every "N consecutive clean runs" statement about these legs —
including the withdrawn criterion above — was counting pushes, not executions.

`src/Core.TypeScript/ci/platform-drift-report.ts` (added with this decision) folds
the last N push runs into per-leg failure **rates**, clean streaks, and **coverage**,
published to `data/platform-drift.json` and rendered on the fleet monitor
(`data/monitor.html`). Coverage is printed first, deliberately: a streak measured
over runs that never ran is evidence of nothing.

Seeded window, as landed — 500 completed push runs, **82 of which executed** (16.4%
coverage), 2026-08-15 .. 2026-08-19:

| leg | status (observed) | executed | failures | rate | clean streak |
|---|---|---|---|---|---|
| `build-and-test (windows-11-arm)` | drift check, non-blocking | 82 | 12 | 14.6% | 57 |
| `build-and-test (windows-2025)` | drift check, non-blocking | 82 | 6 | 7.3% | 58 |
| `build-and-test (macos-26)` | **BLOCKS** | 82 | 1 | 1.2% | 19 |
| `build-and-test (ubuntu-24.04)` | **BLOCKS** | 82 | 2 | 2.4% | 27 |
| `build-and-test (ubuntu-24.04-arm)` | unobserved (no failure) | 82 | 0 | 0.0% | 82 |

Two things in that table are worth naming. `windows-11-arm` is failing at 14.6% on
this window — higher than the 5.9% in the Evidence section above, which is what a
rate rather than a level buys you. And `ubuntu-24.04-arm` reads **unobserved**, not
"healthy": it has never failed here, so nothing has been measured about it, and the
report refuses to round that up.

## Strategic context — recorded, NOT acted on

Aaron, in the same breath as the decision:

> "we are moving more and more away from PRs and more into sovereign mode without
> PRs."

This is context for whoever picks up the gate's future, and it is deliberately out
of scope here. It reframes what a "gate" is: a pre-merge blocking check is a
PR-shaped construct, and the drift-and-heal ADR already called blocking gates
"corporate mode" against drift checks as "sovereign mode". Aaron's sentence says
that direction is not a metaphor but a trajectory.

The debt to watch, stated without proposing work against it: **any design that
hard-codes PR-shaped assumptions is accruing interest.** Concretely, in this
neighbourhood — the required-status-check contract (`gate (required)` as the one
required context), `matrix-setup`'s `pull_request` / `merge_group` branch, armed
auto-merge as the landing mechanism, and the pre-merge floor concept itself. None
of that is wrong today. It is simply written in a shape the maintainer has said the
factory is moving away from, and the drift-check half — measure, publish, let a
reader decide — is the half that survives the move.

## Not in scope here

Reducing the Windows failure rate itself (installer path, ARM64 package
coverage) is the peer-harness milestone's work, not this item's.

Two follow-ups this decision surfaced, both deliberately left unfiled as work
rather than done here:

- **BD001 conflates blocking and drift.** It fires identically for a red Linux
  build and for a Windows drift leg, at the tightest budget on the ledger
  (1 tick → auto-filed P1), and the fleet monitor renders it as "main build RED".
  Splitting it would need a `registry/drift-slo.yaml` entry, which is a registry
  consent act — not something to slip into a decision-recording change.
- **The 88% push-run cancellation rate** is a CI-topology question (concurrency
  group shape), and it degrades every push-cadence check, not just these legs.
