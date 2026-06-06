module Zeta.Tests.BonsaiSoftTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.Bonsai


// ═══════════════════════════════════════════════════════════════════
// BonsaiSoft — the soft evaluator (yang made executable). Soft = SoftValue
// distribution (persisted/wonder-holding); snap = SoftValue.resolve threshold
// (the soft→sharp collapse for execution). Maintainer's soft-vs-sharp resolution.
// ═══════════════════════════════════════════════════════════════════

let private okSoft = function
    | Ok (sv: SoftValue.SoftValue) -> sv
    | Error e -> failwithf "expected Ok, got Error %s" e

let private dist (sv: SoftValue.SoftValue) =
    SoftValue.candidates sv |> List.sortBy (fun (d, _) -> sprintf "%A" d)

// Assert via F#'s own `=` (honours DynamicValue's structural equality) — FsUnit's
// `should equal` mis-compares Result-wrapped custom-equality types.
let private snapShould (expected: DynamicValue option) (r: Result<DynamicValue option, string>) =
    match r with
    | Ok actual when actual = expected -> ()
    | other -> failwithf "expected Ok %A, got %A" expected other


[<Fact>]
let ``Const + Binary arithmetic evaluates certain`` () =
    let expr = Binary(Add, Const(CInt 2L), Const(CInt 3L))
    let sv = BonsaiSoft.evalSoft Map.empty expr |> okSoft
    SoftValue.confidence sv |> should equal 1.0
    SoftValue.resolve 1.0 sv |> should equal (Some(DynamicValue.Int 5L))


[<Fact>]
let ``nested arithmetic: (2+3)*4 = 20`` () =
    let expr = Binary(Mul, Binary(Add, Const(CInt 2L), Const(CInt 3L)), Const(CInt 4L))
    BonsaiSoft.snap 1.0 Map.empty expr |> snapShould (Some(DynamicValue.Int 20L))


[<Fact>]
let ``Param resolves from the environment`` () =
    let env = Map.ofList [ "x", SoftValue.certain (DynamicValue.Int 7L) ]
    BonsaiSoft.snap 1.0 env (Binary(Add, Param "x", Const(CInt 1L))) |> snapShould (Some(DynamicValue.Int 8L))


[<Fact>]
let ``unbound param is an honest Error`` () =
    match BonsaiSoft.evalSoft Map.empty (Param "nope") with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for unbound param"


[<Fact>]
let ``comparison + boolean ops`` () =
    BonsaiSoft.snap 1.0 Map.empty (Binary(Lt, Const(CInt 1L), Const(CInt 2L))) |> snapShould (Some(DynamicValue.Bool true))
    BonsaiSoft.snap 1.0 Map.empty (Binary(And, Const(CBool true), Const(CBool false))) |> snapShould (Some(DynamicValue.Bool false))
    BonsaiSoft.snap 1.0 Map.empty (Binary(Eq, Const(CStr "a"), Const(CStr "a"))) |> snapShould (Some(DynamicValue.Bool true))


[<Fact>]
let ``Cond with a certain test takes the chosen branch sharply`` () =
    let expr = Cond(Const(CBool true), Const(CInt 10L), Const(CInt 20L))
    BonsaiSoft.snap 1.0 Map.empty expr |> snapShould (Some(DynamicValue.Int 10L))


[<Fact>]
let ``Cond is evaluated SOFTLY — both branches blended by the test's truth-confidence`` () =
    // test ~ Bool{true:0.7, false:0.3}; then=10, else=20 -> {10:0.7, 20:0.3}
    let test = SoftValue.ofWeighted [ DynamicValue.Bool true, 0.7; DynamicValue.Bool false, 0.3 ] |> Option.get
    let env = Map.ofList [ "t", test ]
    let expr = Cond(Param "t", Const(CInt 10L), Const(CInt 20L))
    let sv = BonsaiSoft.evalSoft env expr |> okSoft
    dist sv
    |> should equal [ DynamicValue.Int 10L, 0.7; DynamicValue.Int 20L, 0.3 ]


[<Fact>]
let ``snap holds (None) below threshold, snaps (Some) at/above it`` () =
    let test = SoftValue.ofWeighted [ DynamicValue.Bool true, 0.7; DynamicValue.Bool false, 0.3 ] |> Option.get
    let env = Map.ofList [ "t", test ]
    let expr = Cond(Param "t", Const(CInt 10L), Const(CInt 20L))
    // confidence is 0.7 -> held above it, snapped to the mode at/below it.
    BonsaiSoft.snap 0.8 env expr |> snapShould None
    BonsaiSoft.snap 0.7 env expr |> snapShould (Some(DynamicValue.Int 10L))


[<Fact>]
let ``Lambda and Call are explicitly unsupported in v1 (no silent wrong answer)`` () =
    match BonsaiSoft.evalSoft Map.empty (Lambda([ "x" ], Param "x")) with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for Lambda"
    match BonsaiSoft.evalSoft Map.empty (Call("f", [ Const(CInt 1L) ])) with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for Call"


[<Fact>]
let ``ill-typed binary is an honest Error, never a silent coercion`` () =
    match BonsaiSoft.evalSoft Map.empty (Binary(Add, Const(CInt 1L), Const(CStr "x"))) with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for ill-typed Add"
