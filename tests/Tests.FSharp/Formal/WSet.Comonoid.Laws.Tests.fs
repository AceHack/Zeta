module Zeta.Tests.Formal.WSetComonoidLawsTests

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// WSet COMONOID LAW PACK + THE DISCRIMINATOR (081KYXE4W8808QG0R0011X8S70)
//
// `WSet<'K,'W>` is the universal tensor of the Markov / CD hexagon
// (design: docs/research/2026-08-01-markov-category-hexagon-…, POST-
// VALIDATION §). Read as a 'W-vector over basis 'K it carries a
// commutative comonoid:  copy Δ (diagonal) and discard ! (Σ weights).
//
// This pack proves, over the ℤ ring (the DBSP base corner):
//   (1) the comonoid laws — coassociativity, counitality, cocommutativity;
//   (2) THE DISCRIMINATOR (the whole point — Fritz's axis): a deterministic
//       `arr g` IS a comonoid homomorphism (copy- AND discard-natural),
//       while a signed/branching `a ↦ b + c` is NOT (copy-naturality grows
//       cross terms b⊗c + c⊗b; discard-naturality doubles the mass).
//       Both directions: positive property + negative controls.
//
// Anchors (Beacon): Fritz 2020 (Markov categories / copy-discard / causality);
// Cho–Jacobs 2019 (CD categories); Fox 1976 (cartesian ⟺ natural comonoid —
// the deterministic corner); Aji–McEliece 2000 (GDL — the one-circuit /
// N-semiring unifier `WSet` instantiates); Coecke–Kissinger (the ℂ no-cloning
// corner as a comonoid failure).
// ═══════════════════════════════════════════════════════════════════

// ── the ℤ '*'-ring: (ℤ,+,×) with identity conjugation (ℝ⊇ℤ has no imaginary
//    part). Named src instance: IntegerRing.Star. Weights kept small. ──
let private intStar : IStarRing<int64> = IntegerRing.Star

let private isZeroI (w: int64) = w = 0L

