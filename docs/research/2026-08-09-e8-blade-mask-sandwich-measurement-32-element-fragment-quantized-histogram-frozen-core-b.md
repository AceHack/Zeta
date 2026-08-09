# The blade-mask sandwich carries a 32-element E8 fragment — measured

*Otto (cowork cell), 2026-08-09. FROZEN-CORE §B measurement; the experiment
promised in `docs/letters/from-otto-tangle-math-reply.md` and sharpened by
Soraya's route-B routing
(`docs/research/2026-08-01-e8-route-b-cl8-versor-construction-of-we8-soraya-routing-and-proof-plan.md`).*

## The question, and what was already known

`CliffordE8Bridge.fs` identifies E8's ambient ℝ⁸ with the 8 blade
coordinates of Cl(3,0) — a linear isometry, honestly scoped: it never
claimed the geometric product generates the root system. Route B
(Soraya, 2026-08-01) added the grading argument: the popcount grading
scatters roots across grades 0–3, so "sandwiching here implements NO
W(E8) reflection" — the true versor construction lives in Cl(8,0)
(Dechant), where `CliffordE8Roots.fs` already reproduces orbit
closure = 240.

The grading argument says *not everything*. It does not say *how much*.
This document banks the number.

## Setup (byte-faithful to the F# oracles)

`src/Core.TypeScript/algebra/e8-blade-mask-sandwich.ts` replicates, in
exact integer arithmetic: the [8,4] extended Hamming generator
(`AdinkraCode.fs`), Construction A roots (`E8Lattice.fs` — 16 even
±2eᵢ plus 224 from weight-4 codewords under all sign patterns), and the
Cl(3,0) geometric product (`Cl3.fs` — mask-XOR with `reorderSign`;
reverse flips grades 2–3). Every bridged root has norm² = 4 and even
inner products, so the only division anywhere is by ⟨A·Ã⟩₀ = 4.

The operation under test is the versor formula transplanted verbatim
into the bridge: for bridged roots A, x,

s_A(x) = −A·x·Ã / ⟨A·Ã⟩₀.

Baseline for construction fidelity: the classical ℝ⁸ reflection
x ↦ x − ½(x·r)·r preserves the root set for **all 57,600** ordered
pairs — the theorem, reproduced, validating the replication.

## The measurement (golden numbers, asserted in the test)

Over all 240 × 240 = 57,600 ordered pairs (A, x):

1. **Versor-normed elements: exactly 32 of 240.** A bridged root A is
   versor-normed when A·Ã is scalar. The 32 sit on exactly 10 supports:
   the 8 single blades (the ±2·blade roots), plus the only two weight-4
   codewords whose supports align with Cl(3,0)'s own structure —
   {1,2,5,6} = {e₁, e₂, e₁₃, e₂₃} and its complement
   {0,3,4,7} = {S, e₁₂, e₃, e₁₂₃}.

   **What distinguishes {0,3,4,7} from the other XOR-closed subgroups.**
   There are exactly three XOR-closed subgroups of size 4 in the Hamming
   code: {0,1,4,5}, {0,2,4,6}, and {0,3,4,7}. Being XOR-closed is
   *necessary* but not *sufficient* — all three qualify, only one survives.
   The distinguishing property is the **grade profile** in Cl(3,0):

   | Support | Blades | Grades | Grade-complete? |
   |---|---|---|---|
   | {0,1,4,5} | {S, e₁, e₃, e₁₃} | {0,1,1,2} | No — missing grade 3 |
   | {0,2,4,6} | {S, e₂, e₃, e₂₃} | {0,1,1,2} | No — missing grade 3 |
   | **{0,3,4,7}** | **{S, e₁₂, e₃, e₁₂₃}** | **{0,1,2,3}** | **Yes — spans all 4 grades** |

   {0,3,4,7} is the unique XOR-closed subgroup that contains one element
   of every grade (scalar, vector, bivector, pseudoscalar). It is the only
   **grade-complete subalgebra** of Cl(3,0) among the three candidates.
   This is a direct computation, not a hunch. Its coset {1,2,5,6} inherits
   the alignment. Of the 14 weight-4 codewords, precisely this
   grade-complete pair is Clifford-aligned.

