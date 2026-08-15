namespace Zeta.Core

open System
open System.Numerics

/// **BonsaiCost — the missing plug for `Vision`'s forecast port: a STATIC cost model
/// for `BonsaiSoft.evalSoft`, derived from the expression alone.**
///
/// The gap this closes (2026-08-15). `Vision.fs` already owns the budgeting and the
/// pruning (`predictBranches` boards the affordable prefix and DEFERS the rest), and
/// `Vision.IBranchForecaster` is the declared port a room plugs its forecast into. But
/// every `Vision.BranchCost` in the tree is **supplied by the caller** — nothing in the
/// repo *derives* a cost from a program. So a scheduler could budget a Bonsai evaluation
/// only if someone already knew what it would cost. This module derives it.
///
/// **The layer split (load-bearing — see the module comment on `Bonsai.reify`/`apply`).**
/// `reify`/`apply` are total, channel-free `Expr ↔ DynamicValue` — the round-trip law and
/// the wire byte-lock depend on their having **no injected channel** (§13 noninterference:
/// what makes the law byte-lockable is that there is no ambient door, which is exactly what
/// leaves no room for a tick). They are **not** parameterized here and must never be.
/// **Evaluation** is where a scheduler belongs, so the cost model reads the `Expr` and
/// predicts what *evaluation* will cost. Nothing in this module is on the encode/decode path.
///
/// **What is metered and what is toy** (`toy-is-free-metered-must-be-earned.md`):
///
/// - `Width` is **metered**. It is a sound upper bound on the number of candidates in the
///   `SoftValue` that `evalSoft` returns, and the falsifier is mechanical and cheap: run
///   `evalSoft`, count `SoftValue.candidates`, assert `actual ≤ Width`. A wrong recurrence
///   (e.g. adding where `Binary` multiplies) makes actual exceed predicted on an ordinary
///   expression and the property fails. `BonsaiCost.Tests` pins both the soundness direction
///   AND a tightness case where predicted = actual exactly — without the tightness case a
///   trivially-huge "bound" would satisfy soundness and the check would be vacuous.
/// - `ToyPairs` is **toy**, and says so in its identifier. It is an upper bound on the
///   `(a, b)` candidate pairs `evalSoft` enumerates through `applyOp` — the honest *time*
///   half — but `applyOp` is private and uninstrumented, so there is no way to observe the
///   actual count and therefore **no falsifier**. It is derived from the same recurrence as
///   `Width` and is used for `BranchCost.TimeTicks`; promoting it means threading a counter
///   through `evalSoft` (one implementation, not a second evaluator), which is deliberately
///   NOT done here — that edits a contended file for a benefit this module does not need.
///
/// **The recurrence** (read directly off `BonsaiSoft.evalSoft`):
///
/// | node | width bound | pairs |
/// |---|---|---|
/// | `Const` | 1 | 0 |
/// | `Param p` | `widths[p]` (unbound ⇒ decline, as `evalSoft` declines) | 0 |
/// | `Binary(op, l, r)` | `w l * w r`, capped at **2** for `Eq/Lt/And/Or` | `p l + p r + w l * w r` |
/// | `Cond(t, a, b)` | `w a + w b` (soft `Cond` blends BOTH branches) | `p t + p a + p b` |
/// | `Lambda` / `Call` | decline (`evalSoft` declines them too) | — |
///
/// The `2` cap is structural, not a fudge: on every success path `applyOp` returns
/// `DynamicValue.Bool` for `Eq`, `Lt`, `And` and `Or`, so the result distribution has at
/// most two distinct candidates however wide its inputs are. The bound stays sound and gets
/// materially sharper for predicate-heavy trees. Note it sharpens **space only** — the
/// work is still `w l * w r` pairs, which is why a narrow `Eq` can still decline on
/// `PairsOverflow`. That asymmetry is real and is the point of keeping the two separate.
///
/// **The bound is sound, not exact.** `SoftValue.ofWeighted` merges equal candidates, so
/// actual width can be strictly less than predicted (a `Cond` whose test is certain drops a
/// whole branch to weight 0; `Binary(Mul, x, x)` collides duplicates). Sound-and-loose is
/// the correct register for a scheduler's admission decision: over-predicting defers work
/// that would have fit, under-predicting blows the budget after committing.
///
/// **Overflow declines rather than caps.** A capped "bound" is a bound that can be wrong.
/// Widths multiply, so a left-spine of `Mul` over 2-candidate params doubles per level and
/// passes `Int64.MaxValue` in ~63 levels (`Bonsai.MaxDepth` is 1024); the recurrence declines
/// the moment either quantity leaves `int64`, which also keeps the intermediate `BigInteger`
/// bounded by `(2^63)²` so an adversarial tree cannot turn the estimator itself into the DoS
/// it exists to prevent. For a scheduler, a decline **is** the prune: "I cannot bound this,
/// so I will not board it."
[<RequireQualifiedAccess>]
module BonsaiCost =

    open Bonsai

    /// The typed reasons a cost prediction declines. Named *Feedback* not *Error* per the
    /// repo convention: a decline is load-bearing scheduling input, not residue.
    type CostFeedback =
        /// A `Param` had no declared candidate width. `evalSoft` declines the same expression
        /// with "unbound param", so the estimator and the evaluator agree on the domain.
        | UnboundParam of name: string
        /// A declared param width was not at least 1 (a `SoftValue` always has ≥ 1 candidate).
        | NonPositiveParamWidth of name: string * width: int64
        /// `Lambda` / `Call` — `BonsaiSoft` v1 declines these, so their cost is undefined,
        /// not zero.
        | UnsupportedNode of kind: string
        /// The predicted result width left `int64`. Not capped — see the module note.
        | WidthOverflow of width: BigInteger
        /// The predicted enumerated-pair count left `int64`.
        | PairsOverflow of pairs: BigInteger
        /// A caller-supplied unit price was negative.
        | NegativeUnitPrice of label: string * price: int64
        /// Priced space bytes left `int64`.
        | SpaceBytesOverflow of bytes: BigInteger
        /// `ToyPairs` did not fit `Vision.BranchCost.TimeTicks` (an `int`).
        | TimeTicksOverflow of pairs: int64

    /// The static prediction. `Width` is metered; `ToyPairs` is not (see the module note).
    type Cost =
        { /// Sound upper bound on `|SoftValue.candidates|` of `evalSoft`'s result.
          Width: int64
          /// UNFALSIFIED upper bound on the candidate pairs `evalSoft` enumerates.
          ToyPairs: int64 }

    /// Declared candidate width per `Param` name — the only environment the estimator needs
    /// (it is value-blind: it reads the shape of the distribution, never its contents).
    type Widths = Map<string, int64>

    /// One evaluation a caller is asking the scheduler to fund.
    type Request =
        { Label: string
          Expr: Expr
          Widths: Widths }

    let private maxI64 = BigInteger Int64.MaxValue
    let private maxI32 = BigInteger Int32.MaxValue

    /// The op's codomain bound: `Eq`/`Lt`/`And`/`Or` yield `DynamicValue.Bool` on every
    /// success path, so at most two distinct candidates survive however wide the inputs are.
    let private opWidthCap (op: BinOp) : BigInteger option =
        match op with
        | Eq
        | Lt
        | And
        | Or -> Some(BigInteger 2)
        | Add
        | Sub
        | Mul -> None

    let rec private go (widths: Widths) (expr: Expr) : Result<BigInteger * BigInteger, CostFeedback> =
        match expr with
        | Const _ -> Ok(BigInteger.One, BigInteger.Zero)
        | Param name ->
            match Map.tryFind name widths with
            | None -> Error(UnboundParam name)
            | Some w when w < 1L -> Error(NonPositiveParamWidth(name, w))
            | Some w -> Ok(BigInteger w, BigInteger.Zero)
        | Binary(op, l, r) ->
            go widths l
            |> Result.bind (fun (wl, pl) ->
                go widths r
                |> Result.bind (fun (wr, pr) ->
                    let product = wl * wr
                    let width =
                        match opWidthCap op with
                        | Some cap -> BigInteger.Min(cap, product)
                        | None -> product
                    let pairs = pl + pr + product
                    if width > maxI64 then Error(WidthOverflow width)
                    elif pairs > maxI64 then Error(PairsOverflow pairs)
                    else Ok(width, pairs)))
        | Cond(test, thenE, elseE) ->
            go widths test
            |> Result.bind (fun (_, pt) ->
                go widths thenE
                |> Result.bind (fun (wThen, pThen) ->
                    go widths elseE
                    |> Result.bind (fun (wElse, pElse) ->
                        let width = wThen + wElse
                        let pairs = pt + pThen + pElse
                        if width > maxI64 then Error(WidthOverflow width)
                        elif pairs > maxI64 then Error(PairsOverflow pairs)
                        else Ok(width, pairs))))
        | Lambda _ -> Error(UnsupportedNode "lambda")
        | Call _ -> Error(UnsupportedNode "call")

    /// **The prediction.** Static, value-blind, and total over the fragment `evalSoft`
    /// supports; declines exactly where `evalSoft` declines structurally, plus on overflow.
    let predict (widths: Widths) (expr: Expr) : Result<Cost, CostFeedback> =
        go widths expr
        |> Result.map (fun (w, p) -> { Width = int64 w; ToyPairs = int64 p })

    /// Human-readable decline text, for a scheduler's feedback channel.
    let feedbackText (feedback: CostFeedback) : string =
        match feedback with
        | UnboundParam name -> sprintf "unbound param '%s'" name
        | NonPositiveParamWidth(name, width) -> sprintf "param '%s' declared width %d (must be >= 1)" name width
        | UnsupportedNode kind -> sprintf "BonsaiSoft v1 does not evaluate '%s'" kind
        | WidthOverflow width -> sprintf "predicted result width overflows int64: %O" width
        | PairsOverflow pairs -> sprintf "predicted enumerated-pair count overflows int64: %O" pairs
        | NegativeUnitPrice(label, price) -> sprintf "negative unit price for %s: %d" label price
        | SpaceBytesOverflow bytes -> sprintf "priced space bytes overflow int64: %O" bytes
        | TimeTicksOverflow pairs -> sprintf "predicted pairs %d does not fit BranchCost.TimeTicks" pairs

    /// **Price the prediction into the scheduler's currency.** The unit prices are the
    /// CALLER'S — this module owns the shape of the cost (how many candidates, how many
    /// pairs) and deliberately does not own what a candidate is worth in bytes, which is a
    /// deployment fact and would be an unfalsifiable constant if baked in here. Same split
    /// `Vision.BranchCost` already makes with `BytesPerTick`.
    let toBranchCost
        (bytesPerCandidate: int64)
        (bytesPerPair: int64)
        (cost: Cost)
        : Result<Vision.BranchCost, CostFeedback> =
        if bytesPerCandidate < 0L then
            Error(NegativeUnitPrice("bytesPerCandidate", bytesPerCandidate))
        elif bytesPerPair < 0L then
            Error(NegativeUnitPrice("bytesPerPair", bytesPerPair))
        else
            let spaceBytes = BigInteger cost.Width * BigInteger bytesPerCandidate
            if spaceBytes > maxI64 then
                Error(SpaceBytesOverflow spaceBytes)
            elif BigInteger cost.ToyPairs > maxI32 then
                Error(TimeTicksOverflow cost.ToyPairs)
            else
                Ok
                    { Vision.SpaceBytes = int64 spaceBytes
                      Vision.TimeTicks = int cost.ToyPairs
                      Vision.BytesPerTick = bytesPerPair
                      Vision.UncertaintyResolutionBits = 0 }

    /// Predict and price in one step.
    let branchCost
        (bytesPerCandidate: int64)
        (bytesPerPair: int64)
        (widths: Widths)
        (expr: Expr)
        : Result<Vision.BranchCost, CostFeedback> =
        predict widths expr |> Result.bind (toBranchCost bytesPerCandidate bytesPerPair)

    /// **The wiring: a Bonsai evaluation batch as `Vision`'s forecast port.** Each request
    /// becomes a `Vision.FutureBranch` whose branch state is the `Expr` ITSELF, so what
    /// `Vision.predictBranches` hands back as `Deferred` is literally the list of
    /// evaluations the budget declined to fund. That is the prune, and it is the whole
    /// point: the scheduler is injected at the EVALUATION layer, never into `reify`/`apply`.
    /// A single unpredictable request declines the whole forecast — a scheduler that boards
    /// a batch it cannot bound has not budgeted it.
    let forecaster
        (bytesPerCandidate: int64)
        (bytesPerPair: int64)
        : Vision.IBranchForecaster<Request list, unit, Expr, CostFeedback> =
        { new Vision.IBranchForecaster<Request list, unit, Expr, CostFeedback> with
            member _.Forecast(requests: Request list) =
                let rec loop acc rest =
                    match rest with
                    | [] -> Ok(List.rev acc)
                    | (request: Request) :: tail ->
                        match branchCost bytesPerCandidate bytesPerPair request.Widths request.Expr with
                        | Error feedback -> Error feedback
                        | Ok cost ->
                            let branch: Vision.FutureBranch<Expr> =
                                { Label = request.Label
                                  State = request.Expr
                                  Cost = cost }
                            loop (branch :: acc) tail
                loop [] requests
                |> Result.map (fun branches ->
                    let forecast: Vision.Forecast<unit, Expr> =
                        { Snapshot = ()
                          Branches = branches }
                    forecast) }


