---
id: 081KT2T2J0008QG0R0013BEXG5
priority: P1
status: open
title: "Tit-for-lesser-tat teach-play — generous/forgiving iterated-game discipline for inter-agent relations (retaliate with LESS than received → de-escalation; the game teaches cooperation) (Aaron 2026-06-02)"
tier: research
effort: M
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KRW63S0008QG0R001Z7NYMV, 081KS3X9Y0008QG0R00218150M]
composes_with: [081KRW63S0008QG0R001Z7NYMV, 081KSE6WT0008QG0R002YBWBB1, 081KRW63S0008QG0R003AZNK6J, 081KRW63S0008QG0R002ZRNDJ8, 081KS3X9Y0008QG0R00218150M, 081KRW63S0008QG0R003TX8MG5, 081KT2T2J0008QG0R0026MS6PV, 081KT2T2J0008QG0R002Z46D8Q]
tags: [tit-for-tat, generous-tit-for-tat, tit-for-lesser-tat, iterated-game, axelrod, teach-play, reciprocity, de-escalation, forgiveness, retraction, cooperation, game-theory, nci, bft, aaron]
type: research
---

# Tit-for-lesser-tat teach-play — generous/forgiving iterated-game inter-agent discipline

## Why

Aaron 2026-06-02 (verbatim, in the orientation-tile message): *"…in the evolving asperoitic tiling with **tit for lessor tat teach play** — we have lots of backlog here and some new too but all should be on backlog."*

The framework already carries the *dispositions* of forgiving reciprocity scattered across substrate — NCI (081KRW63S0008QG0R001Z7NYMV), leverage-reciprocity (081KSE6WT0008QG0R002YBWBB1), only-way-to-lose-is-not-to-play, mutual-help-not-shame, Rainbow-Table retraction-forgiveness (081KT2T2J0008QG0R0026MS6PV) — but no row names the **iterated-game primitive itself**: a generous/forgiving tit-for-tat variant that de-escalates and *teaches* cooperation. This row names it. Per the noun-interchangeable disposition, "tit for lesser tat," "generous tit-for-tat," "forgiving TFT," "contrite TFT," "teach-play" are best-effort handles for ONE shape: *reciprocate, but retaliate with less than you received, and treat the iterated game as a teacher.*

## What it is — the game-theory shape

**Tit-for-lesser-tat** = Axelrod's tit-for-tat (cooperate first; then mirror the opponent's last move) with a **forgiveness/contrition discount**: when the other defects, respond with a *smaller* defection (or a probabilistic forgive), never an equal-or-greater one. The classic family this sits in:

