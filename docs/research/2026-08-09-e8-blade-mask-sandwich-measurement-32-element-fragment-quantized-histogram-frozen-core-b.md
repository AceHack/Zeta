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

   **What distinguishes the two surviving supports — pseudoscalar CLOSURE.**
   Two earlier explanations were tried; both are recorded here because each
   is instructive about *why* it fails. Head-to-head over the 14 weight-4
   codewords (computed; pinned by regression tests):

   | Criterion | Matches | Exactly the 2 survivors? |
   |---|---|---|
   | XOR-closed subgroup | 3 — {0,1,4,5}, {0,2,4,6}, {0,3,4,7} | No — under-determined |
   | Contains the pseudoscalar e₁₂₃ | 7 | No — far too weak |
   | **Closed under `i ↦ i⊕7`** (multiplication by I) | **2 — {0,3,4,7}, {1,2,5,6}** | **Yes** ✔ |

   *Why "XOR-closed subalgebra + coset" fails:* three pairs qualify, one
   survives. Necessary, not sufficient.

   *Why "the unique grade-complete subalgebra" fails:* it explains only
   **half the answer**. {0,3,4,7} does have grades {0,1,2,3}, but the other
   survivor **{1,2,5,6} has grades {1,1,2,2} and contains neither the scalar
   nor the pseudoscalar** — so grade-completeness cannot be the criterion
   that selects the pair. ({0,1,4,5} and {0,2,4,6} are equally genuine
   4-dimensional subalgebras, each ≅ Cl(2,0); they fail for a different
   reason — their even and odd halves span *orthogonal* 2-planes of ℍ, so no
   sign pattern can make q ∥ p. Subalgebra-hood is a red herring.)

   *Why closure is the right notion:* {1,2,5,6} = 1 ⊕ {0,3,4,7} is the
   **coset**, and closure under `i ↦ i⊕7` is **coset-invariant** (if S is
   closed, so is x ⊕ S) whereas "contains 7" is not. One criterion, both
   survivors — which is what an explanation has to do.

   **The algebraic content** (Lumen, math review 2026-08-09). With
   `Cl(3,0) ≅ ℂ ⊗ℝ ℍ` and `I = e₁₂₃` central (`I² = −1`), write `A = q + I·p`
   with `q, p ∈ Cl⁺(3,0) ≅ ℍ`. Then `A·Ã = (|q|²+|p|²) + I·(p q̄ − q p̄)`, so

   > **A is versor-normed ⟺ `p q̄ ∈ ℝ` ⟺ q and p are ℝ-collinear ⟺ A is a
   > DECOMPOSABLE element of ℂ⊗ℍ (a ℂ-multiple of a real quaternion).**

   Collinearity forces `span(q) = span(p)`, which is exactly why the support
   must be closed under multiplication by I.

   **Support-level talk is a lossy projection.** Only **8 of the 16 sign
   patterns** on each surviving support is versor-normed (16 single blades +
   8 + 8 = 32), so no support-level narrative could ever have been the whole
   characterization.

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

## ⚠ Two caveats that MUST travel with the number 32

Added after math review (Lumen, 2026-08-09). Neither weakens the core result —
the sandwich is emphatically **not** a W(E8) reflection action, and the residue
is a specific structure rather than noise — but both correct how "32" may be
stated.

### 1. "32-element E8 fragment" is wrong twice

- **It is not a sub-root-system.** The 32 fail closure under their own
  reflections. Their reflection closure is **48 roots = D₄ ⊕ D₄** — a genuine
  Borel–de Siebenthal maximal-rank subsystem of E8 — of which the 32 are 32 of
  48. (32 is not a sub-root-system size at all: A₁⁸=16, D₄=24, E₆=72, E₇=126,
  D₈=112.)
- **32 counts root-vectors, not symmetries.** The 32 induce only **8 distinct
  maps**, which generate a group of order **16 ≅ D₄ × C₂** inside W(E8) —
  index **43,545,600**. The 8 maps form the coset `−D₄`.

  Defensible phrasing: *"the sandwich realizes a `D₄ × C₂` subgroup of order 16
  inside W(E8) (index 43,545,600), carried by 32 of the 240 bridged roots via an
  8-element coset of conjugations."* Stronger than "32-element fragment", and it
  keeps the route-B disclaimer intact — 16 of 696,729,600 is still essentially
  nothing of the Weyl group.

### 2. **32 is LABELLING-DEPENDENT** — do not enter it into FROZEN-CORE bare

Sweeping all `8!` relabellings of code coordinates onto blade indices:

| versor-normed count | 16 | **32** | 48 | 64 | 96 |
|---|---|---|---|---|---|
| % of 40,320 labellings | 46.7 | **30.0** | 6.7 | 13.3 | 3.3 |

**Only the 16 single blades are labelling-invariant.** The extra 16 exist because
`AdinkraCode.fs`'s generator happens to place one complementary codeword pair on
the `i ↦ i⊕7` orbits of `Cl3.fs`'s blade indexing. So "32" is a fact about **this
pairing of two independent coordinate conventions**, not about E8 and Cl(3,0) as
such.

*(Sweep measured by Lumen during review; not independently re-run by Otto — flagged
so the provenance is legible.)*

**Convention-free by contrast** (these are safe to bank): the `ℂ⊗ℍ`
decomposability characterization, the identity `|det A|² + |v(A)|² = ⟨A,A⟩² = 16`,
the three-tier det/rank stratification, the rank-1 2-plane image, and
"≥ 16 versor-normed under any labelling".

### On the quantization {0, 64, 128, 240}

Now **derived**, not merely observed. Two exact invariants do the work: with the
ℂ-valued determinant `det(A) = |q|²−|p|² + 2I⟨q,p⟩`,

- **Identity A:** `|det(A)|² + |v(A)|² = ⟨A,A⟩² = 16`
- **Identity B:** `det(−A x Ã/4) = |det A|² · det(x) / 16`

The root set realizes only `|det|² ∈ {0, 8, 16}`, giving three tiers: `|det|²=16`
(32 roots, versor-normed ⇒ inner automorphism ⇒ **240** preserved); `|det|²=8`
(128 roots ⇒ Identity B halves `|det|`, and {0,8,16} is not closed under halving
⇒ **0**); `|det|²=0` (80 zero divisors, rank 1 ⇒ image is a single ℂ-line ⇒ 0, 64
or 128 as `4 × fiber size`).

So **64 and 128 are fixed-point counts of a rank-1 ℂ-linear map — not orbit or
stabiliser sizes.** Note this also refutes an earlier conjecture in this doc that
the tiers stratify by *the subalgebra the support generates*: they stratify by
**det/rank**, and both the 64-tier and the 128-tier share supports with the 0-tier.

**Anchors:** Conway–Sloane *SPLAG* (Construction A; D₄⊕D₄ in E8); Borel–de
Siebenthal 1949 (maximal-rank subsystems); Porteous / Lounesto (`Cl(3,0) ≅ ℂ⊗ℍ ≅
M₂(ℂ)`, versor vs versor-normed); Dechant 2016 (the true reflection action needs
`Cl(8,0)`); Gates et al. (adinkra ↔ doubly-even codes).
