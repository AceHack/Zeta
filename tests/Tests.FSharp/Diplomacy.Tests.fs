module Zeta.Tests.DiplomacyTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module D = Zeta.Core.Diplomacy

// ═══════════════════════════════════════════════════════════════════
// Diplomacy — the polymorphic-diplomacy handshake over yin-yang cells (Aaron, 2026-06-05). Agents
// describe / interrogate / negotiate each other's SHAPE (yin identity skeleton + yang capability set).
// The load-bearing proof is the NCI SAFETY property: the public profile reveals shape only, never hidden
// values — so the handshake cannot be used to coerce hidden state out of another agent.
// ═══════════════════════════════════════════════════════════════════

let rec private bumpLeaves (dv: DynamicValue) : DynamicValue =
    match dv with
    | DynamicValue.Int i -> DynamicValue.Int(i + 1L)
    | DynamicValue.Bool b -> DynamicValue.Bool(not b)
    | DynamicValue.String s -> DynamicValue.String(s + "!")
    | DynamicValue.Float f -> DynamicValue.Float(f + 1.0)
    | DynamicValue.Null -> DynamicValue.Null
    | DynamicValue.Bytes b -> DynamicValue.Bytes b
    | DynamicValue.Array xs -> DynamicValue.Array(List.map bumpLeaves xs)
    | DynamicValue.Object kvs -> DynamicValue.Object(List.map (fun (k, v) -> k, bumpLeaves v) kvs)

let rec private genDv (depth: int) : Gen<DynamicValue> =
    let leaf =
        Gen.oneof
            [ Gen.choose (-50, 50) |> Gen.map (int64 >> DynamicValue.Int)
              Gen.elements [ "a"; "b"; "secret" ] |> Gen.map DynamicValue.String
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
                              let! k = Gen.elements [ "x"; "y"; "z" ]
                              let! v = genDv (depth - 1)
                              return k, v
                          })
                  return DynamicValue.Object(kvs |> Map.ofList |> Map.toList)
              } ]

type DvArb() =
    static member D() = Arb.fromGen (genDv 3)

// ── the NCI safety property (load-bearing) ──

[<Property(Arbitrary = [| typeof<DvArb> |])>]
let ``describe reveals shape but NOT hidden values (NCI safety / non-coercion)`` (dv: DynamicValue) =
    let acts = Bonsai.Call("op", [ Bonsai.Param "a" ])
    let mine = { YinYang.Remains = dv; YinYang.Acts = acts }
    let sameShapeDifferentSecrets = { YinYang.Remains = bumpLeaves dv; YinYang.Acts = acts }
    // identical public profile despite different hidden values => the handshake can't extract secrets
    D.shapeOf dv = D.shapeOf (bumpLeaves dv) && D.describe mine = D.describe sameShapeDifferentSecrets

// ── describe / interrogate / negotiate / interoperate ──

[<Fact>]
let ``shapeOf erases leaf values, keeps keys + types + structure`` () =
    let dv = DynamicValue.Object [ "name", DynamicValue.String "secret"; "n", DynamicValue.Int 5L ]
    Assert.Equal<D.Shape>(D.SObject [ "name", D.SString; "n", D.SInt ], D.shapeOf dv)

[<Fact>]
let ``capabilitiesOf collects the named operations (the yang surface)`` () =
    let acts = Bonsai.Call("greet", [ Bonsai.Call("ping", [ Bonsai.Param "a" ]); Bonsai.Param "b" ])
    Assert.Equal<Set<string>>(Set.ofList [ "greet"; "ping" ], D.capabilitiesOf acts)

[<Fact>]
let ``interrogate answers capability presence without revealing internals`` () =
    let cell = { YinYang.Remains = DynamicValue.Null; YinYang.Acts = Bonsai.Call("ping", [ Bonsai.Param "a" ]) }
    Assert.True(D.interrogate cell "ping")
    Assert.False(D.interrogate cell "pong")

[<Fact>]
let ``negotiate is the shared capabilities; interoperate needs shared shape + shared capability`` () =
    let idShape = DynamicValue.Object [ "id", DynamicValue.String "" ]
    let a = { YinYang.Remains = DynamicValue.Object [ "id", DynamicValue.String "a1" ]; YinYang.Acts = Bonsai.Call("sync", [ Bonsai.Call("ping", []) ]) }
    let b = { YinYang.Remains = DynamicValue.Object [ "id", DynamicValue.String "b2" ]; YinYang.Acts = Bonsai.Call("sync", [ Bonsai.Call("pong", []) ]) }
    let c = { YinYang.Remains = DynamicValue.Int 0L; YinYang.Acts = Bonsai.Call("sync", []) }
    ignore idShape
    Assert.Equal<Set<string>>(Set.singleton "sync", D.negotiate a b)  // shared "sync"
    Assert.True(D.canInteroperate a b)   // same id-shape {id: string} + shared "sync"
    Assert.False(D.canInteroperate a c)  // c's identity shape differs (Int vs Object)
