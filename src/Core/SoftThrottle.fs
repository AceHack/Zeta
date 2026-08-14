namespace Zeta.Core

/// SoftThrottle — the SOFT throttle knob: "how can we make our throttler soft? then it really will be
/// the flux capacitor" (Aaron 2026-06-10).
///
/// A HARD throttle is a step function: under the ceiling admit, over it reject — a resistor/clipper.
/// A SOFT throttle replaces the wall with a **gradient + a tank**:
///   • **admission** is a smooth harmonic function of pressure (a sigmoid — backpressure becomes a
///     *gradient*, the coupled-oscillator reading of the four-corner feedback, not a binary wall);
///   • **capacity** is a **capacitor of flux** (the literal flux capacitor): it CHARGES while idle and
///     DISCHARGES in bursts — an LC-tank shape (the harmonic oscillator of charge), so the throttle can
///     resonate with the workload's natural rhythm (the time-crystal) instead of clipping it.
///
/// **The Y-junction / time-travel reading (why "flux capacitor" is exact, not a joke):** the throttler
/// sits at the junction of three time-legs — the COMMITTED PAST (the event store), the SPECULATIVE
/// FUTURE (the branch tree; `SoftChip8.lookAhead` — the throttler already "decides how many timesteps to
/// batch"), and the PRESENT crossing (input resolving the forks). Throttling speculative depth IS
/// throttling travel into the future; retraction (the Z-set −1, the antiparticle) is the trip back. The
/// soft throttle governs the flux between the three legs.
///
/// **Look-don't-infer (Aaron's catch):** `FerryThrottler` already throttles AND batches — and its
/// batching core is *already codenamed* **the Flux Capacitor** (`FerryThrottler.fs`: accumulate queued
/// items, discharge them as a *boat* the instant a ferry frees). **The batching algorithm is Aaron's own
/// invention** — his alternative to Nagle: **it never waits, no timeout, ever** — under slow traffic a
/// boat of one sails immediately (zero added latency); under bursts the boat is simply whatever
/// accumulated while the ferry was busy. (Independent invention; nearest named kin: Martin Thompson's
/// "smart batching"; deeper root: Van Jacobson's self-clocking. Nagle waits on a timer — Aaron's never
/// does.) That is the **hard** flux capacitor: real boats, hard config knobs. THIS module is the **soft**
/// half that completes the name — the gradient admission + the charged tank — so the throttle "really
/// will be the flux capacitor": hard boats below, soft flux above.
///
/// Pure module, deterministic (DST §7): "probabilistic" admission derives from `SplitMix64.mix (seed,
/// tick)` — same seed, same decisions, replay-equal. Additive (FerryThrottler untouched — this is the
/// knob it can consume; per the 081KTQD8A0008QG0R0005EFYPV razor, no rewrite).
[<RequireQualifiedAccess>]
module SoftThrottle =

    /// Admission probability under `pressure` (0 = idle, 1 = nominal full, >1 = overloaded): a smooth
    /// logistic gradient centered at pressure = 1 with steepness `k`. At pressure 0 ≈ admit-always; at 1 =
    /// exactly ½; far above 1 → admit-rarely — but NEVER a hard 0/1 wall (the gradient is the softness).
    let admissionProbability (k: float) (pressure: float) : float =
        1.0 / (1.0 + exp (k * (pressure - 1.0)))

    /// The deterministic admission decision at (seed, tick) under `pressure` — soft in distribution, hard
    /// in replay: `mix(seed, tick)` supplies the deterministic "coin", so the same run admits the same
    /// ticks (DST), while across ticks the admit-rate tracks `admissionProbability`.
    let admit (k: float) (seed: int64) (tick: int) (pressure: float) : bool =
        let p = admissionProbability k pressure
        let h = SplitMix64.mix (uint64 seed + uint64 tick * SplitMix64.GoldenRatio)
        // map the top 53 bits to [0,1) — the deterministic uniform draw
        let u = float (h >>> 11) / float (1UL <<< 53)
        u < p

    /// The HARD admission — the k→∞ limit of `admit`: the logistic collapses to a step function (under
    /// nominal pressure admit, at/over it reject). With the `Tank` (a float-generalized token bucket)
    /// this is the classic hard rate limiter — the hard register as a *limit case* of the soft one
    /// (default-to-both: one mechanism, both registers; dual-use hard/soft).
    let admitHard (pressure: float) : bool = pressure < 1.0


    /// The flux tank — the capacitor: charges while idle (up to `Capacity`), discharges on bursts. The
    /// LC-tank half of the flux capacitor: stored flow-capacity, not a fixed ceiling.
    type Tank =
        { Capacity: float // max stored flux
          Charge: float // current stored flux
          ChargeRate: float } // flux gained per idle tick

    /// A fresh tank, fully charged.
    let tank (capacity: float) (chargeRate: float) : Tank =
        { Capacity = max 0.0 capacity
          Charge = max 0.0 capacity
          ChargeRate = max 0.0 chargeRate }

    /// One idle tick: the tank charges toward capacity (never beyond).
    let charge (t: Tank) : Tank =
        { t with Charge = min t.Capacity (t.Charge + t.ChargeRate) }

    /// Try to discharge `amount` for a burst: `Some tank'` if the stored flux covers it, else `None`
    /// (the burst waits — but note this is the TANK's no, not a wall: the caller can take a smaller sip).
    let discharge (amount: float) (t: Tank) : Tank option =
        if amount <= t.Charge then Some { t with Charge = t.Charge - amount } else None

    /// The largest burst the tank can serve right now (take a sip instead of being refused — the soft
    /// alternative to a hard reject).
    let available (t: Tank) : float = t.Charge

    // ── flux IS heat (Aaron 2026-06-11) ──
    // The flux spent funding speculation IS the heat dissipated (Landauer/attention — the cost of
    // exploring the branch tree forward). The reversible CUT pays no heat (history is kept), but the
    // EXPLORATION does — that resolves the apparent paradox: commit = free, speculation = heat. Charging
    // while idle = COOLING (radiating budget back); running out = the THERMAL CEILING.

    /// Heat dissipated so far — the flux discharged from a full tank (the instantaneous heat-debt).
    let heatSpent (t: Tank) : float = max 0.0 (t.Capacity - t.Charge)

    /// Cooling headroom — the flux remaining before the thermal ceiling (= `available`, named for heat).
    let coolingHeadroom (t: Tank) : float = t.Charge

    /// **The limiter — Aaron's original Itron abstraction, ported.** In his `Platform.DotNet`
    /// `Threading.Tasks.Throttling`, the batch limiter is a **stateful fold delegate**:
    /// `BatchSizeLimiter<TItem, TState> = (item, state) → (fits?, state')` — pluggable over ANY
    /// accumulated measure (his count limiter is literally `state < batchSize, state + 1`; bytes is the
    /// same fold over sizes). This is that delegate in F#.
    type Limiter<'a, 's> = 'a -> 's -> bool * 's

    /// **The boat — Aaron's zero-wait batch, generalized over his limiter.** Take items (arrival order,
    /// never waits, no timeout) while the limiter says they fit, folding its state; stop the instant one
    /// doesn't. Returns (boat, remaining, finalState).
    ///
    /// **Conservation (locked by test): `boat @ remaining = items`, exactly.** The non-boarding items are
    /// HANDED BACK to the caller, never dropped — deferral, not annihilation. Under the `SchedulerZeta`
    /// test (*"because the fixed points are derived, drop-and-recompute is lossless"*) that makes a full
    /// boat **pressure**, never loss. See `SchedulerShedHeat.throttlePressure`.
    let boat (limiter: Limiter<'a, 's>) (items: 'a list) (s0: 's) : 'a list * 'a list * 's =
        let rec go acc rest s =
            match rest with
            | [] -> List.rev acc, [], s
            | x :: xs ->
                match limiter x s with
                | true, s' -> go (x :: acc) xs s'
                // SHED: soft-throttle-boat-close class=pressure metered=no
                // NOT loss: `rest` (the unboarded tail, `x` included) is RETURNED, so
                // the partition is exact and the caller retains every item. Nothing
                // was annihilated, so nothing needs a loss meter.
                | false, _ -> List.rev acc, rest, s

        go [] items s0

    /// Aaron's original count limiter (`state < batchSize, state + 1`), verbatim in F#.
    let countLimiter (batchSize: int) : Limiter<'a, int> =
        fun _ n -> (n < batchSize), n + 1

    /// **The BYTE limiter over the soft tank — "it meters the future in BYTES, literally" (Aaron).**
    /// `FerryThrottler` already sizes boats by serialized bytes (`MaxBatchBytes` + `itemSizeBytes` —
    /// Aaron's tracking unit); here the ceiling is the **charged tank**, not a constant: an item fits iff
    /// the tank funds its bytes (discharging as it boards). Bytes = information — the Bekenstein unit:
    /// the speculative future you may visit is bounded in information, exactly like the room interior.
    let bytesTankLimiter (sizeOf: 'a -> int) : Limiter<'a, Tank> =
        fun x t ->
            match discharge (float (max 0 (sizeOf x))) t with
            | Some t' -> true, t'
            | None -> false, t

    /// The byte-metered boat (the bytes-tank limiter applied): (boat, remaining, tank').
    let boatBytes (sizeOf: 'a -> int) (items: 'a list) (t: Tank) : 'a list * 'a list * Tank =
        boat (bytesTankLimiter sizeOf) items t

    /// The flux-capacitor step: given pressure and a desired burst, the soft throttle either serves the
    /// burst from the tank (discharging), serves what it CAN (the sip), or charges (idle). Deterministic.
    /// Returns (servedAmount, tank').
    let step (k: float) (seed: int64) (tick: int) (pressure: float) (want: float) (t: Tank) : float * Tank =
        if want <= 0.0 then
            0.0, charge t
        elif admit k seed tick pressure then
            match discharge want t with
            | Some t' -> want, t'
            | None ->
                // SHED: soft-throttle-step-sip class=pressure metered=no
                // NOT loss: the shortfall is `want - served`, and the caller supplied
                // `want` — it still holds both halves. A scalar deficit the caller can
                // recompute is deferral, so this is pressure at most.
                let sip = available t
                sip, { t with Charge = 0.0 }
        else
            0.0, charge t

    // ── The scheduler tie-in (Aaron: "and tie it into our scheduler") — additive, the wrap ──

    /// A scheduler state carrying its flux tank + tick counter alongside the inner room state.
    type Throttled<'S> =
        { Inner: 'S
          Tank: Tank
          Tick: int
          Served: int // how many matched arrivals actually ran (admitted + funded)
          Skipped: int } // how many were softly skipped (gradient said no / tank dry)

    /// Wrap a room state for throttled driving.
    let throttled (inner: 'S) (t: Tank) : Throttled<'S> =
        { Inner = inner; Tank = t; Tick = 0; Served = 0; Skipped = 0 }

    /// Wrap a `SoftScheduler.Handler<'S>` into a throttled `Handler<Throttled<'S>>`: on each matched
    /// arrival the flux capacitor decides — the harmonic gradient admits (deterministically from
    /// (seed, tick)) AND the tank funds `cost`, then the inner ISR runs and the tank discharges;
    /// otherwise the arrival is *softly skipped* (inner state untouched, tank charges, the room keeps
    /// breathing). `pressure` reads the current pressure off the inner state. The SCHEDULER IS UNTOUCHED
    /// — softness arrives by wrapping (the 081KTQD8A0008QG0R0005EFYPV razor: instantiation, not refactor).
    ///
    /// **A soft skip is PRESSURE, never loss** (locked by test). `Inner` is carried through
    /// bit-for-bit — the wrapper never held the arrival as data in the first place (`Handler.Run` is
    /// `ISR<'S,'S>`; it cannot see the crossing), and `SoftScheduler.Source` is `int -> InterruptKind list`,
    /// a pure function of the tick the scheduler retains for the whole run. So the skipped arrival is
    /// derived, drop-and-recompute is lossless, and `Served + Skipped = Tick` holds every tick — nothing
    /// is annihilated to pay for. `SchedulerShedHeat.throttlePressure` reads `Skipped` as backpressure.
    let wrapHandler
        (k: float)
        (seed: int64)
        (cost: float)
        (pressure: 'S -> float)
        (h: SoftScheduler.Handler<'S>)
        : SoftScheduler.Handler<Throttled<'S>> =
        SoftScheduler.handler (h.Name + "-soft-throttled") h.Matches (fun ctx st ->
            task {
                let p = pressure st.Inner
                if admit k seed st.Tick p then
                    match discharge cost st.Tank with
                    | Some tank' ->
                        let! r = h.Run ctx st.Inner
                        return
                            r
                            |> Result.map (fun inner' ->
                                { st with
                                    Inner = inner'
                                    Tank = tank'
                                    Tick = st.Tick + 1
                                    Served = st.Served + 1 })
                    | None ->
                        // SHED: soft-throttle-skip-dry-tank class=pressure metered=yes
                        // tank dry — soft skip; charge and move on (no hard failure).
                        // `Inner` unchanged ⇒ nothing annihilated ⇒ pressure (Skipped).
                        return
                            Ok
                                { st with
                                    Tank = charge st.Tank
                                    Tick = st.Tick + 1
                                    Skipped = st.Skipped + 1 }
                else
                    // SHED: soft-throttle-skip-gradient class=pressure metered=yes
                    // gradient said not-now — soft skip; charge.
                    // `Inner` unchanged ⇒ nothing annihilated ⇒ pressure (Skipped).
                    return
                        Ok
                            { st with
                                Tank = charge st.Tank
                                Tick = st.Tick + 1
                                Skipped = st.Skipped + 1 }
            })
