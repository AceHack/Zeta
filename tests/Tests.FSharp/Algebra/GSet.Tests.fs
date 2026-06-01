module Zeta.Tests.Algebra.GSetTests

open System.IO
open System.Reflection
open System.Text.Json
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// G-Set is oracle #2 of the cross-language 4-oracle (TS = #1; C#/Rust join
// later per the meet-in-the-middle fan-out). This file proves the three CRDT
// convergence laws hold AND that the F# impl replays the SHARED golden vector
// to the same states the TS reference emitted. "The compilers don't lie."

// ─── CRDT convergence laws (why a G-Set converges without coordination) ────

[<Fact>]
let ``ofSeq sorts ascending and drops duplicates`` () =
    GSet.ofSeq [ "c"; "a"; "b"; "a"; "c" ] |> GSet.toList |> should equal [ "a"; "b"; "c" ]

[<Fact>]
let ``contains agrees with membership via binary search`` () =
    let s = GSet.ofSeq [ "a"; "c"; "e" ]
    GSet.contains "c" s |> should equal true
    GSet.contains "d" s |> should equal false
    GSet.contains "a" GSet.empty<string> |> should equal false

[<Fact>]
let ``union is idempotent: union a a = a`` () =
    let a = GSet.ofSeq [ "a"; "b" ]
    GSet.union a a |> GSet.toList |> should equal (GSet.toList a)

[<Fact>]
let ``union is commutative: union a b = union b a`` () =
    let a = GSet.ofSeq [ "a"; "b" ]
    let b = GSet.ofSeq [ "b"; "c" ]
    GSet.union a b |> GSet.toList |> should equal (GSet.union b a |> GSet.toList)

[<Fact>]
let ``union is associative: union (union a b) c = union a (union b c)`` () =
    let a = GSet.ofSeq [ "a"; "b" ]
    let b = GSet.ofSeq [ "b"; "c" ]
    let c = GSet.ofSeq [ "c"; "d" ]
    let left = GSet.union (GSet.union a b) c
    let right = GSet.union a (GSet.union b c)
    GSet.toList left |> should equal (GSet.toList right)

[<Fact>]
let ``union identity: union a empty = a and union empty a = a`` () =
    let a = GSet.ofSeq [ "a"; "b" ]
    GSet.union a GSet.empty<string> |> GSet.toList |> should equal (GSet.toList a)
    GSet.union GSet.empty<string> a |> GSet.toList |> should equal (GSet.toList a)

[<Fact>]
let ``add is idempotent for a present element`` () =
    let a = GSet.ofSeq [ "a"; "b" ]
    GSet.add "a" a |> GSet.toList |> should equal (GSet.toList a)
    GSet.add "z" a |> GSet.toList |> should equal [ "a"; "b"; "z" ]

[<Fact>]
let ``custom equality: order-independent inputs are equal + hash-stable`` () =
    let a = GSet.ofSeq [ "a"; "b"; "c" ]
    let b = GSet.ofSeq [ "c"; "a"; "b"; "a" ]
    (a = b) |> should equal true
    a.GetHashCode() |> should equal (b.GetHashCode())
    (a = GSet.ofSeq [ "a"; "b" ]) |> should equal false

// ─── Shared golden vector (cross-language parity lock) ─────────────────────

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel) — same
/// pattern as the observe golden-vector test.
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
let private strList (e: JsonElement) : string list =
    [ for x in e.EnumerateArray() -> x.GetString() ]

type private GsOp =
    | Add of string
    | Union of string list

let private parseOp (e: JsonElement) : GsOp =
    match e.GetProperty("op").GetString() with
    | "add" -> Add(e.GetProperty("arg").GetString())
    | "union" -> Union(strList (e.GetProperty("arg")))
    | other -> failwithf "unknown g-set op in fixture: %s" other

/// Read the fixture once; copy every primitive into F# values so the
/// JsonDocument is safe to dispose before the values are used.
let private loadVector () : string list * GsOp list * string list list * string list =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "g-set", "golden-vectors.json")
    use doc = JsonDocument.Parse(File.ReadAllText(path))
    let root = doc.RootElement
    let initial = strList (root.GetProperty("initialSet"))
    let ops = [ for op in root.GetProperty("ops").EnumerateArray() -> parseOp op ]
    let replay = [ for st in root.GetProperty("expectedReplayStates").EnumerateArray() -> strList st ]
    let final = strList (root.GetProperty("expectedFinalState"))
    initial, ops, replay, final

[<Fact>]
let ``F# replays the shared golden vector to expectedReplayStates + expectedFinalState`` () =
    let initial, ops, expectedReplay, expectedFinal = loadVector ()
    let mutable state = GSet.ofSeq initial
    let actual =
        [ for op in ops do
              state <-
                  match op with
                  | Add x -> GSet.add x state
                  | Union xs -> GSet.union state (GSet.ofSeq xs)
              yield GSet.toList state ]
    actual |> should equal expectedReplay
    GSet.toList state |> should equal expectedFinal
