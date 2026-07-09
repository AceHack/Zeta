module Zeta.Tests.Algebra.PatriciaIntMapTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

[<Fact>]
let ``branchingBit computes highest differing bit`` () =
    // diff = 1 ^ 2 = 3 (0b11). Highest bit is 2 (1UL <<< 1).
    PatriciaInt.branchingBit 1UL 2UL |> should equal 2UL
    // diff = 4 ^ 8 = 12 (0b1100). Highest bit is 8 (1UL <<< 3).
    PatriciaInt.branchingBit 4UL 8UL |> should equal 8UL
    // Same prefixes should return 0UL
    PatriciaInt.branchingBit 100UL 100UL |> should equal 0UL

[<Fact>]
let ``insert and tryFind retrieve expected values`` () =
    let empty : PatriciaTree<int, string> = Nil
    let g1 = KeyGroup(1, ZSet.ofSeq [ "a", 1L ])
    let g2 = KeyGroup(2, ZSet.ofSeq [ "b", 2L ])
    let t1 = PatriciaInt.insert 1UL g1 empty
    let t2 = PatriciaInt.insert 2UL g2 t1

    PatriciaInt.tryFind 1UL t2 |> should equal (Some g1)
    PatriciaInt.tryFind 2UL t2 |> should equal (Some g2)
    PatriciaInt.tryFind 3UL t2 |> should equal None

[<Fact>]
let ``remove deletes key and preserves others`` () =
    let empty : PatriciaTree<int, string> = Nil
    let g1 = KeyGroup(1, ZSet.ofSeq [ "a", 1L ])
    let g2 = KeyGroup(2, ZSet.ofSeq [ "b", 2L ])
    let t1 = PatriciaInt.insert 1UL g1 empty
    let t2 = PatriciaInt.insert 2UL g2 t1

    let t3 = PatriciaInt.remove 1UL t2
    PatriciaInt.tryFind 1UL t3 |> should equal None
    PatriciaInt.tryFind 2UL t3 |> should equal (Some g2)

[<Fact>]
let ``merge resolves collisions and merges trees`` () =
    let resolve (g1: KeyGroup<int, string>) (g2: KeyGroup<int, string>) =
        KeyGroup(g1.Key, ZSet.add g1.Values g2.Values)

    let empty : PatriciaTree<int, string> = Nil
    let g1 = KeyGroup(1, ZSet.ofSeq [ "a", 1L ])
    let g2 = KeyGroup(2, ZSet.ofSeq [ "b", 2L ])
    let g3 = KeyGroup(1, ZSet.ofSeq [ "a", 2L ]) // collision on key 1

    let t1 = PatriciaInt.insert 1UL g1 empty |> PatriciaInt.insert 2UL g2
    let t2 = PatriciaInt.insert 1UL g3 empty

    let merged = PatriciaInt.merge resolve t1 t2
    let expectedG1 = KeyGroup(1, ZSet.ofSeq [ "a", 3L ])

    PatriciaInt.tryFind 1UL merged |> should equal (Some expectedG1)
    PatriciaInt.tryFind 2UL merged |> should equal (Some g2)

[<Fact>]
let ``structural sharing is preserved on independent branches`` () =
    let empty : PatriciaTree<int, string> = Nil
    // Build a tree with keys 4 and 5 (they share prefix above bit 1)
    // and key 100 (which differs at higher bits)
    let g4 = KeyGroup(4, ZSet.ofSeq [ "four", 1L ])
    let g5 = KeyGroup(5, ZSet.ofSeq [ "five", 1L ])
    let g100 = KeyGroup(100, ZSet.ofSeq [ "hundred", 1L ])

    let t1 = PatriciaInt.insert 4UL g4 empty
             |> PatriciaInt.insert 5UL g5
             |> PatriciaInt.insert 100UL g100

    // Now insert key 6 into t1 to get t2.
    // The node containing key 100 is in an independent branch and should be structurally shared!
    let g6 = KeyGroup(6, ZSet.ofSeq [ "six", 1L ])
    let t2 = PatriciaInt.insert 6UL g6 t1

    // Traverse both trees to locate the branch containing key 100.
    let rec getBranchFor100 t =
        match t with
        | Nil -> failwith "not found"
        | Tip(h, _) when h = 100UL -> t
        | Tip(_, _) -> failwith "not found"
        | Bin(p, m, l, r) ->
            if PatriciaInt.nomatch 100UL p m then failwith "not found"
            elif PatriciaInt.zero 100UL m then getBranchFor100 l
            else getBranchFor100 r

    let b1 = getBranchFor100 t1
    let b2 = getBranchFor100 t2

    // Verification of physical reference equality
    System.Object.ReferenceEquals(b1, b2) |> should be True
