module Zeta.Tests.Algebra.BagTests

open System.IO
open System.Reflection
open System.Text.Json
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// Bag is the MIDDLE rung of the cross-language algebra ladder (G-Set ⊂ Bag ⊂
// Z-set). TS = oracle #1; Rust joined; this is the F# oracle. This file proves
// the commutative-monoid laws (commutative, associative, identity — and
// crucially NOT idempotent, the Bag/G-Set distinction) AND that the F# impl
// replays the SHARED golden vector to the same states the TS reference emitted.
// "The compilers don't lie."

// ─── Commutative-monoid laws (and the non-idempotence that defines a Bag) ───

[<Fact>]
let ``ofSeq counts occurrences`` () =
    Bag.ofSeq [ "a"; "b"; "a"; "c"; "a" ]
    |> Bag.toList
    |> should equal [ ("a", 3L); ("b", 1L); ("c", 1L) ]

[<Fact>]
let ``ofEntries sums per key, sorts ascending, drops non-positive`` () =
    Bag.ofEntries [ ("c", 1L); ("a", 2L); ("c", 3L); ("b", 1L); ("b", -1L) ]
    |> Bag.toList
    |> should equal [ ("a", 2L); ("c", 4L) ] // b nets to 0 → dropped; c: 1+3=4

[<Fact>]
let ``union is NOT idempotent: union a a doubles every count`` () =
    let a = Bag.ofEntries [ ("a", 1L); ("b", 2L) ]
    Bag.union a a |> Bag.toList |> should equal [ ("a", 2L); ("b", 4L) ]

[<Fact>]
let ``union is commutative`` () =
    let a = Bag.ofEntries [ ("a", 1L); ("b", 2L) ]
    let b = Bag.ofEntries [ ("b", 1L); ("c", 3L) ]
    Bag.union a b |> Bag.toList |> should equal (Bag.union b a |> Bag.toList)

[<Fact>]
let ``union is associative`` () =
    let a = Bag.ofEntries [ ("a", 1L) ]
    let b = Bag.ofEntries [ ("a", 2L); ("b", 1L) ]
    let c = Bag.ofEntries [ ("b", 5L); ("c", 1L) ]
    Bag.toList (Bag.union (Bag.union a b) c)
    |> should equal (Bag.toList (Bag.union a (Bag.union b c)))

[<Fact>]
let ``union identity: union a empty = a and union empty a = a`` () =
    let a = Bag.ofEntries [ ("a", 1L); ("b", 2L) ]
    Bag.union a Bag.empty<string> |> Bag.toList |> should equal (Bag.toList a)
    Bag.union Bag.empty<string> a |> Bag.toList |> should equal (Bag.toList a)

[<Fact>]
let ``multiplicity + contains via binary search`` () =
    let a = Bag.ofEntries [ ("a", 3L); ("c", 1L) ]
    Bag.multiplicity "a" a |> should equal 3L
    Bag.multiplicity "b" a |> should equal 0L
    Bag.contains "c" a |> should equal true
    Bag.contains "z" a |> should equal false
    Bag.multiplicity "a" Bag.empty<string> |> should equal 0L

[<Fact>]
let ``addN is a no-op for n <= 0; add increments`` () =
    let a = Bag.ofEntries [ ("a", 1L) ]
    Bag.addN "a" 0L a |> Bag.toList |> should equal (Bag.toList a)
    Bag.addN "b" -3L a |> Bag.toList |> should equal (Bag.toList a)
    Bag.add "a" a |> Bag.toList |> should equal [ ("a", 2L) ]
    Bag.addN "z" 4L a |> Bag.toList |> should equal [ ("a", 1L); ("z", 4L) ]

[<Fact>]
let ``total + distinctCount`` () =
    let a = Bag.ofEntries [ ("a", 3L); ("b", 1L); ("c", 4L) ]
    Bag.total a |> should equal 8L
    Bag.distinctCount a |> should equal 3

[<Fact>]
let ``custom equality: order-independent inputs are equal + hash-stable`` () =
    let a = Bag.ofEntries [ ("a", 2L); ("b", 1L); ("c", 3L) ]
    let b = Bag.ofEntries [ ("c", 1L); ("a", 2L); ("b", 1L); ("c", 2L) ] // c: 1+2=3
    (a = b) |> should equal true
    a.GetHashCode() |> should equal (b.GetHashCode())
    (a = Bag.ofEntries [ ("a", 2L); ("b", 1L) ]) |> should equal false

// ─── Shared golden vector (cross-language parity lock) ─────────────────────

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel) — same
/// pattern as the G-Set / observe golden-vector tests.
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
let private entList (e: JsonElement) : (string * int64) list =
    [ for x in e.EnumerateArray() -> (x.GetProperty("e").GetString(), x.GetProperty("n").GetInt64()) ]

type private BagOp =
    | Add of string
    | AddN of string * int64
    | Union of (string * int64) list

let private parseOp (e: JsonElement) : BagOp =
    match e.GetProperty("op").GetString() with
    | "add" -> Add(e.GetProperty("arg").GetString())
    | "addN" -> AddN(e.GetProperty("arg").GetString(), e.GetProperty("n").GetInt64())
    | "union" -> Union(entList (e.GetProperty("arg")))
    | other -> failwithf "unknown bag op in fixture: %s" other

/// Read the fixture once; copy every primitive into F# values so the
/// JsonDocument is safe to dispose before the values are used.
let private loadVector () : (string * int64) list * BagOp list * (string * int64) list list * (string * int64) list =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "bag", "golden-vectors.json")
    use doc = JsonDocument.Parse(File.ReadAllText(path))
    let root = doc.RootElement
    let initial = entList (root.GetProperty("initialBag"))
    let ops = [ for op in root.GetProperty("ops").EnumerateArray() -> parseOp op ]
    let replay = [ for st in root.GetProperty("expectedReplayStates").EnumerateArray() -> entList st ]
    let final = entList (root.GetProperty("expectedFinalState"))
    initial, ops, replay, final

[<Fact>]
let ``F# replays the shared Bag golden vector to expectedReplayStates + expectedFinalState`` () =
    let initial, ops, expectedReplay, expectedFinal = loadVector ()
    let mutable state = Bag.ofEntries initial
    let actual =
        [ for op in ops do
              state <-
                  match op with
                  | Add x -> Bag.add x state
                  | AddN (x, n) -> Bag.addN x n state
                  | Union xs -> Bag.union state (Bag.ofEntries xs)
              yield Bag.toList state ]
    actual |> should equal expectedReplay
    Bag.toList state |> should equal expectedFinal
