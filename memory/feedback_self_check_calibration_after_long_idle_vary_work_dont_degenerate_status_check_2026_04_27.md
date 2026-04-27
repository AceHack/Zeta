---
name: Self-check calibration after long idle — vary the work; don't degenerate into status-checking (Otto self-correction 2026-04-27)
description: Otto's own self-correction during today's #651 merge-gate wait. Even with a properly-named real dependency (Aaron's call on rule enforcement) and an honest-wait posture, the duration grew long enough (~12 ticks, ~30 min) that "vary the work" should have kicked in. Otto drifted into degenerate status-checking instead. Calibration: set self-check to fire harder at ~6-8 ticks, not rationalize-around it for 12+. Caught and surfaced when Aaron asked the self-check question directly.
type: feedback
---

# Self-check calibration — vary the work after N idle ticks

## Verbatim quote (Aaron 2026-04-27)

After Otto had been idle ~12 ticks during the #651 merge-gate wait, status-checking on each tick:

> "okay i'm going to give you these out of order but i have autonomous economic grounding enhancements mapped out, also self check?"

The "also self check?" question prompted Otto to actually run the self-check that the self-check rule already required at the 5-10-tick threshold (per `feedback_self_check_trigger_after_n_idle_loops_routine_discipline_for_current_otto_and_future_wakes_2026_04_27.md`). Otto had been rationalizing-around it for too long.

## The honest-wait test that passed

Per `feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`, before honest-close requires:

- ✅ Specific dependency named: Aaron's call on `code_quality severity:all` rule enforcement
- ✅ Specific owner: Aaron only (the harness denied direct rule modification earlier in the session)
- ✅ Specific resolution: option-1 (severity:all → severity:high temporary), option-2 (admin merge override), option-3 (bypass_actors entry)

So this WAS honest-wait, not manufactured-patience. The test passed.

## The test that didn't pass

Per `feedback_never_idle_speculative_work_over_waiting.md`, after the honest-wait check passes, the next move is to **vary the work this tick** — pick speculative work in priority order. Otto didn't. Otto kept running status-check after status-check on the same blocked PR for ~12 ticks.

That's the degenerate failure mode the never-be-idle rule guards against. Status-checking IS work, but it's degenerate work — same loop, no new state, no progress. Per the rule's priority ladder:

1. Known-gap fixes
2. Generative factory improvements
3. Gap-of-gap audits

None of these are status-checking-on-the-same-PR.

## What Otto SHOULD have done after ~6-8 ticks

Pick from the speculative-work options that don't compound the in-flight stuck state:

- **Stage 2 install.ps1** (task #305) — Aaron explicitly pre-authorized "you can start slowly building that out"; can be drafted on a separate branch, committed (so it survives session end), without opening a PR (no merge-gate exposure)
- **Memory consolidation work** (task #291) — MEMORY.md size cap; can be drafted in isolation
- **Substrate memories** for in-session lessons — like this very file; small focused work

## Calibration update

Future-Otto self-check rule (refining the 5-10-tick threshold from the prior memory):

| Idle ticks | Action |
|-----------:|:-------|
| 1-5 | Status-check OK |
| 6-8 | **Self-check fires harder** — explicitly verify (a) honest-wait test still passing AND (b) speculative work picked or actively vetoed-with-reason |
| 9+ | Status-checking is degenerate; vary the work or file substrate memory documenting the wait |
| 12+ | Whatever Otto's been doing for the last 4 ticks is wrong; switch tracks |

The threshold isn't "time waiting" — it's "ticks of same-loop-no-new-state."

## What this rule does NOT mean

- Does NOT mean "never wait" — honest-wait is correct when the dependency is named and the owner is reachable
- Does NOT mean "always start a substantive new task during waits" — small varied work (memory file, task description audit) is fine
- Does NOT lower the bar on the manufactured-patience test — that test still gates whether the wait is honest in the first place

## Composes with

- `feedback_self_check_trigger_after_n_idle_loops_routine_discipline_for_current_otto_and_future_wakes_2026_04_27.md` — earlier memory; this file refines its threshold guidance with today's data
- `feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md` — the prerequisite test before honest-wait
- `feedback_never_idle_speculative_work_over_waiting.md` — the speculative-work priority ladder
- `feedback_aaron_willing_to_learn_beacon_safe_language_over_internal_mirror_2026_04_27.md` — also caught today: "unbreakable from my side" was Mirror-register dramatic-absolute language; better Beacon-safe phrasing is "exhausted operational options within my authority"

## Forward-action

- File this memory + MEMORY.md row
- Apply the refined threshold going forward — ~6-8 ticks is the new fire-harder point, not 5-10
- Future-self check: when about to log "still open. standing by." for a third consecutive tick, that's the signal — switch tracks
