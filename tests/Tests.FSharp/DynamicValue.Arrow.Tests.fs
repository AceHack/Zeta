module Zeta.Tests.DynamicValueArrowTests

open System.Collections.Immutable
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// DynamicValue ↔ Apache Arrow IPC codec (Phase 1) — the SHREDDED
// NODE-TABLE encoding. Proves the general round-trip LAW
// (fromArrow ∘ toArrow = id for EVERY value, 8/8 shapes) plus the
// never-collapse distinctions and non-finite floats. Mirrors the CBOR
// round-trip test's structure (DynamicValue.Canonical.Tests.fs); the
// 8-shape generator is copied locally (it is `private` there).
// ═══════════════════════════════════════════════════════════════════

// ── FsCheck generators for an arbitrary DynamicValue tree (copied from
//    DynamicValue.Canonical.Tests.fs — CborDvArb / build cborLeaf) ──
let private genChar = Gen.elements [ 'a'; 'Z'; '0'; '"'; '\\'; '\n'; '\t'; '/'; ' '; 'é'; '☃' ]

let private genStr =
    gen {
        let! n = Gen.choose (0, 6)
        let! cs = Gen.listOfLength n genChar
        return System.String(List.toArray cs)
    }

let private genInt64 =
    Gen.oneof
        [ Gen.choose (-100000, 100000) |> Gen.map int64
          Gen.elements [ 0L; 1L; -1L; System.Int64.MaxValue; System.Int64.MinValue ] ]

let private genFiniteFloat =
    Gen.oneof
        [ Gen.choose (-1000000, 1000000) |> Gen.map (fun n -> float n / 1000.0)
          Gen.elements [ 0.0; 1.0; 1.5; -4.0; 65504.0; 1.0e300 ] ]

let private genBytes =
    gen {
        let! n = Gen.choose (0, 6)
        let! bs = Gen.listOfLength n (Gen.choose (0, 255) |> Gen.map byte)
        return ImmutableArray.CreateRange bs
    }

let private cborLeaf =
    Gen.oneof
        [ Gen.constant DynamicValue.Null
          Gen.map DynamicValue.Bool (Gen.elements [ true; false ])
          Gen.map DynamicValue.Int genInt64
          Gen.map DynamicValue.Float genFiniteFloat
          Gen.map DynamicValue.String genStr
          Gen.map DynamicValue.Bytes genBytes ]

let private build (leaf: Gen<DynamicValue>) : Gen<DynamicValue> =
    let rec aux (size: int) : Gen<DynamicValue> =
        if size <= 0 then
            leaf
        else
            Gen.oneof
                [ leaf
                  gen {
                      let! n = Gen.choose (0, 3)
                      let! items = Gen.listOfLength n (aux (size / 2))
                      return DynamicValue.Array items
                  }
                  gen {
                      let! n = Gen.choose (0, 3)
                      let! rawKeys = Gen.listOfLength n genStr
                      let keys = List.distinct rawKeys
                      let! vals = Gen.listOfLength keys.Length (aux (size / 2))
                      return DynamicValue.Object(List.zip keys vals)
                  } ]

    Gen.sized aux

type ArrowDvArb() =
    static member Dv() = Arb.fromGen (build cborLeaf)

// ── the general round-trip LAW (8/8 shapes) ──

[<Property(Arbitrary = [| typeof<ArrowDvArb> |])>]
let ``ARROW DynamicValue: round-trip — fromArrow ∘ toArrow = id (8/8 shapes)`` (v: DynamicValue) =
    DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk v) = Ok v

// ── never-collapse: Null / empty Array / empty Object / empty String / empty Bytes
//    all round-trip AND are pairwise distinguished ──

[<Fact>]
let ``ARROW DynamicValue: never-collapse — empties round-trip and stay distinct`` () =
    let empties =
        [ DynamicValue.Null
          DynamicValue.Array []
          DynamicValue.Object []
          DynamicValue.String ""
          DynamicValue.Bytes ImmutableArray<byte>.Empty ]

    // each round-trips to itself
    for v in empties do
        Assert.Equal(Ok v, DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk v))

    // and they are all pairwise distinct after round-trip (no collapse)
    let decoded = empties |> List.map (DynamicValueArrow.toArrowOk >> DynamicValueArrow.fromArrow)
    let distinct = decoded |> List.distinct
    Assert.Equal(empties.Length, distinct.Length)

// ── non-finite floats: NaN / ±inf / -0.0 round-trip (Arrow Double preserves bits) ──

[<Fact>]
let ``ARROW DynamicValue: non-finite floats (NaN, ±inf, -0.0) round-trip`` () =
    for f in [ nan; infinity; -infinity; -0.0; 0.0 ] do
        let v = DynamicValue.Float f
        Assert.Equal(Ok v, DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk v))

// ── fixed nested cases ──

[<Fact>]
let ``ARROW DynamicValue: nested object/array/object round-trips faithfully`` () =
    let v =
        DynamicValue.Object
            [ "a", DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.Object [ "x", DynamicValue.Bool true ] ]
              "b", DynamicValue.Null
              "c", DynamicValue.Array []
              "d", DynamicValue.Object [] ]

    Assert.Equal(Ok v, DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk v))

[<Fact>]
let ``ARROW DynamicValue: object key order and array sibling order are preserved`` () =
    let v =
        DynamicValue.Array
            [ DynamicValue.Object [ "z", DynamicValue.Int 1L; "a", DynamicValue.Int 2L; "m", DynamicValue.Int 3L ]
              DynamicValue.String "first"
              DynamicValue.String "second" ]

    match DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk v) with
    | Ok decoded -> Assert.Equal(v, decoded)
    | Error e -> failwithf "round-trip failed: %A" e

[<Fact>]
let ``ARROW DynamicValue: deeply nested array of bytes/strings round-trips`` () =
    let v =
        DynamicValue.Array
            [ DynamicValue.Bytes(ImmutableArray.CreateRange [ 0uy; 255uy; 7uy ])
              DynamicValue.Array
                  [ DynamicValue.String "☃"
                    DynamicValue.Float 1.5
                    DynamicValue.Object [ "deep", DynamicValue.Array [ DynamicValue.Null ] ] ] ]

    Assert.Equal(Ok v, DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk v))
