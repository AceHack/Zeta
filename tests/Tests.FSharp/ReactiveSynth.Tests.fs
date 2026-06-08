module Zeta.Tests.ReactiveSynthTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ReactiveSynth

// Three banana-split queries over one int stream — each a little closure with free variables.
let private qCount: Query<int, int, int> =
    { Seed = 0; Step = (fun a _ -> a + 1); Extract = id }

let private qSum: Query<int, int, int> =
    { Seed = 0; Step = (fun a e -> a + e); Extract = id }

let private qLast: Query<int, int option, int option> =
    { Seed = None; Step = (fun _ e -> Some e); Extract = id }

let private stream = [ 3; 1; 4; 1; 5 ]

[<Fact>]
let ``run folds a single banana`` () =
    Assert.Equal(5, run qCount stream)
    Assert.Equal(14, run qSum stream)
    Assert.Equal(Some 5, run qLast stream)

[<Fact>]
let ``BANANA SPLIT LAW: run (zip a b) = (run a s, run b s) — one fused fold (#7054)`` () =
    Assert.Equal<int * int>((run qCount stream, run qSum stream), run (zip qCount qSum) stream)

[<Fact>]
let ``zip is a single pass: the fused fold equals the tuple of independent folds, for all prefixes`` () =
    // stronger: the law holds at every prefix (reactive trace), not just the end
    let fused = scan (zip qCount qSum) stream
    let independent = List.zip (scan qCount stream) (scan qSum stream)
    Assert.Equal<(int * int) list>(independent, fused)

// An interface synthesized from the joined queries (object expression, #7051).
type ICounters =
    abstract member Count: int
    abstract member Sum: int
    abstract member Last: int option

let private counters (c, s, l) : ICounters =
    { new ICounters with
        member _.Count = c
        member _.Sum = s
        member _.Last = l }

[<Fact>]
let ``synthesize news an interface from joined banana-split queries over one stream (#7052)`` () =
    let iface = synthesize counters (zip3 qCount qSum qLast) stream
    Assert.Equal(5, iface.Count)
    Assert.Equal(14, iface.Sum)
    Assert.Equal(Some 5, iface.Last)

[<Fact>]
let ``scan yields the running value at every prefix (reactive trace, seed first)`` () =
    Assert.Equal<int list>([ 0; 1; 2; 3; 4; 5 ], scan qCount stream)

[<Fact>]
let ``synthesizeTrace evolves the interface step by step; the latest is the current view (#7058)`` () =
    let trace = synthesizeTrace counters (zip3 qCount qSum qLast) stream
    let latest = List.last trace
    Assert.Equal(5, latest.Count)
    Assert.Equal(14, latest.Sum)
    Assert.Equal(stream.Length + 1, trace.Length) // seed + one per event

[<Fact>]
let ``map post-transforms a query's output`` () =
    Assert.Equal("5", run (map string qCount) stream)
