module Zeta.Tests.Algebra.ZSetTests
#nowarn "0893"

open FsUnit.Xunit
open FsCheck
open FsCheck.FSharp
open global.Xunit
open Zeta.Core


// ───────────── Basic invariants ─────────────

[<Fact>]
let ``empty zset has count zero`` () =
    ZSet.count ZSet<int>.Empty |> should equal 0
    ZSet.isEmpty ZSet<int>.Empty |> should be True

[<Fact>]
let ``singleton contains the key`` () =
    let s = ZSet.singleton 42 1L
    s.[42] |> should equal 1L
    s.[99] |> should equal 0L
    s.Count |> should equal 1

[<Fact>]
let ``singleton with zero weight is empty`` () =
    ZSet.singleton 42 0L |> ZSet.isEmpty |> should be True

[<Fact>]
let ``ofSeq consolidates duplicates`` () =
    let s = ZSet.ofSeq [ 1, 2L ; 2, 3L ; 1, 5L ]
    s.[1] |> should equal 7L
    s.[2] |> should equal 3L

[<Fact>]
let ``ofSeq drops zero weights after consolidation`` () =
    let s = ZSet.ofSeq [ 1, 2L ; 1, -2L ; 3, 4L ]
    s.[1] |> should equal 0L
    s.[3] |> should equal 4L
    s.Count |> should equal 1


// ───────────── ZSet construction variants (moved from CoverageTests) ─────────────

[<Fact>]
let ``ZSet ofKeys with duplicates sums weights`` () =
    let z = ZSet.ofKeys [ 1 ; 1 ; 2 ; 3 ; 3 ; 3 ]
    z.[1] |> should equal 2L
    z.[2] |> should equal 1L
    z.[3] |> should equal 3L


[<Fact>]
let ``ZSet ofSet deduplicates`` () =
    let z = ZSet.ofSet [ 1 ; 1 ; 2 ; 3 ; 3 ]
    z.Count |> should equal 3
    z.[1] |> should equal 1L
    z.[2] |> should equal 1L


[<Fact>]
let ``ZSet scale by zero is empty`` () =
    let z = ZSet.ofKeys [ 1 ; 2 ; 3 ]
    ZSet.scale 0L z |> ZSet.isEmpty |> should be True


[<Fact>]
let ``ZSet scale by one is identity`` () =
    let z = ZSet.ofKeys [ 1 ; 2 ; 3 ]
    ZSet.scale 1L z |> should equal z


[<Fact>]
let ``ZSet scale by negative one is neg`` () =
    let z = ZSet.ofKeys [ 1 ; 2 ]
    ZSet.scale -1L z |> should equal (ZSet.neg z)


[<Fact>]
let ``ZSet flatMap chains weights`` () =
    let z = ZSet.ofSeq [ 1, 2L ; 2, 3L ]
    let result = ZSet.flatMap (fun k -> ZSet.singleton (k * 10) 1L) z
    result.[10] |> should equal 2L
    result.[20] |> should equal 3L


[<Fact>]
let ``ZSet cartesian`` () =
    let a = ZSet.ofKeys [ 1 ; 2 ]
    let b = ZSet.ofKeys [ "a" ; "b" ]
    let product = ZSet.cartesian a b
    product.[(1, "a")] |> should equal 1L
    product.[(2, "b")] |> should equal 1L


[<Fact>]
let ``ZSet sum folds Z-sets`` () =
    let zs = [ ZSet.singleton 1 1L ; ZSet.singleton 2 1L ; ZSet.singleton 1 1L ]
    let s = ZSet.sum zs
    s.[1] |> should equal 2L
    s.[2] |> should equal 1L


[<Fact>]
let ``ZSet ofPairs from struct tuples`` () =
    let z = ZSet.ofPairs [ struct (1, 1L) ; struct (2, 2L) ; struct (1, 1L) ]
    z.[1] |> should equal 2L
    z.[2] |> should equal 2L


[<Fact>]
let ``Default ZSet is empty`` () =
    let z = Unchecked.defaultof<ZSet<int>>
    z.IsEmpty |> should be True
    z.Count |> should equal 0
    z.[42] |> should equal 0L


[<Fact>]
let ``ZSet ToString formats readably`` () =
    let z = ZSet.ofKeys [ 1 ; 2 ]
    let s = z.ToString()
    s |> should haveSubstring "1"
    s |> should haveSubstring "2"


[<Fact>]
let ``ZSet empty ToString`` () =
    let z = ZSet<int>.Empty
    z.ToString() |> should equal "{}"


[<Fact>]
let ``ZSet GetHashCode stable for equal sets`` () =
    let a = ZSet.ofKeys [ 1 ; 2 ; 3 ]
    let b = ZSet.ofKeys [ 3 ; 2 ; 1 ]
    a.GetHashCode() |> should equal (b.GetHashCode())


[<Fact>]
let ``ZSet Equals handles non-ZSet`` () =
    let z = ZSet.ofKeys [ 1 ]
    z.Equals "not a zset" |> should be False


[<Fact>]
let ``ZSet isPositive and isSet`` () =
    ZSet.ofKeys [ 1 ; 2 ] |> ZSet.isSet |> should be True
    ZSet.ofKeys [ 1 ; 2 ] |> ZSet.isPositive |> should be True
    ZSet.ofSeq [ 1, -1L ] |> ZSet.isPositive |> should be False


