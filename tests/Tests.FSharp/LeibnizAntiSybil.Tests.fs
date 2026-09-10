module Zeta.Tests.LeibnizAntiSybilTests

// Historical Leibniz/identity fixtures, scoped to the record statistics they execute.
// Observable equality is not physical/controller identity. Bit complementation is
// not list reversal or a CPT transformation. The dated component correction retains
// the original conceptual correspondence and the counterexamples to stronger claims.

open global.Xunit
open Zeta.Core

module AS = AntiSybil

/// A deterministic stream from a supplied SplitMix64 seed. Distinct seed labels do
/// not themselves constitute an independent-entropy or controller measurement.
let private streamFromSeed (seed: uint64) (n: int) : int list =
    let mutable s = seed
    [ for _ in 1 .. n do
        s <- s + SplitMix64.GoldenRatio
        yield int (SplitMix64.mix s &&& 1UL) ]

let private len = 256
let private threshold = 0.5

[<Fact>]
let ``identical nonempty record fixture forms one component`` () =
    let s = streamFromSeed 42UL len
    let observed = AS.antiSybil threshold [ s; s; s; s ]
    Assert.Equal(4, observed.ClaimedCount)
    Assert.Equal(1, observed.DistinctCount)
    Assert.False(observed.AllDistinct)

[<Fact>]
let ``bit complementation preserves perfect absolute agreement without reversing time order`` () =
    let s = streamFromSeed 7UL len
    let complemented = s |> List.map (fun b -> 1 - b)
    Assert.Equal(1.0, AS.correlation s complemented)
    Assert.Equal(1, (AS.antiSybil threshold [ s; complemented ]).DistinctCount)

[<Fact>]
let ``time reversal can remove the correlation edge even for one supplied history`` () =
    let history = [ 0; 0; 1; 0 ]
    let reversed = List.rev history
    Assert.Equal(0.0, AS.correlation history reversed)
    Assert.Equal(2, (AS.antiSybil threshold [ history; reversed ]).DistinctCount)

[<Fact>]
let ``five seeded fixture records have five singleton components at this threshold`` () =
    let streams = [ for seed in 1UL .. 5UL -> streamFromSeed (seed * 0x9E3779B97F4A7C15UL) len ]
    let observed = AS.antiSybil threshold streams
    Assert.Equal(5, observed.DistinctCount)
    Assert.True(observed.AllDistinct)

[<Fact>]
let ``six claims repeating two fixed seeded records form two components`` () =
    let a = streamFromSeed 0xA5A5A5A5UL len
    let b = streamFromSeed 0x5A5A5A5AUL len
    let observed = AS.antiSybil threshold [ a; a; a; b; b; b ]
    Assert.Equal(6, observed.ClaimedCount)
    Assert.Equal(2, observed.DistinctCount)
    let components = observed.SourceOf
    Assert.Equal(components.[0], components.[1])
    Assert.Equal(components.[1], components.[2])
    Assert.Equal(components.[3], components.[4])
    Assert.Equal(components.[4], components.[5])
    Assert.NotEqual(components.[0], components.[3])
