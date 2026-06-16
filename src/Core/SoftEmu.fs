namespace Zeta.Core

open System

/// **`SoftEmu` — the WHOLE CHIP-8 emulator as one soft value (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"we have a CAS-less, lockless, purely soft emulator — this is insane to have the whole emu soft."*
/// This is that: the machine state is a **`Soft` = a normalized weighted ensemble of `Chip8Cow.Frame`s** — a
/// distribution over whole machine states. `softStep : Soft → Soft` advances *every* branch at once.
///
/// **Why the four properties hold:**
///   - **CAS-less:** the soft state is just a weighted list — no content-addressing, no dedup store. The
///     superposition lives *in* the ensemble, not across CAS-stored branches. (Dedup would be CAS; we don't.)
///   - **Lockless:** built on `Chip8Cow`'s pure immutable `step` (COW persistent maps) — no shared mutable
///     state, no locks, DST-replayable.
///   - **Purely soft:** the whole machine is the distribution; `collapse` is the *only* point a definite frame
///     is chosen (by a value fn — fitness/empowerment), never silently (the [[SoftValue]] never-collapse ethos).
///   - **Correlations exact up to S=2:** each ensemble member is a *joint* frame (all cells correlated within
///     it), and `RND` is **seed-determined** (`Frame.Rng` = the shared soft-time generator / common cause), so
///     branches fork **only on unknown INPUT** — *not* on `RND`. That is the shared-hidden-variable model, which
///     by **Bell** reproduces correlations up to the **classical bound S=2**, cheaply, with no signalling.
///     Genuine entanglement (2√2) / the algebraic max (S=4) would need a *feedback channel* between cells at
///     collapse (signalling) — `FeedbackThrottle`'s latency knob — which this module deliberately does NOT add
///     (so the rung it sits on is legible: shared generator ⇒ S=2).
///
/// **Honest scope (peel):** branching doubles the ensemble at each input opcode → unbounded growth; `prune`
/// (the throttle / `FerryThrottler` breadth knob) caps it by keeping the top-weighted members — a *lossy*
/// truncation. The typed pruning APIs report the dropped tail as heat: if the room cannot afford to keep
/// all futures, that information loss must be visible instead of hiding inside a smaller support count.
/// No per-cell factoring here
/// (that is the further mean-field compression; this ensemble keeps correlations exact at the cost of width).
/// Prior art anchors: symbolic execution (KLEE/angr — fork-on-branch), probabilistic-program semantics (Kozen),
/// planning over emulator state (ALE/MuZero — take-every-branch-score-collapse). The *synthesis* (exact
/// semantics + DST-seed shared generator + empowerment collapse) is not claimed novel without a real search.
[<RequireQualifiedAccess>]
module SoftEmu =

    /// The whole emulator as a soft value: a weighted ensemble of joint frames (invariant: non-empty,
    /// weights > 0, weights sum to 1 after `normalize`). CAS-less (a plain list), lockless (immutable frames).
    type Soft = (Chip8Cow.Frame * float) list

    /// How a finite soft room handles an ensemble wider than its support budget.
    [<RequireQualifiedAccess>]
    type SoftPrunePolicy =
        /// Keep every current branch and report backpressure instead of erasing futures.
        | RejectNew
        /// Keep the highest-weight branches and report the dropped tail as heat.
        | KeepHighestWeight

    /// Feedback for cold/no-forget pruning.
    [<RequireQualifiedAccess>]
    type SoftPruneFeedback =
        | SupportExceeded of limit: int * support: int

    /// Heat emitted by lossy soft-ensemble pruning.
    ///
    /// `DroppedBranches` carries the pre-renormalization branch weights that no
    /// longer participate in the ensemble. `DroppedMass` is the probability mass
    /// that had to be redistributed over the retained branches.
    type SoftEmuHeat =
        { DroppedBranches: (Chip8Cow.Frame * float) list
          DroppedSupport: int
          DroppedMass: float
          RenormalizationGain: float }

    type SoftPruneReport =
        { State: Soft
          Heat: SoftEmuHeat }

    let private EPS = 1e-12

    let emptyHeat =
        { DroppedBranches = []
          DroppedSupport = 0
          DroppedMass = 0.0
          RenormalizationGain = 1.0 }

    let private heatOf (keptMass: float) (dropped: Soft) : SoftEmuHeat =
        let droppedMass = dropped |> List.sumBy snd

        { DroppedBranches = dropped
          DroppedSupport = List.length dropped
          DroppedMass = droppedMass
          RenormalizationGain = if keptMass <= EPS then 0.0 else 1.0 / keptMass }

    let private millionths (value: float) : int64 =
        if Double.IsNaN value || Double.IsInfinity value then
            0L
        else
            int64 (Math.Round(max 0.0 value * 1_000_000.0))

    /// Compact host-facing heat signature for a lossy soft-ensemble prune.
    let heatSignature (source: string) (heat: SoftEmuHeat) : HeatSignature =
        let detail =
            sprintf
                "droppedSupport=%d;renormalizationGainPpm=%d"
                heat.DroppedSupport
                (millionths heat.RenormalizationGain)

        HeatSignature.ofMass source "soft-emu.prune" heat.DroppedSupport heat.DroppedMass detail

    /// Renormalize weights to sum to 1 (drops non-positive). Empty input ⇒ empty (no fabricated certainty).
    let normalize (s: Soft) : Soft =
        let kept = s |> List.filter (fun (_, w) -> w > 0.0)
        let total = kept |> List.sumBy snd
        if total <= EPS then []
        else kept |> List.map (fun (f, w) -> f, w / total)

    /// A point mass — the certain machine (confidence 1). The soft analog of a single concrete frame.
    let pure1 (f: Chip8Cow.Frame) : Soft = [ f, 1.0 ]

    /// Lift a concrete machine into the soft ensemble.
    let ofFrame = pure1

    /// The number of live branches (ensemble width) — the throttle's breadth signal.
    let support (s: Soft) : int = List.length s

    /// Shannon entropy (nats) over the branch weights — how uncertain the machine is about its own state.
    let entropy (s: Soft) : float =
        s |> List.sumBy (fun (_, p) -> if p <= EPS then 0.0 else -p * log p)

    /// **The soft transition: advance every branch at once.** Deterministic opcodes keep a branch a point-mass
    /// (one successor); an INPUT opcode forks it (weighted successors from `SoftChip8.forkOnInput`, scaled by
    /// the branch's weight). `RND` does NOT fork — it is seed-determined (the shared generator). Result is
    /// renormalized. This is `softStep : Soft → Soft`.
    let softStep (s: Soft) : Soft =
        s
        |> List.collect (fun (f, w) -> SoftChip8.forkOnInput f |> List.map (fun (f', p) -> f', w * p))
        |> normalize

    /// Fold `n` soft steps (the soft analog of `Chip8Cow.run`). Unbounded width — pair with `prune`.
    let softRun (n: int) (s: Soft) : Soft =
        let mutable cur = s
        for _ in 1 .. max 0 n do
            cur <- softStep cur
        cur

    /// **The throttle / breadth knob with an explicit policy.**
    ///
    /// `RejectNew` is the cold/no-forget option: if the ensemble is too wide,
    /// it returns typed backpressure and keeps the caller's state untouched.
    /// `KeepHighestWeight` is lossy by design, but emits the dropped tail as
    /// heat before renormalizing the retained branches.
    let pruneWithPolicy (policy: SoftPrunePolicy) (k: int) (s: Soft) : Result<SoftPruneReport, SoftPruneFeedback> =
        if k <= 0 || List.length s <= k then
            Ok { State = s; Heat = emptyHeat }
        else
            match policy with
            | SoftPrunePolicy.RejectNew -> Error(SoftPruneFeedback.SupportExceeded(k, List.length s))
            | SoftPrunePolicy.KeepHighestWeight ->
                let sorted = s |> List.sortByDescending snd
                let kept = sorted |> List.truncate k
                let dropped = sorted |> List.skip k
                let keptMass = kept |> List.sumBy snd

                Ok
                    { State = normalize kept
                      Heat = heatOf keptMass dropped }

    /// Lossy pruning with a heat report.
    let pruneWithHeat (k: int) (s: Soft) : SoftPruneReport =
        match pruneWithPolicy SoftPrunePolicy.KeepHighestWeight k s with
        | Ok report -> report
        | Error _ -> { State = s; Heat = emptyHeat }

    /// Emit pruning heat through an injected host/in-room IO port. No heat is
    /// emitted for cold no-op prunes; sink backpressure stays on the feedback
    /// channel so the CHIP-8 room never has to swallow its own lost futures.
    let emitHeat (source: string) (sink: IHeatSink) (report: SoftPruneReport) : Result<SoftPruneReport, HeatSinkFeedback> =
        if report.Heat.DroppedSupport = 0 then
            Ok report
        else
            sink.Emit(heatSignature source report.Heat)
            |> Result.map (fun () -> report)

    /// Lossy prune and immediately export the heat signature through the
    /// injected boundary.
    let pruneWithHeatSink
        (source: string)
        (sink: IHeatSink)
        (k: int)
        (s: Soft)
        : Result<SoftPruneReport, HeatSinkFeedback> =
        pruneWithHeat k s |> emitHeat source sink

    /// Cold/no-forget pruning: returns backpressure instead of erasing futures.
    let pruneOrBackpressure (k: int) (s: Soft) : Result<SoftPruneReport, SoftPruneFeedback> =
        pruneWithPolicy SoftPrunePolicy.RejectNew k s

    /// Compatibility state projection. Prefer `pruneWithHeat` when a caller can
    /// carry debugging heat forward.
    let prune (k: int) (s: Soft) : Soft =
        (pruneWithHeat k s).State

    /// One throttled soft step: advance, then cap width to `k` (the `FerryThrottler` breadth budget per tick).
    let throttledStepWithHeat (k: int) (s: Soft) : SoftPruneReport =
        softStep s |> pruneWithHeat k

    /// One throttled step with heat exported through an injected boundary.
    let throttledStepWithHeatSink
        (source: string)
        (sink: IHeatSink)
        (k: int)
        (s: Soft)
        : Result<SoftPruneReport, HeatSinkFeedback> =
        throttledStepWithHeat k s |> emitHeat source sink

    /// One throttled soft step projected to state only. Prefer `throttledStepWithHeat`
    /// when the dropped branch tail is diagnostically relevant.
    let throttledStep (k: int) (s: Soft) : Soft =
        (throttledStepWithHeat k s).State

    /// **Collapse — the ONE legitimate definite choice (never silent):** the single frame maximizing `value`
    /// (a fitness / empowerment fn). This is "take every branch, score, collapse to the best" (Aaron #7090).
    /// `None` on an empty ensemble. The soft emulator only ever yields a concrete machine *here*.
    let collapse (value: Chip8Cow.Frame -> float) (s: Soft) : Chip8Cow.Frame option =
        match s with
        | [] -> None
        | _ -> s |> List.maxBy (fun (f, w) -> value f * w) |> fst |> Some

    /// The maximum-weight (most-likely) branch — collapse with the trivial value fn. `None` if empty.
    let mostLikely (s: Soft) : Chip8Cow.Frame option =
        match s with
        | [] -> None
        | _ -> s |> List.maxBy snd |> fst |> Some

    /// **A soft observable:** the probability that pixel `(x,y)` is lit, summed across the ensemble — the
    /// expectation of a display cell over the whole superposition (what a soft screen would show as intensity).
    let probLit (x: int) (y: int) (s: Soft) : float =
        s |> List.sumBy (fun (f, w) -> if Chip8Cow.pixel x y f then w else 0.0)

    /// The expected value of any frame-observable over the ensemble (⟨value⟩ — the soft expectation).
    let expect (value: Chip8Cow.Frame -> float) (s: Soft) : float =
        s |> List.sumBy (fun (f, w) -> value f * w)

    /// **The live soft frame-step:** advance every branch a full frame — `cyclesPerFrame` soft steps (forking on
    /// input), then `tick` every branch (the 60 Hz interrupt). Plain `softStep`/`softRun` never `tick`, so a ROM
    /// waiting on the delay timer freezes the whole ensemble at one reachable state (empowerment → 1, the bug the
    /// 2026-06-08 run exposed). This is the unit that keeps the soft emulator *live*. Renormalized.
    let softFrame (cyclesPerFrame: int) (s: Soft) : Soft =
        let stepped = [ 1 .. max 1 cyclesPerFrame ] |> List.fold (fun acc _ -> softStep acc) s
        stepped |> List.map (fun (f, w) -> Chip8Cow.tick f, w) |> normalize

    /// **The ghost screen:** `P(pixel lit)` for every cell as a `DisplayH × DisplayW` float grid — the expected
    /// display over the whole superposition (intensity = probability). The soft analog of "watching the screen":
    /// a heatmap, not a bitmap. What you watch when you run the soft version, alongside `support`/`entropy`/
    /// empowerment.
    let probLitGrid (s: Soft) : float[][] =
        [| for y in 0 .. Chip8.DisplayH - 1 -> [| for x in 0 .. Chip8.DisplayW - 1 -> probLit x y s |] |]

    /// A fully-comparable content key for a frame (for distribution distance / dedup — `Frame` itself isn't
    /// comparable because of its `byte[]` fields).
    let private frameKey (f: Chip8Cow.Frame) =
        (int f.PC,
         [ for v in f.V -> int v ],
         int f.I,
         Map.toList f.Mem,
         Map.toList f.Display,
         f.Stack,
         int f.Delay,
         int f.Sound,
         [ for k in f.Keys -> k ],
         f.Rng)

    /// **Total-variation distance** between two soft ensembles: `½ Σ |p_a(f) − p_b(f)|` over all frames. 0 =
    /// identical distributions, 1 = disjoint support. The metric for the `t0=t∞` self-consistency search.
    let softDistance (a: Soft) (b: Soft) : float =
        let tally (s: Soft) =
            s
            |> List.fold (fun m (f, w) -> let k = frameKey f in Map.add k (w + (Map.tryFind k m |> Option.defaultValue 0.0)) m) Map.empty
        let ma, mb = tally a, tally b
        let keys = Set.union (ma |> Map.toSeq |> Seq.map fst |> Set.ofSeq) (mb |> Map.toSeq |> Seq.map fst |> Set.ofSeq)
        0.5
        * (keys
           |> Seq.sumBy (fun k ->
               abs ((Map.tryFind k ma |> Option.defaultValue 0.0) - (Map.tryFind k mb |> Option.defaultValue 0.0))))

    /// **The `t0=t∞` stationary soft state:** iterate the (caller-supplied, bounded) soft step to its
    /// self-consistent fixed point `s = step s` under `softDistance` — the closed-time-loop state of the soft
    /// emulator (Aaron's t0=t∞ on the ensemble; the soft analog of `Fixpoint`/`Orbit`). Use a *pruned* step
    /// (e.g. `fun s -> softFrame cyc s |> prune width`) so the ensemble stays bounded and a fixed point can exist.
    /// Returns the `Fixpoint.FixResult` (state + whether it converged + residual + iterations).
    let stationary (step: Soft -> Soft) (tol: float) (maxIter: int) (s0: Soft) : Fixpoint.FixResult<Soft> =
        Fixpoint.solve softDistance step tol maxIter s0
