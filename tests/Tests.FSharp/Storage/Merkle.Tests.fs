module Zeta.Tests.Storage.MerkleTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``MerkleTree root of no leaves is Zero`` () =
    let t = MerkleTree [||]
    t.Root |> should equal MerkleHash.Zero


[<Fact>]
let ``MerkleTree root is deterministic`` () =
    let leaves = [| "a"B; "b"B; "c"B |]
    let t1 = MerkleTree leaves
    let t2 = MerkleTree leaves
    t1.Root |> should equal t2.Root


[<Fact>]
let ``MerkleTree root changes under a single-leaf edit`` () =
    let t1 = MerkleTree [| "a"B; "b"B; "c"B |]
    let t2 = MerkleTree [| "a"B; "b"B; "d"B |]
    t1.Root |> should not' (equal t2.Root)


[<Fact>]
let ``MerkleTree LeafDiff detects single-leaf change`` () =
    let leaves1 = [| "alpha"B; "bravo"B; "charlie"B; "delta"B |]
    let leaves2 = [| "alpha"B; "bravo"B; "charlie"B; "echo"B |]
    let diff = (MerkleTree leaves2).LeafDiff(MerkleTree leaves1)
    diff.Length |> should equal 1
    diff.[0] |> should equal 3
