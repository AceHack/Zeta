---
id: 081KRW63S0008QG0R000Y109W0
priority: P3
status: open
title: "Add aggregate-tier counter escalation to holding-without-named-dependency rule — per-chain N=6 alone misses across-chain dwell when peer main-moves provide periodic resets"
tier: substrate-engineering
effort: S
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [081KRSKQ20008QG0R0028VN0KR]
tags: [holding-discipline, autonomous-loop, counter-escalation, aggregate-tier]
type: substrate-engineering
---

# Aggregate-tier counter escalation for the holding-failure rule

## Why

The current counter-with-escalation clause in [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) is **per-chain** — N=6 brief-acks within a single chain forces escalation. The counter resets on any of:

1. Aaron speaking
2. Named dependency surfacing (PR merge, CI failure, main-move from peer activity)
3. Concrete artifact produced

In a closed-cycle session where peer Otto activity provides main-moves at a ~30-60 min cadence, the per-chain counter resets BEFORE reaching N=6. Each chain stays at #1→#2→#3→#4→reset, indefinitely. The aggregate brief-ack count grows hundreds-deep without ever triggering forced-#6.

Empirical evidence: [`memory/feedback_otto_cli_autonomous_loop_per_chain_counter_resets_via_main_moves_mask_aggregate_brief_ack_dwell_2026_05_18.md`](../../../memory/feedback_otto_cli_autonomous_loop_per_chain_counter_resets_via_main_moves_mask_aggregate_brief_ack_dwell_2026_05_18.md) documents an Otto-CLI session that emitted ~440 brief-acks across ~14 hours without ever hitting the per-chain N=6 threshold, because peer main-moves provided periodic counter resets at exactly the wrong cadence.

## Goal

Add a complementary **aggregate-tier counter** to the holding-failure rule. Specifically:

1. Track aggregate brief-acks **across counter-resets within the session**
2. At aggregate `N_AGG` (suggested initial value: 50), force concrete-artifact production regardless of per-chain count
3. Aggregate counter resets ONLY on:
   - Aaron speaking
   - Agent-produced concrete artifact (NOT peer main-moves)

The aggregate-tier composes with the per-chain tier:

- Per-chain N=6 catches within-chain dwell
- Aggregate N_AGG=50 catches across-chain dwell
- 081KRSKQ20008QG0R0028VN0KR's escape-hatch (drafted) handles the post-cycle-close saturation case

## Acceptance criteria

- [ ] Holding-failure rule sub-section "Aggregate-tier counter (081KRW63S0008QG0R000Y109W0)" added with:
  - Threshold `N_AGG = 50` (initial; subject to refinement based on subsequent evidence)
  - Counter-reset condition list (Aaron-speaks + agent-artifact ONLY)
  - At least 1 cross-instance empirical anchor (currently 1 same-instance anchor in PR #4151 memo)
- [ ] Cold-boot reading of the rule makes the aggregate-tier discipline immediately clear
- [ ] Composes with 081KRSKQ20008QG0R0028VN0KR's drafted "ALWAYS works at #6" refinement without contradiction

## Non-goals

- Changing the per-chain N=6 threshold (that catches a different shape of failure)
- Mechanizing the counter via TS substrate (the discipline IS the mechanism for now; if a future Standing-by-detector slice adds aggregate counting in code, this row can be re-scoped)
- Refactoring the entire holding-failure rule (this is a small additive sub-section)

## Implementation hazard

The rule already has 5 empirical anchors and is one of the longer rules in `.claude/rules/`. Adding a 6th anchor + a sub-section is bounded but should be done as a SINGLE atomic PR to avoid the inflation pattern this row's own discipline warns against.

Per [081KRSKQ20008QG0R0028VN0KR's drafted refinement](081KRSKQ20008QG0R0028VN0KR-investigate-forced-6-meta-fallback-edge-case-post-cycle-close-2026-05-17.md): wait for at least 1 additional cross-INSTANCE evidence (different Otto identity / session / machine) before landing the rule edit. Otherwise the discipline composes with 081KRSKQ20008QG0R0028VN0KR's same warning about same-session inflation.

## Composes with

- [081KRSKQ20008QG0R0028VN0KR](081KRSKQ20008QG0R0028VN0KR-investigate-forced-6-meta-fallback-edge-case-post-cycle-close-2026-05-17.md) — meta-fallback edge case; this row addresses a complementary pattern
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — the rule this row extends
- [PR #4151](https://github.com/Lucent-Financial-Group/Zeta/pull/4151) — the empirical-evidence memo this row crystallizes
- [PR #4110](https://github.com/Lucent-Financial-Group/Zeta/pull/4110) — pre-empt-substrate-pool-saturation anchor (same root cause class)

## Status

Open. Bounded effort (single rule edit, ~30 lines added to the existing rule). Acceptance gates on cross-instance evidence beyond this session per 081KRSKQ20008QG0R0028VN0KR's drafted constraint.

---

**Otto-CLI** — Split by truth.
