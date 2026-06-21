module Zeta.Tests.Algebra.HexCoreTests

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// The seed core's most-inevitable-first slice (081KT2T2J0008QG0R003VK5GRX): the six reservoir
// walls (081KT2T2J0008QG0R0026MS6PV) + the atomic Vector noun, built on the existing
// Cayley–Dickson ℂ (Complex). These tests anchor the canonical wall set
// (the cube-of-space's six faces) and prove the Vector ↔ ℂ bijection plus
// that Vector.add *composes* the existing complex algebra rather than
// re-deriving it. "The compilers don't lie."

// ─── The six reservoir walls (081KT2T2J0008QG0R0026MS6PV) ───

[<Fact>]
let ``the six reservoir walls are present, in canonical order`` () =
    Wall.all
    |> should
        equal
        [ Wall.RememberWhen
          Wall.PayAttention
          Wall.WhichWay
          Wall.HowMuch
          Wall.RainbowTable
          Wall.ObserveEmit ]

[<Fact>]
let ``there are exactly six walls (the hexahedron's six faces)`` () =
    Wall.all |> List.length |> should equal 6

// ─── The atomic Vector noun (081KT2T2J0008QG0R003VK5GRX: vectors before trajectories) ───

[<Fact>]
let ``Vector zero has no magnitude`` () =
    Vector.zero.HowMuch |> should equal 0.0

[<Fact>]
let ``Vector <-> Complex round-trips for non-negative magnitude`` () =
    let v = Vector.make 0.7 2.5
    let back = v |> Vector.toComplex |> Vector.ofComplex
    back.WhichWay |> should (equalWithin 1e-9) v.WhichWay
    back.HowMuch |> should (equalWithin 1e-9) v.HowMuch

[<Fact>]
let ``Vector.add composes the existing Cayley-Dickson C algebra`` () =
    // east (1, 0) + north (1, π/2) = (1, 1) → modulus √2, argument π/4
    let east = Vector.make 0.0 1.0
    let north = Vector.make (Math.PI / 2.0) 1.0
    let sum = Vector.add east north
    sum.HowMuch |> should (equalWithin 1e-9) (sqrt 2.0)
    sum.WhichWay |> should (equalWithin 1e-9) (Math.PI / 4.0)

[<Fact>]
let ``negative magnitude normalizes to a non-negative modulus`` () =
    let v = Vector.make 0.0 -1.0
    v.HowMuch |> should (equalWithin 1e-9) 1.0
    // direction flipped by π → points the opposite way
    cos v.WhichWay |> should (equalWithin 1e-9) -1.0

[<Fact>]
let ``toComplex lands a unit east vector on the real axis`` () =
    let c = Vector.make 0.0 1.0 |> Vector.toComplex
    c.Real |> should (equalWithin 1e-9) 1.0
    c.Imag |> should (equalWithin 1e-9) 0.0
