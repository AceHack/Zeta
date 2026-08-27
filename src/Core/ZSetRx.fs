namespace Zeta.Core

/// **Bonsai-serialized Rx query connecting the +1 fold to the −1 fold.**
///
/// Aaron 2026-08-26: the two DBSP folds are not two programs. The **connection**
/// is an Rx query — Meijer μ (fold / `IEnumerable`) ⇄ ν (unfold / `IObservable`) —
/// and it generalises to **any** `ZSet<'K>`. Persist the query as a Bonsai tree
/// (DeSmet / Reaqtor / Nuqleon); unfold it on each delta. The tree never mentions
/// `'K`, so the same bytes interpret over `ZSet<int>`, `ZSet<string>`, …
///
/// Canonical queries:
///   - `integrateQuery` — `I`: `acc + delta` (the +1 fold)
///   - `retractQuery`   — unary minus (the −1 emission, appended later)
///   - `connectQuery`   — `plus1 + minus1` (the ping-return; net view)
///
/// Formal siblings already in-tree, **consistent with** this query (not identified
/// by count — see numerology-vs-number-theory):
///   - `FourCornerTrace` — generator reread; `−1 = i²` on the ℂ ring (C₄)
///   - Clifford Cl(p,q) — generators square to ±1; reflection sandwich uses −1
///   - `MinimalBnn` / factor graphs — online +1 absorb of an observation;
///     retracting evidence is a generator-reinterpret of the evidence *set*,
///     not a chat rewind. EP/ADF re-normalisation is **not** Z-set minus
///     (inverse-free corners do not instantiate `FourCornerTrace`).
///
/// Anchors: Budiu et al. VLDB 2023; Meijer, Fokkinga & Paterson 1991;
/// DeSmet Reaqtor/Bonsai; Joyal–Street–Verity 1996.
[<RequireQualifiedAccess>]
module ZSetRx =

    let integrateQuery: Bonsai.Expr =
        Bonsai.Lambda(
            [ "acc"; "delta" ],
            Bonsai.Call("zset.add", [ Bonsai.Param "acc"; Bonsai.Param "delta" ])
        )

    let retractQuery: Bonsai.Expr =
        Bonsai.Lambda([ "delta" ], Bonsai.Call("zset.neg", [ Bonsai.Param "delta" ]))

    /// The standing query between the two folds. μ snapshot = eval this;
    /// ν standing subscription unfolds it on each arriving delta.
    let connectQuery: Bonsai.Expr =
        Bonsai.Lambda(
            [ "plus1"; "minus1" ],
            Bonsai.Call("zset.add", [ Bonsai.Param "plus1"; Bonsai.Param "minus1" ])
        )

    let rec eval (env: Map<string, ZSet<'K>>) (e: Bonsai.Expr) : Result<ZSet<'K>, string> =
        match e with
        | Bonsai.Param name ->
            match Map.tryFind name env with
            | Some z -> Ok z
            | None -> Error("unbound param: " + name)
        | Bonsai.Call("zset.add", [ left; right ]) ->
            match eval env left, eval env right with
            | Ok a, Ok b -> Ok(ZSet.add a b)
            | Error err, _ -> Error err
            | _, Error err -> Error err
        | Bonsai.Call("zset.neg", [ inner ]) ->
            match eval env inner with
            | Ok z -> Ok(ZSet.neg z)
            | Error err -> Error err
        | Bonsai.Call(fn, _) -> Error("unknown zset-rx fn: " + fn)
        | Bonsai.Const Bonsai.CNull -> Ok ZSet<'K>.Empty
        | Bonsai.Lambda _ -> Error "open lambda"
        | Bonsai.Binary _ -> Error "binary ops are the host-language subset; zset rx uses Call"
        | Bonsai.Cond _ -> Error "cond is not a zset-rx node"
        | Bonsai.Const _ -> Error "non-null const is not a zset"

    let apply1 (query: Bonsai.Expr) (value: ZSet<'K>) : Result<ZSet<'K>, string> =
        match query with
        | Bonsai.Lambda([ name ], body) -> eval (Map.ofList [ name, value ]) body
        | _ -> Error "expected 1-param lambda"

    let apply2 (query: Bonsai.Expr) (left: ZSet<'K>) (right: ZSet<'K>) : Result<ZSet<'K>, string> =
        match query with
        | Bonsai.Lambda([ n1; n2 ], body) -> eval (Map.ofList [ n1, left; n2, right ]) body
        | _ -> Error "expected 2-param lambda"

    /// Forward fold `I` by unfolding `integrateQuery` over a delta stream.
    let integrate (deltas: ZSet<'K> seq) : Result<ZSet<'K>, string> =
        let mutable acc: Result<ZSet<'K>, string> = Ok ZSet<'K>.Empty

        for d in deltas do
            match acc with
            | Error _ -> ()
            | Ok a -> acc <- apply2 integrateQuery a d

        acc

    let connect (plus1: ZSet<'K>) (minus1: ZSet<'K>) : Result<ZSet<'K>, string> =
        apply2 connectQuery plus1 minus1