// ───────────── weightedCount (moved from Round7/Round8) ─────────────

[<Fact>]
let ``weightedCount sums 100 entries correctly`` () =
    let pairs = [| for i in 0 .. 99 -> i, int64 (i + 1) |]
    let z = ZSet.ofSeq pairs
    let expected = (100L * 101L) / 2L   // Σ 1..100
    ZSet.weightedCount z |> should equal expected


[<Fact>]
let ``weightedCount handles negative weights`` () =
    let pairs = [ 1, 10L; 2, -5L; 3, 7L ]
    let z = ZSet.ofSeq pairs
    ZSet.weightedCount z |> should equal 12L


[<Fact>]
let ``ZSet.weightedCount handles length not divisible by 4`` () =
    // Force the tail path: 7 items (not multiple of 4).
    let pairs = [| for i in 1 .. 7 -> i, int64 i |]
    let z = ZSet.ofSeq pairs
    ZSet.weightedCount z |> should equal 28L   // 1+2+...+7


[<Fact>]
let ``ZSet.weightedCount handles empty`` () =
    ZSet.weightedCount ZSet<int>.Empty |> should equal 0L


// ───────────── FsCheck generators ─────────────

let private smallZSet : Arbitrary<ZSet<int>> =
    let g =
        Gen.sized (fun size ->
            let n = min size 16
            Gen.zip (Gen.choose (-5, 5)) (Gen.choose (-3, 3) |> Gen.map int64)
            |> Gen.listOfLength n
            |> Gen.map ZSet.ofSeq)
    Arb.fromGen g

type SmallZSetArb() =
    static member ZSet() = smallZSet


// ───────────── Group axioms ─────────────

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``addition is associative`` (a: ZSet<int>) (b: ZSet<int>) (c: ZSet<int>) =
    ZSet.add (ZSet.add a b) c = ZSet.add a (ZSet.add b c)

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``addition is commutative`` (a: ZSet<int>) (b: ZSet<int>) =
    ZSet.add a b = ZSet.add b a

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``zero is additive identity`` (a: ZSet<int>) =
    ZSet.add a ZSet.empty = a && ZSet.add ZSet.empty a = a

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``negation gives additive inverse`` (a: ZSet<int>) =
    ZSet.add a (ZSet.neg a) = ZSet<int>.Empty

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``double negation is identity`` (a: ZSet<int>) =
    ZSet.neg (ZSet.neg a) = a

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``subtraction is addition of negation`` (a: ZSet<int>) (b: ZSet<int>) =
    ZSet.sub a b = ZSet.add a (ZSet.neg b)


// ───────────── Linearity ─────────────

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``filter distributes over add`` (a: ZSet<int>) (b: ZSet<int>) =
    let p x = x > 0
    ZSet.filter p (ZSet.add a b) = ZSet.add (ZSet.filter p a) (ZSet.filter p b)

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``map distributes over add`` (a: ZSet<int>) (b: ZSet<int>) =
    let f x = x * 2
    ZSet.map f (ZSet.add a b) = ZSet.add (ZSet.map f a) (ZSet.map f b)

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``scale distributes over add`` (a: ZSet<int>) (b: ZSet<int>) =
    let n = 3L
    ZSet.scale n (ZSet.add a b) = ZSet.add (ZSet.scale n a) (ZSet.scale n b)


// ───────────── Distinct semantics ─────────────

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``distinct is idempotent`` (a: ZSet<int>) =
    ZSet.distinct (ZSet.distinct a) = ZSet.distinct a

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``distinct produces a set`` (a: ZSet<int>) =
    let d = ZSet.distinct a
    ZSet.isSet d || ZSet.isEmpty d

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``distinct is positive-preserving`` (a: ZSet<int>) =
    ZSet.isPositive (ZSet.distinct a)


// ───────────── Bilinearity of join ─────────────

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``join is linear in first argument`` (a1: ZSet<int>) (a2: ZSet<int>) (b: ZSet<int>) =
    let left = ZSet.join id id (fun x y -> (x, y)) (ZSet.add a1 a2) b
    let right = ZSet.add (ZSet.join id id (fun x y -> (x, y)) a1 b)
                         (ZSet.join id id (fun x y -> (x, y)) a2 b)
    left = right

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``join is linear in second argument`` (a: ZSet<int>) (b1: ZSet<int>) (b2: ZSet<int>) =
    let left = ZSet.join id id (fun x y -> (x, y)) a (ZSet.add b1 b2)
    let right = ZSet.add (ZSet.join id id (fun x y -> (x, y)) a b1)
                         (ZSet.join id id (fun x y -> (x, y)) a b2)
    left = right


// ───────────── Incremental distinct (the H function) ─────────────

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``distinctIncremental plus distinct of old equals distinct of new`` (oldV: ZSet<int>) (delta: ZSet<int>) =
    let oldDistinct = ZSet.distinct oldV
    let newDistinct = ZSet.distinct (ZSet.add oldV delta)
    let h = ZSet.distinctIncremental oldV delta
    ZSet.add oldDistinct h = newDistinct
