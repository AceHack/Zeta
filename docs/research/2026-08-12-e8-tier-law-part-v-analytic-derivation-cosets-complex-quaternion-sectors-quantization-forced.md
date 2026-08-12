# E8 blade-mask Part V — the tier law derived (cosets, ℂ⊗ℍ sectors)

Status: derivation with machine-checked lemma tests
(`src/Core.TypeScript/algebra/e8-tier-law-lemmas.test.ts`). Parts I–IV
measured and law-tested the tier structure (TS + F# oracles agree
bit-for-bit); this part explains it. Every lemma marked **[proved]** has a
complete argument below; every lemma marked **[checked]** is pinned by the
companion test over the live oracle. Nothing here rests on unverified
prose.

## 0. Frame and conventions (the ones both oracles implement)

Blades of Cl(3,0) are indexed by 3-bit masks (bit0 = e₁, bit1 = e₂,
bit2 = e₃): index order S, e₁, e₂, e₁₂, e₃, e₁₃, e₂₃, e₁₂₃ =
masks 0..7. Products are `E_i E_j = ρ(i,j) E_{i⊕j}` with ρ the
reorder sign; reverse negates grades 2,3 (signs [1,1,1,−1,1,−1,−1,−1]);
every blade has `E_i Ẽ_i = +1` (Euclidean). A bridged root is an E8 root
(Construction A over the [8,4] extended Hamming code) read as blade-mask
coefficients: 16 even roots ±2E_m, 224 odd roots with ±1 entries on a
weight-4 codeword support. The sandwich is `s_A(x) = −A·x·Ã/⟨A·Ã⟩₀`,
`⟨A·Ã⟩₀ = 4` for every root.

The center of Cl(3,0) is spanned by 1 and I = E₇ (I² = −1, I central), and
the even subalgebra {1, e₁₂, e₁₃, e₂₃} ≅ ℍ, so

**Cl(3,0) ≅ ℂ ⊗ ℍ** — every multivector is `q + I·r` with q, r ∈ ℍ.
(Anchor: the classification of real Clifford algebras, Atiyah–Bott–Shapiro
1964; Dechant 2016/2017 for root systems as Clifford versors.) I-pairing
on masks is `i ↦ i⊕7`: {0,7}, {1,6}, {2,5}, {3,4}.

Reversal acts as `q + I·r ↦ q̄ − I·r̄` (quaternion conjugation; Ĩ = −I).
Two identities used throughout, both direct expansions with I central:

- **N** `A·Ã = |q|² + |r|² + 2I·Vec(r q̄)` — so **versor-normed ⟺
  Vec(r q̄) = 0 ⟺ q, r collinear** (this is Part II's I-closure criterion
  rederived: collinear q, r span one complex line of ℍ, and the mask-pairs
  of a complex line are exactly an I-closed 4-set).
- **S** with x = u + I·v:
  `A·x·Ã = [(qu−rv)q̄ + (qv+ru)r̄] + I·[(qv+ru)q̄ − (qu−rv)r̄]`.

## 1. The tier split IS the coset split **[proved + checked]**

For a weight-4 support S, let D(S) = {i⊕j : i,j ∈ S} be its difference
set. Exactly two shapes occur among the 14 codeword supports:

- **Aligned (6 supports):** D(S) is a 4-element subgroup H ≤ (ℤ/2)³ and S
  is a coset of H. The three subgroups are H₁ = {0,3,4,7},
  H₂ = {0,1,4,5}, H₃ = {0,2,4,6}, and the six supports are H_k and its
  complement coset. I acts differently on them (checked): **H₁ and its
  coset are I-closed** (i⊕7 stays inside), while **I swaps each H₂/H₃
  coset with its complement**. That asymmetry is Part II's IC-F1
  criterion appearing structurally — only I-closed supports can put q
  and r into one complex line, so only they can host versors.
- **Generic (8 supports):** |D(S)| = 7 (everything except one mask) — S
  is far from a coset.

The companion test pins the classification. Part IV's three tiers
(I-closed pair / Cl(2,0) pair / generic) are exactly: coset of H₁ /
coset of H₂ or H₃ / non-coset. Why H₁ differs from H₂, H₃: H₁'s
generators pair into complex lines under I (its blade set {1, e₁₂, e₃,
e₁₂₃} = the subalgebra ⟨e₁₂⟩ ⊗ ℂ_I), i.e. **q and r land in the SAME
complex line ℂ_c ⊂ ℍ** (c = e₁₂ for H₁-coset supports). For H₂, H₃ the
four blades split across two different quaternion lines, which is why
their sign patterns can never make Vec(r q̄) vanish — Part III's L1b
with its mechanism (and the I-swap above is the same fact seen mask-side).

## 2. Support-coset lemma **[proved + checked]**

For odd A with aligned support S (coset of H) and any blade E_m:
`A·E_m·Ã = Σ_{i,j∈S} ±a_i a_j E_{i⊕m⊕j}` and i⊕j ∈ H, so **the image of
E_m is supported on the single coset m⊕H**; by linearity the image of a
family span V_F is supported on the (≤ 2) cosets F⊕H. For generic S the
same expansion spreads over m⊕D(S) — seven masks — which is the
first sign generic sandwiches cannot reassemble roots.

