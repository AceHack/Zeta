module Zeta.Tests.Sketches.TropicalTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Tropical semiring (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Tropical addition is min`` () =
    let a = TropicalWeight 5L
    let b = TropicalWeight 3L
    (a + b).Value |> should equal 3L


[<Fact>]
let ``Tropical multiplication is plus`` () =
    let a = TropicalWeight 5L
    let b = TropicalWeight 3L
    (a * b).Value |> should equal 8L


[<Fact>]
let ``Tropical infinity absorbs under multiplication`` () =
    let inf = TropicalWeight.Infinity
    let a = TropicalWeight 5L
    (inf * a).Value |> should equal Int64.MaxValue


[<Fact>]
let ``Tropical zero is infinity one is 0`` () =
    TropicalWeight.Zero.Value |> should equal Int64.MaxValue
    TropicalWeight.One.Value |> should equal 0L
