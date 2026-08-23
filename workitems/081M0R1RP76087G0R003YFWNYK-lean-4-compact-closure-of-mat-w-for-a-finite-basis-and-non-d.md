---
id: 081M0R1RP76087G0R003YFWNYK
type: task
state: backlog
priority: P2
slug: lean-4-compact-closure-of-mat-w-for-a-finite-basis-and-non-d
title: "Lean 4: compact closure of Mat(W) for a finite basis, and non-dualizability for an infinite one"
created: 2026-08-23T19:32:39.270Z
depends_on: []
composes_with: []
---

# Lean 4: compact closure of Mat(W) for a finite basis, and non-dualizability for an infinite one

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R1RP76087G0R003YFWNYK-*.md` glob. -->

**Route to:** `formal-verification-expert` (Soraya). **Tool recommended: Lean 4** — this is
coherence/equational content that Z3 cannot express. Mathlib carries
`CategoryTheory.Monoidal.Rigid` (`ExactPairing`, `evaluation` / `coevaluation`), `Matrix`,
`Module.Dual`, `Basis`.

**Analysis this comes from:** `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §1.

## Two obligations

**S1 (positive).** For `W` a **commutative semiring** and `K` a **finite** type, the category
`Mat(W)` — objects finite types, morphisms `K₁ → K₂` the `W`-matrices, ⊗ the Kronecker product
on `K₁ × K₂` — is symmetric monoidal and **compact closed with self-dual objects**, via
`η = Σ_{k∈K} e_k ⊗ e_k` and `ε(e_i ⊗ e_j) = δ_ij`. Prove **both** snake (triangle) identities.

Two conditions must appear as *hypotheses in the statement*, because §1.3 shows both are
load-bearing and neither is currently expressible in the shipped types:

- **commutativity of `W`** — needed for the interchange law `(A⊗B)(C⊗D) = (AC)⊗(BD)`, i.e. for ⊗
  to be a bifunctor at all. This is **stricter** than the associativity ceiling already documented
  in `src/Core.Abstractions/IStarRing.cs` (ℍ and below); commutativity caps the Cayley–Dickson
  tower at **ℂ**.
- **no field, no additive inverse** — the snake computation consumes only `0`, `1`, associativity
  and distributivity. The statement must *not* assume a ring, or the tropical / log-probability /
  Boolean corners are excluded for no reason.

**S2 (negative, and the reason this is not just a comment).** For infinite `K`, the free module
`⊕_K W` is **not dualizable**: its dual is `∏_K W ≇ ⊕_K W`, so no `η` exists. This is what
justifies a `FiniteKey` refinement in the code phase rather than a docstring.

## Why it matters

DisCoCat (Coecke–Sadrzadeh–Clark 2010) sends pregroup reductions (Lambek 1958, 2008) to cups and
caps and therefore **requires** compact closure. §1.1 of the analysis shows the tree today has the
**cap** (`WeightedSet.inner`) in one file and the **tensor** (`WSet.tensor`) in another, and the
**cup in neither** — so the snake identities are not merely unproven, they are *unstatable*.

## Falsifier

Exhibit a commutative semiring and a finite `K` for which a snake identity fails (this would
refute the borrowed theorem and is the check that must be able to fire), **or** show the shipped
types admit no `FiniteKey` refinement without breaking a current consumer.

## Anchors (checked)

- Kelly & Laplaza, *Coherence for compact closed categories*, JPAA 19 (1980).
- Selinger, *A survey of graphical languages for monoidal categories* (2011) §4.4 — `Mat(S)` over
  a commutative semiring. **This is the anchor that entails the claim**; CSC 2010 alone does not,
  because it works in `FdHilb` and assumes the field.
- Houston, *Finite products are biproducts in a compact closed category*, JPAA 212 (2008) — why a
  future "make everything copyable" refactor would collapse the structure (§1.5).

## Not in scope

Implementation. Aaron sequenced code after the analysis.