2. **Each of the 32 preserves ALL 240 roots** — 7,680/7,680 pairs. A
   perfect root-symmetry fragment lives inside the bridge.

3. **The other 208 quantize.** Per-A preservation histogram:

   | roots preserved | # of A |
   | --- | --- |
   | 0 | 160 |
   | 64 | 32 |
   | 128 | 16 |
   | 240 | 32 |

   Totals: 33,024 images have integer coordinates; 11,776 are roots
   (20.4%); 352 pairs are identity-fixed.

   **On the quantization {0, 64, 128, 240}.** The values 64 and 128 are
   empirical fixed-point counts — how many of the 240 roots a given A maps
   to roots — not orbit sizes of W(E8) (whose orbits are 240, 2160, etc.).
   64 and 128 are not divisors of 240, confirming they are measured counts,
   not group-theoretic orbit sizes. The stratification likely corresponds to
   how much of ⟨A·Ã⟩ leaks out of grade 0 (i.e., how far the support is
   from being grade-complete), but a closed-form predicate is an open
   question — see §"Newly minted open questions" below.

## Interpretation

The route-B disclaimer upgrades from an argument to a theorem-shaped
measurement: **the blade-mask sandwich implements exactly a 32-element
Clifford-aligned subset of the E8 root system that acts as root symmetries
under the sandwich, and nothing more.** (Note: "32-element E8 fragment"
is a convenient label for this subset; 32 is not a standard sub-root-system
size — A₁⁸=16, D₄=24, E₆=72 — so the phrasing means "32 roots that each
individually preserve all 240 roots under the Cl(3,0) sandwich", not a
closed sub-root-system.) It is nowhere near a reflection action (baseline
100% vs 20.4%),
so Cl(3,0) is confirmed as the basis/metric bridge only — but the
fragment is real, and its membership has a reason: an element acts as a
root symmetry precisely when its support is compatible with the algebra
that is doing the sandwiching. The two special codewords are where the
adinkra code and the Clifford blade structure agree.

## Newly minted open questions (not claims)

- **Characterize the group.** The 32 preserve the root set individually;
  sandwiches compose, so they generate a group of root symmetries inside
  the bridge. Conjecture: sandwiches by the 8 unit blades generate the
  signed blade-permutation group compatible with the mask structure — a
  small subgroup of W(E8) (order 696,729,600·2). Its order and
  conjugacy placement are computable next steps.
- **Explain the quantization.** Why exactly {0, 64, 128, 240}? The
  64/128 tiers likely stratify by the subalgebra the support generates
  (how much of A·Ã leaks out of grade 0). A closed-form predicate
  "preservation count = f(support class)" looks provable. Note: 64 and 128
  are empirical counts, not orbit sizes of W(E8).
- **F# second oracle.** Port the measurement beside `CliffordE8Roots.fs`
  so the golden numbers are cross-language byte-locked like everything
  else in §B. (The TS module deliberately reimplements rather than
  imports, so a port is a genuine second oracle.)

## Anchors

Dechant, *Clifford algebra is the natural framework for root systems
and Coxeter groups* (Adv. Appl. Clifford Algebras 26, 2016) and *The
E8 geometry from a Clifford perspective* (ibid. 27, 2017) — the true
versor construction, in Cl(8,0). Conway & Sloane, *Sphere Packings,
Lattices and Groups* — Construction A. Gates et al. — adinkra ↔
doubly-even self-dual codes. Humphreys, *Reflection Groups and Coxeter
Groups* — W(E8). In-repo: `CliffordE8Bridge.fs` (the honest scope this
measures), `CliffordE8Roots.fs` (the Cl(8,0) positive result), workitem
`081KYXCM1WK` (Soraya's Lean certification lane — unaffected; this
document measures the *other* bridge).
