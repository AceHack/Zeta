module Zeta.Tests.BonsaiCostTests

open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.Bonsai


// ═══════════════════════════════════════════════════════════════════
// BonsaiCost — the static cost model for `BonsaiSoft.evalSoft`.
//
// The falsifier is the whole point. `Width` claims to be a SOUND UPPER BOUND on
// the candidate count of `evalSoft`'s result, so every test below either
//   (a) SOUNDNESS — runs `evalSoft` and checks actual <= predicted, or
//   (b) TIGHTNESS — pins predicted = actual EXACTLY on a case where the bound is
//       achieved.
// Both halves are required. Soundness alone is satisfied by returning
// Int64.MaxValue, which is the vacuity class: a bound that cannot be wrong is
// not a prediction. Tightness alone would be false (merging makes the bound
// loose — pinned explicitly in `the bound is SOUND but not EXACT ...`).
//
// `ToyPairs` carries no falsifier by construction (`applyOp` is private and
// uninstrumented) and says so in its name; the tests below pin only its
// recurrence, never a claim that it matches observed work.
// ═══════════════════════════════════════════════════════════════════

let private okSoft =
    function
    | Ok(sv: SoftValue.SoftValue) -> sv
    | Error e -> failwithf "expected evalSoft Ok, got Error %s" e

let private actualWidth (env: BonsaiSoft.Env) (e: Expr) =
    BonsaiSoft.evalSoft env e |> okSoft |> SoftValue.candidates |> List.length

let private okCost =
    function
    | Ok(c: BonsaiCost.Cost) -> c
    | Error f -> failwithf "expected predict Ok, got Error %s" (BonsaiCost.feedbackText f)

let private soft (values: int64 list) : SoftValue.SoftValue =
    values
    |> List.map (fun v -> DynamicValue.Int v, 1.0)
    |> SoftValue.ofWeighted
    |> Option.defaultWith (fun () -> failwith "test env: degenerate distribution")


// ── (b) TIGHTNESS: Binary multiplies, and the bound is ACHIEVED ──
//
// x = {2,3,5}, y = {7,11,13}: all nine products are distinct, so nothing merges
// and predicted must equal actual. Mutating the `Binary` recurrence from `wl * wr`
// to `wl + wr` predicts 6 against an actual of 9 — the bound stops being a bound.

[<Fact>]
let ``Binary width bound is exact when no products collide`` () =
    let env: BonsaiSoft.Env = Map.ofList [ "x", soft [ 2L; 3L; 5L ]; "y", soft [ 7L; 11L; 13L ] ]
    let widths: BonsaiCost.Widths = Map.ofList [ "x", 3L; "y", 3L ]
    let expr = Binary(Mul, Param "x", Param "y")

    let predicted = BonsaiCost.predict widths expr |> okCost
    predicted.Width |> should equal 9L
    predicted.ToyPairs |> should equal 9L
    actualWidth env expr |> should equal 9


// ── (b) TIGHTNESS: Cond ADDS (soft Cond blends BOTH branches) ──
//
// Mutating `wThen + wElse` to `max wThen wElse` predicts 3 against an actual of 5.

[<Fact>]
let ``Cond width bound is exact when both branches contribute distinct candidates`` () =
    let env: BonsaiSoft.Env =
        Map.ofList
            [ "a", soft [ 1L; 10L ]           // 1 < 5 = true, 10 < 5 = false  ⇒ both branches live
              "p", soft [ 100L; 200L ]
              "q", soft [ 300L; 400L; 500L ] ]
    let widths: BonsaiCost.Widths = Map.ofList [ "a", 2L; "p", 2L; "q", 3L ]
    let expr = Cond(Binary(Lt, Param "a", Const(CInt 5L)), Param "p", Param "q")

    let predicted = BonsaiCost.predict widths expr |> okCost
    predicted.Width |> should equal 5L
    predicted.ToyPairs |> should equal 2L    // only the Lt test enumerates pairs: 2 * 1
    actualWidth env expr |> should equal 5


