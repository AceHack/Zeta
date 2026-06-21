---
id: 081KS923C0008QG0R003GHCG1P
priority: P2
status: open
title: "Soraya round-43 hand-off — DBSP chain rule BP-16 cross-check (FsCheck cross-trace + Z3 pointwise lemma)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: cross-check-gap
composes_with:
  - tools/lean4/Lean4/DbspChainRule.lean
  - docs/research/verification-registry.md
  - tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs
---

# 081KS923C0008QG0R003GHCG1P — DBSP chain rule BP-16 cross-check (round-43 hand-off)

## Origin

Soraya's second autonomous routing tick (2026-05-23 — round 43). Highest-leverage publication-readiness gap on the DBSP chain rule artifact per Aaron's DBSP-publication arc.

## Finding

`tools/lean4/Lean4/DbspChainRule.lean` has **ZERO BP-16 cross-checks**. Currently A-with-CI-green-since-2026-05-17 but single-tool (Lean only). Per BP-16, P0 invariants require ≥2 cross-checks.

**Empirical**:

- 17 theorems/lemmas in Lean artifact
- 0 hits for `chain_rule_proposition` / `Qdelta` / `Dop_LTI` in `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`
- 0 hits across all 19 TLA+ specs in `tools/tla/specs/`

**Historical anchor**: April 2026 Class 1 drift catch (`chain_rule` mis-named a Theorem-3.3 corollary as Proposition 3.2) is exhibit-A that single-tool review missed the failure mode the first time. Cross-check would have caught it independently.

## Routing decision (Soraya)

- Cross-check 2: **FsCheck cross-trace** on `Qdelta(Q1 ∘ Q2)(s) = Qdelta Q1 (Qdelta Q2 s)` at bounded depth. Effort: S.
- Cross-check 3: **Z3 pointwise lemma** on `D ∘ I = id` + `Dop_LTI_commute` arithmetic step (QF_LRA). Effort: S.

## TLA+-hammer guard

TLA+ was tempting. **REJECTED**: chain rule is a pointwise algebraic identity over operators, NOT a state-machine safety invariant. TLC would enumerate the product state space of two iterations and time out before catching the definitional-drift class. FsCheck + Z3 close the actual axes (real-code behaviour + arithmetic identity); TLA+ closes a different axis (interleaving) that nothing in the chain-rule statement depends on.

## Acceptance criteria

1. New FsCheck file `tests/Tests.FSharp/Formal/DbspChainRule.Properties.fs` (or extend existing Z3.Laws.Tests.fs) with property covering `chain_rule_proposition_3_2` and `Dop_LTI_commute` at bounded depth
2. Z3 lemma covering `D ∘ I = id` + `Dop_LTI_commute` arithmetic step (QF_LRA encoding)
3. Both cross-checks wired into CI (existing dotnet test gate is sufficient for FsCheck; Z3 may need explicit invocation)
4. `verification-registry.md` rows for `chain_rule_proposition_3_2` + `Dop_LTI_commute` updated to reflect 3-tool cross-check status

## Publication-readiness alignment

Per Soraya: "Single-tool evidence does not survive Budiu-grade peer review; converting from 'A-with-CI, single-tool' to 'A-with-CI, three-tool BP-16 compliant' is the line publication crosses." **This is the gap that gets the chain-rule artifact past the publication line** (after PR #4772 closed gaps #1+#2 — README + CI badge).

## Effort

S + S = total S+ (one evening per cross-check). Assignee: kenji.

## Composes with

- [`tools/lean4/Lean4/DbspChainRule.lean`](../../../tools/lean4/Lean4/DbspChainRule.lean) — the artifact needing cross-checks
- [`tools/lean4/README.md`](../../../tools/lean4/README.md) — landed via PR #4772; documents the artifact for reviewers
- [`docs/research/verification-registry.md`](../../research/verification-registry.md) — registry rows for `chain_rule_proposition_3_2` + `Dop_LTI_commute`
- [`docs/research/chain-rule-proof-log.md`](../../research/chain-rule-proof-log.md) — round-35 paper-drift audit substrate
- `memory/soraya/NOTEBOOK.md` — Round 43 entry (pending NOTEBOOK update; locate by `## Round 43` heading once landed; pruned-preserved)
