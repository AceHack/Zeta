# Routing the E8-route claims: "quotients nothing" is true, and it costs exactly as much

**Date:** 2026-08-25
**Work item:** `081M0XBP381087G0R001C2Q9W7`
**Author:** Soraya (formal-verification routing)
**Register:** Beacon for the anchors; Mirror for the routing shorthand.
**Standard applied:** `.claude/rules/numerology-vs-number-theory.md`,
`.claude/rules/toy-is-free-metered-must-be-earned.md`, BP-16 (cross-check).

**Verdict in one line:** the second-hand quote is real (at a corrected path), the docstring
under review is **literally true and rhetorically misleading**, the bivector route costs
**exactly as much** as the coded route on the only axis both are measured on, and it is
in-tree as **arithmetic with no construction** — which is the one item here that needs a tool.

**Lint honesty:** this file is `docs/research/2026-*-*.md`, which is in the
`.markdownlint-cli2.jsonc` **ignores** list (line 151). A `markdownlint` rc=0 on this file is a
check that did not run. Nothing here is claimed to be lint-verified.

---

## 0. Triage first — property class, instrument, and the refusals

| # | Claim | Property class | Instrument | Verdict |
|---|---|---|---|---|
| 2 | the `CssCode.Tests.fs:122` quote | **string identity** | `rg` | **CONFIRMED**, path in the report was wrong (§1) |
| 1a | Construction A collapses the vertex module below `dim Cl(0,N)` | **finite dimension count** | arithmetic + citation check | **already PROVEN in-tree**, do not redo (§2.1) |
| 1b | the bivector route "quotients nothing" | **categorical: sub vs quotient** | definition check | **TRUE literally, implicature FALSE** (§2.2) |
| 1c | the two routes' preservation defects | **closed-form identity** | 2-line algebra + a total xUnit test at 4 points | **NEW: they are EQUAL** (§2.3) |
| 1d | `so(16) ⊕ Δ⁺` *is* `e₈` | **algebraic identification** | executable bracket + exhaustive Jacobi | **NOT DONE — count only** (§2.4) |
| 3 | "true in classical, not quantum" | **parameter formula** | arithmetic on the in-tree CSS table | **wrong axis, right instinct** (§3) |
| 4 | "both adinkras can be true at once" | **doctrine, not mathematics** | none — write the table | **UPHELD**, table in §4 |

**Instruments explicitly refused, with the wrong-tool cost:**

- **TLA+ / PlusCal — refused on all seven.** Nothing in this cluster has a state machine, a
  temporal property, or a concurrency interleaving. A TLA+ spec here would model an
  invented transition system and go green over a property no one cares about: **false green
  in CI**, plus the human-week to write it. This is the most likely mis-route because TLA+ is
  the tool the fleet is most fluent in, and fluency is not a routing argument.
- **Lean 4 — refused for now on 1a and 1c.** Both are finite matrix-algebra dimension counts
  with two-line proofs. Formalising `Cl(0,N) ≅ M_{2^{N/2}}(ℝ)` in Lean is a **multi-week**
  Clifford-periodicity development to certify an argument a competent reader checks in a
  minute. Lean becomes the right instrument only if someone wants the statement quantified
  over **all** `N ≡ 0 (mod 8)` mechanically rather than as prose-plus-four-points; that is a
  real but low-value promotion, and it should be filed, not started.
- **Z3 / SMT — refused.** There is no satisfiability question here. The identity in §2.3 is
  closed-form over `ℕ`; handing it to an SMT solver with `2^n` in it invites the
  nonlinear-arithmetic incompleteness for zero benefit.
- **Alloy — refused.** No relational structure to search, no small-scope counterexample to hunt.
- **FsCheck / property testing — refused on all seven.** Every space named here is either
  exhaustible (the 902 doubly-even length-8 codes are already exhausted in-tree; `C(248,3)`
  triples are already exhausted in `E8LieAlgebra`) or parameterised by an integer where four
  points plus a proof beats a thousand samples. Sampling an exhaustible space is **strictly
  weaker than the trivial loop** and reports a probabilistic answer where a certain one is free.