// ── (b) TIGHTNESS: the predicate cap is sound AND achieved ──
//
// `Lt` returns Bool on every success path, so 3 x 3 candidates collapse to at most
// 2. Deleting `opWidthCap` predicts 9 against an actual of 2 — still sound, so ONLY
// the tightness assertion catches it. That is why tightness is tested at all.

[<Fact>]
let ``predicate ops are capped at two candidates however wide the inputs`` () =
    let env: BonsaiSoft.Env = Map.ofList [ "x", soft [ 1L; 2L; 3L ]; "y", soft [ 2L; 3L; 4L ] ]
    let widths: BonsaiCost.Widths = Map.ofList [ "x", 3L; "y", 3L ]
    let expr = Binary(Lt, Param "x", Param "y")

    let predicted = BonsaiCost.predict widths expr |> okCost
    predicted.Width |> should equal 2L
    predicted.ToyPairs |> should equal 9L    // SPACE is capped; the WORK is not
    actualWidth env expr |> should equal 2


// ── (a) SOUNDNESS, stated honestly: the bound is an upper bound, not an equality ──

[<Fact>]
let ``the bound is SOUND but not EXACT when candidates merge`` () =
    let env: BonsaiSoft.Env = Map.ofList [ "x", soft [ 2L; 3L; 5L ] ]
    let widths: BonsaiCost.Widths = Map.ofList [ "x", 3L ]
    let expr = Binary(Mul, Param "x", Const(CInt 0L))   // every product is 0 ⇒ all three merge

    let predicted = BonsaiCost.predict widths expr |> okCost
    predicted.Width |> should equal 3L
    actualWidth env expr |> should equal 1
    // the register: over-prediction is permitted, under-prediction is a defect
    int64 (actualWidth env expr) <= predicted.Width |> should equal true


// ── The estimator's domain agrees with the evaluator's ──

[<Fact>]
let ``predict declines exactly where evalSoft declines structurally`` () =
    let widths: BonsaiCost.Widths = Map.ofList [ "x", 2L ]

    match BonsaiCost.predict widths (Param "missing") with
    | Error(BonsaiCost.UnboundParam "missing") -> ()
    | other -> failwithf "expected UnboundParam, got %A" other
    BonsaiSoft.evalSoft Map.empty (Param "missing") |> Result.isError |> should equal true

    match BonsaiCost.predict widths (Lambda([ "p" ], Const(CInt 1L))) with
    | Error(BonsaiCost.UnsupportedNode "lambda") -> ()
    | other -> failwithf "expected UnsupportedNode lambda, got %A" other
    BonsaiSoft.evalSoft Map.empty (Lambda([ "p" ], Const(CInt 1L))) |> Result.isError |> should equal true

    match BonsaiCost.predict widths (Call("f", [])) with
    | Error(BonsaiCost.UnsupportedNode "call") -> ()
    | other -> failwithf "expected UnsupportedNode call, got %A" other
    BonsaiSoft.evalSoft Map.empty (Call("f", [])) |> Result.isError |> should equal true

    match BonsaiCost.predict (Map.ofList [ "x", 0L ]) (Param "x") with
    | Error(BonsaiCost.NonPositiveParamWidth("x", 0L)) -> ()
    | other -> failwithf "expected NonPositiveParamWidth, got %A" other


// ── The DECLINE is the prune: an unboundable tree is refused, not capped ──
//
// A left spine of `Mul` over a 2-candidate param doubles the width per level, so it
// leaves int64 in ~63 levels. The estimator must decline (and must not itself become
// the blow-up it exists to predict — this returns in microseconds).

[<Fact>]
let ``a width that leaves int64 DECLINES rather than capping`` () =
    let widths: BonsaiCost.Widths = Map.ofList [ "x", 2L ]
    let expr = List.fold (fun acc _ -> Binary(Mul, acc, Param "x")) (Param "x") [ 1..70 ]

    match BonsaiCost.predict widths expr with
    | Error(BonsaiCost.WidthOverflow _) -> ()
    | Error other -> failwithf "expected WidthOverflow, got %A" other
    | Ok cost -> failwithf "expected a decline, got a bound of %d" cost.Width