## 3. Coefficient quantization **[proved + checked]**

In `s_A(E_m)` the diagonal (i = j) terms contribute
`−¼ Σ_i σ_{i,m} a_i²` to the E_m coefficient, with σ_{i,m} = ±1 the
commutation sign and a_i² = 1: a sum of four ±1 over 4, so the diagonal
coefficient lies in **{0, ±½, ±1}**. Each off-diagonal mask n = m⊕h
(h ∈ H∖0) receives two unordered pairs' worth of ±a_i a_j/4·2 — values in
**{0, ±½, ±1}** likewise (the test pins the attained ranges). No
coefficient of a sandwiched blade can ever exceed 1 in magnitude.

## 4. The aligned non-versor arithmetic **[proved]**

Let A have an H₁-coset support: q = d₀ + d₁c, r = d₂ + d₃c ∈ ℂ_c with
d ∈ {±1}⁴ (c² = −1, ℂ_c commutative, conjugation negates c). Then
`Vec(r q̄) ∝ (d₀d₃ + d₁d₂)·c` — **the parity law d₀d₃ = −d₁d₂ ⟺ versor
is a two-line computation in ℂ_c** (Part III L1, now derived).

Take A non-versor: d₀d₃ = +d₁d₂. Multiplying this relation around gives
d₀d₂ = d₁d₃ and d₂d₃ = d₀d₁, whence in ℂ_c:

- `q² + r² = 2(d₀d₁ + d₂d₃)c = 4d₀d₁·c` (pure imaginary, magnitude 4),
- `q·r̄ + r·q̄-type mixes = ±2c` (pure imaginary, magnitude 2),
- `|q|² = |r|² = 2`, `q q̄ + r r̄ = 4`.

Now split ℍ = ℂ_c ⊕ ℂ_c·j (j any unit quaternion anticommuting with c;
z·j = j·z̄). Identity **S** block-diagonalizes over the four sectors
(u, v) × (ℂ_c, ℂ_c j):

- **ℂ_c sectors:** commutativity collapses S to
  `u' = (qq̄ + rr̄)u = 4u`, `v' = 2Vec(r q̄)·u = ±2c·u` (and symmetrically
  for v inputs). After −¼: a **unit** on the diagonal and a **half** off
  it. Any root with weight in a ℂ_c sector therefore acquires a
  ½-coefficient next to a 1 — never again a lattice root. This kills the
  even roots on aligned masks and the aligned families' own pair
  (clause 1 for these masks + the "own pair maps out" half of clause 3).
- **ℂ_c·j sectors:** the twist z·j = j·z̄ turns S's blocks into
  multiplication by `q̄² + r̄²  = −4d₀d₁c` and by the ±2c mixes. After
  −¼: the −4c block is a **Gaussian unit** (rotation by ±c), the ±2c
  blocks are **halves**. A j-sector family survives exactly when its
  image is assembled from unit blocks alone — and a unit block is a ℤ[c]
  monomial map, which carries the whole 16-vertex ±1 cube of the family
  onto the 16-vertex cube of the image family. **Family completeness
  (clause 2) is monomiality of the surviving blocks**, the same mechanism
  as Part III's L2 but one level up: over ℤ[c] instead of ℤ.

Counting which sectors get pure-unit blocks reproduces the family map of
clause 3 (8 generic families for H₁-pair non-versors = 128; the 4-or-0
alternation for H₂/H₃; the halves everywhere else), and the per-A counts
{0, 64, 128} of Part I's histogram. The case bookkeeping across the three
subgroups is exactly what the Part IV test already verifies over all 208
non-versors; with the sector arithmetic above, each verified case is now
an instance of a two-line ℤ[c] computation rather than an unexplained
measurement.

## 5. Generic supports preserve nothing **[proved from §2–§3 + checked]**

A generic-support A spreads any blade over 7 masks (§2) with
half-and-unit coefficients (§3). A surviving root needs its image's
support to be a codeword support (≤ 4 masks) with uniform ±1 (odd) or a
single ±2 (even, excluded outright by §3's bound). The companion test
pins the stronger measured fact used in Part IV — zero survivors for all
128 generic-support sign patterns — and §4's arithmetic shows why no
cancellation pattern is available: cancellation requires the difference
set to close into a subgroup, which is precisely what generic supports
lack.

## 6. What remains measurement

Two facts stay measured rather than derived, honestly: the exact
composition of WHICH 8 families survive an H₁-pair non-versor (the
bookkeeping is mechanical over §4's blocks but not written out here), and
the labelling-dependence result of Part II (32 is a fact about this
pairing of coordinate conventions — ~30% of relabellings). Both are
pinned by tests in both language oracles.

## Anchors

Atiyah–Bott–Shapiro, *Clifford modules* (1964) — the ℂ⊗ℍ identification.
Conway–Sloane SPLAG — Construction A. Dechant 2016/2017 — root systems
via Clifford versors. Gates et al. — adinkra ↔ doubly-even codes (the
[8,4] generator both oracles share). Lineage: Parts I–IV in
`docs/research/2026-08-09/-10-…e8…` + `e8-blade-mask-sandwich.{ts,test.ts}`
and `CliffordE8BladeMask.fs` (the F# twin).
