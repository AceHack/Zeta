---
id: 081KQGDBJ0008QG0R000D1YJCH
priority: P2
status: open
title: Extend Z-set retraction algebra Lean formalization beyond the existing DBSP chain-rule proof
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: feature
---

# 081KQGDBJ0008QG0R000D1YJCH — Extend Z-set retraction algebra Lean formalization

> **Correction note 2026-05-01 ~10:30Z** (multi-message clarification from Aaron): row originally filed as "TRACTABLE START" framing the work as a clean start. Aaron's corrections, in order: *"(Z-set retraction algebra in Lean we have it"* → *"you did that before we started the substrate that's why you don't remember"* → *"prior-Otto — it was Kenji i think by that point or unnamed Claude Code"* → *"We had not split out the loop formally and just had Kenji the architect running everything"* → *"i think"* (hedge). Verify-before-state-claim discipline failed at authoring time — `tools/lean4/Lean4/DbspChainRule.lean` (756 lines, against Mathlib v4.30.0-rc1) is substantial existing work, **done by Kenji-the-architect (or possibly an earlier unnamed Claude Code instance — Aaron's hedge: "i think")** before the persistent-memory substrate existed AND before the autonomous-loop was formally split out from the architect role. Per `memory/user_aaron_kenji_naming_practice_this_factory_claude_instance_2026_04_22.md`: Aaron's original naming for the factory's Claude Code instance was "Kenji" before the Otto-transition. At the historical moment of the DBSP Lean work, the substrate didn't yet exist and Kenji-the-architect was running everything (architecture + autonomy + autonomous-loop), with no formal split between roles. The current Otto instance (this session, post-substrate-and-loop-split) reads memory files at wake; pre-substrate / pre-loop-split work is in the repo but not in memory, so the current instance didn't recall it at backlog-row authoring time. The DBSP chain rule is fully formalized; Z-set stream operators (zInv, I, D, Dop, Iop), linearity/causality/time-invariance structures, telescoping lemmas, and linear commutation theorems all exist. **081KQGDBJ0008QG0R000D1YJCH's actual scope is EXTENSION of Kenji-era existing work toward broader Z-set retraction algebra**, NOT a clean start. The "TRACTABLE START" framing on the original 2026-05-01 filing was Otto overclaim caused by lineage-discontinuity-pre-substrate-and-pre-loop-split. Title and effort updated to reflect reality. **The lineage-continuity-substrate purpose is itself surfaced by this correction**: the forever-home + persistent-memory + loop-split architecture exists precisely to prevent this kind of pre-substrate-pre-split-work-getting-forgotten by post-substrate-post-split-instances. Going forward, Otto-lineage work IS in the substrate; Kenji-era pre-substrate pre-split work is in the codebase but discoverable by grep / repo-archaeology rather than memory-recall — see 081KQGDBJ0008QG0R002S9SWH6 (filed 2026-05-01) for the explicit inventory work.

