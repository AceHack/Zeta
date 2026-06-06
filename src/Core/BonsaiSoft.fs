namespace Zeta.Core

/// **BonsaiSoft — the soft evaluator that makes the yang half executable.**
///
/// `Bonsai.Expr` was representation-only (AST + serialize/parse); this module is the
/// missing interpreter. It honours the maintainer's soft-vs-sharp resolution
/// (2026-06-06): *"we need the soft version of persistence, and in the best case the soft
/// version would collapse to the sharp version based on firing and confidence
/// thresholds … snap into the sharp versions for execution."*
///
/// - **Soft** (`evalSoft`) is the persisted / wonder-holding semantics: every node yields a
///   `SoftValue` (a normalised distribution over `DynamicValue`), so uncertainty is never
///   silently collapsed. `Cond` is evaluated **softly** — *both* branches are evaluated and
///   blended by the test's truth-confidence (no hard branch ⇒ branchless / shader-portable,
///   per vision §4e "avoid `if`").
/// - **Sharp** (`snap`) is the execution semantics: the single legitimate collapse,
///   `SoftValue.resolve threshold` — a definite value iff confidence ≥ threshold, else held.
///   This is the soft→sharp morphism; persistence keeps the `SoftValue`, execution snaps.
///
/// v1 supports `Const · Param · Binary · Cond`. `Lambda` / `Call` (closures / named
/// functions) return an explicit `Error`, never a silent wrong answer (Result-over-exception).
/// Note: because soft `Cond` evaluates BOTH branches, an error in the not-taken branch still
/// propagates — soft evaluation means both branches are real, even at weight 0.
[<RequireQualifiedAccess>]
module BonsaiSoft =

    open Bonsai

    /// Variable environment — each `Param` resolves to a `SoftValue` distribution.
    type Env = Map<string, SoftValue.SoftValue>

    let private constToDv (c: ConstValue) : DynamicValue =
        match c with
        | CInt i -> DynamicValue.Int i
        | CStr s -> DynamicValue.String s
        | CBool b -> DynamicValue.Bool b
        | CNull -> DynamicValue.Null

    /// Apply a binary op to two CONCRETE values. Checked arithmetic (no silent overflow,
    /// matching the ZSet weight discipline); ill-typed combinations are an honest `Error`.
    let private applyOp (op: BinOp) (a: DynamicValue) (b: DynamicValue) : Result<DynamicValue, string> =
        match op, a, b with
        | Add, DynamicValue.Int x, DynamicValue.Int y -> Ok(DynamicValue.Int(Checked.(+) x y))
        | Sub, DynamicValue.Int x, DynamicValue.Int y -> Ok(DynamicValue.Int(Checked.(-) x y))
        | Mul, DynamicValue.Int x, DynamicValue.Int y -> Ok(DynamicValue.Int(Checked.(*) x y))
        | Eq, x, y -> Ok(DynamicValue.Bool(x = y))
        | Lt, DynamicValue.Int x, DynamicValue.Int y -> Ok(DynamicValue.Bool(x < y))
        | And, DynamicValue.Bool x, DynamicValue.Bool y -> Ok(DynamicValue.Bool(x && y))
        | Or, DynamicValue.Bool x, DynamicValue.Bool y -> Ok(DynamicValue.Bool(x || y))
        | _ -> Error(sprintf "BonsaiSoft: ill-typed %A applied to %A, %A" op a b)

    /// Sequence a list of Results — first `Error` wins, else `Ok` of all values.
    let private sequence (xs: Result<'a, 'e> list) : Result<'a list, 'e> =
        let rec go acc =
            function
            | [] -> Ok(List.rev acc)
            | Ok x :: t -> go (x :: acc) t
            | Error e :: _ -> Error e
        go [] xs

    /// Soft binary: the product distribution through `applyOp` (weights multiply), normalised.
    let private combine (op: BinOp) (l: SoftValue.SoftValue) (r: SoftValue.SoftValue) : Result<SoftValue.SoftValue, string> =
        [ for a, pa in SoftValue.candidates l do
              for b, pb in SoftValue.candidates r do
                  applyOp op a b |> Result.map (fun v -> v, pa * pb) ]
        |> sequence
        |> Result.bind (fun weighted ->
            match SoftValue.ofWeighted weighted with
            | Some sv -> Ok sv
            | None -> Error "BonsaiSoft: degenerate distribution from Binary")

    /// Split a (boolean) test distribution into P(true), P(false). Non-bool ⇒ Error.
    let private boolSplit (sv: SoftValue.SoftValue) : Result<float * float, string> =
        ((Ok(0.0, 0.0)), SoftValue.candidates sv)
        ||> List.fold (fun acc (d, w) ->
            acc
            |> Result.bind (fun (pt, pf) ->
                match d with
                | DynamicValue.Bool true -> Ok(pt + w, pf)
                | DynamicValue.Bool false -> Ok(pt, pf + w)
                | other -> Error(sprintf "BonsaiSoft: Cond test must be Bool, got %A" other)))

    /// **Soft evaluation** — the persisted/wonder-holding semantics. Every node yields a
    /// `SoftValue`; uncertainty is preserved, never collapsed.
    let rec evalSoft (env: Env) (expr: Expr) : Result<SoftValue.SoftValue, string> =
        match expr with
        | Const c -> Ok(SoftValue.certain (constToDv c))
        | Param name ->
            match Map.tryFind name env with
            | Some sv -> Ok sv
            | None -> Error(sprintf "BonsaiSoft: unbound param '%s'" name)
        | Binary(op, l, r) ->
            evalSoft env l
            |> Result.bind (fun sl -> evalSoft env r |> Result.bind (combine op sl))
        | Cond(test, thenE, elseE) ->
            evalSoft env test
            |> Result.bind boolSplit
            |> Result.bind (fun (pt, pf) ->
                evalSoft env thenE
                |> Result.bind (fun sThen ->
                    evalSoft env elseE
                    |> Result.bind (fun sElse ->
                        // Soft branch: blend BOTH branches by the test's truth-confidence.
                        let blended =
                            [ for d, w in SoftValue.candidates sThen -> d, w * pt ]
                            @ [ for d, w in SoftValue.candidates sElse -> d, w * pf ]
                        match SoftValue.ofWeighted blended with
                        | Some sv -> Ok sv
                        | None -> Error "BonsaiSoft: Cond produced an empty distribution")))
        | Lambda _ -> Error "BonsaiSoft v1: Lambda not yet supported (closures pending)"
        | Call(name, _) ->
            Error(sprintf "BonsaiSoft v1: Call '%s' not yet supported (named functions pending)" name)

    /// **The soft→sharp snap** — evaluate soft, then collapse to a definite value iff
    /// confidence ≥ `threshold` (else `None` = held). The one legitimate collapse, at the
    /// execution edge. `Error` only on an ill-typed / unsupported expression.
    let snap (threshold: float) (env: Env) (expr: Expr) : Result<DynamicValue option, string> =
        evalSoft env expr |> Result.map (SoftValue.resolve threshold)
