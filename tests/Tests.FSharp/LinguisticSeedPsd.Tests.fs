module Zeta.Tests.LinguisticSeedPsdTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// The Mercer-closure PSD theorems — MECHANICAL WITNESS (the proof is
// docs/proofs/mercer-closure-psd-preservation-theorems.md; this file is the regression CHECK, per the
// Math Razor's proof-vs-evidence discipline). FsCheck generates RANDOM kernels by composing the closure
// (T1–T8) over random expression trees, then checks the quadratic form Q(k; xs, v) ≥ 0 on random
// samples/weights. If any constructor or combinator ever stops preserving PSD, this finds a counterexample.
// ═══════════════════════════════════════════════════════════════════

module LS = Zeta.Core.LinguisticSeed

let private eps = 1e-7 // float-arithmetic slack on a mathematically-≥0 quantity

// ── bounded scalar inputs (keep the arithmetic well away from overflow) ──
let private genScalar: Gen<float> = Gen.choose (-50, 50) |> Gen.map (fun i -> float i / 5.0)

// ── random closure kernels over float (random expression trees, T1–T8) ──
// Base cases include a RAGGED dot (length depends on the input) — exactly the shape the zero-extension
// P0 fix exists for; min-truncation would fail this suite.
let private genBase: Gen<LS.Kernel<float>> =
    Gen.elements
        [ LS.constant 0.7
          LS.feature id
          LS.feature (fun x -> x * x / 10.0)
          LS.indicator
          LS.dot (fun x -> [| x; x * x / 10.0 |])
          LS.dot (fun x -> if x > 0.0 then [| x |] else [| x; 1.0; 0.5 |]) ] // ragged on purpose

let rec private genKernel (size: int) : Gen<LS.Kernel<float>> =
    if size <= 0 then
        genBase
    else
        let sub = genKernel (size / 2)

        Gen.oneof
            [ genBase
              Gen.map2 LS.sum sub sub
              Gen.map2 LS.product sub sub
              Gen.map (fun k -> LS.scale 0.3 k) sub
              Gen.map (LS.pullback (fun (y: float) -> y - 1.0)) sub ]

// Wrapper records so FsCheck binds OUR bounded generators (a bare float[] would pull the default
// arbitrary — NaN / 1e308 — which is out of scope: PSD is a statement about real numbers, and the
// witness checks it within float range).
type Sample = { Xs: float[]; V: float[] }

let private genSample: Gen<Sample> =
    gen {
        let! n = Gen.choose (1, 6)
        let! xs = Gen.arrayOfLength n genScalar
        let! v = Gen.arrayOfLength n (Gen.choose (-20, 20) |> Gen.map (fun i -> float i / 4.0))
        return { Xs = xs; V = v }
    }

type PsdArbs =
    static member Kernel() = Arb.fromGen (Gen.sized (fun s -> genKernel (min s 8)))
    static member Sample() = Arb.fromGen genSample

[<Property(Arbitrary = [| typeof<PsdArbs> |])>]
let ``T-main: every randomly closure-composed kernel has nonnegative quadratic form`` (k: LS.Kernel<float>) (s: Sample) =
    LS.quadForm k s.Xs s.V >= -eps

[<Property(Arbitrary = [| typeof<PsdArbs> |])>]
let ``T7 witness: the Schur product of two random closure kernels stays PSD`` (k1: LS.Kernel<float>) (k2: LS.Kernel<float>) (s: Sample) =
    LS.quadForm (LS.product k1 k2) s.Xs s.V >= -eps

[<Property(Arbitrary = [| typeof<PsdArbs> |])>]
let ``symmetry: every closure kernel is symmetric`` (k: LS.Kernel<float>) (s: Sample) =
    s.Xs
    |> Array.forall (fun a -> s.Xs |> Array.forall (fun b -> abs (k a b - k b a) <= eps))

// ── the non-vacuity guard: the form CAN go negative outside the closure ──
// (so the suite is not trivially green): a NEGATIVE constant — exactly what the clamp forbids — fails.
[<Fact>]
let ``non-vacuous: an unclamped negative constant would violate PSD (the clamp is load-bearing)`` () =
    let badK: LS.Kernel<float> = fun _ _ -> -1.0 // unexpressible via the closure (constant clamps)
    Assert.True(LS.quadForm badK [| 1.0 |] [| 1.0 |] < 0.0)

// ── T9/T10 witnesses: the conformal slice ──

let private genPoint: Gen<ConformalGA.CPoint> =
    gen {
        let! x = genScalar
        let! y = genScalar
        let! z = genScalar
        return ConformalGA.embed x y z
    }

type PointSet = { Ps: ConformalGA.CPoint[] }

type GaArbs =
    static member Point() = Arb.fromGen genPoint

    static member PointSet() =
        Arb.fromGen (gen {
            let! n = Gen.choose (1, 5)
            let! ps = Gen.arrayOfLength n genPoint
            return { Ps = ps }
        })

[<Property(Arbitrary = [| typeof<GaArbs> |])>]
let ``T10: inner (embed x) (embed y) = -half the Euclidean distance squared, exactly`` (p: ConformalGA.CPoint) (q: ConformalGA.CPoint) =
    abs (ConformalGA.inner p q - (-0.5 * ConformalGA.euclidSq p q)) <= 1e-9

[<Property(Arbitrary = [| typeof<GaArbs> |])>]
let ``T10 corollary: embedded points are null (inner P P = 0)`` (p: ConformalGA.CPoint) =
    ConformalGA.isNull 1e-9 p

[<Property(Arbitrary = [| typeof<GaArbs> |])>]
let ``T9: the RBF memory kernel has nonnegative quadratic form on random embedded points`` (s: PointSet) =
    let k = ConformalGA.rbfKernel 3.0
    let v = s.Ps |> Array.mapi (fun i _ -> if i % 2 = 0 then 1.0 else -1.5)
    LS.quadForm k s.Ps v >= -eps
