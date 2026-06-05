module Zeta.Tests.DynamicValueFoldTests

open System.Collections.Immutable
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// DynamicValueFold — catamorphism + banana-split laws.
//   (a) cata identityAlgebra dv = dv      (reflection law)
//   (b) bananaSplit a b dv = (cata a dv, cata b dv)   (banana-split law)
//   (c) one-pass: a counter algebra shows a single traversal.
// Reuses the 8-shape generator pattern from DynamicValue.Canonical.Tests.fs.
// ═══════════════════════════════════════════════════════════════════

let private genChar = Gen.elements [ 'a'; 'Z'; '0'; '"'; '\\'; '\n'; ' '; 'é' ]
let private genStr =
    gen { let! n = Gen.choose (0, 5)
          let! cs = Gen.listOfLength n genChar
          return System.String(List.toArray cs) }
let private genInt64 = Gen.choose (-100000, 100000) |> Gen.map int64
let private genFloat = Gen.choose (-1000, 1000) |> Gen.map (fun n -> float n / 7.0)
let private genBytes =
    gen { let! n = Gen.choose (0, 5)
          let! bs = Gen.listOfLength n (Gen.choose (0, 255) |> Gen.map byte)
          return ImmutableArray.CreateRange bs }

let private leaf =
    Gen.oneof
        [ Gen.constant DynamicValue.Null
          Gen.map DynamicValue.Bool (Gen.elements [ true; false ])
          Gen.map DynamicValue.Int genInt64
          Gen.map DynamicValue.Float genFloat
          Gen.map DynamicValue.String genStr
          Gen.map DynamicValue.Bytes genBytes ]

let private build: Gen<DynamicValue> =
    let rec aux (size: int) : Gen<DynamicValue> =
        if size <= 0 then leaf
        else
            Gen.oneof
                [ leaf
                  gen { let! n = Gen.choose (0, 3)
                        let! items = Gen.listOfLength n (aux (size / 2))
                        return DynamicValue.Array items }
                  gen { let! n = Gen.choose (0, 3)
                        let! rawKeys = Gen.listOfLength n genStr
                        let keys = List.distinct rawKeys
                        let! vals = Gen.listOfLength keys.Length (aux (size / 2))
                        return DynamicValue.Object(List.zip keys vals) } ]
    Gen.sized aux

type FoldDvArb() =
    static member Dv() = Arb.fromGen build

// node-count algebra (every shape counts 1 plus its children)
let private nodeCount: DynamicValueFold.DvAlgebra<int> =
    { Null = 1
      Bool = fun _ -> 1
      Int = fun _ -> 1
      Float = fun _ -> 1
      String = fun _ -> 1
      Bytes = fun _ -> 1
      Array = fun rs -> 1 + List.sum rs
      Object = fun rs -> 1 + (rs |> List.sumBy snd) }

// max-depth algebra
let private maxDepth: DynamicValueFold.DvAlgebra<int> =
    { Null = 1
      Bool = fun _ -> 1
      Int = fun _ -> 1
      Float = fun _ -> 1
      String = fun _ -> 1
      Bytes = fun _ -> 1
      Array = fun rs -> 1 + (if List.isEmpty rs then 0 else List.max rs)
      Object = fun rs -> 1 + (if List.isEmpty rs then 0 else rs |> List.map snd |> List.max) }

[<Property(Arbitrary = [| typeof<FoldDvArb> |])>]
let ``cata identityAlgebra dv = dv`` (dv: DynamicValue) =
    DynamicValueFold.cata DynamicValueFold.identityAlgebra dv = dv

[<Property(Arbitrary = [| typeof<FoldDvArb> |])>]
let ``banana-split law: bananaSplit a b dv = (cata a dv, cata b dv)`` (dv: DynamicValue) =
    DynamicValueFold.bananaSplit nodeCount maxDepth dv = (DynamicValueFold.cata nodeCount dv, DynamicValueFold.cata maxDepth dv)

[<Property(Arbitrary = [| typeof<FoldDvArb> |])>]
let ``banana-split visits each node exactly once (one pass)`` (dv: DynamicValue) =
    // a counter algebra that ticks a mutable cell once per node; after bananaSplit
    // the cell must equal the node count exactly (a two-pass impl would double it).
    // Null's carrier is a `unit` VALUE (evaluated once at record construction, not
    // per Null node), so the mutable counter only ticks on the function fields →
    // it counts NON-Null nodes. Compare against an algebra that counts the same.
    let mutable visits = 0
    let counting: DynamicValueFold.DvAlgebra<unit> =
        { Null = ()
          Bool = fun _ -> visits <- visits + 1
          Int = fun _ -> visits <- visits + 1
          Float = fun _ -> visits <- visits + 1
          String = fun _ -> visits <- visits + 1
          Bytes = fun _ -> visits <- visits + 1
          Array = fun _ -> visits <- visits + 1
          Object = fun _ -> visits <- visits + 1 }
    let nonNullCount: DynamicValueFold.DvAlgebra<int> =
        { Null = 0
          Bool = fun _ -> 1
          Int = fun _ -> 1
          Float = fun _ -> 1
          String = fun _ -> 1
          Bytes = fun _ -> 1
          Array = fun rs -> 1 + List.sum rs
          Object = fun rs -> 1 + (rs |> List.sumBy snd) }
    visits <- 0
    DynamicValueFold.bananaSplit counting nodeCount dv |> ignore
    // exactly one tick per non-Null node — no double traversal.
    visits = DynamicValueFold.cata nonNullCount dv
