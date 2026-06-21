module Zeta.Tests.Algebra.ProbabilitySemiringTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module PS = Zeta.Core.ProbabilitySemiring

// ═══════════════════════════════════════════════════════════════════
// ProbabilitySemiring math leg (081KTAH8Q0008QG0R001YHSSA0, the NCI discharge piece 2) — the exact-rational probability
// (+,×) and Viterbi (max,×) semirings + forward/Viterbi inference. All exact ℚ (no floats), so these
// laws + the worked vectors are the byte-lockable core the C#/TS/Rust oracles will cross-verify.
// ═══════════════════════════════════════════════════════════════════

// Small exact rationals for the property generators.
let private genRat : Gen<PS.Rational> =
    gen {
        let! n = Gen.choose (-20, 20) |> Gen.map int64
        let! d = Gen.choose (1, 20) |> Gen.map int64
        return PS.rat n d
    }

type RatArb() =
    static member R() = Arb.fromGen genRat

// ── normalization: lowest terms, positive denominator, structural equality ──

[<Fact>]
let ``rat normalizes to lowest terms with positive denominator`` () =
    let check (n: int64) (d: int64) (en: int64) (ed: int64) =
        let r = PS.rat n d
        Assert.Equal<int64>(en, r.Num)
        Assert.Equal<int64>(ed, r.Den)
    check 2L 4L 1L 2L          // 2/4 -> 1/2
    check 6L -3L -2L 1L        // 6/-3 -> -2/1 (sign on numerator)
    check 3L -6L -1L 2L        // 3/-6 -> -1/2
    check 0L 5L 0L 1L          // 0/5 -> 0/1
    Assert.Equal<PS.Rational>(PS.zero, PS.rat 0L 7L)
    Assert.Equal<PS.Rational>(PS.one, PS.rat 5L 5L)

// ── worked exact values (these become the cross-language golden seed) ──

[<Fact>]
let ``add / mul / max worked exact values`` () =
    Assert.Equal<PS.Rational>(PS.rat 5L 6L, PS.add (PS.rat 1L 2L) (PS.rat 1L 3L))
    Assert.Equal<PS.Rational>(PS.rat 1L 2L, PS.mul (PS.rat 2L 3L) (PS.rat 3L 4L))
    Assert.Equal<PS.Rational>(PS.rat 1L 6L, PS.max (PS.rat 1L 6L) (PS.rat 1L 8L))

[<Fact>]
let ``forward step over (+,x) is the exact pi*P`` () =
    let pi = [| PS.rat 1L 2L; PS.rat 1L 2L |]
    let p = [| [| PS.rat 1L 3L; PS.rat 2L 3L |]; [| PS.rat 1L 4L; PS.rat 3L 4L |] |]
    Assert.Equal<PS.Rational[]>([| PS.rat 7L 24L; PS.rat 17L 24L |], PS.forwardStep pi p)

[<Fact>]
let ``Viterbi step over (max,x) is the exact best-path score`` () =
    let v = [| PS.rat 1L 2L; PS.rat 1L 2L |]
    let p = [| [| PS.rat 1L 3L; PS.rat 2L 3L |]; [| PS.rat 1L 4L; PS.rat 3L 4L |] |]
    Assert.Equal<PS.Rational[]>([| PS.rat 1L 6L; PS.rat 3L 8L |], PS.viterbiStep v p)

[<Fact>]
let ``forward over a row-stochastic P preserves total probability 1`` () =
    let pi = [| PS.rat 1L 2L; PS.rat 1L 2L |]
    let p = [| [| PS.rat 1L 3L; PS.rat 2L 3L |]; [| PS.rat 1L 4L; PS.rat 3L 4L |] |]
    let total (xs: PS.Rational[]) = Array.fold PS.add PS.zero xs
    Assert.Equal<PS.Rational>(PS.one, total (PS.forward pi p 5))

// ── probability-semiring laws (commutative monoid ⊕, monoid ⊗, distribution) ──

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``add is commutative`` (a: PS.Rational) (b: PS.Rational) = PS.add a b = PS.add b a

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``add is associative`` (a: PS.Rational) (b: PS.Rational) (c: PS.Rational) =
    PS.add (PS.add a b) c = PS.add a (PS.add b c)

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``zero is the additive identity`` (a: PS.Rational) =
    PS.add a PS.zero = a && PS.add PS.zero a = a

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``mul is commutative`` (a: PS.Rational) (b: PS.Rational) = PS.mul a b = PS.mul b a

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``mul is associative`` (a: PS.Rational) (b: PS.Rational) (c: PS.Rational) =
    PS.mul (PS.mul a b) c = PS.mul a (PS.mul b c)

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``one is the multiplicative identity`` (a: PS.Rational) =
    PS.mul a PS.one = a && PS.mul PS.one a = a

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``zero annihilates under mul`` (a: PS.Rational) =
    PS.mul a PS.zero = PS.zero && PS.mul PS.zero a = PS.zero

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``mul distributes over add`` (a: PS.Rational) (b: PS.Rational) (c: PS.Rational) =
    PS.mul a (PS.add b c) = PS.add (PS.mul a b) (PS.mul a c)

// ── Viterbi-semiring laws (idempotent commutative monoid ⊕ = max, distributes) ──

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``max is idempotent`` (a: PS.Rational) = PS.max a a = a

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``max is commutative`` (a: PS.Rational) (b: PS.Rational) = PS.max a b = PS.max b a

[<Property(Arbitrary = [| typeof<RatArb> |])>]
let ``max is associative`` (a: PS.Rational) (b: PS.Rational) (c: PS.Rational) =
    PS.max (PS.max a b) c = PS.max a (PS.max b c)
