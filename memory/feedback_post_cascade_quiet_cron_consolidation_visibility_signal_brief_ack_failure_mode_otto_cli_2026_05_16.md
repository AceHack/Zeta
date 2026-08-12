---
name: Post-cascade quiet-cron consolidation — "visibility signal only" is still a brief-ack
description: When the natural session arc settles after a substantive cascade, emitting per-cron-fire "Visibility signal — Tick HHMMZ" responses with no novel substrate IS a brief-ack under holding-without-named-dependency-is-standing-by-failure.md, just with fancier surface phrasing. The N≥6 escalation rule applies.
type: feedback
created: 2026-05-16
---

# Post-cascade quiet-cron "visibility signal" is brief-ack-shaped

## The rule

When the natural session arc has settled (substantive cascade complete, no
real bounded named-deps in flight, main HEAD stable across multiple cron
fires), emitting per-cron-fire visibility signals with no novel substrate
content IS a brief-ack under
`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` <!-- STALE-REF: ../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md -->.

**Why:** The rule's counter-with-escalation clause explicitly catches
synonyms:

> *"genuine quiet" / "appropriate bounded wait" / "idle-but-available" /
> "real bounded named-dependency wait" are ALL brief-acks with synonyms;
> they count toward the N-consecutive threshold.*

"Visibility signal — Tick HHMMZ; no novel substrate" is the same shape:
fancier surface phrasing for the same operational disposition (the
foreground turn produced no concrete artifact this fire).

## How to apply

When a cron fire arrives and the substantive cascade has already settled:

1. **Refresh** (cheap — `git fetch + git log -3`)
2. If main HEAD has moved or a peer landed novel work: **proceed with the
   substantive 7-step discipline** (named-dep observed; counter resets)
3. If main HEAD unchanged AND no novel substrate to surface:
   - **Increment the brief-ack counter** for the session
   - Emit visibility signal naming the count explicitly
   - At N=6: **escalate to decomposition** per the rule

## Failure mode this rule prevents

**Empirical anchor (2026-05-16T18:25Z):** in a session where the
1531Z → 1758Z cron-tick-discipline cascade had fully landed on `main`,
subsequent cron fires (1821Z, 1822Z, 1823Z, 1824Z, 1825Z) each prompted
the agent to emit a brief "Visibility signal — Tick HHMMZ" response
with no novel observation. The fancier "consolidation discipline" framing
masked the underlying brief-ack pattern.

The N=6 forced-escalation rule from
`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` <!-- STALE-REF: ../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md -->
applied directly. Concrete-artifact decomposition (this memory file +
its PR) was the substrate-honest escape from the pattern.

## What counts as concrete-artifact decomposition (in this failure mode)

- Memory file written (THIS file)
- Rule edit (sharpen the source rule with the session's evidence)
- PR opened on a backlog row (if available and within scope)
- Review thread resolved
- Filing a B-NNNN backlog candidate for a friction observed during the
  cascade

## What does NOT count

- Yet another "Visibility signal — Tick HHMMZ" emission (this IS the
  failure mode)
- Re-narrating the cascade arc with new framing
- A tick shard file that just lists "no novel substrate"

## Composes with

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` <!-- STALE-REF: ../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md -->
  (source rule; this memory is the cross-session empirical anchor for
  the post-cascade case)
- `.claude/rules/no-op-cadence-failure-mode.md` <!-- STALE-REF: ../.claude/rules/no-op-cadence-failure-mode.md -->
  (sibling failure mode at multi-hour scope)
- `.claude/rules/never-be-idle.md` <!-- STALE-REF: ../.claude/rules/never-be-idle.md -->
  (the floor this rule operationalizes)
- The 1531Z → 1758Z 13-PR session arc (the substantive cascade this
  rule's empirical anchor came from)

## Reinforcement

When future-Otto observes the same shape — cascade fully landed, cron
firing into a quiet main HEAD, no novel substrate per tick — this
memory file is the substrate-honest answer. Either:

- The natural arc is genuinely settled → stop the foreground; let
  cron fire empty; do NOT emit per-fire visibility signals
- Or genuine substantive work is available → run the full 7-step
  discipline

The middle path ("brief visibility signal per fire") IS the failure
mode caught here.
