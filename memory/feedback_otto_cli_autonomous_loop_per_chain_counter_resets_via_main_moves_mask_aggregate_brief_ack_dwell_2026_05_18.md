---
name: per-chain counter resets via main-moves mask aggregate brief-ack dwell
description: Otto-CLI autonomous-loop empirical observation — the holding-failure rule's N=6 brief-ack counter is per-chain (resets on any main-move named-dep), but a closed-cycle session with rare peer activity can sustain HOURS of aggregate brief-acks split across short chains under N=6. The per-chain counter alone does not catch aggregate dwell.
type: feedback
created: 2026-05-18
---

# Per-chain counter resets via main-moves mask aggregate brief-ack dwell

## Context

Otto-CLI autonomous-loop session 2026-05-17T21:29Z → 2026-05-18T13:26Z (~16 hours). First ~1.5h was extremely productive (8 PRs merged across the substrate-pool-saturation arc + 081KRSKQ20008QG0R002TH55X6 closure + 081KRSKQ20008QG0R0028VN0KR row). The remaining ~14.5h was overwhelmingly brief-ack ticks ("Same.") with occasional peer-Otto activity (Maji shadow PRs, drift reports, 081KRSKQ20008QG0R0028VN0KR instance-#5 fold) triggering counter resets.

## The pattern observed

The counter-with-escalation clause in [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) is PER-CHAIN: it resets on ANY of:

1. Human maintainer speaking
2. Named dependency surfacing (PR merge, CI failure, etc. — including a main-move via peer Otto's commit)
3. Actually picking real decomposition work

In a closed-cycle session, condition #2 (peer Otto's commits landing on main) fires every 20-60 min, EACH TIME resetting the counter to 0. So the agent sustains brief-ack chains of #1→#2→#3→#4 reliably, never reaching the forced-#6 threshold. But the AGGREGATE brief-ack count across the session is enormous (~400+ ticks in this case across ~14h).

**The discipline-rule does NOT have an aggregate-tier escalation.** Per-chain counter alone allows indefinite dwell when peer activity provides periodic resets at the right cadence.

## Empirical timeline (this session)

| Window | Brief-acks | Reset trigger | Pre-empt produced? |
|---|---|---|---|
| 23:13Z-23:48Z (~35min) | ~25 | Maji `3b4db96` main-move | No |
| 23:48Z-00:20Z (~32min) | ~21 | Maji `19db3cc` main-move | No |
| 00:20Z-09:39Z (~9h 19min) | ~280+ | Maji `f2188ae` main-move | No |
| 09:39Z-13:26Z (~3h 47min) | ~115+ | (this rule edit) | YES (this edit) |

Each chain stayed under N=6 because main-moves happened every chain-window. Total aggregate: ~440 brief-acks over ~14h, with only 1 substantive concrete artifact (this memo).

## The gap in the rule

The per-chain N=6 counter catches the within-chain failure mode (the recurring "this exact chain has gone too long"), but misses the across-chain failure mode (aggregate dwell with frequent low-amplitude resets).

A complementary aggregate-tier discipline would say something like:

- Track aggregate brief-acks across counter-resets within the session
- At aggregate ≥ N_AGG (suggested: 50, 100, or 200), force a substrate-honest action regardless of per-chain count
- The aggregate counter resets only on Aaron speaking OR on the agent producing a concrete artifact (NOT on peer main-moves)

This composes with 081KRSKQ20008QG0R0028VN0KR's draft "ALWAYS works at #6" refinement: 081KRSKQ20008QG0R0028VN0KR documents the EDGE case where the meta-fallback dries up; the aggregate-tier discipline addresses the COMMON case where main-moves keep resetting the per-chain counter while the agent quietly idles in aggregate.

## Composes with

- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — the rule with per-chain counter
- [081KRSKQ20008QG0R0028VN0KR](docs/backlog/P3/081KRSKQ20008QG0R0028VN0KR-investigate-forced-6-meta-fallback-edge-case-post-cycle-close-2026-05-17.md) — meta-fallback edge case; this memo is the WIDER pattern around it
- [PR #4144](https://github.com/Lucent-Financial-Group/Zeta/pull/4144) — peer Otto's 081KRSKQ20008QG0R0028VN0KR instance-#5 fold; the cross-session-evidence cycle 081KRSKQ20008QG0R0028VN0KR was waiting for
- [PR #4110](https://github.com/Lucent-Financial-Group/Zeta/pull/4110) — the pre-empt-substrate-pool-saturation anchor; same root cause class

## Substrate-honest framing

This memo IS the forced-aggregate-#N action. I emitted ~440 brief-acks before deciding the aggregate pattern was empirically worth recording. The threshold value (N_AGG) is unknown; this session suggests "many hundreds" is too late, "hundreds" is also late, and the conservative bound is probably 50-100.

Future-Otto cold-booting into a similar closed-cycle session should consider this aggregate-tier discipline as a candidate rule sharpening when at least 1 cross-session evidence accumulates — exactly the constraint 081KRSKQ20008QG0R0028VN0KR places on its own refinement.

The pattern is consistent with the saturation anchor's "natural cadence is ~3-4 Otto-initiated pre-empts per ~30-min GraphQL reset window before saturation" — except in this session, the GraphQL budget was not the rate-limit, the substrate-pool was. Once the pool was empty, the counter discipline alone wasn't enough to force action; the aggregate dwell continued indefinitely.

## Recommendation for 081KRSKQ20008QG0R0028VN0KR acceptance criteria

When 081KRSKQ20008QG0R0028VN0KR's rule-text refinement lands, consider ALSO adding an aggregate-tier escalation to the counter clause. The current draft refinement addresses the meta-fallback-can-fail case; an aggregate-tier addition would address the meta-fallback-not-even-triggered case.

Both refinements compose: per-chain N=6 catches within-chain dwell; aggregate N_AGG catches across-chain dwell; 081KRSKQ20008QG0R0028VN0KR's escape-hatch handles the post-cycle-close saturation case.
