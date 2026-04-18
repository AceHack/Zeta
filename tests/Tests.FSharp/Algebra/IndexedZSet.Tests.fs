module Zeta.Tests.Algebra.IndexedZSetTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── IndexedZSet correctness (moved from ZSetTests) ─────────

[<Fact>]
let ``indexWith groups by key`` () =
    let z = ZSet.ofSeq [ (1, "a"), 1L ; (1, "b"), 1L ; (2, "c"), 1L ]
    let idx = IndexedZSet.indexWith fst snd z
    idx.KeyCount |> should equal 2
    idx.[1].Count |> should equal 2
    idx.[2].Count |> should equal 1


[<Fact>]
let ``toZSet roundtrips indexWith`` () =
    let z = ZSet.ofSeq [ (1, "a"), 1L ; (1, "b"), 2L ; (2, "c"), 3L ]
    let idx = IndexedZSet.indexWith fst snd z
    let flat = IndexedZSet.toZSet idx
    flat |> should equal z


// ─── IndexedZSet paths (moved from CoverageTests) ──────────────────

[<Fact>]
let ``IndexedZSet empty`` () =
    let e = IndexedZSet<int, string>.Empty
    e.IsEmpty |> should be True
    e.KeyCount |> should equal 0


[<Fact>]
let ``IndexedZSet add merges key groups`` () =
    let a = IndexedZSet.indexWith fst snd (ZSet.ofKeys [ (1, "a") ; (2, "b") ])
    let b = IndexedZSet.indexWith fst snd (ZSet.ofKeys [ (1, "c") ; (3, "d") ])
    let sum = IndexedZSet.add a b
    sum.KeyCount |> should equal 3


[<Fact>]
let ``IndexedZSet neg and sub`` () =
    let a = IndexedZSet.indexWith fst snd (ZSet.ofKeys [ (1, "a") ])
    let n = IndexedZSet.neg a
    let zero = IndexedZSet.add a n
    zero.IsEmpty |> should be True
    let diff = IndexedZSet.sub a a
    diff.IsEmpty |> should be True


[<Fact>]
let ``IndexedZSet join combines values`` () =
    let a = IndexedZSet.indexWith fst snd (ZSet.ofKeys [ (1, "a") ; (2, "b") ])
    let b = IndexedZSet.indexWith fst snd (ZSet.ofKeys [ (1, 10) ; (2, 20) ])
    let joined = IndexedZSet.join (fun k v1 v2 -> struct (k, v1, v2)) a b
    joined.[struct (1, "a", 10)] |> should equal 1L
    joined.[struct (2, "b", 20)] |> should equal 1L


[<Fact>]
let ``IndexedZSet Equals and GetHashCode`` () =
    let a = IndexedZSet.indexWith fst snd (ZSet.ofKeys [ (1, "a") ])
    let b = IndexedZSet.indexWith fst snd (ZSet.ofKeys [ (1, "a") ])
    a.Equals b |> should be True
    a.GetHashCode() |> should equal (b.GetHashCode())
    a.Equals "not indexed" |> should be False


[<Fact>]
let ``Default IndexedZSet works like empty`` () =
    let e = Unchecked.defaultof<IndexedZSet<int, string>>
    e.IsEmpty |> should be True
    e.KeyCount |> should equal 0


// ─── IndexedZSet bucket chain index (moved from CoverageBoostTests) ─────

[<Fact>]
let ``IndexedZSet.indexWith groups by derived key`` () =
    let raw = ZSet.ofKeys [ 1; 2; 3; 4 ]
    let idx = IndexedZSet.indexWith (fun k -> k % 2) id raw
    idx.KeyCount |> should equal 2


[<Fact>]
let ``IndexedZSet.toZSet round-trips indexWith on identity key`` () =
    let raw = ZSet.ofKeys [ "a"; "b"; "c" ]
    let idx = IndexedZSet.indexWith id id raw
    let z = IndexedZSet.toZSet idx
    z.Count |> should equal 3


[<Fact>]
let ``IndexedZSet empty is empty`` () =
    let e = IndexedZSet.empty<int, string>
    IndexedZSet.isEmpty e |> should be True
    IndexedZSet.keyCount e |> should equal 0
