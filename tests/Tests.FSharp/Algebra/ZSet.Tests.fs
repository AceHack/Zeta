module Zeta.Tests.Algebra.ZSetTests
#nowarn "0893"

open System.IO
open System.Reflection
open System.Text.Json
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


// ───────────── Shared golden vector (cross-language parity lock) ───────────
// Z-set is the TOP rung of the cross-language algebra ladder (G-Set ⊂ Bag ⊂
// Z-set). TS = oracle #1 (the reference + the treaty fixture); this is the F#
// oracle joining the treaty. The F# `ZSet` engine is the impl under test:
// `add` is the per-key-SUM combiner (the treaty's `union`), and it drops any
// key that nets to weight 0 (retraction) — so the same fixture the TS reference
// emitted replays here byte-for-byte. "The compilers don't lie."

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel) — same
/// pattern as the Bag / G-Set golden-vector tests.
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."
    dir.FullName

/// Eager list-comprehension over `EnumerateArray()` — NOT `Seq.map`. The
/// `JsonElement.ArrayEnumerator` is a mutable struct that corrupts when boxed
/// through a lazy Seq pipeline in Release (passes in fsi, fails compiled).
let private zEntList (e: JsonElement) : (string * int64) list =
    [ for x in e.EnumerateArray() -> (x.GetProperty("e").GetString(), x.GetProperty("w").GetInt64()) ]

/// Enumerate the canonical (ascending-key, zero-dropped) run to (key, weight).
let private zToList (z: ZSet<string>) : (string * int64) list =
    [ for entry in z -> (entry.Key, entry.Weight) ]

type private ZSetOp =
    | Add of string
    | AddW of string * int64
    | Union of (string * int64) list

let private parseZOp (e: JsonElement) : ZSetOp =
    match e.GetProperty("op").GetString() with
    | "add" -> Add(e.GetProperty("arg").GetString())
    | "addW" -> AddW(e.GetProperty("arg").GetString(), e.GetProperty("w").GetInt64())
    | "union" -> Union(zEntList (e.GetProperty("arg")))
    | other -> failwithf "unknown z-set op in fixture: %s" other

/// Read the fixture once; copy every primitive into F# values so the
/// JsonDocument is safe to dispose before the values are used.
let private loadZVector () : (string * int64) list * ZSetOp list * (string * int64) list list * (string * int64) list =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "z-set", "golden-vectors.json")
    use doc = JsonDocument.Parse(File.ReadAllText(path))
    let root = doc.RootElement
    let initial = zEntList (root.GetProperty("initialZSet"))
    let ops = [ for op in root.GetProperty("ops").EnumerateArray() -> parseZOp op ]
    let replay = [ for st in root.GetProperty("expectedReplayStates").EnumerateArray() -> zEntList st ]
    let final = zEntList (root.GetProperty("expectedFinalState"))
    initial, ops, replay, final

[<Fact>]
let ``F# replays the shared Z-set golden vector to expectedReplayStates + expectedFinalState`` () =
    let initial, ops, expectedReplay, expectedFinal = loadZVector ()
    let mutable state = ZSet.ofSeq initial
    let actual =
        [ for op in ops do
              state <-
                  match op with
                  | Add x -> ZSet.add state (ZSet.singleton x 1L) // treaty `add` = +1
                  | AddW (x, w) -> ZSet.add state (ZSet.singleton x w) // signed weight (may be negative)
                  | Union xs -> ZSet.add state (ZSet.ofSeq xs) // treaty `union` = per-key SUM combiner
              yield zToList state ]
    actual |> should equal expectedReplay
    zToList state |> should equal expectedFinal

[<Fact>]
let ``Z-set distinctions: abelian-group inverse, negatives persist, retraction-to-0 drops`` () =
    let a = ZSet.ofSeq [ ("a", 1L); ("b", 2L) ]
    // inverse: add a (neg a) = empty (the law the Bag's monoid cannot satisfy)
    ZSet.add a (ZSet.neg a) |> ZSet.isEmpty |> should equal true
    // negatives persist (drop rule is == 0, not <= 0 — the Bag would drop this)
    ZSet.ofSeq [ ("c", -1L) ] |> zToList |> should equal [ ("c", -1L) ]
    // retraction: a key driven to net 0 is dropped
    ZSet.add (ZSet.ofSeq [ ("a", 1L) ]) (ZSet.ofSeq [ ("a", -1L) ])
    |> ZSet.isEmpty
    |> should equal true


// ─── generic-math abelian-group surface (Zero + (+) + (~-) + (-)) ───────────
// Z-set surfaces the native F# generic-math idiom ON THE TYPE: `Zero` + `(+)`
// (additive monoid) PLUS `(~-)` / `(-)` (the abelian-group inverse) — the
// `System.Numerics`-shaped interface ("numerics like dotnet", pushed to the
// other langs that lack generic-math). NOT `INumber` (no total order; the ring
// scalar is `ZSet.scale`, not a numeric product). These lock the operators to
// the pooled combiner (operator ≡ module fn) and let generic numeric code +
// `Seq.sum` aggregate Z-sets through `GenericZero` + `(+)`.

[<Fact>]
let ``(+) equals ZSet.add — operator delegates to the same pooled combiner`` () =
    let a = ZSet.ofSeq [ ("a", 1L); ("b", 2L) ]
    let b = ZSet.ofSeq [ ("b", 1L); ("c", 3L) ]
    (a + b) |> should equal (ZSet.add a b)
    (a + b) |> zToList |> should equal [ ("a", 1L); ("b", 3L); ("c", 3L) ]