- **A quantum simulator (Q#/Qiskit) — refused on item 3.** Nothing in item 3 is a circuit.
  Simulating one would answer a different question (does this circuit do what I typed) than the
  one asked (is the collapse mechanism substrate-dependent). Cost: CPU-days and a category error.

**Instrument actually needed:** exactly one — §2.4, and it is an *executable computation* in the
existing F# harness, not a proof assistant. Plus a **mutation run** (`stryker-config.json`) on
the new arithmetic test in §2.3 so it is a falsifier rather than a restatement.

---

## 1. Item 2 — CONFIRMED, at a corrected path

The reported path `tests/Tests.FSharp/Formal/CssCode.Tests.fs` **does not exist**. There is no
`CssCode.Tests.fs` under `Formal/`. The file is:

- `tests/Tests.FSharp/CssCode.Tests.fs` — one directory up.

At **that** file, **line 122** onward, verbatim:

```fsharp
    // The second adinkra family — the homoiconic, non-coded one — is the C = 0 case under
    // Doran-Faux-Gates-Hubsch-Iga-Landweber, i.e. the full 8-cube. Omitting it as degenerate is
    // what makes the table look like it has a gap. It has none: homoiconicity is bought by
    // declining exactly the quotient the protection lives in.
```

**The quote is accurate in content and in line number; only the directory was wrong.** Nothing
downstream needs retracting on this account. The sibling assertion is at
`src/Core/CssCode.fs:238-240`.

**And it is more than a comment.** The enclosing test computes `CC.adinkraClosureLength8 ()` and
pins the whole family, so the sentence has a machine-checked witness rather than only prose:

| `dim C` | CSS `(N,K,D)` |
|---|---|
| 0 | `(8, 8, 1)` — uncoded, homoiconic, **worst distance** |
| 1 | `(8, 6, 2)` |
| 2 | `(8, 4, 2)` |
| 3 | `(8, 2, 2)` |
| 4 | `(8, 0, 4)` — the `[8,4]` extended Hamming code, **zero encoded qubits** |

`K` falls and `D` rises monotonically in `dim C`. That is the trade, computed.

---

## 2. Item 1 — the highest-value item, split into four claims that have four different answers

### 2.1 "Quotienting collapses the vertex module below `dim Cl(0,N)`" — PROVEN, and not by me

This is already a theorem in-tree, with an anchor and a mechanised falsifier. **Do not spend a
round re-deriving it.**

- Statement: under Doran–Faux–Gates–Hübsch–Iga–Landweber, adinkraic chromotopologies are exactly
  `(ℤ/2)^N / C` for `C` doubly-even of length `N`, dimension `k`. Vertex count `2^(N−k)`. The
  algebra `Cl(0,N)` does not shrink: `dim = 2^N`. So `M ≅ A` (free of rank 1) **iff `k = 0`**.
- Where: `docs/research/2026-08-14-adinkra-minimal-homoiconicity-...-lumen.md` §2.1–2.2;
  `docs/research/2026-08-18-is-there-a-coded-adinkra-that-is-still-a-regular-representation-proven-no-...`;
  mechanised at `tests/Tests.FSharp/HomoiconicSeam.Tests.fs`.
- The defect is **quantised**: `defect := dim A / dim M = 2^k`. There is no "nearly homoiconic".
- Our case: `N = 8`, `k = 4` → `16` vertices against a `256`-dimensional algebra, defect `16`.

**Anchor status, stated honestly:** DFGHIL (arXiv:0806.0050, arXiv:0806.0051) is **cited in-tree
and I did not re-open the papers this session.** I am reporting the in-tree citation as-is, not
re-certifying it. The *arithmetic* consequence (`2^(N−k) < 2^N` iff `k > 0`) needs no anchor.

**Instrument for this claim: none needed.** It is discharged.

### 2.2 "The bivector route quotients nothing" — TRUE, and the implicature it carries is FALSE

The docstring at `src/Core/CliffordPeriodicity.fs:179-181` says exactly:

> `AdinkraCode.fs` reaches E8 by Construction A over the `[8,4]` code — which costs
> homoiconicity, because quotienting collapses the vertex module below `dim Cl(0,N)`. The
> bivector route quotients nothing.

Three sub-claims. **All three are true as written.** `Λ²(ℝⁿ)` is the grade-2 **subspace** of
`Cl(0,n)`, closed under the Clifford commutator, and `Λ²(ℝⁿ) ≅ so(n)` as a Lie algebra. A
subspace is not a quotient. No ideal is divided out. Correct.

**What is false is what the sentence is read as saying.** Placed immediately after "this is the
door out of the coded tower", it invites the inference *therefore the bivector route preserves
what quotienting cost*. It does not. Sub and quotient are dual failures of the same bijection:

| operation | map | how homoiconicity dies |
|---|---|---|
| **quotient** (Construction A) | surjective, `ker ≠ 0` | distinct algebra elements land on the same vertex — **collapse** |
| **subspace** (bivector) | injective, `image ≠ A` | `120` of `65536` basis elements are represented; the rest are **absent** |

Neither is a bijection `vertices ↔ algebra basis`. The coded route loses **injectivity**; the
bivector route loses **surjectivity**. "Quotients nothing" is a true statement about the *kind*
of loss, not the absence of one.

Numbers, computed: at `n = 16`, `dim Λ²(ℝ¹⁶) = 120`, `dim Cl(0,16) = 65536`, `dim e₈ = 248`.
The bivector route represents `248 / 65536 ≈ 0.38%` of its ambient algebra.

**Recommended edit (routed to the file's author, not applied by me):** keep all three clauses,
delete or qualify "the door out", and add one sentence — *"this is a subobject, not a quotient;
it does not recover homoiconicity, it fails it in the dual direction."*

### 2.3 NEW — the two routes' defects are **equal**, at every `N ≡ 0 (mod 8)`

Put both routes on one axis: `defect := dim A / dim M`, the same quantity §2.1 already uses.

For `N ≡ 0 (mod 8)`, `Cl(0,N) ≅ M_{2^{N/2}}(ℝ)` (Bott periodicity, `Cl(0,N+8) ≅ Cl(0,N) ⊗ M₁₆(ℝ)`),
and `Cl⁰(0,N) ≅ Cl(0,N−1) ≅ M_{2^{N/2−1}}(ℝ) ⊕ M_{2^{N/2−1}}(ℝ)` — the split-real row the
`halvesSeparateCleanly` clock already computes.

- **Maximally-coded adinkra.** A doubly-even **self-dual** binary code has `k = N/2` and exists
  exactly when `N ≡ 0 (mod 8)`. Vertex module `2^(N−k) = 2^{N/2}` — which is precisely the
  irreducible `Cl(0,N)`-module. `defect = 2^N / 2^{N/2} = **2^{N/2}**`.
- **Bivector / half-spinor route.** `Δ⁺` is a module over `Cl⁰(0,N)`, **not** over `Cl(0,N)` (odd
  elements swap the chiralities). So `A = Cl⁰(0,N)`, `dim = 2^{N−1}`; `M = Δ⁺`,
  `dim = 2^{N/2−1}`. `defect = 2^{N−1} / 2^{N/2−1} = **2^{N/2}**`.

> **They are equal. At every `N ≡ 0 (mod 8)`, the coded route and the half-spinor route pay the
> same defect `2^{N/2}`.**

**Why this is number theory and not numerology.** The equality is not a coincidence of counts; it
follows from semisimplicity in one line. For `M_d(ℝ)`: `dim = d²`, irrep `d`, `defect = d`. For
`M_d ⊕ M_d`: `dim = 2d²`, irrep `d`, `defect = 2d`. The even subalgebra **halves** the algebra
dimension **and** halves the irrep dimension **and** doubles the block count; the halvings cancel.
Competitor check: no other object is being identified here — this is an equality between two
computed quantities, not a match of a number to a named structure, so the identification hazard
the numerology rule guards does not arise. (§2.4 is where it *does* arise.)

Witness, computed this session (`node`, exact `BigInt`, no floats):

| `N` | `dim Cl(0,N)` | uncoded `M` | coded `M` (`k=N/2`) | `defect_coded` | `dim Cl⁰` | `dim Δ⁺` | `defect_spinor` | equal |
|---|---|---|---|---|---|---|---|---|
| 8 | 256 | 256 | 16 | **16** | 128 | 8 | **16** | ✔ |
| 16 | 65536 | 65536 | 256 | **256** | 32768 | 128 | **256** | ✔ |
| 24 | 16777216 | 16777216 | 4096 | **4096** | 8388608 | 2048 | **4096** | ✔ |
| 32 | 4294967296 | 4294967296 | 65536 | **65536** | 2147483648 | 32768 | **65536** | ✔ |

**Honest limit:** the proof above is prose and complete; the table is a **four-point witness**, not
a proof for all `N`. Do not upgrade "checked at four points" to "proven for all `N`" in any
downstream citation — the prose argument is what carries the general case.

**Routing call.** This belongs in-tree as a **total xUnit arithmetic test**, six lines, over
`N ∈ {8,16,24,32}` reusing `CP.bivectorDim` / `CP.halfSpinorDim` / `CP.dimensionOfType`, plus a
**mutation run** so it cannot pass vacuously. **Not FsCheck** — the parameter set is chosen, not
sampled. **Not Lean** — see §0. Routed to the `CliffordPeriodicity` author; Soraya does not write
the spec.

### 2.4 NEW, and this is the item that actually needs a tool — `so(16) ⊕ Δ⁺ = e₈` is a **count**, not a construction

Explicit-target search across `src/` and `tests/` for `so(16)`, `so16`, `spinor`, `128`:

- `src/Core/CliffordPeriodicity.fs` — the docstring, and `let e8FromSpinors = (16, 248)`, an
  integer tuple.
- `tests/Tests.FSharp/CliffordPeriodicity.Tests.fs:264` — asserts
  `bivectorDim 16 + halfSpinorDim 16 = 248`.
- `src/Core/E8LieAlgebra.fs` — **contains none of these strings.** It builds `e₈` from the root
  system by the Chevalley basis and checks Jacobi on all `C(248,3)` triples. That is rung 4 of the
  **Construction-A** ladder, downstream of the coded route.

> **There is no code in the tree that constructs a bracket on `so(16) ⊕ Δ⁺` and verifies it is a
> Lie algebra, let alone that it is `e₈`.** The route exists as `120 + 128 = 248`.

By this repo's own rule that is a **matching count**, and the rule requires naming the competitor
and the excluding invariant. Here is one, and it is not exotic:

> **Competitor:** `g = so(16) ⋉ Δ⁺` with `[Δ⁺, Δ⁺] = 0` — the graded contraction (Inönü–Wigner)
> of `e₈` with respect to the same `ℤ₂` grading. It has **dimension 248**, the **same**
> `120 + 128` decomposition, the **same** `so(16)` acting on the **same** `128`. It is **not**
> isomorphic to `e₈`.
>
> **Excluding invariant:** the bracket `Λ²Δ⁺ → so(16)` is nonzero — equivalently, the Killing
> form is nondegenerate, equivalently the algebra is simple. **That is exactly what the in-tree
> assertion does not check.** `120 + 128 = 248` cannot distinguish them and never could.

The same gap holds one rung down at `f4FromSpinors = (9, 52)`: `36 + 16 = 52` has the identical
competitor `so(9) ⋉ Δ₉`.

**Anchor status.** The *mathematics* is standard and correctly cited — `e₈ ≅ so(16) ⊕ Δ⁺₁₆` is in
Adams, *Lectures on Exceptional Lie Groups*, and the docstring names it. **The anchor is fine; the
artefact is the gap.** A correct citation attached to a dimension check is still a dimension check.
Under `toy-is-free-metered-must-be-earned` the route is **`unmetered`**, not `metered`, and should
be labelled so until a bracket exists.

**Routing call — the one tool assignment in this whole cluster:**

| what | instrument | why not the alternatives |
|---|---|---|
| build `Γ: Λ²Δ⁺ → so(16)` from the `Cl(0,16)` gamma matrices, define the bracket on `so(16) ⊕ Δ⁺`, run **exhaustive Jacobi** on all `C(248,3)` basis triples, and check the Killing form is nondegenerate | **executable F# in `tests/Tests.FSharp/Formal/`, mirroring the pattern `E8LieAlgebra.fs` already uses** | **Lean:** weeks of Clifford-module formalisation for a fact a triple loop settles in seconds — and the loop is already written once in this repo. **Z3:** no decision problem. **FsCheck:** `C(248,3) = 2,538,776` triples is exhaustible; sampling is strictly weaker. **TLA+:** no state machine. |

**Second half of the routing call, and it is the cheaper win:** once the bracket exists, the
**isomorphism to the Construction-A `e₈`** is the actual claim of interest ("two faces of one
object"), and its falsifier is an explicit isomorphism or a matching invariant — *not* a matching
dimension. Note PR #15424: at rank 8 an agreement between routes is **forced by uniqueness** and
carries **zero evidential value**. So this cross-check is worth running only because `e₈` the
*algebra* is not the rank-8 lattice uniqueness sink — the Jacobi/Killing check can genuinely fail,
which is what makes it a falsifier at all.

**Wrong-tool cost if this is left unrouted:** a docstring reading like a construction sits beside
a test reading like a verification, and every downstream synthesis inherits "we have two
independent routes to E₈" when the tree has one route and one arithmetic identity.

---

## 3. Item 3 — Aaron's classical/quantum cut: **wrong axis, right instinct**, and the real difference is computable

**The coordinator's hypothesis is upheld on the stated mechanism.** `dim M = 2^(N−k) < 2^N = dim A`
is a statement about finite-dimensional modules over a real Clifford algebra. It survives
complexification (`Cl(0,N) ⊗ ℂ ≅ Cl(N,ℂ)`, still `2^N`; the quotient still divides by `2^k`), and
"classical vs quantum" is not a variable it contains. **Adjudication: the mechanism in the
docstring is substrate-independent. That cut is on the wrong axis.**

**But Aaron is pointing at something real, and it is bigger than the thing he was disagreeing
with.** Two genuine differences, and the second is quantitative:

1. **Category.** In the stabiliser setting the logical algebra is `N(S)/S` — the centraliser of
   the stabiliser **modulo** the stabiliser, a **subquotient inside one Pauli algebra**. The
   stabiliser generators and the logical operators are elements of the *same* algebra. That is a
   form of self-reference a classical linear code does not have, and it is genuinely not the
   adinkra's "module quotient of a fixed algebra" shape. Naming the operation correctly matters:
   **subquotient ≠ quotient**.
2. **The exponent doubles — and it is already in the in-tree table.** For `CSS(C⊥, C⊥)` from a
   doubly-even `C` of length `N` and dimension `k`, the in-tree enumeration gives
   `K = N − 2k` (check against §1's table: `k=0→8`, `1→6`, `2→4`, `3→2`, `4→0` ✔). So:

   | | protected object | dimension | defect vs `2^N` |
   |---|---|---|---|
   | adinkra vertex module | vertex space | `2^(N−k)` | `2^k` |
   | CSS codespace | codespace | `2^(N−2k)` | **`2^{2k}`** |

   > **The CSS construction spends the code twice — once on `X`, once on `Z` — so the quantum
   > route pays double the exponent for the same `k`.** At `N=8, k=4`: the adinkra keeps 16
   > vertices; the CSS codespace collapses to **one state**.

**Verdict on item 3: partially upheld, on a corrected axis.** Not "classical vs quantum" — the
Clifford dimension count is the same in both. But "does the quantum setting differ" is **yes**,
and the difference is a factor of 2 in the exponent plus a change of operation from quotient to
subquotient. **Instrument: arithmetic on data already in the tree.** No Q#, no simulator, no proof
assistant. This is a two-line comparison, and it should land as a note beside the CSS table
rather than as a new artefact.

---

## 4. Item 4 — the route table. Aaron's reframe is upheld; the "trade" framing was the error

"Both adinkras can be true at once, many can" is correct, and the repo's own doctrine already says
so: **raw vault** — *a single version of the facts, never a single version of the truth* — and
**anti-Babel** — *reintegration is not reconvergence; both branches held with their paths
recorded*. The exclusive-or framing (homoiconicity **XOR** protection) is retracted here. What
replaces it is not a verdict but a ledger: each route held, with its path and its price.

| # | Route | In-tree site | Target object | Categorical operation | Preserves | Costs | Defect | Transfers to | Status |
|---|---|---|---|---|---|---|---|---|---|
| **R0** | uncoded `N`-cube adinkra (`C = 0`) | `CssCode.fs` dim-0 row; `HomoiconicSeam.Tests.fs` | `Cl(0,N)` regular rep — **not E₈ on its own** | none (free object) | **homoiconicity**: `M ≅ A`, `Q_I` = left mult by `γ_I` | **all protection**: `d = 1`, corrects nothing | **1** | nothing yet | **PROVEN** |
| **R1** | Construction A over `[8,4]` | `E8Lattice.fs`, `ConstructionATheta.fs` | E₈ **lattice** | **quotient** (code) + integral lift | evenness from double-evenness; 240 minimal vectors; theta series | homoiconicity | **2⁴ = 16** | → `E8LieAlgebra` (roots ⇒ Chevalley ⇒ `e₈`) | **PROVEN + byte-locked** |
| **R2** | bivector + half-spinor `so(16) ⊕ Δ⁺` | `CliffordPeriodicity.fs:192` | E₈ **Lie algebra** *(claimed)* | **subspace + module**, no quotient | the `ℤ₂` (parity) grading; needs no code | **completeness**: 248 of 65536 basis elements | **2⁸ = 256** at `n=16` — **equal to R1's at the same `N`** (§2.3) | nothing — **no bracket in tree** | **ARITHMETIC ONLY** (§2.4) |
| **R3** | icosian golden doubling `2I ∪ φ·2I` | `IcosahedralH3.fs:211-225` | E₈ **root system** (240 vectors) | union of two orbits, exact in `ℤ[φ]` | exact integer arithmetic; visible H₄/H₃ symmetry | **canonicity** — needs an explicit isometry (transposition of coords 5,7) to align with `E8Lattice.roots` | n/a (not a module quotient) | `E8Lattice.roots` via `e8Isometry` | **PROVEN** (invariant gate + target gate) |
| **R4** | versor/reflection orbit | `CliffordE8Roots.fs` | E₈ root system + `W(E8)` | **orbit closure** of a *derived* simple system | reflections as algebra elements; simple system found by Cartan-matrix search, not hardcoded | **independence** — starts in R1's integer frame, so it is not an independent route to the same object | n/a | `W(E8)` as versors | **PROVEN**, reproduces Dechant |
| **R5** | blade-mask bridge `Cl(3,0) ↔ ℝ⁸` | `CliffordE8Bridge.fs` | the **ambient `ℝ⁸`** only | **linear isometry** (bijection) | everything — it is a bijection; adds a grade labelling `1+3+3+1` | it **constructs nothing**; scope declared honestly in the file | **1** | grade labelling for R4 | **PROVEN**, scope stated |
| **R6** | `CSS(C⊥, C⊥)` quantum route | `CssCode.fs`, `CssCode.Tests.fs` | `[[8, 8−2k, d]]` stabiliser code | **subquotient** `N(S)/S` | error protection, up to `d = 4` | encoded qubits: `K = N − 2k` | **2^{2k}** — twice R1's exponent (§3) | — | **PROVEN + exhaustive** (902 codes) |

**Four readings of the table that are load-bearing:**

1. **R0 and R1 are the same family, not two families.** R0 is the `dim C = 0` row of R1's ladder.
   The "second adinkra" is the trivial end of one chain, and it is the **worst** row on distance.
2. **R4 and R5 are not independent of R1.** Both begin in R1's integer frame. **R3 is genuinely
   independent** (built from icosian units in `ℤ[φ]`). **R2 would be independent — if it existed.**
   For BP-16 purposes the tree currently has **two** independent roads to the E₈ root system
   (R1, R3), not five.
3. **At rank 8 that independence buys nothing anyway.** PR #15424: rank 8 is a **uniqueness
   sink** — exactly one even unimodular rank-8 lattice — so routes "agreeing" there agree by a
   theorem about the target. **Zero evidential value.** Any BP-16 cross-check that wants to mean
   something must run at **rank 16, where the routes disagree**. Repeating the rank-8 agreement in
   a new artefact would be manufacturing confirmation.
4. **The defect column is the honest comparator, and it refuses the ranking the discussion wanted.**
   R0 pays 1 and protects nothing. R1 and R2 pay the same `2^{N/2}`. R6 pays `2^{2k}`. Nobody is
   free; the routes differ in **what kind** of loss they take, not in **whether**.

---

## 5. Items 5 and 6 — not touched

- **Item 5 (CFGs are initial algebras of their production functor).** Settled, rigorous, owned by
  another agent. Not re-derived here. The one thing this table offers that thread: **R0 vs R1 is
  exactly free-object vs quotient-by-relations**, and the price is measured (`defect = 2^k`,
  quantised). If the syntax/semantics split is claimed to carry the same structure, the transferable
  question is *what plays the role of the defect there* — a free/quotient analogy with no measured
  price is a shape, not a result.
- **Item 6 (PR #15424, #15423).** Used above, not redone. Both verified to exist: #15424 **MERGED**
  (*"rank 16 is where the E8 routes disagree — the rank-8 agreement was forced"*), #15423 **OPEN**.

---

## 6. What stays riffing, and should stay labelled riffing

Cutting these is the point, not a shortfall.

- **"The door out of the coded tower."** Rhetoric that carries a false implicature (§2.2). Keep the
  three true clauses; drop the metaphor.
- **"One clock, three rungs"** (`(0,8) → 8`, `(7,7) → 64`, `(0,16) → 128`). The arithmetic is
  correct and mechanised. It is **not evidence for anything downstream** — it is the same mod-8
  fact read at three points. Fine as exposition, inert as support.
- **"Two faces of the same object."** True and standard for the lattice/algebra pair (the E₈
  lattice *is* the root lattice of `e₈`). But in-tree it currently relates R1 to R1-via-Chevalley,
  **not** R1 to R2 — because R2 has no object yet (§2.4). Do not cite this phrase as a bridge
  between the coded and uncoded towers until the bracket exists.
- **The homoiconicity/protection "trade" as exclusive-or.** Retracted (§4). It is a **ledger of
  priced routes**, not a fork with two prongs.
- **`f₄ = so(9) ⊕ Δ₉`, `36 + 16 = 52`.** Same status as R2: correct arithmetic, no construction,
  same named competitor. Keep it, keep it labelled `unmetered`. It is a second data point for a
  recipe the tree does not implement, which is worth exactly as much as one.

---

## 7. Routing summary

| item | instrument | owner | priority |
|---|---|---|---|
| §2.2 docstring edit — add the sub-vs-quotient sentence, drop "door out" | prose | `CliffordPeriodicity.fs` author | **now**, it is one sentence and it stops a false inference propagating |
| §2.3 defect-equality test at `N ∈ {8,16,24,32}` + mutation run | total xUnit arithmetic; **not** FsCheck, **not** Lean | Kenji or the module author | high — cheap, and it converts a prose proof into a guarded one |
| §2.4 construct the `so(16) ⊕ Δ⁺` bracket; exhaustive Jacobi + nondegenerate Killing | executable F# in `tests/Tests.FSharp/Formal/`; **not** Lean, **not** Z3 | routed, needs an owner | **highest** — it is the only claim here that is currently a count wearing a construction's clothes |
| §3 note the `K = N − 2k` doubling beside the CSS table | arithmetic, in-place comment | `CssCode.fs` author | medium |
| §2.1, item 5, item 6 | **none** | — | already discharged; re-deriving is waste |
| generic-`N` mechanisation of §2.3 | Lean 4 | **file it, do not start it** | low — the prose proof is two lines |

Soraya routes; she does not write the specs. Each row above is a handoff, not a claim of work done.