/// **BonsaiCostMeasure — the instrument, not the gate.**
///
/// A cost bound has two independent properties that fail in OPPOSITE directions:
///
/// - **Soundness** — never under-predict. `actual > predicted` is the violation;
///   `actual < predicted` is a loose bound and is permitted. This stays a hard assertion.
/// - **Discrimination** — does the prediction actually separate cheap branches from
///   expensive ones? A model answering "the ceiling" for everything is perfectly sound and
///   useless, because `Vision.predictBranches` prunes on the predicted order.
///
/// **Discrimination is measured and recorded, NOT gated** (Aaron 2026-08-15, on the
/// expectation that predictions will discriminate poorly at first: *"yes exactly — most
/// probably won't at first, until we get better at it."*). Treating it as a bar to clear
/// would either block honest work or, worse, invite tuning the model until the number looks
/// good — inverting the instrument into a target. The number exists to tell us whether
/// pruning is worth trusting yet; **do not optimise against it.**
///
/// So: `measure` asserts nothing. It returns the numbers, re-runnably, so the trajectory is
/// visible across dates. A recorded poor score is honest and improvable; an unmeasured
/// "sound" model is neither. The labelling discipline is unchanged — a model that does not
/// discriminate is `unmetered` as a *predictor* however sound it is as a *bound*.
///
/// **The concordance number is the one that matters for a prune.** A scheduler boards by
/// ORDER, not by absolute magnitude, so the question is whether predicted order agrees with
/// actual order. A constant predictor scores `ConcordantFraction = 0` with every pair landing
/// in `TiedPredictedPairs` — the "1.02x spread" failure made visible rather than argued about.
///
/// **`measureWith` takes the predictor as a parameter.** That is one parameter, not
/// speculative architecture, and it is what lets several independent estimators be scored
/// against the same actuals later. Aaron 2026-08-15: *"fast failures and decorrelated cheap
/// AI is the way to improve this."* Whether decorrelated ensembles actually beat one
/// carefully-argued cost function here is **not measured** — see the research doc, which
/// records that transfer as a structural argument rather than a result.
[<RequireQualifiedAccess>]
module BonsaiCostMeasure =

    open Bonsai

    /// One scored case: the estimator's inputs plus the environment to actually evaluate in.
    type Case =
        { Label: string
          Widths: BonsaiCost.Widths
          Env: BonsaiSoft.Env
          Expr: Expr }

    type CaseOutcome =
        { Label: string
          Predicted: int64
          Actual: int
          /// `false` is the defect: the bound was exceeded.
          Sound: bool
          Exact: bool
          /// predicted / actual — 1.0 is a tight bound, large is a loose one.
          OverPredictionFactor: float }

    type Measurement =
        { Cases: int
          /// Labels where `actual > predicted`. Non-empty means the MODEL IS WRONG.
          Unsound: string list
          ExactCases: int
          MaxOverPredictionFactor: float
          GeoMeanOverPredictionFactor: float
          /// Pairs whose ACTUAL widths differ — the pairs a predictor could get right.
          ComparablePairs: int
          ConcordantPairs: int
          DiscordantPairs: int
          /// Pairs the predictor could not separate at all. A constant model lands here.
          TiedPredictedPairs: int
          /// ConcordantPairs / ComparablePairs. 1.0 = perfect ordering, 0.0 = no signal.
          ConcordantFraction: float
          Outcomes: CaseOutcome list }

    type MeasureFeedback =
        | NoCases
        | PredictDeclined of label: string * text: string
        | EvalDeclined of label: string * text: string

    let private score (case: Case) (predicted: int64) (actual: int) : CaseOutcome =
        { Label = case.Label
          Predicted = predicted
          Actual = actual
          Sound = int64 actual <= predicted
          Exact = int64 actual = predicted
          OverPredictionFactor = float predicted / float actual }

    /// Score a corpus with ANY predictor against the actual `evalSoft` widths.
    let measureWith
        (predictor: BonsaiCost.Widths -> Expr -> Result<BonsaiCost.Cost, BonsaiCost.CostFeedback>)
        (cases: Case list)
        : Result<Measurement, MeasureFeedback> =
        if List.isEmpty cases then
            Error NoCases
        else
            let rec run acc rest =
                match rest with
                | [] -> Ok(List.rev acc)
                | (case: Case) :: tail ->
                    match predictor case.Widths case.Expr with
                    | Error feedback -> Error(PredictDeclined(case.Label, BonsaiCost.feedbackText feedback))
                    | Ok cost ->
                        match BonsaiSoft.evalSoft case.Env case.Expr with
                        | Error text -> Error(EvalDeclined(case.Label, text))
                        | Ok sv -> run (score case cost.Width (List.length (SoftValue.candidates sv)) :: acc) tail

            run [] cases
            |> Result.map (fun outcomes ->
                let arr = List.toArray outcomes
                let mutable comparable = 0
                let mutable concordant = 0
                let mutable discordant = 0
                let mutable tied = 0
                for i in 0 .. arr.Length - 2 do
                    for j in i + 1 .. arr.Length - 1 do
                        let da = compare arr.[i].Actual arr.[j].Actual
                        if da <> 0 then
                            comparable <- comparable + 1
                            let dp = compare arr.[i].Predicted arr.[j].Predicted
                            if dp = 0 then tied <- tied + 1
                            elif dp = da then concordant <- concordant + 1
                            else discordant <- discordant + 1
                let logSum = outcomes |> List.sumBy (fun o -> log o.OverPredictionFactor)
                { Cases = arr.Length
                  Unsound = outcomes |> List.filter (fun o -> not o.Sound) |> List.map _.Label
                  ExactCases = outcomes |> List.filter _.Exact |> List.length
                  MaxOverPredictionFactor = outcomes |> List.map _.OverPredictionFactor |> List.max
                  GeoMeanOverPredictionFactor = exp (logSum / float arr.Length)
                  ComparablePairs = comparable
                  ConcordantPairs = concordant
                  DiscordantPairs = discordant
                  TiedPredictedPairs = tied
                  ConcordantFraction =
                    if comparable = 0 then 0.0 else float concordant / float comparable
                  Outcomes = outcomes })

    /// Score a corpus with the shipped predictor.
    let measure (cases: Case list) : Result<Measurement, MeasureFeedback> =
        measureWith BonsaiCost.predict cases

    // ── The reference corpus ────────────────────────────────────────────────
    //
    // It lives in Core, not in the test project, for one reason: the number is
    // meant to be re-run and compared across DATES, which means the instrument has
    // to be callable outside the test harness (`dotnet fsi`, a future metrics tick,
    // another estimator being scored against the same actuals). A corpus locked
    // inside a test file can only ever be run one way.
    //
    // It is DELIBERATELY FIXED. Editing it changes what the score means, so a later
    // reading would not be comparable to the recorded one. If it needs to grow,
    // append and say so with the date — never rewrite to improve a number.

    let private softOf (values: int64 list) : SoftValue.SoftValue =
        values
        |> List.map (fun v -> DynamicValue.Int v, 1.0)
        |> SoftValue.ofWeighted
        |> Option.defaultValue (SoftValue.certain (DynamicValue.Int 0L))

    let private case label widths env expr : Case =
        { Label = label
          Widths = Map.ofList widths
          Env = Map.ofList env
          Expr = expr }

    /// The stable scoring corpus: certain constants, bare params, products that do
    /// and do not collide, predicate ops (where the codomain cap bites), both `Cond`
    /// shapes (both branches live vs. a certain test dropping one), and nested trees.
    let standardCorpus: Case list =
        let x3 = softOf [ 2L; 3L; 5L ]
        let y3 = softOf [ 7L; 11L; 13L ]
        let z2 = softOf [ 100L; 200L ]
        let a2 = softOf [ 1L; 10L ]
        let q3 = softOf [ 300L; 400L; 500L ]
        let xyzW = [ "x", 3L; "y", 3L; "z", 2L ]
        let xyzE = [ "x", x3; "y", y3; "z", z2 ]

        [ case "const" [] [] (Const(CInt 1L))
          case "const-binary" [] [] (Binary(Mul, Const(CInt 2L), Const(CInt 3L)))
          case "param-3" [ "x", 3L ] [ "x", x3 ] (Param "x")
          case "mul-3x3-distinct" xyzW xyzE (Binary(Mul, Param "x", Param "y"))
          case "mul-collapse-to-zero" [ "x", 3L ] [ "x", x3 ] (Binary(Mul, Param "x", Const(CInt 0L)))
          case "add-3x2" xyzW xyzE (Binary(Add, Param "x", Param "z"))
          case "sub-self-merges" [ "x", 3L ] [ "x", x3 ] (Binary(Sub, Param "x", Param "x"))
          case "lt-3x3-predicate" xyzW xyzE (Binary(Lt, Param "x", Param "y"))
          case "eq-self-predicate" [ "x", 3L ] [ "x", x3 ] (Binary(Eq, Param "x", Param "x"))
          case
              "and-of-predicates"
              xyzW
              xyzE
              (Binary(And, Binary(Lt, Param "x", Param "y"), Binary(Lt, Param "y", Param "x")))
          case "nested-mul-3x3x2" xyzW xyzE (Binary(Mul, Binary(Mul, Param "x", Param "y"), Param "z"))
          case
              "add-over-merged-sub"
              [ "x", 3L ]
              [ "x", x3 ]
              (Binary(Add, Param "x", Binary(Sub, Param "x", Param "x")))
          case
              "cond-both-branches-live"
              [ "a", 2L; "p", 2L; "q", 3L ]
              [ "a", a2; "p", z2; "q", q3 ]
              (Cond(Binary(Lt, Param "a", Const(CInt 5L)), Param "p", Param "q"))
          case
              "cond-test-certain-drops-a-branch"
              [ "p", 2L; "q", 3L ]
              [ "p", z2; "q", q3 ]
              (Cond(Binary(Lt, Const(CInt 1L), Const(CInt 5L)), Param "p", Param "q"))
          case
              "cond-nested-in-arithmetic"
              [ "a", 2L; "p", 2L; "q", 3L; "z", 2L ]
              [ "a", a2; "p", z2; "q", q3; "z", z2 ]
              (Binary(Add, Cond(Binary(Lt, Param "a", Const(CInt 5L)), Param "p", Param "q"), Param "z")) ]

    /// A single fixed-format line, so two runs on different dates are diffable by eye.
    /// Invariant-culture throughout — this line is compared across machines.
    let report (m: Measurement) : string =
        System.String.Format(
            System.Globalization.CultureInfo.InvariantCulture,
            "BonsaiCost discrimination: cases={0} unsound={1} exact={2} concordant={3}/{4} tied={5} discordant={6} concordantFraction={7:F3} overPrediction(geoMean)={8:F3} overPrediction(max)={9:F3}",
            m.Cases,
            List.length m.Unsound,
            m.ExactCases,
            m.ConcordantPairs,
            m.ComparablePairs,
            m.TiedPredictedPairs,
            m.DiscordantPairs,
            m.ConcordantFraction,
            m.GeoMeanOverPredictionFactor,
            m.MaxOverPredictionFactor
        )
