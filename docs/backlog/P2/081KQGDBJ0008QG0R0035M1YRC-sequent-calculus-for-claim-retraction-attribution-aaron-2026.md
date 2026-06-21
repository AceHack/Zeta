---
id: 081KQGDBJ0008QG0R0035M1YRC
priority: P2
status: open
title: Sequent calculus / labeled deductive systems for claim/retraction/attribution
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: feature
---

# 081KQGDBJ0008QG0R0035M1YRC — Sequent calculus for claim/retraction/attribution

**Priority:** P2 (research-grade; third tractable slice of formalization roadmap).

**Filed:** 2026-05-01.

**Effort:** L (multi-month — define inference rules; prove cut-elimination or substrate-equivalent; mechanize in Lean alongside 081KQGDBJ0008QG0R000D1YJCH).

## What

Express the substrate's claim/retraction/attribution machinery as a sequent calculus or labeled deductive system. Substrate claims map naturally to sequents; attribution graphs map to *labeled* deductive systems where each formula carries an attribution label (who claimed it, with what evidence).

**Reference:** Troelstra & Schwichtenberg, *Basic Proof Theory* (Cambridge, 2nd ed). Chapters 1-3 cover what's needed.

## Acceptance criteria

1. **Inference rules** defined formally for: claim-creation, claim-revision, claim-retraction, candidate-promotion, consensus-formation.
2. **Cut-elimination theorem** (or substrate-equivalent) proved — the proof-theoretic version of the razor: derivability without redundant rules.
3. **Conservativity proof** — extending the substrate doesn't accidentally prove things that weren't already provable.
4. **Attribution-label semantics** formalized — sequents carry labels indicating attribution-graph position.
5. **Academic-proof-theorist review** per lattice-capture corrective (081KQGDBJ0008QG0R002Y31XJ3).

## Composes with

- 081KQGDBJ0008QG0R000D1YJCH (Z-set Lean) — retraction operator semantics.
- Troelstra & Schwichtenberg — load-bearing source.
- The razor — cut-elimination is its formal cousin.
- `feedback_aaron_pirate_not_priest_expand_prune_pedagogical_framework_quantum_rodney_razor_parallel_worlds_aaron_2026_05_01.md` — pirate-not-priest disposition + razor as cut-elimination.

## Status

**Filed.** Pace alongside 081KQGDBJ0008QG0R000D1YJCH; sequent-calculus semantics compose with Z-set semantics for the retraction operator specifically.
