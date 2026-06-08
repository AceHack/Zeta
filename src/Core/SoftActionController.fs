namespace Zeta.Core

/// **`SoftActionController` — the soft value AS the controller for the hard (DynamicValue) emulator (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"can we make the DynamicValue version that uses the soft value as a controller?"* — this is it. The
/// **hard `Chip8Cow` emulator is the DynamicValue version** (concrete frames = resolved definite values); the
/// **controller is a `SoftValue` over actions** — a calibrated distribution that is *resolved* each frame to the
/// concrete key that drives the hard step. This applies the [[SoftValue]] **never-falsely-certain** discipline to
/// *control*: score each candidate action by its soft empowerment/value rollout → softmax into a distribution
/// (the soft controller) → **commit the top action only when confidence ≥ threshold, else HOLD** (do nothing).
///
/// **Why this is the right shape:** the idling the earlier runs showed isn't a bug — it's *calibration*. When no
/// action discriminates (a deterministic phase, all rollouts tie), the action distribution is ~uniform,
/// confidence is low, and the controller correctly **holds** rather than acting on noise. It acts exactly when
/// the soft value is *confident* one action opens more future than the others. Soft plans → resolves → hard acts:
/// `SoftValue.resolve → DynamicValue`, lifted to the control loop (the recursion, #7100, made calibrated).
///
/// **Honest scope (peel):** greedy first-action search over 17 actions (`none`+16 keys), not full tree search;
/// the empowerment horizon (`depth`) must be deep enough to discriminate or it holds forever (the weak-player
/// caveat — calibration makes idling *honest*, not *good*). Softmax `temperature` and `threshold` are knobs, not
/// derived. Deterministic (DST §7). Cost ~ `actions · depth · width` soft frames per decision.
[<RequireQualifiedAccess>]
module SoftActionController =

    let private actions: bool[] list =
        SoftController.none :: [ for k in 0..15 -> SoftController.singleKey k ]

    /// Score each candidate action by the expected `value` over its `depth`-frame soft rollout (frame-aware).
    let actionScores
        (value: Chip8Cow.Frame -> float)
        (cyclesPerFrame: int)
        (depth: int)
        (width: int)
        (hard: Chip8Cow.Frame)
        : (bool[] * float) list =
        actions
        |> List.map (fun keys ->
            let started = Chip8Cow.frameStep cyclesPerFrame { hard with Keys = keys }
            let mutable s = SoftEmu.pure1 started
            for _ in 1 .. max 0 depth do
                s <- SoftEmu.softFrame cyclesPerFrame s |> SoftEmu.prune width
            keys, SoftEmu.expect value s)

    /// **The soft controller = a `SoftValue` over actions:** softmax the rollout scores into a normalized
    /// distribution over the candidate actions (stabilized; `temperature → 0` sharpens to argmax, `→ ∞` uniform).
    let actionDistribution
        (temperature: float)
        (value: Chip8Cow.Frame -> float)
        (cyclesPerFrame: int)
        (depth: int)
        (width: int)
        (hard: Chip8Cow.Frame)
        : (bool[] * float) list =
        let scores = actionScores value cyclesPerFrame depth width hard
        let t = max 1e-9 temperature
        let m = scores |> List.map snd |> List.max
        let exps = scores |> List.map (fun (k, s) -> k, exp ((s - m) / t))
        let z = exps |> List.sumBy snd
        if z <= 1e-12 then scores |> List.map (fun (k, _) -> k, 1.0 / float (List.length scores))
        else exps |> List.map (fun (k, e) -> k, e / z)

    /// Confidence = the probability mass on the most-likely action (1.0 = a point mass; `1/17` = uniform/no idea).
    let confidence (dist: (bool[] * float) list) : float =
        match dist with
        | [] -> 0.0
        | _ -> dist |> List.map snd |> List.max

    /// **Resolve the soft controller to a concrete action (the calibrated collapse):** commit the top action iff
    /// its confidence ≥ `threshold`; otherwise **HOLD** (`none`) — never act on an uncertain distribution. This is
    /// `SoftValue.resolve` for control: the only place the soft value becomes a definite (DynamicValue) action.
    let resolve
        (threshold: float)
        (temperature: float)
        (value: Chip8Cow.Frame -> float)
        (cyclesPerFrame: int)
        (depth: int)
        (width: int)
        (hard: Chip8Cow.Frame)
        : bool[] =
        let dist = actionDistribution temperature value cyclesPerFrame depth width hard
        let best, _ = dist |> List.maxBy snd
        if confidence dist >= threshold then best else SoftController.none

    /// **Drive the hard (DynamicValue) emulator with the soft value as controller:** each frame, resolve the soft
    /// action and commit one live `frameStep`. Holds when not confident. Deterministic.
    let drive
        (threshold: float)
        (temperature: float)
        (value: Chip8Cow.Frame -> float)
        (cyclesPerFrame: int)
        (depth: int)
        (width: int)
        (frames: int)
        (hard: Chip8Cow.Frame)
        : Chip8Cow.Frame =
        let mutable cur = hard
        for _ in 1 .. max 0 frames do
            let keys = resolve threshold temperature value cyclesPerFrame depth width cur
            cur <- Chip8Cow.frameStep cyclesPerFrame { cur with Keys = keys }
        cur
