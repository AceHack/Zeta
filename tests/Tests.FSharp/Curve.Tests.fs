module Zeta.Tests.CurveTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module C = Zeta.Core.Curve

// ═══════════════════════════════════════════════════════════════════
// Curve — rate (∂) and curvature (∂²) over the clock, the DBSP D/I operators.
// Proves the discrete-calculus laws: D and I are mutual inverses (DBSP Thm 2.22, I∘D=id), D is linear,
// rate of a constant is zero (after the initial sample), a linear ramp has zero curvature, and the
// discrete FTC (total change = last cumulative rate). The "how-fast/how-bending" measurement axis,
// sibling of SoftValue (how-sure).
// ═══════════════════════════════════════════════════════════════════

// Bounded samples keep the arithmetic legible (the laws hold over all of int64 — Z/2^64 is a group).
let private genSignal : Gen<int64[]> =
    gen {
        let! n = Gen.choose (0, 12)
        let! xs = Gen.listOfLength n (Gen.choose (-1000, 1000) |> Gen.map int64)
        return List.toArray xs
    }

// A pair of equal-length signals (for linearity).
let private genPair : Gen<int64[] * int64[]> =
    gen {
        let! n = Gen.choose (0, 12)
        let! a = Gen.listOfLength n (Gen.choose (-1000, 1000) |> Gen.map int64)
        let! b = Gen.listOfLength n (Gen.choose (-1000, 1000) |> Gen.map int64)
        return List.toArray a, List.toArray b
    }

type CurveArb() =
    static member S() = Arb.fromGen genSignal
    static member P() = Arb.fromGen genPair

let private addArr (a: int64[]) (b: int64[]) : int64[] =
    Array.init a.Length (fun i -> a.[i] + b.[i])

// ── D and I are mutual inverses (the discrete fundamental theorem of calculus) ──

[<Property(Arbitrary = [| typeof<CurveArb> |])>]
let ``integrate then differentiate is identity (D ∘ I = id)`` (s: int64[]) =
    C.differentiate (C.integrate s) = s

[<Property(Arbitrary = [| typeof<CurveArb> |])>]
let ``differentiate then integrate is identity (I ∘ D = id)`` (s: int64[]) =
    C.integrate (C.differentiate s) = s

// ── D is linear ──

[<Property(Arbitrary = [| typeof<CurveArb> |])>]
let ``differentiate is additive`` (p: int64[] * int64[]) =
    let a, b = p
    C.differentiate (addArr a b) = addArr (C.differentiate a) (C.differentiate b)

// ── rate / curvature have the expected shape on simple signals ──

[<Property(Arbitrary = [| typeof<CurveArb> |])>]
let ``rate of a constant signal is zero after the first sample`` (c: int64) (n: PositiveInt) =
    let len = min n.Get 20
    let s = Array.create len c
    let r = C.rate s
    r.[0] = c && Array.forall id [| for i in 1 .. len - 1 -> r.[i] = 0L |]

[<Property(Arbitrary = [| typeof<CurveArb> |])>]
let ``a linear ramp has zero curvature beyond the start`` (a: int64) (b: int64) (n: PositiveInt) =
    // s[i] = a + b*i — constant rate b ⇒ curvature 0 for i >= 2
    let len = min (n.Get + 2) 20
    let s = Array.init len (fun i -> a + b * int64 i)
    let k = C.curvature s
    Array.forall id [| for i in 2 .. len - 1 -> k.[i] = 0L |]

// ── discrete FTC: total change = last cumulative rate ──

[<Property(Arbitrary = [| typeof<CurveArb> |])>]
let ``total change equals the last sample (FTC)`` (s: int64[]) =
    // `||` short-circuits so the index is never evaluated on an empty signal.
    s.Length = 0 || C.totalChange (C.rate s) = s.[s.Length - 1]

[<Property(Arbitrary = [| typeof<CurveArb> |])>]
let ``curvature is the rate of the rate`` (s: int64[]) =
    C.curvature s = C.rate (C.rate s)
