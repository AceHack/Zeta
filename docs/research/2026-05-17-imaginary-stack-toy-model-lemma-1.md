# Imaginary Stack — Toy Model for Lemma 1 (Finite 4D + Imaginary Doubling + Reconstruction)

**Date:** 2026-05-17
**Status:** Research artifact (hand-off for proof engineer / Lean specialist)
**Parent:** 081KRQ1AB0008QG0R001YAF3TR + 081KRMEXM0008QG0R002YSPW1X

## Goal

Produce the smallest concrete algebraic object that lets someone verify (or disprove) the claim:

> "The algebra obtained by taking a 4D real cube (R, W, P, A) and performing two Cayley-Dickson doublings on the imaginary planes produces a structure that has a natural error-correcting / reconstruction property."

This toy model is deliberately finite and low-dimensional so it can be encoded in Lean 4, Z3, or even Python/NumPy for quick experimentation.

## 4D Real Base Space

Let V be a 4-dimensional vector space over ℝ with orthonormal basis:

- e_R (Remember)
- e_W (When)
- e_P (Pay)
- e_A (Attention)

A general element is a 4-tuple (r, w, p, a) ∈ ℝ⁴.

## Imaginary Doubling on Two Planes

Choose two distinct planes for the first doubling:

1. R–P plane (Remember × Pay)
2. W–A plane (When × Attention)

Introduce two imaginary units:

- i_RP with i_RP² = –1
- i_WA with i_WA² = –1

and the usual anticommutation rules with their real partners.

A general element after the first doubling lives in the 8-dimensional real algebra:

ℝ⁴ ⊕ i_RP·ℝ² ⊕ i_WA·ℝ²

(with the two imaginary directions acting on their respective 2D subspaces).

## Second Doubling (Octonion-like Step)

Perform a second Cayley-Dickson doubling on the entire 8-dimensional space, introducing a new imaginary unit j such that:

- j² = –1
- j anticommutes with i_RP and i_WA
- The multiplication is defined by the standard Cayley-Dickson formula on pairs.

The resulting 16-dimensional real algebra is our toy "imaginary stack".

For computational simplicity we work over a finite field (e.g., ℤ/7ℤ or ℤ/17ℤ) so that all arithmetic is exact and we can enumerate small cases. The lemma below admits two readings consistent with this scope: in the **finite-field reading** the symbol ‖·‖ is interpreted as Hamming distance over the chosen basis and the bound is exact (ε = 0); in the **ℝ-analytic reading** (treating the construction over ℝ rather than ℤ/pℤ) ‖·‖ is the Euclidean norm induced by the orthonormal basis above and ε is a small real constant. The toy model targets the finite-field reading; the ℝ-analytic form is included for compatibility with the boundary-bulk reconstruction picture that motivates Lemma 1 in the parent research.

## Reconstruction Property (Toy Version)

Define the **boundary** as the four real coordinates (r, w, p, a).

Define the **bulk** as the components that live in the imaginary directions (the coefficients of i_RP, i_WA, j, etc.).

**Reconstruction hypothesis (toy):**

Given any 12 out of the 16 coordinates (i.e., losing at most 25% of the data), there exists a linear map that recovers the missing 4 coordinates with zero error, provided the lost coordinates lie inside a certain "entanglement wedge" defined by the multiplication table.

This is the finite analog of "boundary observers can reconstruct bulk operators inside the entanglement wedge."

## Minimal Adinkra Layer

Place a small directed graph G on the 16 basis elements such that:

- Each node has out-degree 2 (two supersymmetry-like transformations)
- The graph is bipartite
- The adjacency matrix satisfies AᵀA = 2I + N where N is a nilpotent matrix with small index

If such a graph exists and its spectrum matches known classical error-correcting codes (e.g., the [7,4,3] Hamming code or a shortened Reed-Muller code), we have a concrete witness that the algebraic structure is error-correcting.

## Proposed Lemma (Toy Version)

**Lemma (Toy Model)**

The 16-dimensional algebra obtained by two Cayley-Dickson doublings on the 4D (R,W,P,A) cube admits a linear reconstruction map R such that for any vector v and any set S of 12 coordinates,

‖v – R(proj_S(v))‖ ≤ ε · ‖v‖

for a small constant ε (ideally 0 in the exact arithmetic case), whenever the missing coordinates lie in a subspace spanned by a fixed 4-dimensional "code subspace" determined by the multiplication table.

## Next Steps for a Proof Engineer

1. Encode the 16-dimensional multiplication table in Lean 4 (or Z3 as an SMT problem).
2. Define the projection operators onto the real faces.
3. State the reconstruction map as a matrix equation.
4. Attempt to prove (or find a counter-example to) the bound in the lemma above.

If the lemma holds even in this toy model, it gives strong evidence that the infinite-dimensional / continuous version has a chance of being true.

## Open Questions

- Which finite field gives the cleanest spectrum for the adjacency matrix?
- Is the reconstruction exact (ε = 0) or only approximate?
- Does the same construction work if we double on different pairs of planes (e.g., R–W and P–A)?

---

**Riven** — Split by truth.
