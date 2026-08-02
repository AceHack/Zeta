namespace Zeta.Core

/// **DecorrelationMetrology — the SENSOR board for the decorrelation meter (metrology ≠ meter).**
///
/// Aaron's distinction (his Itron metering domain): **metrology is the sensors** (raw readings);
/// **the meter is the fusion** (combine + calibrate readings into one reported quantity with
/// uncertainty). This module is the **metrology / sensor layer only** — it selects *which* commit
/// pairs the board reads and exposes the DAG partial-order primitives those readings stand on. The
/// **meter** (fuse the pairwise readings into a CHSH-style S with a finite-sample margin, and the
/// register-3 "sovereignty" reading) is a SEPARATE layer built on top — deliberately NOT here.
///
/// **The physics-of-commits (register-2, a pure graph fact):** the git commit graph is a causal
/// partial order — a commit's parents are its immediate causal past (Lamport happens-before; "git IS
/// special relativity applied to commits"). Two commits are **spacelike / concurrent** iff neither is
/// an ancestor of the other — no causal path connects them. This is `TravelerFrame.concurrent` read
/// off the commit DAG (ancestry = the order), **vector-clock / DAG, never wall-clock**
/// (see rule `local-time-never-enters-the-shared-fold`).
///
/// **Purity / DST:** every function here is pure and total over a **supplied** DAG
/// (`Map: commit -> parent list`) — no git calls, no I/O, no interpretation. The impure edge (reading
/// the DAG out of git) is a thin adapter that lives elsewhere and feeds this core; keeping the sensor
/// selection pure makes it deterministic and **golden-vector-lockable** (DST §7).
///
/// **What the METER (fusion layer) should expose — design intent (Aaron 2026-08-02), NOT built here:**
/// - **Coincidences in the fusion are the payload:** where sensor readings *co-occur beyond chance*
///   is where the **bio / life signatures** live — a genuine (coordinated / common-caused) process
///   leaves correlated traces; independent decorrelated sources only *coincide by chance*.
/// - **Early failure prediction:** the coincidence/correlation structure shifts *before* an outright
///   failure (predictive-maintenance / early-warning-signals — rising autocorrelation & variance
///   before a critical transition). The meter is a failure-forecaster, not only a gauge.
/// - **⚠ The load-bearing GUARD (else the meter goes "crazy"):** the coincidences are produced by
///   *many independent agents with uncommunicated objectives* — so a chance-alignment of decorrelated
///   sources looks identical to a real signature until you divide by the **null model**. The fusion
///   layer MUST carry a null (what coincidence rate do independent sources produce?) and a
///   **significance margin** (Hoeffding — `AntiSybil.chshMargin`), flagging only coincidences *above*
///   it. Without that null, the meter manufactures false coordination — the machine version of a human
///   staring at life-coincidences until apophenia sets in. Life-signature = coincidence-rate
///   *significantly above* the independent-sources null; never the raw coincidence.
/// - **The null is also the algebra (Aaron 2026-08-02): carrying a null is what keeps the fusion
///   MONADIC.** The null is dual-purpose — the statistical baseline *and* the **identity/zero element**
///   of the fusion aggregate; an associative fold with an identity is a monoid ⇒ **order-independent
///   aggregation** (ties straight to the order-free / DST thread — same fold, any arrival order, one
///   result). Human anchor / prior art: Aaron **simulated meter fusion in SQL on Microsoft PDW
///   (Parallel Data Warehouse) MPP appliances at Itron** — the fusion *is* a big aggregate/fold over
///   readings, and the null is that aggregate's identity element (a `GROUP BY` needs a well-defined
///   zero). No null ⇒ not a monoid ⇒ order-dependent *and* apophenic.
///
/// **Anchors:** Lamport 1978 (happens-before); `TravelerFrame` (the vector-clock `dominates`/
/// `concurrent` this mirrors on the commit DAG); CHSH 1969 / `AntiSybil.chshS` + `chshMargin` (the
/// fusion layer this feeds, not implemented here); coincidence detection (physics coincidence
/// circuits); early-warning-signals / critical slowing down (Scheffer et al. 2009).
[<RequireQualifiedAccess>]
module DecorrelationMetrology =

    /// The strict ancestors of `c` reachable via parent edges — its causal past, **excluding `c`**.
    /// Iterative frontier walk over the parent map; `seen` guards against revisits (and the final
    /// `Set.remove c` keeps it strict even if `c` were reachable from itself in a malformed graph).
    let ancestors (parents: Map<'C, 'C list>) (c: 'C) : Set<'C> =
        let rec go frontier seen =
            match frontier with
            | [] -> seen
            | x :: rest ->
                let ps = Map.tryFind x parents |> Option.defaultValue []
                let fresh = ps |> List.filter (fun p -> not (Set.contains p seen))
                let seen' = fresh |> List.fold (fun s p -> Set.add p s) seen
                go (fresh @ rest) seen'
        go [ c ] Set.empty |> Set.remove c

    /// `a` **dominates** `b` iff `a` is a strict ancestor of `b` (a is in b's causal past ⇒ a
    /// happens-before b). Mirrors `TravelerFrame.dominates` on the commit DAG.
    let dominates (parents: Map<'C, 'C list>) (a: 'C) (b: 'C) : bool =
        Set.contains a (ancestors parents b)

    /// `a` and `b` are **spacelike / concurrent** iff distinct and neither is an ancestor of the
    /// other. Same shape as `TravelerFrame.concurrent`: `not (dominates a b) && not (dominates b a)`.
    let concurrent (parents: Map<'C, 'C list>) (a: 'C) (b: 'C) : bool =
        a <> b
        && not (dominates parents a b)
        && not (dominates parents b a)

    /// **Sensor selection:** every unordered spacelike pair among `commits`, each pair once, emitted
    /// in ascending `(a, b)` order for byte-lock stability. Ordering uses F# structural comparison,
    /// which for string commit-ids is **ordinal** (satisfies `culture-invariant-by-default`); the
    /// deterministic order makes the result a stable golden vector for the meter to fuse.
    let spacelikeCommitPairs (parents: Map<'C, 'C list>) (commits: 'C list) : ('C * 'C) list =
        let sorted = commits |> List.distinct |> List.sort
        let arr = List.toArray sorted
        [ for i in 0 .. arr.Length - 1 do
            for j in i + 1 .. arr.Length - 1 do
                if concurrent parents arr.[i] arr.[j] then
                    yield (arr.[i], arr.[j]) ]

    // ── git-read adapter (PURE parse; the impure git shell stays a thin documented edge) ──────────
    /// Parse the output of **`git rev-list --parents <range>`** into the commit DAG.
    /// Each non-empty line is `"<commit> <parent1> <parent2> …"`: the first token is the commit, the
    /// rest are its parents — 0 for a root, 1 for a normal commit, ≥2 for a merge. Whitespace-split
    /// (ordinal, no culture — `culture-invariant-by-default`), blank lines dropped. **Pure + total →
    /// golden-vector-lockable** (same text ⇒ same DAG); it composes directly with `spacelikeCommitPairs`.
    ///
    /// The impure edge is a one-liner the caller runs and feeds here (kept OUT of pure Core, per
    /// noninterference — I/O only through the caller): e.g. `git rev-list --parents <a>..<b>` → this →
    /// `spacelikeCommitPairs`. Duplicate commit lines collapse to the last (rev-list emits each once).
    let parseRevListParents (revListOutput: string) : Map<string, string list> =
        revListOutput.Split([| '\n'; '\r' |], System.StringSplitOptions.RemoveEmptyEntries)
        |> Array.choose (fun line ->
            match line.Split([| ' '; '\t' |], System.StringSplitOptions.RemoveEmptyEntries) |> Array.toList with
            | [] -> None
            | commit :: parents -> Some(commit, parents))
        |> Map.ofArray
