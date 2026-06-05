module Zeta.Tests.YinYangTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// YinYang — the self-contained dynamical cell (Aaron's 2026-06-05 breakthrough): "what remains" (yin =
// static value tree) + "what acts" (yang = the Bonsai engine) as discriminated siblings in ONE
// DynamicValue. First slice, proven on the floor:
//   • math: the cell round-trips losslessly (yin preserved; yang survives Bonsai serialize→string→parse);
//   • 4-ser + Arrow: the cell-as-DynamicValue rides DynamicValue's proven serializers (the engine
//     survives the wire).
// This is the concrete "single DynamicValue with Rx inside" — the medium for polymorphic diplomacy.
// ═══════════════════════════════════════════════════════════════════

let private leaves = [ Bonsai.Param "a"; Bonsai.Param "b"; Bonsai.Param "x" ]

let rec private genExpr (depth: int) : Gen<Bonsai.Expr> =
    if depth <= 0 then
        Gen.elements leaves
    else
        Gen.oneof
            [ Gen.elements leaves
              gen { let! l = genExpr (depth - 1) in
                    let! r = genExpr (depth - 1) in
                    return Bonsai.Call("f", [ l; r ]) }
              gen { let! b = genExpr (depth - 1) in return Bonsai.Lambda([ "x" ], b) }
              gen { let! t = genExpr (depth - 1) in
                    let! th = genExpr (depth - 1) in
                    let! e = genExpr (depth - 1) in
                    return Bonsai.Cond(t, th, e) } ]

let rec private genRemains (depth: int) : Gen<DynamicValue> =
    let leaf =
        Gen.oneof
            [ Gen.choose (-50, 50) |> Gen.map (int64 >> DynamicValue.Int)
              Gen.elements [ "hi"; "yo"; "" ] |> Gen.map DynamicValue.String
              Gen.elements [ true; false ] |> Gen.map DynamicValue.Bool ]
    if depth <= 0 then
        leaf
    else
        Gen.oneof
            [ leaf
              gen {
                  let! n = Gen.choose (0, 3)
                  let! kvs =
                      Gen.listOfLength n (
                          gen {
                              let! k = Gen.elements [ "a"; "b"; "c" ]
                              let! v = genRemains (depth - 1)
                              return k, v
                          })
                  // dedupe keys (canonical object) so round-trip equality is well-defined
                  return DynamicValue.Object(kvs |> Map.ofList |> Map.toList)
              } ]

let private genCell : Gen<YinYang.Cell> =
    gen {
        let! r = genRemains 2
        let! a = genExpr 2
        return { YinYang.Remains = r; YinYang.Acts = a }
    }

type CellArb() =
    static member C() = Arb.fromGen genCell

[<Property(Arbitrary = [| typeof<CellArb> |])>]
let ``a yin-yang cell round-trips losslessly and rides the 4-ser + Arrow serializers`` (cell: YinYang.Cell) =
    match YinYang.toDynamicValue cell with
    | Some dv ->
        YinYang.ofDynamicValue dv = Some cell
        && SerializerLegs.fourSerAgree dv
        && SerializerLegs.arrowAgree dv
    | None -> false

[<Fact>]
let ``representative cells: identity (yin) + a Bonsai engine (yang) survive the round-trip`` () =
    let cells =
        [ { YinYang.Remains = DynamicValue.Object [ "name", DynamicValue.String "agent-1" ]
            YinYang.Acts = Bonsai.Param "self" }
          { YinYang.Remains = DynamicValue.Int 42L
            YinYang.Acts = Bonsai.Call("watermark-combine", [ Bonsai.Param "a"; Bonsai.Param "b" ]) }
          { YinYang.Remains = DynamicValue.String "hi"
            YinYang.Acts = Bonsai.Cond(Bonsai.Param "p", Bonsai.Param "a", Bonsai.Param "b") }
          { YinYang.Remains = DynamicValue.Bool true
            YinYang.Acts = Bonsai.Lambda([ "x" ], Bonsai.Param "x") } ]

    for cell in cells do
        match YinYang.toDynamicValue cell with
        | Some dv ->
            Assert.Equal<YinYang.Cell option>(Some cell, YinYang.ofDynamicValue dv)
            Assert.True(SerializerLegs.fourSerAgree dv, "cell should ride JSON+CBOR+YAML+XML")
            Assert.True(SerializerLegs.arrowAgree dv, "cell should ride Arrow")
        | None -> Assert.Fail "toDynamicValue returned None for a valid cell"

[<Fact>]
let ``a malformed DynamicValue is not mistaken for a cell`` () =
    Assert.Equal<YinYang.Cell option>(None, YinYang.ofDynamicValue (DynamicValue.Int 1L))
    Assert.Equal<YinYang.Cell option>(None, YinYang.ofDynamicValue (DynamicValue.Object [ "remains", DynamicValue.Int 1L ]))
    // acts present but not a parseable Bonsai string
    Assert.Equal<YinYang.Cell option>(
        None,
        YinYang.ofDynamicValue (DynamicValue.Object [ "remains", DynamicValue.Int 1L; "acts", DynamicValue.String "(((" ]))
