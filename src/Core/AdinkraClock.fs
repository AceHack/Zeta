namespace Zeta.Core

/// **`AdinkraClock` — the fork-probe experiment (Aaron 2026-07-11, shadow\*: "lets try this").**
///
/// The question (`docs/research/2026-07-11-where-does-the-adinkra-clock-come-from…`): does the SUSY
/// time-translation `∂_τ = {Q,Q}` **fall out as a `VirtualTimeScheduler.AdvanceBy`** (time = an
/// *injected* Rx-style scheduler, the "A-when-run" / DeSmet-scheduler reading), or is `∂_τ`
/// **intrinsic to the static graph** (the "B / just-remains" reading)?
///
/// This probes it on the minimal **N=1 adinkra (valise)**: one boson φ (height 0), one fermion ψ
/// (height 1), one supercharge `Q`:
///   - `Q(φ) = ψ`         — *up*-edge (raise height): NO time derivative.
///   - `Q(ψ) = ∂_τ φ`     — *down*-edge (lower height): emits ONE `∂_τ`.
/// So `{Q,Q}φ = Q²φ = ∂_τ φ` — the round-trip φ→ψ→φ̇ produces exactly one `∂_τ`. The probe models a
/// down-edge (a `∂_τ`) as **one `scheduler.AdvanceBy(1)`** and asks whether the clock the round-trip
/// makes equals the scheduler advance.
///
/// **Honest scope (peel — this is a TOY, not a proof).** It shows the mapping is *natural and
/// consistent* (weak pressure), NOT that the adinkra *is* an Rx observable. The verdict it lands on
/// (see `Verdict`) is the **layering**: the *structure* (which moves, in what order → the `∂_τ` count)
/// is **intrinsic** to the graph and computable with NO scheduler (B); the *clock metric* (the τ
/// coordinate) is **injectable** and falls out as scheduler advance (A-when-run); and the two
/// **agree**. So time is neither in layer B nor layer A — it is the **B→A transition** (running the
/// intrinsic structure under an injected scheduler). Held `Tri.N`; routed to the Rx-guys / math team
/// (DeSmet on schedulers, Beckman on the physics) for the real check. Deterministic (DST §7).
[<RequireQualifiedAccess>]
module AdinkraClock =

    /// The two fields of the minimal N=1 adinkra (valise): boson (height 0), fermion (height 1).
    type Field =
        | Boson
        | Fermion

    /// Adinkra field state: the current field, and the accumulated worldline time-derivative order
    /// (`DTauOrder` = how many `∂_τ` the round-trips have produced — the *intrinsic* physical count,
    /// carried in the state itself, independent of any clock).
    type State = { Field: Field; DTauOrder: int }

    /// The vacuum: a boson, no time-derivatives applied.
    let initial: State = { Field = Boson; DTauOrder = 0 }

    /// One supercharge move `Q`. Returns the new state and whether it was a **down-edge** (a `∂_τ`, i.e.
    /// a clock tick): `Q(Boson) = Fermion` (up, no tick); `Q(Fermion) = ∂_τ(Boson)` (down, one tick).
    let step (s: State) : State * bool =
        match s.Field with
        | Boson -> { s with Field = Fermion }, false
        | Fermion -> { Field = Boson; DTauOrder = s.DTauOrder + 1 }, true

    /// Run one `Q` against an **injected** `VirtualTimeScheduler`: a down-edge (`∂_τ`) is modeled as one
    /// `AdvanceBy(1)`. The clock is NOT in the state — it is the injected scheduler.
    let stepScheduled (scheduler: VirtualTimeScheduler) (s: State) : State =
        let s', tick = step s
        if tick then scheduler.AdvanceBy(1L)
        s'

    /// `{Q,Q}` on the vacuum = `Q²` = the round-trip φ→ψ→φ̇ (two `Q` moves, one `∂_τ`), driven through the
    /// scheduler. Returns the final state and the clock advance observed (`scheduler.Now` delta).
    let anticommutatorTick (scheduler: VirtualTimeScheduler) : State * int64 =
        let t0 = scheduler.Now
        let s1 = stepScheduled scheduler initial
        let s2 = stepScheduled scheduler s1
        s2, scheduler.Now - t0

    /// The **intrinsic** run (NO scheduler): fold `n` supercharge moves purely over the graph structure,
    /// returning the final state. Proves the `∂_τ` *count* is computable with no clock — layer B.
    let runIntrinsic (n: int) : State =
        let mutable s = initial
        for _ in 1..n do
            s <- fst (step s)
        s

    /// The honest verdict of the probe (a label, not a proof).
    type Verdict =
        /// Structure intrinsic (B) AND clock falls out as injected scheduler advance (A-when-run), and
        /// they agree — time is the B→A transition (running the remains under an injected scheduler).
        | LayeringBToA
        /// The clock could not be modeled as an injected scheduler advance (would pressure strict-B).
        | ClockResistsInjection
        /// The structure could not be computed without the clock (would pressure strict-A).
        | StructureNeedsClock

    /// Run the probe: do `k` round-trips through an injected scheduler, and separately compute the same
    /// `∂_τ` count purely from the graph (no scheduler). Returns the verdict + the two counts.
    ///
    /// **⚠ SELF-REVIEW (shadow, 2026-07-11): this verdict is TAUTOLOGICAL by construction — it does NOT
    /// discriminate the fork.** `injectedClock` counts down-edges (the scheduler ticks on each) and
    /// `intrinsic` (`DTauOrder`) *also* counts down-edges — the same integer `k` by two paths, because
    /// `stepScheduled` wires the tick to the exact move that increments the count. So the equality
    /// always holds, `LayeringBToA` is returned unconditionally, and the other two branches are
    /// **unreachable dead code**. What this legitimately shows: the mapping `∂_τ = AdvanceBy(1)` is
    /// *self-consistent / available* (necessary, not sufficient). What it does NOT show: any preference
    /// between homoiconic-A and just-remains-B — the coincidence is wired in, not derived. A real
    /// discriminator must compute clock and structure by *independent* routes. Routed to the math team:
    /// workitem `081KX93R6EF08QG0R0020AQQWZ`.
    let probe (k: int) : Verdict * int64 * int =
        let scheduler = VirtualTimeScheduler()
        // A-when-run: drive k round-trips; each round-trip = one ∂_τ = one AdvanceBy(1).
        let mutable s = initial
        for _ in 1..k do
            s <- stepScheduled scheduler s // up
            s <- stepScheduled scheduler s // down (tick)
        let injectedClock = scheduler.Now
        // B: the same ∂_τ count from the pure graph, no scheduler.
        let intrinsic = (runIntrinsic (2 * k)).DTauOrder
        // The verdict: structure computed without a clock (B holds) AND clock = injected advance
        // (A-when-run holds) AND they agree ⇒ the layering.
        let verdict =
            if int64 intrinsic = injectedClock then LayeringBToA
            elif injectedClock = 0L && intrinsic > 0 then ClockResistsInjection
            else StructureNeedsClock
        verdict, injectedClock, intrinsic

    // ── Lumen's Q4 discriminator (letter from-lumen-adinkra-clock-fork-homoiconic, 2026-07-11):
    // metric-freeness = invariance of the causal trace under a monotonic rescale of the injected
    // metric. UNLIKE `probe` above, this is a REAL discriminator — it returns FALSE for a step that
    // reads the clock (the negative control), so it can actually fail. This is the honest repair of
    // the tautology. Workitem 081KX93R6EF08QG0R0020AQQWZ Q4.
    //
    // Vernacular (Aaron 2026-07-11): this IS **frames-per-second**. The causal trace is the *frame
    // sequence* (which frames, in what order — the animation itself, topological); the metric is the
    // *duration* between frames = 1/fps ("more frames → shorter metric duration"). Same animation at
    // 24 fps or 60 fps ⇒ metric-free ⇒ Layer B holds. The general statement is even stronger than
    // constant-fps: it allows *variable*-rate playback (slow-mo → fast-forward) and still the same
    // sequence — same shape as proper time / the two-orders guard (#9709): the causal order is shared
    // and invariant, the fps/clock is local and rescalable. ──

    /// A step whose down-edge advances the injected scheduler by `metric` ticks. The `metric` is the
    /// *duration* of a tick; whether the STATE reads it is what the discriminator tests.
    /// `stepPure`: the real adinkra step — advances the clock but the state NEVER reads it (metric-free
    /// by construction; Layer B holds).
    let stepPure (metric: int64) (scheduler: VirtualTimeScheduler) (s: State) : State =
        let s', tick = step s
        if tick then scheduler.AdvanceBy(metric)
        s'

    /// NEGATIVE CONTROL — a Layer-B-**violating** step: after ticking, it overwrites `DTauOrder` with
    /// the injected metric (`scheduler.Now`) instead of the topological count. Its trace therefore
    /// DEPENDS on the metric, so `isMetricFree` must report it `false`. This is what proves the
    /// discriminator is not tautological: it distinguishes this from `stepPure`.
    let stepMetricDependent (metric: int64) (scheduler: VirtualTimeScheduler) (s: State) : State =
        let s', tick = step s
        if tick then scheduler.AdvanceBy(metric)
        { s' with DTauOrder = int scheduler.Now }

    /// The causal trace: the sequence of `State`s from folding `n` moves under a down-edge duration of
    /// `metric` ticks. The topological content, which a metric-free structure leaves invariant.
    let traceUnder (stepFn: int64 -> VirtualTimeScheduler -> State -> State) (metric: int64) (n: int) : State list =
        let scheduler = VirtualTimeScheduler()
        let mutable s = initial
        [ for _ in 1..n do
            s <- stepFn metric scheduler s
            yield s ]

    /// **Lumen's Q4 metric-freeness discriminator.** `stepFn` is metric-free (Layer B holds) iff its
    /// causal trace is invariant under a monotonic rescale of the injected tick duration (here 1 vs 7).
    /// Returns `true` for `stepPure` (the real adinkra — metric-free) and `false` for
    /// `stepMetricDependent` (reads the clock — Layer B violated). A genuine test: it can fail.
    let isMetricFree (stepFn: int64 -> VirtualTimeScheduler -> State -> State) (n: int) : bool =
        traceUnder stepFn 1L n = traceUnder stepFn 7L n
