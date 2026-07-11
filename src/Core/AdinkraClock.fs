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
    /// `∂_τ` count purely from the graph (no scheduler). Returns the verdict + the two counts, which must
    /// AGREE for `LayeringBToA`. This is the whole experiment, made checkable.
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
