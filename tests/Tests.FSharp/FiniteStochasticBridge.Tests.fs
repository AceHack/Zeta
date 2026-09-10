module Zeta.Tests.FiniteStochasticBridgeTests

open Xunit
open Zeta.Research

[<Fact>]
let ``arithmetic instrument refuses invalid operands before unchecked core operations`` () =
    Assert.True(FiniteStochasticBridge.arithmeticGuardFixture ())

[<Fact>]
let ``registered sparse matrix-unit witnesses retain all negative controls`` () =
    let report = FiniteStochasticBridge.run ()
    Assert.True(report.Complete, report.Failure)
    Assert.Equal(0, report.Arithmetic.Refusals)
    Assert.Equal<int array>([|9;27;6;81;729;81;9;9;1;1;1;1;1;1|], report.Checks |> Array.map (fun row -> row.Cases.Length))
    for row in report.Checks do
        for case in row.Cases do Assert.True(case.Passed, row.Name + ":" + case.Id)
    let negative name = report.Checks |> Array.find (fun row -> row.Name = name) |> _.Cases |> Array.exactlyOne
    Assert.Equal("false", (negative "naive quantum identity refusal").Left.[1])
    Assert.Equal("-1/1", (negative "signed normalized refusal").Left.[2])
    Assert.Equal("1x1:-1/1", (negative "positive but not CP").Left |> Array.last)
