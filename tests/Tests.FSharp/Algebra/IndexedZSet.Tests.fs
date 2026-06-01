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


// ─── generic-math abelian-group surface (Zero + (+) + (~-) + (-)) ───────────
// IndexedZSet (Z[K×V]) is an abelian group — same surface as the Z-set rung
// (#6480): Zero + (+) (additive monoid) PLUS (~-)/(-) (the inverse). The pooled
// key-group merge combiner lives ON THE TYPE so F# SRTP / Seq.sum / GenericZero
// resolve it; the module add/neg/sub delegate. NOT INumber — the ring product is
// the bilinear `join`, surfaced separately, not a numeric multiply.

let private ixz (pairs: ((int * string) * int64) list) : IndexedZSet<int, string> =
    IndexedZSet.indexWith fst snd (ZSet.ofSeq pairs)

[<Fact>]
let ``(+) equals IndexedZSet.add; (~-) equals neg; (-) equals sub`` () =
    let a = ixz [ (1, "a"), 1L; (2, "b"), 2L ]
    let b = ixz [ (2, "b"), 1L; (3, "c"), 3L ]
    (a + b) |> should equal (IndexedZSet.add a b)
    (-a) |> should equal (IndexedZSet.neg a)
    (a - b) |> should equal (IndexedZSet.sub a b)

[<Fact>]
let ``Zero is the additive identity and equals empty / GenericZero`` () =
    let a = ixz [ (1, "a"), 1L ]
    (IndexedZSet<int, string>.Zero + a) |> should equal a
    (a + IndexedZSet<int, string>.Zero) |> should equal a
    IndexedZSet<int, string>.Zero |> should equal IndexedZSet.empty<int, string>
    LanguagePrimitives.GenericZero<IndexedZSet<int, string>> |> should equal IndexedZSet.empty<int, string>

[<Fact>]
let ``abelian-group inverse via operators: a + (-a) = Zero and a - a = Zero`` () =
    let a = ixz [ (1, "a"), 1L; (2, "b"), -2L; (2, "c"), 3L ]
    (a + (-a)) |> IndexedZSet.isEmpty |> should be True
    (a - a) |> IndexedZSet.isEmpty |> should be True

[<Fact>]
let ``Seq.sum aggregates through GenericZero + (+) (key empties out and drops)`` () =
    let parts =
        [ ixz [ (1, "a"), 1L ]
          ixz [ (1, "a"), 1L; (2, "b"), 2L ]
          ixz [ (2, "b"), -2L ] ]
    // key 1 → a:2 ; key 2 → b nets 0 → value-ZSet empties → key dropped
    IndexedZSet.toZSet (Seq.sum parts) |> should equal (ZSet.ofSeq [ (1, "a"), 2L ])

[<Fact>]
let ``(+) is NOT idempotent: a + a doubles every value-weight`` () =
    let a = ixz [ (1, "a"), 1L; (1, "b"), -3L ]
    IndexedZSet.toZSet (a + a) |> should equal (ZSet.ofSeq [ (1, "a"), 2L; (1, "b"), -6L ])