// ── Pricing is the CALLER's; the module owns only the shape ──

[<Fact>]
let ``toBranchCost prices the shape with caller-supplied unit prices`` () =
    let cost: BonsaiCost.Cost = { Width = 9L; ToyPairs = 9L }

    match BonsaiCost.toBranchCost 16L 4L cost with
    | Ok branch ->
        branch.SpaceBytes |> should equal 144L
        branch.TimeTicks |> should equal 9
        branch.BytesPerTick |> should equal 4L
        branch.UncertaintyResolutionBits |> should equal 0
    | Error f -> failwithf "expected Ok, got %s" (BonsaiCost.feedbackText f)

    match BonsaiCost.toBranchCost -1L 4L cost with
    | Error(BonsaiCost.NegativeUnitPrice("bytesPerCandidate", -1L)) -> ()
    | other -> failwithf "expected NegativeUnitPrice, got %A" other


// ── The WIRING: injected at the evaluation layer, and the budget PRUNES ──
//
// The branch state is the `Expr` itself, so `Vision.predictBranches` hands back the
// evaluations it declined to fund as `Deferred`. Shrinking the tank must move a
// branch from Boarded to Deferred — that movement IS the prune, and a budget that
// boards everything regardless of size would fail here.

[<Fact>]
let ``the Vision forecast port boards the affordable prefix and DEFERS the rest`` () =
    let widths: BonsaiCost.Widths = Map.ofList [ "x", 3L; "y", 3L ]
    let cheap: BonsaiCost.Request =
        { Label = "cheap"; Expr = Binary(Lt, Param "x", Param "y"); Widths = widths }      // width 2
    let dear: BonsaiCost.Request =
        { Label = "dear"; Expr = Binary(Mul, Param "x", Param "y"); Widths = widths }      // width 9

    let forecaster = BonsaiCost.forecaster 16L 0L
    let forecast =
        match forecaster.Forecast [ cheap; dear ] with
        | Ok f -> f
        | Error e -> failwithf "expected a forecast, got %s" (BonsaiCost.feedbackText e)

    forecast.Branches |> List.map (fun b -> b.Label) |> should equal [ "cheap"; "dear" ]
    // branch state is the expression itself — what is deferred is a real evaluation
    forecast.Branches |> List.map (fun b -> b.State) |> should equal [ cheap.Expr; dear.Expr ]

    // 32 bytes funds "cheap" (2 * 16) and cannot fund "dear" (9 * 16 = 144)
    let tank = SoftThrottle.tank 32.0 0.0
    match Vision.predictForecast forecast tank with
    | Ok report ->
        report.Boarded |> List.map (fun b -> b.Label) |> should equal [ "cheap" ]
        report.Deferred |> List.map (fun b -> b.Label) |> should equal [ "dear" ]
        report.Deferred |> List.map (fun b -> b.State) |> should equal [ dear.Expr ]
        report.Starved |> should equal true
    | Error f -> failwithf "expected a prediction report, got %A" f

    // a budget large enough boards both — so the deferral above was the BUDGET, not a bug
    match Vision.predictForecast forecast (SoftThrottle.tank 1000.0 0.0) with
    | Ok report ->
        report.Boarded |> List.map (fun b -> b.Label) |> should equal [ "cheap"; "dear" ]
        report.Deferred |> should be Empty
    | Error f -> failwithf "expected a prediction report, got %A" f


[<Fact>]
let ``one unpredictable request declines the whole forecast`` () =
    let forecaster = BonsaiCost.forecaster 16L 0L
    let good: BonsaiCost.Request =
        { Label = "good"; Expr = Const(CInt 1L); Widths = Map.empty }
    let bad: BonsaiCost.Request =
        { Label = "bad"; Expr = Param "unknown"; Widths = Map.empty }

    match forecaster.Forecast [ good; bad ] with
    | Error(BonsaiCost.UnboundParam "unknown") -> ()
    | other -> failwithf "expected the batch to decline, got %A" other


