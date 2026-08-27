module Zeta.Tests.DuExpandTests

open global.Xunit
open Zeta.Core

// DU → DynamicValue (collapsed) and SoftValue (Bayesian interpretation).
// Local action is a +1; global effect is SoftValue.observe (commutes).
// Workitem 081M10AAVAT087G0R0027M0GV5. DST: no clock, no IO.

let private tagWeight (sv: SoftValue.SoftValue) (tag: string) : float =
    SoftValue.weightOf (DuExpand.collapsed tag []) sv

[<Fact>]
let ``collapsed case carries k and extra fields; tagOf reads it`` () =
    let dv =
        DuExpand.collapsed "do_item" [ "item", DynamicValue.String "081TEST" ]
    Assert.Equal(Some "do_item", DuExpand.tagOf dv)
    match dv with
    | DynamicValue.Object kvs ->
        let name, value = List.head kvs
        Assert.Equal("k", name)
        Assert.Equal<DynamicValue>(DynamicValue.String "do_item", value)
    | _ -> failwith "expected Object"

[<Fact>]
let ``ObserveBridge-shaped NextAction object is a DU expand (same k field)`` () =
    let explore =
        DynamicValue.Object [ "k", DynamicValue.String "explore"; "reason", DynamicValue.String "forward" ]
    Assert.Equal(Some "explore", DuExpand.tagOf explore)

[<Fact>]
let ``interpret is a SoftValue over DU tags (our Bayesian reading)`` () =
    match DuExpand.interpret [ "explore", 1.0; "do_item", 1.0; "play", 1.0 ] with
    | None -> failwith "expected a distribution"
    | Some sv ->
        Assert.True(abs (tagWeight sv "explore" - (1.0 / 3.0)) < 1e-9)
        Assert.True(SoftValue.resolve 0.9 sv |> Option.isNone)

[<Fact>]
let ``local action updates the global SoftValue toward that case`` () =
    let prior = DuExpand.interpret [ "explore", 1.0; "do_item", 1.0 ] |> Option.get
    let action = DuExpand.localAction "do_item" []
    match DuExpand.globalEffect action prior with
    | None -> failwith "expected posterior"
    | Some posterior ->
        Assert.True(tagWeight posterior "do_item" > tagWeight prior "do_item")
        Assert.True(tagWeight posterior "do_item" > tagWeight posterior "explore")

[<Fact>]
let ``independent local actions commute globally`` () =
    let prior =
        DuExpand.interpret [ "explore", 1.0; "do_item", 1.0; "play", 1.0 ]
        |> Option.get
    let a = DuExpand.localAction "do_item" []
    let b = DuExpand.localAction "explore" []
    let ab =
        DuExpand.globalEffect a prior
        |> Option.bind (DuExpand.globalEffect b)
        |> Option.get
    let ba =
        DuExpand.globalEffect b prior
        |> Option.bind (DuExpand.globalEffect a)
        |> Option.get
    Assert.True(abs (tagWeight ab "do_item" - tagWeight ba "do_item") < 1e-9)
    Assert.True(abs (tagWeight ab "explore" - tagWeight ba "explore") < 1e-9)
    Assert.True(abs (tagWeight ab "play" - tagWeight ba "play") < 1e-9)

[<Fact>]
let ``snap is the only collapse: certain local action resolves to DynamicValue`` () =
    let sv = SoftValue.certain (DuExpand.localAction "play" [])
    match SoftValue.snap (SoftValue.threshold 0.99) sv with
    | Some dv -> Assert.Equal(Some "play", DuExpand.tagOf dv)
    | None -> failwith "certain play should snap"
