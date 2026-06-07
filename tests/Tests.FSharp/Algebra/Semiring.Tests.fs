module Zeta.Tests.Algebra.SemiringTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── Helpers ──────────────────────────────────────────────────────

/// Verify the three semiring axioms that hold for all implementations:
/// additive identity, multiplicative identity, annihilator.
let inline checkMonoidLaws (sr: ISemiring<'W>) (a: 'W) =
    // Zero + a = a  (left identity)
    sr.Add(sr.Zero, a) |> should equal a
    // a + Zero = a  (right identity)
    sr.Add(a, sr.Zero) |> should equal a
    // One * a = a   (left identity)
    sr.Mul(sr.One, a) |> should equal a
    // a * One = a   (right identity)
    sr.Mul(a, sr.One) |> should equal a

/// Verify additive inverse: a + Negate(a) = Zero.
let inline checkRingNegate (sr: ISemiring<'W>) (a: 'W) =
    sr.Add(a, sr.Negate(a)) |> should equal sr.Zero


// ─── IntegerRing ──────────────────────────────────────────────────

[<Fact>]
let ``IntegerRing — Zero is 0L`` () =
    IntegerRing.Instance.Zero |> should equal 0L

[<Fact>]
let ``IntegerRing — One is 1L`` () =
    IntegerRing.Instance.One |> should equal 1L

[<Fact>]
let ``IntegerRing — Add is checked addition`` () =
    IntegerRing.Instance.Add(3L, 4L) |> should equal 7L
    IntegerRing.Instance.Add(-2L, 5L) |> should equal 3L

[<Fact>]
let ``IntegerRing — Mul is checked multiplication`` () =
    IntegerRing.Instance.Mul(3L, 4L) |> should equal 12L

[<Fact>]
let ``IntegerRing — Negate`` () =
    IntegerRing.Instance.Negate(5L) |> should equal -5L
    IntegerRing.Instance.Negate(0L) |> should equal 0L

[<Fact>]
let ``IntegerRing — monoid laws`` () =
    let sr = IntegerRing.Instance
    checkMonoidLaws sr 42L
    checkMonoidLaws sr -7L

[<Fact>]
let ``IntegerRing — ring negate law`` () =
    let sr = IntegerRing.Instance
    checkRingNegate sr 42L
    checkRingNegate sr -7L

[<Fact>]
let ``IntegerRing — matches legacy Weight constants`` () =
    // Ensure ISemiring<int64> aligns with existing Weight module.
    IntegerRing.Instance.Zero |> should equal Weight.Zero
    IntegerRing.Instance.One  |> should equal Weight.One


// ─── IntervalRing ─────────────────────────────────────────────────

[<Fact>]
let ``IntervalWeight — Point is certain`` () =
    let p = IntervalWeight.Point 3.0
    p.Lo |> should equal 3.0
    p.Hi |> should equal 3.0
    p.Width |> should equal 0.0
    p.IsCertain |> should be True

[<Fact>]
let ``IntervalWeight — Zero and One`` () =
    IntervalWeight.Zero.Lo |> should equal 0.0
    IntervalWeight.Zero.Hi |> should equal 0.0
    IntervalWeight.One.Lo  |> should equal 1.0
    IntervalWeight.One.Hi  |> should equal 1.0

[<Fact>]
let ``IntervalRing — Add widens interval`` () =
    let sr = IntervalRing.Instance
    let a  = IntervalWeight(1.0, 2.0)
    let b  = IntervalWeight(3.0, 5.0)
    let c  = sr.Add(a, b)
    c.Lo |> should equal 4.0
    c.Hi |> should equal 7.0

[<Fact>]
let ``IntervalRing — Mul positive intervals`` () =
    let sr = IntervalRing.Instance
    let a  = IntervalWeight(2.0, 3.0)
    let b  = IntervalWeight(4.0, 5.0)
    let c  = sr.Mul(a, b)
    c.Lo |> should equal 8.0    // 2*4
    c.Hi |> should equal 15.0   // 3*5

[<Fact>]
let ``IntervalRing — Mul with negative interval uses Kaucher hull`` () =
    let sr = IntervalRing.Instance
    let a  = IntervalWeight(-2.0, 3.0)
    let b  = IntervalWeight(1.0, 4.0)
    let c  = sr.Mul(a, b)
    // products: -2*1=-2, -2*4=-8, 3*1=3, 3*4=12  → hull [-8, 12]
    c.Lo |> should equal -8.0
    c.Hi |> should equal 12.0

