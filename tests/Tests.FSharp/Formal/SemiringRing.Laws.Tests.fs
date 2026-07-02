module Zeta.Tests.Formal.SemiringRingLawsTests

open System
open System.Diagnostics
open System.IO
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Formal

// ═══════════════════════════════════════════════════════════════════
// Semiring/Ring LAW PACK (081KWG9JQ9H, Ilyana condition #1: laws land
// BEFORE the IRing/ISemiring interface split, so every demotion is
// WITNESSED, not asserted).
//
// Three tiers, per instance:
//   • ISemiring laws — (S,Add,Zero) commutative monoid; (S,Mul,One)
//     monoid; distributivity; Zero annihilation.
//   • IRing law — Add(a, Negate a) = Zero (the earned quotient).
//   • Witnessed violations — pinned Facts for the lies the split will
//     make unrepresentable: Tropical's throwing Negate (a PROVEN
//     classical impossibility: Vandiver 1934, Golan 1999,
//     Baccelli–Cohen–Olsder–Quadrat 1992 §3.2) and IntervalRing's
//     double violation (081KWGA0C7: Negate not an inverse; Moore-1966
//     sub-distributivity).
// ═══════════════════════════════════════════════════════════════════

// ── generic law properties over a boxed ring/semiring ───────────────

let private addCommutes (r: ISemiring<'W>) a b = r.Add(a, b) = r.Add(b, a)
let private addAssociates (r: ISemiring<'W>) a b c = r.Add(r.Add(a, b), c) = r.Add(a, r.Add(b, c))
let private zeroIsIdentity (r: ISemiring<'W>) a = r.Add(a, r.Zero) = a && r.Add(r.Zero, a) = a
let private mulAssociates (r: ISemiring<'W>) a b c = r.Mul(r.Mul(a, b), c) = r.Mul(a, r.Mul(b, c))
let private oneIsIdentity (r: ISemiring<'W>) a = r.Mul(a, r.One) = a && r.Mul(r.One, a) = a
let private distributes (r: ISemiring<'W>) a b c =
    r.Mul(a, r.Add(b, c)) = r.Add(r.Mul(a, b), r.Mul(a, c))
    && r.Mul(r.Add(b, c), a) = r.Add(r.Mul(b, a), r.Mul(c, a))
let private zeroAnnihilates (r: ISemiring<'W>) a = r.Mul(a, r.Zero) = r.Zero && r.Mul(r.Zero, a) = r.Zero
let private negateInverts (r: ISemiring<'W>) a = r.Add(a, r.Negate a) = r.Zero

// ── generators (bounded: Checked ops must not overflow mid-law) ─────

type private LawArb =
    static member SmallInt64() =
        Gen.choose (-1_000_000, 1_000_000) |> Gen.map int64 |> Arb.fromGen

    static member Tropical() =
        Gen.frequency
            [ 9, Gen.choose (-1_000_000, 1_000_000) |> Gen.map (int64 >> TropicalWeight)
              1, Gen.constant TropicalWeight.Infinity ]
        |> Arb.fromGen

    // exact-in-float integer endpoints so interval arithmetic is exact
    static member Interval() =
        gen {
            let! a = Gen.choose (-100, 100)
            let! b = Gen.choose (-100, 100)
            return IntervalWeight(float (min a b), float (max a b))
        }
        |> Arb.fromGen

// ── IntegerRing: full ring — every law holds ─────────────────────────

[<Property(Arbitrary = [| typeof<LawArb> |])>]
let ``IntegerRing satisfies every semiring law`` (a: int64) (b: int64) (c: int64) =
    let r = IntegerRing.Instance
    addCommutes r a b && addAssociates r a b c && zeroIsIdentity r a
    && mulAssociates r a b c && oneIsIdentity r a && distributes r a b c
    && zeroAnnihilates r a

[<Property(Arbitrary = [| typeof<LawArb> |])>]
let ``IntegerRing satisfies the ring law: Add(a, Negate a) = Zero`` (a: int64) =
    negateInverts IntegerRing.Instance a

// ── TropicalSemiring: a LAWFUL semiring… ─────────────────────────────

[<Property(Arbitrary = [| typeof<LawArb> |])>]
let ``TropicalSemiring satisfies every semiring law`` (a: TropicalWeight) (b: TropicalWeight) (c: TropicalWeight) =
    let r = TropicalSemiring.Instance
    addCommutes r a b && addAssociates r a b c && zeroIsIdentity r a
    && mulAssociates r a b c && oneIsIdentity r a && distributes r a b c
    && zeroAnnihilates r a

// …whose Negate is a PROVEN impossibility, currently a runtime throw.

[<Fact>]
let ``WITNESS (Tropical): Negate throws — idempotent semirings admit no inverses (Vandiver 1934 / Golan 1999)`` () =
    // After the split this witness is DELETED: TropicalSemiring will not have
    // a Negate member to call, and the misuse will not compile.
    let r = TropicalSemiring.Instance
    Assert.Throws<InvalidOperationException>(fun () -> r.Negate(TropicalWeight 3L) |> ignore)
    |> ignore

// ── IntervalRing: the double lie, WITNESSED (081KWGA0C7) ─────────────

[<Fact>]
let ``WITNESS (IntervalRing lie 1): Negate is not an additive inverse`` () =
    // [1,2] + (−[1,2]) = [1,2] + [−2,−1] = [−1,1] ≠ [0,0] — Moore negation
    // over intervals never cancels unless the interval is a point.
    let r = IntervalRing.Instance
    let x = IntervalWeight(1.0, 2.0)
    let residue = r.Add(x, r.Negate x)
    residue |> should equal (IntervalWeight(-1.0, 1.0))
    residue |> should not' (equal r.Zero)

[<Property(Arbitrary = [| typeof<LawArb> |])>]
let ``WITNESS (IntervalRing lie 1, general): a − a leaves phantom residue of width 2·Width(a)`` (a: IntervalWeight) =
    let r = IntervalRing.Instance
    let residue = r.Add(a, r.Negate a)
    // the residue is [Lo−Hi, Hi−Lo]: zero ONLY for point intervals — this is
    // exactly the phantom retraction residue DBSP folds would accumulate.
    residue = IntervalWeight(a.Lo - a.Hi, a.Hi - a.Lo)
    && (residue = r.Zero) = (a.Lo = a.Hi)

[<Fact>]
let ``WITNESS (IntervalRing lie 2): distributivity fails — Moore 1966 sub-distributivity`` () =
    // Soraya's counterexample: x=[−1,1], y=[1,1], z=[−1,−1]:
    //   x·(y+z) = [−1,1]·[0,0] = [0,0]
    //   x·y + x·z = [−1,1] + [−1,1] = [−2,2]
    let r = IntervalRing.Instance
    let x = IntervalWeight(-1.0, 1.0)
    let y = IntervalWeight(1.0, 1.0)
    let z = IntervalWeight(-1.0, -1.0)
    let lhs = r.Mul(x, r.Add(y, z))
    let rhs = r.Add(r.Mul(x, y), r.Mul(x, z))
    lhs |> should equal (IntervalWeight(0.0, 0.0))
    rhs |> should equal (IntervalWeight(-2.0, 2.0))
    lhs |> should not' (equal rhs)

[<Property(Arbitrary = [| typeof<LawArb> |])>]
let ``IntervalRing DOES satisfy the additive-monoid laws (what survives demotion)`` (a: IntervalWeight) (b: IntervalWeight) (c: IntervalWeight) =
    let r = IntervalRing.Instance
    addCommutes r a b && addAssociates r a b c && zeroIsIdentity r a && zeroAnnihilates r a

// ── Z3 lemma: idempotent ∧ invertible ⇒ zero (symbolic, all semirings) ──

let private solversAvailable () =
    let mode = Environment.GetEnvironmentVariable("ZETA_SOLVER_MODE")
    if not (String.IsNullOrEmpty(mode)) && mode.ToLowerInvariant() = "replay" then true
    else
        let which (tool: string) =
            try
                let psi =
                    ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                        RedirectStandardOutput = true, UseShellExecute = false)
                use p = Process.Start psi
                let output = p.StandardOutput.ReadToEnd().Trim()
                p.WaitForExit()
                p.ExitCode = 0 && File.Exists output
            with _ -> false
        which "z3" && which "cvc5"

[<Fact>]
let ``Z3: in ANY idempotent semiring, an additively invertible element is zero`` () =
    // The abstract form of the Tropical witness, machine-checked. The axioms
    // are GROUND-INSTANTIATED at exactly the points the textbook proof uses
    // (0 = a⊕na = (a⊕a)⊕na = a⊕(a⊕na) = a⊕0 = a): associativity at (a,a,na),
    // right-identity at a, idempotence at a. Quantifier-free UF, so BOTH
    // solvers decide it (the fully-quantified form is Unsat for Z3 but
    // Unknown for CVC5's quantifier engine — cross-check demands agreement).
    if solversAvailable () then
        let script =
            "(declare-sort S 0)\n\
             (declare-fun add (S S) S)\n\
             (declare-const zero S)\n\
             (declare-const a S)\n\
             (declare-const na S)\n\
             (assert (= (add (add a a) na) (add a (add a na))))\n\
             (assert (= (add a zero) a))\n\
             (assert (= (add a a) a))\n\
             (assert (= (add a na) zero))\n\
             (assert (not (= a zero)))\n\
             (check-sat)\n"
        let (v1, v2) = SolverHarness.crossCheck script
        v1 |> should equal Unsat
        v2 |> should equal Unsat
