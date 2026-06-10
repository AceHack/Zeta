module Zeta.Tests.CliVerbTests

open global.Xunit
open Zeta.Core
// CliVerb is [<RequireQualifiedAccess>] — reference its members qualified, do not `open` it.

type private V = CliVerb.Verb
type private E = CliVerb.ResolveError

[<Fact>]
let ``full words resolve`` () =
    Assert.Equal<Result<V, E>>(Ok CliVerb.Simulate, CliVerb.resolve "simulate")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Measure, CliVerb.resolve "measure")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Cut, CliVerb.resolve "cut")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Benchmark, CliVerb.resolve "benchmark")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Classify, CliVerb.resolve "classify")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Resolve, CliVerb.resolve "resolve")

[<Fact>]
let ``the 3-letter stems resolve (sim mea cut ben cla res)`` () =
    Assert.Equal<Result<V, E>>(Ok CliVerb.Simulate, CliVerb.resolve "sim")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Measure, CliVerb.resolve "mea")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Cut, CliVerb.resolve "cut")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Benchmark, CliVerb.resolve "ben")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Classify, CliVerb.resolve "cla")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Resolve, CliVerb.resolve "res")

[<Fact>]
let ``mea and measure both resolve to Measure (the diskpart question)`` () =
    for t in [ "mea"; "meas"; "measu"; "measur"; "measure" ] do
        Assert.Equal<Result<V, E>>(Ok CliVerb.Measure, CliVerb.resolve t)

[<Fact>]
let ``unambiguous prefixes resolve (cu->Cut, cl->Classify, single-letter where unique)`` () =
    Assert.Equal<Result<V, E>>(Ok CliVerb.Cut, CliVerb.resolve "cu")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Classify, CliVerb.resolve "cl")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Simulate, CliVerb.resolve "s") // only s-verb
    Assert.Equal<Result<V, E>>(Ok CliVerb.Measure, CliVerb.resolve "m") // only m-verb
    Assert.Equal<Result<V, E>>(Ok CliVerb.Benchmark, CliVerb.resolve "b") // only b-verb
    Assert.Equal<Result<V, E>>(Ok CliVerb.Resolve, CliVerb.resolve "r") // only r-verb

[<Fact>]
let ``ambiguous prefix is REJECTED not guessed (c -> cut|classify)`` () =
    match CliVerb.resolve "c" with
    | Error (CliVerb.ResolveError.Ambiguous("c", cands)) ->
        Assert.Equal<V list>([ CliVerb.Cut; CliVerb.Classify ], cands)
    | other -> Assert.Fail($"expected Ambiguous, got {other}")

[<Fact>]
let ``unknown token is rejected`` () =
    match CliVerb.resolve "xyz" with
    | Error (CliVerb.ResolveError.Unknown "xyz") -> ()
    | other -> Assert.Fail($"expected Unknown, got {other}")
    match CliVerb.resolve "" with
    | Error (CliVerb.ResolveError.Unknown _) -> ()
    | other -> Assert.Fail($"expected Unknown for empty, got {other}")

[<Fact>]
let ``resolution is culture-invariant / case-insensitive`` () =
    Assert.Equal<Result<V, E>>(Ok CliVerb.Measure, CliVerb.resolve "MEASURE")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Simulate, CliVerb.resolve "Sim")
    Assert.Equal<Result<V, E>>(Ok CliVerb.Cut, CliVerb.resolve "  CuT  ")

[<Fact>]
let ``commits: sim is ephemeral (false); mea/cut/ben/cla/res commit via the finalizer (true)`` () =
    Assert.False(CliVerb.commits CliVerb.Simulate)
    for v in [ CliVerb.Measure; CliVerb.Cut; CliVerb.Benchmark; CliVerb.Classify; CliVerb.Resolve ] do
        Assert.True(CliVerb.commits v, $"{v} should commit")