let private consol<'K when 'K: comparison> (s: WSet.WSet<'K, int64>) : WSet.WSet<'K, int64> =
    WSet.consolidate intStar isZeroI s

// ── generator: a small ℤ-weighted set over keys 0..4 (forces diagonal
//    collisions), weights −6..6 (bounded so Checked-free ops never overflow). ──
type private WSetArb =
    static member Raw() : Arbitrary<(int * int64) list> =
        gen {
            let! n = Gen.choose (0, 6)
            let! ps =
                Gen.listOfLength
                    n
                    (gen {
                        let! k = Gen.choose (0, 4)
                        let! w = Gen.choose (-6, 6)
                        return (k, int64 w)
                    })
            return ps
        }
        |> Arb.fromGen

// ═══════════════════════════════════════════════════════════════════
// (1) THE COMONOID LAWS on WSet over ℤ
// ═══════════════════════════════════════════════════════════════════

// Coassociativity: (Δ ⊗ id) ∘ Δ = (id ⊗ Δ) ∘ Δ. Both re-key the diagonal
// {(a,a)} into the triple diagonal {(a,a,a)}; equality holds precisely
// BECAUSE Δ is diagonal (were it off-diagonal the two sides would differ).
[<Property(Arbitrary = [| typeof<WSetArb> |])>]
let ``WSet copy Δ is coassociative`` (raw: (int * int64) list) =
    let s = consol raw
    let dd = WSet.copy s
    let lhs = dd |> List.map (fun ((x, y), w) -> (x, x, y), w) |> consol
    let rhs = dd |> List.map (fun ((x, y), w) -> (x, y, y), w) |> consol
    lhs = rhs

// Counitality: (ε ⊗ id) ∘ Δ = id = (id ⊗ ε) ∘ Δ. Applying ε to one factor
// is marginalising (summing out) that coordinate of Δ(s); the diagonal
// collapses back to s.
[<Property(Arbitrary = [| typeof<WSetArb> |])>]
let ``WSet copy Δ is counital (left and right)`` (raw: (int * int64) list) =
    let s = consol raw
    let dd = WSet.copy s
    let sumOutFirst = dd |> List.map (fun ((_, y), w) -> y, w) |> consol // (ε ⊗ id) ∘ Δ
    let sumOutSecond = dd |> List.map (fun ((x, _), w) -> x, w) |> consol // (id ⊗ ε) ∘ Δ
    sumOutFirst = consol s && sumOutSecond = consol s

// Cocommutativity: swap ∘ Δ = Δ (the comonoid is commutative — copy is
// symmetric, the Markov-category default).
[<Property(Arbitrary = [| typeof<WSetArb> |])>]
let ``WSet copy Δ is cocommutative`` (raw: (int * int64) list) =
    let s = consol raw
    let dd = WSet.copy s
    let swapped = dd |> List.map (fun ((x, y), w) -> (y, x), w) |> consol
    swapped = consol dd

// discard ! = Σ weights (sanity: it is the total mass, the all-ones covector).
[<Property(Arbitrary = [| typeof<WSetArb> |])>]
let ``WSet discard ! is the total weight`` (raw: (int * int64) list) =
    let s = consol raw
    WSet.discard intStar s = (s |> List.sumBy snd)

// ═══════════════════════════════════════════════════════════════════
// (2) THE DISCRIMINATOR — comonoid-naturality IS the corner (Fritz's axis)
// ═══════════════════════════════════════════════════════════════════

// A morphism f applied to a state = `WSet.apply ring op`.
//   deterministic `arr g`  : op k = [ g k, one ]          (single-key image)
//   branching  `a ↦ b + c` : op _ = [ b, one; c, one ]    (two-key image, b ≠ c)
let private detOp (g: int -> int) : int -> WSet.WSet<int, int64> =
    fun k -> [ g k, intStar.One ]

let private branchOp (b: int) (c: int) : int -> WSet.WSet<int, int64> =
    fun _ -> [ b, intStar.One; c, intStar.One ]

// copy-naturality:  Δ_B ∘ f  =  (f ⊗ f) ∘ Δ_A
let private copyNatLHS (op: int -> WSet.WSet<int, int64>) (s: WSet.WSet<int, int64>) =
    WSet.apply intStar op s |> WSet.copy |> consol

let private copyNatRHS (op: int -> WSet.WSet<int, int64>) (s: WSet.WSet<int, int64>) =
    WSet.copy s
    |> List.collect (fun ((k1, k2), w) ->
        WSet.tensor intStar (op k1) (op k2)
        |> List.map (fun (kk, w2) -> kk, intStar.Mul(w, w2)))
    |> consol

// discard-naturality:  ε_B ∘ f  =  ε_A
let private discardNat (op: int -> WSet.WSet<int, int64>) (s: WSet.WSet<int, int64>) =
    WSet.discard intStar (WSet.apply intStar op s) = WSet.discard intStar s

// ── POSITIVE: a deterministic `arr g` IS a comonoid homomorphism ────────────
[<Property(Arbitrary = [| typeof<WSetArb> |])>]
let ``discriminator (+): deterministic arr g is copy-natural`` (raw: (int * int64) list) =
    let s = consol raw
    let op = detOp (fun k -> k * 7 + 1)
    copyNatLHS op s = copyNatRHS op s

[<Property(Arbitrary = [| typeof<WSetArb> |])>]
let ``discriminator (+): deterministic arr g is discard-natural`` (raw: (int * int64) list) =
    let s = consol raw
    discardNat (detOp (fun k -> k * 7 + 1)) s

// ── NEGATIVE: a branching / signed map is NOT a comonoid homomorphism ────────
// copy-naturality FAILS whenever the total mass ε(s) ≠ 0: the RHS `(f ⊗ f) ∘ Δ`
// grows the cross terms b⊗c + c⊗b (each carrying weight ε(s)) that the LHS `Δ ∘ f`
// (diagonal only) can never carry. When ε(s) = 0 the cross terms vanish and both
// sides collapse to the zero vector — so ε(s) ≠ 0 is the exact failure condition
// (this precondition is itself a fact about the discriminator, not a dodge).
[<Property(Arbitrary = [| typeof<WSetArb> |])>]
let ``discriminator (−): branching map fails copy-naturality when ε(s) ≠ 0`` (raw: (int * int64) list) =
    let s = consol raw
    let op = branchOp 100 200 // 100 ≠ 200, disjoint from key range 0..4
    if WSet.discard intStar s = 0L then true // cross terms carry weight ε(s) = 0 ⇒ vanish
    else copyNatLHS op s <> copyNatRHS op s

// Concrete cross-term witness (the b⊗c + c⊗b that appear).
[<Fact>]
let ``discriminator (−): branching cross terms are explicit`` () =
    let s : WSet.WSet<int, int64> = [ 0, 1L ] // a single unit
    let op = branchOp 100 200
    let lhs = copyNatLHS op s // Δ ∘ f  — diagonal only
    let rhs = copyNatRHS op s // (f ⊗ f) ∘ Δ — with cross terms
    // LHS carries ONLY the diagonal (100,100) and (200,200).
    lhs |> should equal [ (100, 100), 1L; (200, 200), 1L ]
    // RHS additionally carries the cross terms (100,200) and (200,100).
    rhs |> should equal [ (100, 100), 1L; (100, 200), 1L; (200, 100), 1L; (200, 200), 1L ]
    lhs |> should not' (equal rhs)

// discard-naturality FAILS: the two-key image DOUBLES the mass. Witnessed on a
// state of non-zero total mass (ε(s) ≠ 0 — otherwise 2·0 = 0 hides the doubling).
[<Fact>]
let ``discriminator (−): branching map doubles the discarded mass`` () =
    let s : WSet.WSet<int, int64> = [ 1, 2L; 3, 5L ] // ε(s) = 7 ≠ 0
    let op = branchOp 100 200
    WSet.discard intStar s |> should equal 7L
    WSet.discard intStar (WSet.apply intStar op s) |> should equal 14L // ε doubled
    discardNat op s |> should equal false

// ═══════════════════════════════════════════════════════════════════
// (2b) THE OTHER RINGS — same discriminator, ℝ≥0 and ℂ (081KYXE4W8808…)
// ═══════════════════════════════════════════════════════════════════
// ℝ≥0 (Markov corner): discard stays natural under a deterministic arrow;
// copy is NOT natural for a branching map (Fritz: probability can copy a
// sample, not a correlated distribution).
[<Fact>]
let ``ℝ≥0 corner: deterministic arr is discard-natural; branching is not copy-natural`` () =
    let r = Real.algebra
    let isZeroR (w: float) = abs w < 1e-12
    let cons (s: WSet.WSet<int * int, float>) = WSet.consolidate r isZeroR s
    let s : WSet.WSet<int, float> = [ 0, 0.3; 1, 0.7 ] // a normalized distribution
    // discard natural under deterministic arr g:
    let detR : int -> WSet.WSet<int, float> = fun k -> [ k, 1.0 ]
    let massBefore = WSet.discard r s
    let massAfter = WSet.discard r (WSet.apply r detR s)
    Assert.True(abs (massBefore - massAfter) < 1e-12)
    // copy NOT natural for a branching map a ↦ b + c:
    let branchR : int -> WSet.WSet<int, float> = fun _ -> [ 100, 1.0; 200, 1.0 ]
    let lhs = WSet.apply r branchR s |> WSet.copy |> cons
    let rhs =
        WSet.copy s
        |> List.collect (fun ((k1, k2), w) ->
            WSet.tensor r (branchR k1) (branchR k2) |> List.map (fun (kk, w2) -> kk, r.Mul(w, w2)))
        |> cons
    Assert.NotEqual<WSet.WSet<int * int, float>>(lhs, rhs)

// ℂ (quantum corner): copy Δ is the DIAGONAL, not the clone `s ⊗ s` — for a
// genuine superposition the two differ (no-cloning; Coecke–Kissinger). Δ exists
// as a map but is not the amplitude-cloning comonoid, so the copy corner is absent.
[<Fact>]
let ``ℂ corner: copy Δ ≠ clone s⊗s for a superposition (no-cloning)`` () =
    let c = ImaginaryStack.complex
    let isZeroC (z: Complex) = abs z.Real < 1e-12 && abs z.Imag < 1e-12
    let cons (s: WSet.WSet<int * int, Complex>) = WSet.consolidate c isZeroC s
    let amp = Doubled.make (1.0 / sqrt 2.0) 0.0
    let s : WSet.WSet<int, Complex> = [ 0, amp; 1, amp ] // |+⟩ = (|0⟩+|1⟩)/√2
    let diagonal = WSet.copy s |> cons // Δ : {(0,0), (1,1)}
    let clone = WSet.tensor c s s |> cons // s ⊗ s : also (0,1),(1,0) cross amplitudes
    // The clone carries off-diagonal amplitude the diagonal cannot represent.
    Assert.NotEqual<WSet.WSet<int * int, Complex>>(diagonal, clone)
    // discard (Born-normalisable total) still well-defined on the ℂ corner:
    Assert.True(isZeroC (c.Add(WSet.discard c s, c.Negate(Doubled.make (2.0 / sqrt 2.0) 0.0))))
