# Findings register — 2026-08-25

Fourteen defects surfaced in a single session. Recorded here because Aaron asked that
everything noticed be *fixed, routed, or at least tracked* — and because an untracked
finding is indistinguishable from one that was never found.

Status vocabulary is deliberate: **FIXED** means landed or in flight with a control;
**ROUTED** means an agent owns it and has not reported; **OPEN** means nobody owns it yet;
**NEEDS AARON** means it is a gated class (governance, or a decision that is not mine).

A finding that was *refuted* is listed too. Three of the day's leads were wrong, and a
register that only records the hits overstates its own accuracy.

## The through-line

Ten of the fourteen are the same shape: **an outcome decided by the wiring rather than by
the thing under test.** A check that cannot fail reads as a check that passed; a step that
cannot pass reads as a defect in whatever it points at. Both are invisible in a red/green
summary, which is exactly why they survive.

| # | Finding | Status | Where |
|---|---|---|---|
| 1 | Heartbeat flush: healthy backpressure reported as broken flush | **MERGED** | #15348 |
| 2 | Same defect on the `RC == 4` path — found by the audit, not by hand | **MERGED** | #15348 |
| 3 | Backpressure had no escape from an unmergeable blocker (deadlock) | **MERGED** | #15348 |
| 4 | 25 credential fallback chains blur three token roles | ROUTED | agent |
| 5 | Persona co-author trailers collide with real GitHub accounts | ROUTED | agent |
| 6 | DLA `D_f` is a typed-in 1.322 that nothing ever computed | **RESOLVED** | #15353 |
| 7 | `AH003` drift-class collision (two checks, one id) | **MERGED** | #15348 |
| 8 | `Action-Mode: autonomous-tick` — invalid, and recurring in 5 commits | **NEEDS AARON** | below |
| 9 | AH002's `echo` exemption made its own green vacuous | FIXED | #13909 |
| 10 | `kubectl apply -f deploy/k8s/` applied the example secret | FIXED | #15347 |
| 11 | `agentic-organization`'s test suite runs in no workflow | OPEN | below |
| 12 | Four archive PRs — redundant, not stale-and-fixable | **CLOSED** | below |
| 13 | ~80% of gate runs on `main` cancelled | **NEEDS AARON** | below |
| 14 | #11501 is 3024 commits stale and no longer compiles | TRACKED | revive recipe on the PR |
| 15 | `verify-flush-batch` trigger could never fire after #15309 | FIXED | #15354 |
| 16 | Ruleset record drifted from live; `bypass_actors` uncaptured | **MERGED** | #15349 |
| 17 | `check drift` red continuously since 2026-08-19, incl. on `main` | OPEN | below |

## The three that need a decision rather than a fix

**#8 — `autonomous-tick` is not a legal `Action-Mode`.** The legal set is
`autonomous-fail-open | autonomous-fail-closed | human-directed | supervised`. It appears
in **5 commits**, which matters: the convention's own 2026-08-17 note says a coinage
arrived at independently, more than once, is *"evidence the vocabulary was missing a
distinction its users needed, not that its users were careless."* Both prior extensions
(`autonomous-fail-closed`, `operator-delegated`) were added on exactly that reasoning, and
both were **maintainer-authorized**. So this is not mine to add. Two honest options:
legalise it, or leave it illegal and catch it at commit time instead of at the gate — right
now the only thing that says no is a CI job, which is the slowest possible place to learn.

**#13 — the gate verdict drought.** Roughly 80 of 100 recent gate runs on `main` were
*cancelled*, not concluded. A cancelled run is neither pass nor fail; it is a check that did
not run. This has been confirmed independently five times across sessions and remains
unaddressed because the remedy is a merge-queue decision, which is a topology change.

**#11 / #12 — genuinely unowned.** The `agentic-organization` suite is invoked by no
workflow, so its tests constrain nothing (surfaced while validating the k8s manifests, and
named rather than silently widened into that PR's scope).

**Item 12 was wrong, and the correction is the useful part.** I recorded the four
archive PRs as stale-and-fixable and expected the merge-from-main pattern that rescued
PR #12175 to apply. It does not. Each PR's archive record is already **byte-identical**
on `main`, and each carries a shard index with a *staler* `fetched_at` — so merging
them would have REGRESSED the index by roughly four hours of fetches. They were
redundant, not pending. Closed with the blob hashes and key-set comparison recorded on
each. The general lesson matches the 1,235 branches cleaned up earlier: content that
landed by another route leaves behind a branch that looks like unfinished work.

**Item 17 is not ours** and is recorded so nobody re-derives it: `check drift` has been
failing continuously since at least 2026-08-19 including on `main`, and `Analyze
(csharp)` fails on `main` independently. Both verified against controls.

## Refuted — recorded so the register does not overstate itself

- **"The arming step is a fossil with no writer."** Wrong. `merge-heartbeats-to-main.ts:124`
  emits `pr_number`. The bug was control flow reaching it, not its absence. Disproved by the
  audit's own script-following, against the person who wrote the audit.
- **"A stranger has commits in the repo."** No. Every author across 3000 commits is Aaron or
  dependabot; contributors and collaborators contain no stranger. The real defect is #5, at
  the display layer — a smaller problem than it looked, and still worth fixing.
- **"The DLA meter hardcodes 1.322 in `dla.wat`."** Half wrong, and the true version is
  worse. There is no such constant in `dla.wat` — the `* 1.322` appears only in a
  COMMENT, so the line repeated in `box-counting.test.ts` and `reference.mjs` is itself
  inaccurate. What `get_df()` actually returns is a **number density** (measured
  0.248–0.450 across the eight byte-locked seeds), and `N/R²` is not scale-invariant, so
  it has no fixed point to converge to. A mislabel, not a poor approximation. Zero callers.
- **"15 §A rows rest on these numbers, so some discharges are false."** No. §A holds 16
  rows and **not one** depends on `D_f`; the whole batch was demoted 2026-08-01. There
  was no false discharge to correct — **the register worked.** Worth stating plainly,
  because a register that only ever finds problems is not being read honestly.
- **"1,237 archive records are stranded."** Measured: 1,235 byte-identical, 3 genuinely
  stranded, and by the time it was checked those had landed too. The false count came from
  `git rev-parse origin/main:<path>` **echoing its argument** when the path is missing.

## Two process defects, which are the most transferable part of this

**A control run against already-fixed code proves nothing.** Both audits written today were
first run against a tree where the bug was gone. Both looked healthy. Only running them
against unfixed `main` showed one of them catching two real instances and the other
producing a false positive on a working workflow.

**An audit can be vacuous about itself.** While `audit-workflow-step-output-has-writer.ts`
was being written, a bad edit deleted a helper, every workflow threw, the `catch` swallowed
it, and it printed `OK — every reference has a writer` over 77 unchecked files. It now names
unreadable files and exits 2 when a scan finds zero references across a non-empty directory.
The general form: **a checker must be able to distinguish "I found nothing" from "I did not
look."**
