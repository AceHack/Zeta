namespace Zeta.Core

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
/// truncation (the dropped tail is logged by `support` shrinking, not silently). No per-cell factoring here
/// (that is the further mean-field compression; this ensemble keeps correlations exact at the cost of width).
/// Prior art anchors: symbolic execution (KLEE/angr — fork-on-branch), probabilistic-program semantics (Kozen),
/// planning over emulator state (ALE/MuZero — take-every-branch-score-collapse). The *synthesis* (exact
/// semantics + DST-seed shared generator + empowerment collapse) is not claimed novel without a real search.
[<RequireQualifiedAccess>]
module SoftEmu =

    /// The whole emulator as a soft value: a weighted ensemble of joint frames (invariant: non-empty,
    /// weights > 0, weights sum to 1 after `normalize`). CAS-less (a plain list), lockless (immutable frames).
    type Soft = (Chip8Cow.Frame * float) list

    let private EPS = 1e-12

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

    /// **The throttle / breadth knob:** keep at most `k` highest-weighted branches, renormalize. Lossy by
    /// design — the dropped tail shows up as `support` no longer doubling (not silent). `k ≤ 0` ⇒ unchanged.
    let prune (k: int) (s: Soft) : Soft =
        if k <= 0 || List.length s <= k then s
        else s |> List.sortByDescending snd |> List.truncate k |> normalize

    /// One throttled soft step: advance, then cap width to `k` (the `FerryThrottler` breadth budget per tick).
    let throttledStep (k: int) (s: Soft) : Soft = softStep s |> prune k

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
