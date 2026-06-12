module Zeta.Tests.Algebra.FusionReconstructionTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

[<Fact>]
let ``fuse reconstructs a G-set from positive Z-set support`` () =
    let interior =
        ZSet.ofSeq [
            "genesis", 1L
            "bifurcation", 2L
            "void", -1L
            "retracted", 1L
            "retracted", -1L
        ]

    FusionReconstruction.fuse interior
    |> GSet.toList
    |> should equal [ "bifurcation"; "genesis" ]

[<Fact>]
let ``fusion hides internal multiplicity at the exterior boundary`` () =
    let oneWay = ZSet.ofSeq [ "life", 1L ]
    let manyWays = ZSet.ofSeq [ "life", 10L ]

    FusionReconstruction.fuse oneWay
    |> should equal (FusionReconstruction.fuse manyWays)

[<Fact>]
let ``fusion composes the signed interior before exposing the exterior`` () =
    let insert = ZSet.ofSeq [ "identity", 1L ]
    let retract = ZSet.ofSeq [ "identity", -1L ]

    let composedExterior = FusionReconstruction.fuse (ZSet.add insert retract)
    let leakedExterior = GSet.union (FusionReconstruction.fuse insert) (FusionReconstruction.fuse retract)

    composedExterior |> GSet.isEmpty |> should equal true
    leakedExterior |> GSet.toList |> should equal [ "identity" ]

[<Fact>]
let ``fusion exterior is an idempotent G-set`` () =
    let exterior =
        ZSet.ofSeq [ "a", 3L; "b", 1L; "c", -2L ]
        |> FusionReconstruction.fuse

    GSet.union exterior exterior |> should equal exterior

[<Fact>]
let ``positiveSupport names the same reconstruction as fuse`` () =
    let z = ZSet.ofSeq [ "a", 1L; "b", -1L; "c", 2L ]

    FusionReconstruction.positiveSupport z
    |> should equal (FusionReconstruction.fuse z)
