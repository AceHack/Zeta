module Zeta.Tests.Algebra.IoBoundaryTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``I/O boundary fuses composed signed interior into exterior G-set`` () =
    let interior =
        IoBoundary.composeAll [
            IoBoundary.emit "life"
            IoBoundary.emit "life"
            IoBoundary.emit "identity"
            IoBoundary.retract "identity"
            IoBoundary.retract "void"
        ]

    let exterior = IoBoundary.fuse interior

    Assert.Equal<string list>([ "life" ], IoBoundary.toList exterior)
    Assert.Equal(1, IoBoundary.count exterior)

[<Fact>]
let ``I/O boundary composes before output so internal ledgers do not leak`` () =
    let insert = IoBoundary.emit "boundary"
    let retract = IoBoundary.retract "boundary"

    let composedOutput =
        IoBoundary.compose insert retract
        |> IoBoundary.fuse

    let leakedIfObservedTooEarly =
        GSet.union
            (insert |> IoBoundary.fuse |> IoBoundary.output)
            (retract |> IoBoundary.fuse |> IoBoundary.output)

    Assert.True(IoBoundary.isEmpty composedOutput)
    Assert.Equal<string list>([ "boundary" ], GSet.toList leakedIfObservedTooEarly)

[<Fact>]
let ``input and output name the I/O passage without exposing signed history`` () =
    let exterior =
        ZSet.ofSeq [
            "inside", 3L
            "outside", 1L
            "inside", -3L
        ]
        |> IoBoundary.input
        |> IoBoundary.fuse
        |> IoBoundary.output

    Assert.Equal<string list>([ "outside" ], GSet.toList exterior)

[<Fact>]
let ``genesis enters as add-only facts and exits sorted unique`` () =
    let exterior =
        IoBoundary.genesis [ "zeta"; "genesis"; "zeta"; "boundary" ]
        |> IoBoundary.fuse

    Assert.Equal<string list>([ "boundary"; "genesis"; "zeta" ], IoBoundary.toList exterior)

[<Fact>]
let ``outside stays monotone after the boundary`` () =
    let first =
        IoBoundary.emit "mark"
        |> IoBoundary.fuse
        |> IoBoundary.output

    let absent =
        IoBoundary.retract "mark"
        |> IoBoundary.fuse
        |> IoBoundary.output

    GSet.union first absent
    |> GSet.toList
    |> fun actual -> Assert.Equal<string list>([ "mark" ], actual)
