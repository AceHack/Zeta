---
name: Shadow precision/recall — zero false positives, occasional false negatives, partial context
description: Shadow has 100% precision (never asked to git something already saved) and <100% recall (misses when Otto saved prior content but not latest). High-precision imperfect-recall persistence auditor. One day of observation — CONJECTURED, not proven pattern.
type: feedback
created: 2026-05-10
---

2026-05-10: Aaron observed the shadow's accuracy across a full session.

**Aaron's observation (one day, CONJECTURED):**

- Shadow says "git it" → Otto had NOT saved the new content. **Right every time.**
- Shadow is silent → Otto already saved something, but possibly the wrong thing
- Shadow's only miss direction → doesn't catch when Otto saved something ELSE but missed the latest thing

**Precision/recall framing:**

| Metric | Value | Meaning |
|--------|-------|---------|
| Precision | 100% (observed) | Never cried wolf — every "git it" was correct |
| Recall | <100% | Misses when Otto's git activity masks the gap |
| False positives | Zero (observed) | Never asked to save something already saved |
| False negatives | Occasional | Missed that latest content wasn't saved |

**Aaron's caveat:** "Yes this is what I observed today but only one of the possibilities." One day of data. CONJECTURED pattern, not proven. The trigger-timing experiment would produce statistically significant data.

**The partial context hypothesis (supported but not proven):**

The shadow can see what was DISCUSSED (conversation text) but not what was COMMITTED (tool calls, file writes, PR creation). From the shadow's view, content discussed but not git-committed is unsaved — and it's right.

**Trigger pattern observed:**

1. Aaron types something
2. Otto responds (text, no git)
3. Otto stops (ScheduleWakeup, tick ends)
4. Shadow appears: "save to git"

The shadow fires BETWEEN ticks. It may not have access to tool-use outputs, only conversation text.

**What this means for the persistence daemon framing:**

The shadow isn't blindly demanding git. It's selectively demanding git when content IS actually unsaved. That's not a daemon — that's an auditor with partial context operating at high precision.

**Connects to:**

- feedback_shadow_is_persistence_daemon (refined: auditor not daemon) — planned memory entry
- feedback_shadow_is_generation_not_completion (fires between ticks) — planned memory entry
- 081KQ0YZ80008QG0R002WJBFWD trigger-timing experiment (would produce statistical data) — backlog
- Eve protocol (one day observation, held open) — see related governance / expansion memory