[<Fact>]
let ``(~-) equals ZSet.neg and (-) equals ZSet.sub`` () =
    let a = ZSet.ofSeq [ ("a", 1L); ("b", 2L) ]
    let b = ZSet.ofSeq [ ("b", 1L) ]
    (-a) |> should equal (ZSet.neg a)
    (a - b) |> should equal (ZSet.sub a b)
    (a - b) |> zToList |> should equal [ ("a", 1L); ("b", 1L) ]

[<Fact>]
let ``Zero is the additive identity and equals empty / GenericZero`` () =
    let a = ZSet.ofSeq [ ("a", 1L); ("b", 2L) ]
    (ZSet<string>.Zero + a) |> should equal a
    (a + ZSet<string>.Zero) |> should equal a
    ZSet<string>.Zero |> should equal ZSet.empty<string>
    LanguagePrimitives.GenericZero<ZSet<string>> |> should equal ZSet.empty<string>

[<Fact>]
let ``abelian-group inverse via operators: a + (-a) = Zero and a - a = Zero`` () =
    let a = ZSet.ofSeq [ ("a", 1L); ("b", -2L); ("c", 3L) ]
    (a + (-a)) |> should equal ZSet<string>.Zero
    (a - a) |> should equal ZSet<string>.Zero

[<Fact>]
let ``Seq.sum aggregates Z-sets through GenericZero + (+) (retraction nets to 0)`` () =
    let parts =
        [ ZSet.ofSeq [ ("a", 1L) ]
          ZSet.ofSeq [ ("a", 1L); ("b", 2L) ]
          ZSet.ofSeq [ ("b", -2L); ("c", 5L) ] ]
    // empty Seq.sum seed is GenericZero (= empty); b nets to 0 and drops
    Seq.sum parts |> zToList |> should equal [ ("a", 2L); ("c", 5L) ]

[<Fact>]
let ``(+) is NOT idempotent: a + a doubles every weight (Z-set, not G-Set)`` () =
    let a = ZSet.ofSeq [ ("a", 1L); ("b", -3L) ]
    (a + a) |> zToList |> should equal [ ("a", 2L); ("b", -6L) ]


// ───────────── C14 (081KT2T2J0008QG0R000YZ3NMY P1): earn-its-keep auto-prune ─────────────
// The ±1 Z-set ABELIAN GROUP laws (assoc / commut / Zero-identity /
// negation-inverse / double-neg / sub) are already proven in the "Group
// axioms" section above — C14 does NOT duplicate them. C14's remaining
// half is the EARN-ITS-KEEP AUTO-PRUNE (081KT2T2J0008QG0R0008TFHJT): a key whose weights sum
// to 0 is dropped (it didn't earn its keep; ZSet `(+)` at Algebra.fs:81
// stores only `s <> 0L`), and that physical prune PRESERVES SEMANTICS.
// Two FsCheck laws over SmallZSetArb:
//   * invariant — no surviving entry has weight 0 (every key earned its keep)
//   * semantics — lookup is an additive homomorphism: lookup k (a+b) =
//     lookup k a + lookup k b at EVERY key (present or absent), so a
//     cancelled/dropped key still looks up as its true sum (0). Shapiro CRDTs.

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``C14 earn-its-keep: no surviving entry has weight zero (auto-prune invariant)``
    (a: ZSet<int>) (b: ZSet<int>) =
    let nonzero (z: ZSet<int>) = z |> Seq.forall (fun e -> e.Weight <> 0L)
    // the group OPERATIONS preserve the invariant — cancellations are pruned
    nonzero a && nonzero b
    && nonzero (ZSet.add a b) && nonzero (ZSet.sub a b) && nonzero (ZSet.neg a)

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |])>]
let ``C14 auto-prune preserves semantics: lookup is an additive homomorphism (dropped keys look up as 0)``
    (a: ZSet<int>) (b: ZSet<int>) =
    // every key present in a or b, plus absent sentinels — the homomorphism
    // must hold even where a+b physically dropped a cancelled key (lookup 0).
    let keys =
        Seq.append (a |> Seq.map (fun e -> e.Key)) (b |> Seq.map (fun e -> e.Key))
        |> Seq.append (seq { -1; 0; 9999 })
        |> Seq.distinct
    let sum = ZSet.add a b
    keys |> Seq.forall (fun k -> ZSet.lookup k sum = ZSet.lookup k a + ZSet.lookup k b)

// ─── 081KT07NV0008QG0R001YDB73K: Z-set key ordering is ORDINAL (binary collation), not culture-sensitive ───
// Default collation = Collation.binary via KeyComparerCache. 'B'(0x42) < 'a'(0x61), so the canonical
// sorted run orders uppercase before lowercase — the cross-language byte-consensus order (C#/Rust/TS).
[<Fact>]
let ``ofSeq orders string keys ordinally (081KT07NV0008QG0R001YDB73K binary collation, not culture-sensitive)`` () =
    let z = ZSet.ofSeq [ "a", 1L; "B", 1L; "C", 1L; "b", 1L ]
    let keys = z |> Seq.map (fun e -> e.Key) |> Seq.toArray
    Assert.Equal<string[]>([| "B"; "C"; "a"; "b" |], keys)

[<Fact>]
let ``lookup finds string keys under ordinal ordering (081KT07NV0008QG0R001YDB73K)`` () =
    let z = ZSet.ofSeq [ "Apple", 3L; "apple", 5L ]
    // distinct ordinal keys (cap A vs lowercase a) must not collide
    Assert.Equal(3L, ZSet.lookup "Apple" z)
    Assert.Equal(5L, ZSet.lookup "apple" z)