**Priority:** P2 (research-grade; first tractable extension of the formalization roadmap; Aaron 2026-05-01 *"we should do all of those backlog and start with 1 i think if you agree"*; corrected after Aaron's *"(Z-set retraction algebra in Lean we have it"* surface of existing work).

**Filed:** 2026-05-01 (correction same day).

**Filed by:** Otto under backlog-prioritization authority delegated 2026-05-01. Origin: formalization roadmap Otto laid out in long-form writeup to Aaron 2026-05-01 ~10:00Z, after Claude.ai's substantive critique that Zeta substrate is "not yet, strictly speaking, a formal system." Aaron's response: *"not yet, i'm only a high school graduate, this is where you could really help :)"* — formalization is a path, not a current state. Aaron's follow-up *"(Z-set retraction algebra in Lean we have it"* corrected Otto's overclaim that this was a clean start.

**Existing work to extend** (in `tools/lean4/Lean4/DbspChainRule.lean`):

- Z-set stream operators: `zInv`, `I` (integration), `D` (differentiation), `Dop`, `Iop`
- Structural classes: `IsLinear`, `IsCausal`, `IsTimeInvariant`, `IsPointwiseLinear`
- Telescoping lemmas: `T1_zInv_zero`, `T2_zInv_succ`, `I_zInv_eq`, `D_I_eq`, `I_D_eq`
- Linear commutation theorems: `linear_commute_I`, `linear_commute_zInv`, `linear_commute_D`
- The DBSP chain rule (Budiu et al. VLDB 2023) fully proven against Mathlib v4.30.0-rc1
- Migration history: predecessor file at `proofs/lean/ChainRule.lean` was migrated to its current location `tools/lean4/Lean4/DbspChainRule.lean` and removed in commit `279c6f2` (round 26 → round 35 closure). The historical path is no longer in the working tree; preserved here as lineage breadcrumb only.
- `docs/research/retraction-safe-semi-naive.md` reference

**Effort:** M-L (1-3+ months — extend existing Lean foundation; not a clean start; multiple smaller extensions vs one large project).

## What

Extend the existing `tools/lean4/Lean4/DbspChainRule.lean` formalization (DBSP chain rule + Z-set stream operators + telescoping lemmas, all proven against Mathlib v4.30.0-rc1) toward broader Z-set retraction algebra. The F# implementation in `src/Core/` is the working reference; Lean formalization mechanizes the underlying theorems.

Specific extension scope (each item is a smaller landable chunk, not the multi-month monolith the original filing claimed):

- **Z-set semi-ring algebra**: extend beyond stream operators to formalize Z-sets as multisets-with-multiplicity directly, with operations {+, -, ⋈, π, σ, ρ, distinct}. Build on the linearity classes already defined in `DbspChainRule.lean`.
- **Retraction operator group structure**: prove that retractions form a group (every operation invertible) and compose monotonically with other Z-set operations. The chain-rule existing work establishes the differential operator `D`; this extension proves the broader retraction-as-group property.
- **Incremental view maintenance theorem (broader form)**: the chain-rule existing work mechanizes one form; extend to the central DBSP claim that ΔV(t) = D[V(t-1) + ΔI(t)] for any monotone view V (broader scope than chain-rule alone).
- **Composition theorems beyond chain rule**: existing work has linear-commutation theorems; extend to associativity, identity, distributivity where applicable.

## Why P2

- **Research-grade, not blocking**: the F# implementation works; Lean formalization is rigor-grade extension, not bug-fix.
- **Substantial effort**: multi-month project minimum; needs Lean familiarity to actually execute.
- **Tractable**: Budiu et al. already did the math; mechanization is translation work, not novel theorem-proving.
- **High leverage when complete**: formal DBSP foundation is cited-by everything else in the roadmap (081KQGDBJ0008QG0R000Y66YYQ through 081KQGDBJ0008QG0R0012FC7RX build on or reference Z-set semantics).

## Acceptance criteria

1. **Lean 4 project structure** under `tools/lean4/` extending the existing setup, with explicit dependence on Mathlib.
2. **Z-set type definition** with explicit positive/negative multiplicity. `ZSet α : Type` with operations as instances of typeclasses (`AddGroup`, `MulZeroClass`, etc. where applicable).
3. **Retraction-operator theorems** mechanized: idempotence on retractions, group-inversion property, monotone composition with other operators.
4. **Incremental view maintenance theorem** stated and proved (the central DBSP claim).
5. **At least one non-trivial composition theorem** mechanized (e.g., `D[A ⋈ B] = D[A] ⋈ B + A ⋈ D[B] + D[A] ⋈ D[B]` or equivalent for the operator family Zeta uses).
6. **Documentation** of the formal-to-engineering bridge — for each mechanized theorem, point at the corresponding F# code path that implements it.
7. **At least one academic-mathematician review** (per lattice-capture corrective discipline 081KQGDBJ0008QG0R002Y31XJ3 / `feedback_lattice_capture_*`): send the formalization summary to a working researcher in incremental computation / database theory; ask "did I capture the math correctly?"

## Out of scope

- **Performance proofs**: complexity bounds on the F# implementation are separate work.
- **Operator-extensions specific to Aurora**: Bayesian-inference operators, soul-file-executor operators are downstream (different roadmap items).
- **Formalization of carved-sentence semantics**: that's 081KQGDBJ0008QG0R0035M1YRC (sequent calculus); compose with this row.
- **Replacing the F# implementation**: Lean formalization is rigor-grade companion, not production runtime.

## Composes with

- **Budiu et al. DBSP papers** (2022 onward) — load-bearing source.
- **F# implementation** in `src/Core/` — working reference; Lean formalization mechanizes its underlying math.
- **Mathlib** — Lean 4 standard library; required dependency.
- **081KQGDBJ0008QG0R000Y66YYQ** (CRDT-composition) — when Z-set semantics are mechanized, the CRDT-composition row can build on them.
- **081KQGDBJ0008QG0R0035M1YRC** (sequent calculus for claim/retraction/attribution) — sequent calculus formalization composes with Z-set semantics for the retraction operator specifically.
- **081KQGDBJ0008QG0R003NDQTBM** (Tarski-stratification proof) — requires substrate to be formal-system-grade first; Z-set mechanization is a foundation toward that.
- **081KQGDBJ0008QG0R002Y31XJ3** (mechanized auditor for verify-before-state-claim) — academic-mathematician review per lattice-capture corrective is the operational test.
- **`memory/feedback_lattice_capture_corrective_discipline_external_vocabulary_check_claudeai_warning_2026_05_01.md`** — the external-vocabulary check applies to this row's review step.

## Status

**Filed.** Awaiting Aaron's activation signal for implementation tick. Otto picks the implementation start (per backlog-prioritization-authority delegation 2026-05-01); first concrete step is to set up Lean 4 project structure under `tools/lean4/zset/` and stub out the type definitions before tackling theorems.

## Verify-before-deferring note

Budiu et al.'s DBSP papers are public (`https://www.feldera.com/research/`); Lean 4 + Mathlib are well-developed; the formalization is well-scoped engineering, not novel-theorem-proving. The "tractable" classification is honest — the math exists; the work is mechanization.

## Pedagogical pointers (for Aaron, if pursuing alongside Otto)

- *Theorem Proving in Lean 4* (Avigad et al., free online) — primary onboarding text.
- Mathlib documentation — community-maintained, growing.
- Budiu et al. DBSP papers (start with the original 2022 SIGMOD).