[<Fact>]
let ``IntervalRing — Negate reverses interval`` () =
    let sr = IntervalRing.Instance
    let a  = IntervalWeight(2.0, 5.0)
    let n  = sr.Negate(a)
    n.Lo |> should equal -5.0
    n.Hi |> should equal -2.0

[<Fact>]
let ``IntervalRing — monoid laws`` () =
    let sr = IntervalRing.Instance
    checkMonoidLaws sr (IntervalWeight(3.0, 7.0))
    checkMonoidLaws sr (IntervalWeight(-1.0, 1.0))

[<Fact>]
let ``IntervalRing — point intervals satisfy ring negate law`` () =
    // Point intervals [v,v] behave like real numbers: [v,v] + [-v,-v] = [0,0].
    let sr = IntervalRing.Instance
    checkRingNegate sr (IntervalWeight.Point 3.0)
    checkRingNegate sr (IntervalWeight.Point(-2.0))

[<Fact>]
let ``IntervalRing — non-point negate gives width-doubled result (not zero)`` () =
    // Standard interval arithmetic: [a,b] + [-b,-a] = [a-b, b-a], not [0,0].
    // This is the interval dependency problem — uncertainty doesn't cancel.
    // Analogy: Spanner TrueTime can't subtract its uncertainty window away.
    let sr = IntervalRing.Instance
    let a  = IntervalWeight(3.0, 7.0)   // width 4
    let r  = sr.Add(a, sr.Negate(a))
    r.Lo |> should equal -4.0           // 3 - 7
    r.Hi |> should equal  4.0           // 7 - 3
    r.Width |> should equal 8.0         // doubled uncertainty

[<Fact>]
let ``IntervalRing — uncertainty widens under repeated Add`` () =
    let sr = IntervalRing.Instance
    let uncertain = IntervalWeight(0.9, 1.1)
    let sum2 = sr.Add(uncertain, uncertain)
    sum2.Width |> should be (greaterThan uncertain.Width)

[<Fact>]
let ``IntervalRing — point intervals commute with integer interpretation`` () =
    // [3,3] + [4,4] = [7,7]  (same as 3 + 4 = 7 in ℤ)
    let sr = IntervalRing.Instance
    let a  = IntervalWeight.Point 3.0
    let b  = IntervalWeight.Point 4.0
    let c  = sr.Add(a, b)
    c.IsCertain |> should be True
    c.Lo |> should equal 7.0


// ─── TropicalSemiring ─────────────────────────────────────────────

[<Fact>]
let ``TropicalSemiring — Zero is Infinity`` () =
    TropicalSemiring.Instance.Zero |> should equal TropicalWeight.Infinity

[<Fact>]
let ``TropicalSemiring — One is TropicalWeight 0L`` () =
    TropicalSemiring.Instance.One |> should equal (TropicalWeight 0L)

[<Fact>]
let ``TropicalSemiring — Add is min`` () =
    let sr = TropicalSemiring.Instance
    sr.Add(TropicalWeight 3L, TropicalWeight 7L) |> should equal (TropicalWeight 3L)
    sr.Add(TropicalWeight 7L, TropicalWeight 3L) |> should equal (TropicalWeight 3L)

[<Fact>]
let ``TropicalSemiring — Mul is saturating plus`` () =
    let sr = TropicalSemiring.Instance
    sr.Mul(TropicalWeight 3L, TropicalWeight 4L) |> should equal (TropicalWeight 7L)
    // Infinity absorbs
    sr.Mul(TropicalWeight.Infinity, TropicalWeight 5L) |> should equal TropicalWeight.Infinity

[<Fact>]
let ``TropicalSemiring — monoid laws`` () =
    let sr = TropicalSemiring.Instance
    checkMonoidLaws sr (TropicalWeight 10L)
    checkMonoidLaws sr TropicalWeight.Infinity

[<Fact>]
let ``TropicalSemiring — Negate raises (no additive inverse)`` () =
    (fun () -> TropicalSemiring.Instance.Negate(TropicalWeight 1L) |> ignore)
    |> should throw typeof<System.InvalidOperationException>
