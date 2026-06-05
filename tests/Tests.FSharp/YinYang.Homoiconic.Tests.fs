module Zeta.Tests.YinYangHomoiconicTests

open global.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// YinYang homoiconic + recursive (Aaron, 2026-06-05): "the action language can contain the staying
// language and vice versa — they are homoiconic — and recursive." Proven both directions on the floor:
//   • yin ⊃ yang, recursively: a cell's Remains is itself a serialized cell (which has its own Acts),
//     nested, round-tripping and navigable down the chain.
//   • yang ⊃ yin: a cell's Acts (a Bonsai engine) carries a DynamicValue data literal that decodes back.
// ═══════════════════════════════════════════════════════════════════

let private dv (c: YinYang.Cell) : DynamicValue =
    match YinYang.toDynamicValue c with
    | Some d -> d
    | None -> failwith "toDynamicValue returned None for a valid cell"

[<Fact>]
let ``yin contains yang recursively: a cell nested in Remains round-trips and is navigable`` () =
    let inner = { YinYang.Remains = DynamicValue.Int 1L; YinYang.Acts = Bonsai.Param "a" }
    let middle = { YinYang.Remains = dv inner; YinYang.Acts = Bonsai.Call("wrap", [ Bonsai.Param "x" ]) }
    let outer = { YinYang.Remains = dv middle; YinYang.Acts = Bonsai.Lambda([ "y" ], Bonsai.Param "y") }

    let outerDv = dv outer
    // the whole nested structure round-trips and rides the proven serializers
    Assert.Equal<YinYang.Cell option>(Some outer, YinYang.ofDynamicValue outerDv)
    Assert.True(SerializerLegs.fourSerAgree outerDv, "nested cell should ride JSON+CBOR+YAML+XML")
    Assert.True(SerializerLegs.arrowAgree outerDv, "nested cell should ride Arrow")
    // …and is navigable down the recursion: outer.Remains IS middle; middle.Remains IS inner
    Assert.Equal<YinYang.Cell option>(Some middle, YinYang.ofDynamicValue outer.Remains)
    Assert.Equal<YinYang.Cell option>(Some inner, YinYang.ofDynamicValue middle.Remains)

[<Fact>]
let ``yang contains yin: the action carries a DynamicValue data literal that decodes back`` () =
    let carried = DynamicValue.Object [ "k", DynamicValue.Int 7L; "tag", DynamicValue.String "v" ]
    let json =
        match DynamicValue.toCanonicalJson carried with
        | Ok s -> s
        | Error e -> failwith (sprintf "%A" e)

    let cell = { YinYang.Remains = DynamicValue.String "outer"; YinYang.Acts = Bonsai.Const(Bonsai.CStr json) }
    let cellDv = dv cell

    match YinYang.ofDynamicValue cellDv with
    | Some c2 ->
        Assert.Equal<YinYang.Cell>(cell, c2)
        match c2.Acts with
        | Bonsai.Const (Bonsai.CStr s) ->
            match DynamicValue.fromCanonicalJson s with
            | Ok decoded -> Assert.Equal<DynamicValue>(carried, decoded)
            | Error e -> Assert.Fail(sprintf "carried literal did not decode: %A" e)
        | _ -> Assert.Fail "expected the action to carry a Const CStr literal"
    | None -> Assert.Fail "ofDynamicValue returned None"