// ═══════════════════════════════════════════════════════════════════
// (a) SOUNDNESS as a property: over generated int-valued expressions, the actual
// candidate count NEVER exceeds the predicted bound.
//
// The generator is deliberately restricted to the well-typed int-valued fragment
// (Add/Sub/Mul, and Cond whose test is a comparison) so that `evalSoft` genuinely
// SUCCEEDS — a generator that mostly produced ill-typed trees would pass while
// exercising nothing, which is the arity-2 vacuity failure in miniature. The
// property asserts `evalSoft` returned Ok rather than skipping, so a generator that
// drifted into ill-typed territory would fail the test rather than silently pass it.
// ═══════════════════════════════════════════════════════════════════

let private propEnv: BonsaiSoft.Env =
    Map.ofList [ "a", soft [ 0L; 1L; 2L ]; "b", soft [ 1L; 2L ]; "c", soft [ 3L ] ]

let private propWidths: BonsaiCost.Widths = Map.ofList [ "a", 3L; "b", 2L; "c", 1L ]

let private genLeaf =
    Gen.oneof
        [ Gen.choose (0, 4) |> Gen.map (fun i -> Const(CInt(int64 i)))
          Gen.elements [ "a"; "b"; "c" ] |> Gen.map Param ]

let rec private genIntExpr (size: int) : Gen<Expr> =
    if size <= 0 then
        genLeaf
    else
        Gen.oneof
            [ genLeaf
              gen {
                  let! op = Gen.elements [ Add; Sub; Mul ]
                  let! l = genIntExpr (size / 2)
                  let! r = genIntExpr (size / 2)
                  return Binary(op, l, r)
              }
              gen {
                  let! test = genBoolExpr (size / 2)
                  let! thenE = genIntExpr (size / 2)
                  let! elseE = genIntExpr (size / 2)
                  return Cond(test, thenE, elseE)
              } ]

and private genBoolExpr (size: int) : Gen<Expr> =
    gen {
        let! op = Gen.elements [ Lt; Eq ]
        let! l = genIntExpr (size / 2)
        let! r = genIntExpr (size / 2)
        return Binary(op, l, r)
    }

/// Small on purpose: widths MULTIPLY through `Binary`, so an unbounded generator
/// would ask `evalSoft` to materialise millions of candidates inside a unit test.
type IntExprArb() =
    static member Expr() = Arb.fromGen (genIntExpr 4)

[<Property(Arbitrary = [| typeof<IntExprArb> |], MaxTest = 400)>]
let ``actual evalSoft width never exceeds the predicted bound`` (e: Expr) =
    let predicted = BonsaiCost.predict propWidths e |> okCost
    let actual = actualWidth propEnv e     // fails loudly if evalSoft declined — no silent skip
    int64 actual <= predicted.Width


/// Non-vacuity guard for the generator above: the property is worthless if the
/// sample is all leaves. This pins that the generator actually reaches `Binary`
/// AND `Cond`, and that at least one sample has a bound wider than 1.
[<Fact>]
let ``the property generator actually produces Binary, Cond, and non-trivial widths`` () =
    let samples = genIntExpr 4 |> Gen.sample 200 |> Seq.toList
    let rec hasBinary =
        function
        | Binary(op, l, r) ->
            (match op with
             | Add
             | Sub
             | Mul -> true
             | _ -> false)
            || hasBinary l
            || hasBinary r
        | Cond(t, a, b) -> hasBinary t || hasBinary a || hasBinary b
        | _ -> false
    let rec hasCond =
        function
        | Cond _ -> true
        | Binary(_, l, r) -> hasCond l || hasCond r
        | _ -> false

    samples |> List.exists hasBinary |> should equal true
    samples |> List.exists hasCond |> should equal true
    samples
    |> List.exists (fun e ->
        match BonsaiCost.predict propWidths e with
        | Ok c -> c.Width > 1L
        | Error _ -> false)
    |> should equal true
