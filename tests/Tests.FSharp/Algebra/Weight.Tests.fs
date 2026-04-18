module Zeta.Tests.Algebra.WeightTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── Weight helpers (moved from CoverageTests / CoverageBoostTests) ──────

[<Fact>]
let ``Weight helpers cover all paths`` () =
    Weight.isZero 0L |> should be True
    Weight.isZero 5L |> should be False
    Weight.isPositive 5L |> should be True
    Weight.isPositive (-5L) |> should be False
    Weight.isPositive 0L |> should be False
    Weight.neg 5L |> should equal -5L
    Weight.Zero |> should equal 0L
    Weight.One |> should equal 1L


[<Fact>]
let ``Weight constants are correct`` () =
    Weight.Zero |> should equal 0L
    Weight.One |> should equal 1L


[<Fact>]
let ``Weight.isZero/isPositive/neg`` () =
    Weight.isZero 0L |> should be True
    Weight.isZero 1L |> should be False
    Weight.isPositive 1L |> should be True
    Weight.isPositive -1L |> should be False
    Weight.neg 5L |> should equal -5L