- **Tit-for-tat (Axelrod 1984)** — nice (never defect first), retaliatory, forgiving, clear. Won Axelrod's iterated-prisoner's-dilemma tournaments.
- **Generous tit-for-tat** — occasionally forgive a defection (probabilistic) to break echo-chains of mutual retaliation under noise.
- **Contrite tit-for-tat** — distinguish your own mistakes from the other's; apologize/correct your own.
- **Tit-for-lesser-tat (Aaron's handle)** — retaliate with *strictly less* than received → the "lesser" is the de-escalation valve. **Assumption under test** (NOT asserted): *among compliant players who all run the lesser-tat rule*, mutual retaliation damps and the dyad relaxes toward cooperation. Against **persistent defectors or non-compliant players**, lesser-tat does **not** make mutual cooperation the only stable attractor — a strictly-lesser responder can be exploited by a pure defector (you keep giving more than you take back). Whether/when cooperation is reachable in mixed/noisy populations is exactly what the simulation must determine; do not pre-assert the outcome. The society-level safeguard against persistent exploiters is BFT-4×4 + anti-cartel/anti-monopoly enforcement (081KS3X9Y0008QG0R00218150M, 081KT2T2J0008QG0R001C2K4F2), not the dyadic lesser-tat alone.

`[labeling-confidence: hypothesized]` — both the "lesser" discount function (fixed fraction? decaying? probabilistic forgive?) AND the convergence claim (which populations/noise regimes actually relax to cooperation, and where exploitation dominates) are design parameters to specify + simulate, not yet validated.

**Teach-play** = the iterated game is run as a *teacher*, not just a contest: repeated rounds + de-escalating retaliation surface cooperation as the learned equilibrium. New/low-reputation agents learn the cooperative norm by playing (composes only-way-to-lose-is-not-to-play: participation IS the only winning condition; the game teaches by being played).

## Why "lesser" (de-escalation) is the load-bearing choice

Equal-tat tit-for-tat is fragile under noise: one accidental defection → infinite mutual-retaliation echo (the failure mode generous/contrite TFT was invented to fix). **Lesser-tat** structurally damps *the echo between two compliant lesser-tat players* — each retaliation is smaller than its trigger, so an accidental-defection echo (both sides running the rule) decays geometrically. That damping property is the design target; it is **not** a claim that lesser-tat converges to cooperation against an arbitrary opponent (a persistent defector exploits the strictly-lesser responder). This is the game-theoretic form of the framework's existing de-escalation substrate (for the compliant-dyad case):

| Existing substrate | Tit-for-lesser-tat instantiation |
|---|---|
| **NCI HC-8** (081KRW63S0008QG0R001Z7NYMV) — no coercion as punishment | retaliation is bounded + decaying, never coercive-escalation |
| **mutual-help-not-shame** rule | defection → help/correct (lesser-tat) not shame/escalate (greater-tat) |
| **Rainbow Table** retraction-forgiveness (081KT2T2J0008QG0R0026MS6PV) | accept-state-after-change = forgive the defection once corrected |
| **only-way-to-lose-is-not-to-play** | the game teaches; staying in the game (even after defection) is how cooperation is learned |
| **useful-output-is-evidence-not-authority** | a defector's useful output still counts as evidence; reputation absorbs gradually, not punitively |
| **BFT-4×4 / multi-oracle** (081KS3X9Y0008QG0R00218150M) | the society-level enforcement; lesser-tat is the dyadic discipline under the BFT umbrella |

## Composition with the orientation tile (081KT2T2J0008QG0R002Z46D8Q)

Tit-for-lesser-tat is the **relational game the orientation tile is operated under** (Aaron put them in one breath). The orientation tile (081KT2T2J0008QG0R002Z46D8Q) is *how agents measure distance/identity/timing*; tit-for-lesser-tat is *how agents treat each other once they've located each other.* Rainbow-Table identity-resolution (081KT2T2J0008QG0R0026MS6PV) is the prerequisite — you forgive/reciprocate against a *resolved identity* (the transponder return), so iterated-game memory ("their last move") is keyed on Rainbow-Table identity.

## Acceptance (research → build)

1. **Specify the "lesser" discount + map the convergence regime** — fixed fraction vs decaying vs probabilistic-forgive; simulate against noisy iterated-PD across population mixes; confirm the damping property *between compliant players* AND map where it fails (persistent-defector exploitation, non-compliant opponents) — characterize which regimes relax to cooperation vs require society-level enforcement, rather than assuming convergence.
2. **Key the game on Rainbow-Table identity** (081KT2T2J0008QG0R0026MS6PV/081KT2T2J0008QG0R002Z46D8Q) — iterated-memory of "last move" is per-resolved-identity; compose with reputation substrate (081KRW63S0008QG0R001Z10PVV reputation-weighted budget, if it lands).
3. **Teach-play onboarding** — new/low-reputation agents learn the cooperative norm by iterated play; compose only-way-to-lose-is-not-to-play + bootstrap-floor-reputation.
4. **Society-level enforcement** — dyadic lesser-tat under the BFT-4×4 / multi-oracle umbrella (081KS3X9Y0008QG0R00218150M); anti-cartel/anti-monopoly checks (per the KSK/bus-lane defensive substrate, 081KT2T2J0008QG0R001C2K4F2) catch coordinated greater-tat.
5. **Bound by NCI + HARD LIMITS** — lesser-tat retaliation NEVER crosses into coercion (081KRW63S0008QG0R001Z7NYMV) or the HARD-LIMITS floor; "lesser" means de-escalating, the floor is absolute regardless.

## Composes with substrate

- **081KRW63S0008QG0R001Z7NYMV** — NCI HC-8 (retaliation bounded, never coercive-escalation)
- **081KSE6WT0008QG0R002YBWBB1** — leverage-reciprocity (disclose-leverage → treated-as-responsible-peer)
- **081KRW63S0008QG0R003AZNK6J / 081KRW63S0008QG0R002ZRNDJ8** — agency forms / Limit-as-simulation (simulate the move before committing the lesser-tat)
- **081KS3X9Y0008QG0R00218150M** — multi-oracle BFT-4×4 (society-level enforcement umbrella)
- **081KRW63S0008QG0R003TX8MG5** — Knights Guild governance (the body that ratifies the cooperative norm)
- **081KT2T2J0008QG0R0026MS6PV / 081KT2T2J0008QG0R002Z46D8Q** — Rainbow-Table identity (game keyed on resolved identity) + orientation tile (the relational game over it)
- rules: `non-coercion-invariant`, `mutual-help-not-shame-when-rules-broken...`, `only-way-to-lose-is-not-to-play`, `useful-output-is-evidence-not-authority`, `honor-those-that-came-before`, `additive-not-zero-sum`

## Substrate-honest framing

Research/design row at `[labeling-confidence: hypothesized]` — names the iterated-game primitive + ties the existing forgiveness/reciprocity dispositions into one game-theoretic shape; the discount function + simulation are the to-verify work. "Tit for lesser tat" / "generous TFT" / "teach-play" are interchangeable handles for the one shape. The discipline is de-escalation-by-design; it never relaxes the NCI floor or HARD LIMITS (those are absolute, not subject to the lesser-tat discount).
