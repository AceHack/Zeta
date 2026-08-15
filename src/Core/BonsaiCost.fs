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
