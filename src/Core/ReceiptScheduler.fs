namespace Zeta.Core

open System.Threading.Tasks

/// **ReceiptScheduler — ComputeReceipt-aware SoftScheduler wrapper (Lumen/Aaron, 2026-07-04).**
///
/// Follows the `SoftThrottle.Throttled<'S>` / `PredictionScheduler.Planned<'S>` wrapper pattern:
/// the scheduler itself is UNTOUCHED — the `ComputeReceipt` feedback arrives by wrapping the
/// handler state, not by refactoring `SoftScheduler`.
///
/// **The four-corner closure:**
///   - Input: the interrupt arrival (the tick source firing).
///   - Output: the updated inner state.
///   - Feedback (backward): the `ComputeReceipt` emitted by the inner handler.
///   - Adaptation: `DeltaU`-driven backoff — if `DeltaU < 0` (wasted compute), the handler
///     records a "heat tick" and the caller can read `HeatTicks` to decide to slow down.
///
/// **Eve's small-rooms principle (§A #16):** each wrapped handler is a small room. The receipt
/// tells you exactly what went wrong (IV ≈ 0 → heat, IV > DeltaJ → profitable). The `Entropy`
/// field tells you how much is still unknown after the tick.
///
/// **Design decisions:**
///   - `DeltaJ = 1.0` per tick (one abstract joule). The caller can override via `costPerTick`.
///   - `onReceipt` is an optional callback — if `None`, receipts are accumulated silently.
///   - `HeatTicks` counts ticks where `DeltaU < 0` (wasted compute).
///   - `ProfitTicks` counts ticks where `DeltaU > 0` (useful compute).
///   - The wrapper does NOT skip ticks (unlike `SoftThrottle`) — it records and reports.
///     Skipping is the caller's decision (use `HeatTicks / TotalTicks` as a pressure signal).
[<RequireQualifiedAccess>]
module ReceiptScheduler =

    /// A scheduler state carrying ComputeReceipt telemetry alongside the inner room state.
    type Receipted<'S> =
        { /// The inner room state.
          Inner: 'S
          /// The tick counter (total ticks processed by this wrapper).
          Tick: int
          /// Ticks where DeltaU < 0 (wasted compute — IV < DeltaJ).
          HeatTicks: int
          /// Ticks where DeltaU > 0 (profitable compute — IV > DeltaJ).
          ProfitTicks: int
          /// The last receipt emitted (None before the first tick).
          LastReceipt: ComputeReceipt.Receipt option
          /// Accumulated total IV across all ticks.
          TotalIV: float
          /// Accumulated total DeltaJ across all ticks.
          TotalDeltaJ: float }

    /// Build the initial wrapper state.
    let receipted (inner: 'S) : Receipted<'S> =
        { Inner = inner
          Tick = 0
          HeatTicks = 0
          ProfitTicks = 0
          LastReceipt = None
          TotalIV = 0.0
          TotalDeltaJ = 0.0 }

    /// The LandauerRatio of the run so far: TotalDeltaJ / max(TotalIV, ε).
    /// 1.0 = at the Landauer limit. Higher = less efficient.
    let landauerRatio (st: Receipted<'S>) : float =
        let eps = 1e-12
        st.TotalDeltaJ / (max st.TotalIV eps)

    /// The heat fraction: HeatTicks / max(Tick, 1).
    /// 0.0 = all ticks were profitable. 1.0 = all ticks were wasted.
    let heatFraction (st: Receipted<'S>) : float =
        float st.HeatTicks / float (max st.Tick 1)

    /// Wrap a `SoftScheduler.Handler<'S>` into a receipt-aware `Handler<Receipted<'S>>`.
    ///
    /// On each matched arrival:
    ///   1. Run the inner handler.
    ///   2. Compute a `ComputeReceipt` using the provided `ivFn` (a function that computes
    ///      the IV gained from the state transition: `'S -> 'S -> float`).
    ///   3. Update the wrapper state with the receipt.
    ///   4. Call `onReceipt` if provided.
    ///
    /// `ivFn prior posterior` — computes the IV (KL divergence) from the state transition.
    /// `costPerTick` — abstract joules per tick (default: 1.0).
    /// `entropyFn posterior` — computes H(posterior) in nats (default: 0.0).
    /// `onReceipt` — optional callback for receipt telemetry (e.g. Prometheus export).
    let wrapHandler
        (ivFn: 'S -> 'S -> float)
        (costPerTick: float)
        (entropyFn: 'S -> float)
        (onReceipt: (ComputeReceipt.Receipt -> unit) option)
        (h: SoftScheduler.Handler<'S>)
        : SoftScheduler.Handler<Receipted<'S>> =
        SoftScheduler.handler (h.Name + "-receipted") h.Matches (fun ctx st ->
            task {
                let prior = st.Inner
                let! result = h.Run ctx prior
                return
                    result
                    |> Result.map (fun posterior ->
                        let iv = ivFn prior posterior
                        let entropy = entropyFn posterior
                        let receipt = ComputeReceipt.fromIV iv costPerTick entropy
                        match onReceipt with
                        | Some cb -> cb receipt
                        | None -> ()
                        { st with
                            Inner = posterior
                            Tick = st.Tick + 1
                            HeatTicks = if receipt.DeltaU < 0.0 then st.HeatTicks + 1 else st.HeatTicks
                            ProfitTicks = if receipt.DeltaU > 0.0 then st.ProfitTicks + 1 else st.ProfitTicks
                            LastReceipt = Some receipt
                            TotalIV = st.TotalIV + iv
                            TotalDeltaJ = st.TotalDeltaJ + costPerTick })
            })

    /// Wrap an arrival-aware `SoftScheduler.HandlerK<'S>` into a receipt-aware `HandlerK<Receipted<'S>>`.
    let wrapHandlerK
        (ivFn: 'S -> 'S -> float)
        (costPerTick: float)
        (entropyFn: 'S -> float)
        (onReceipt: (ComputeReceipt.Receipt -> unit) option)
        (h: SoftScheduler.HandlerK<'S>)
        : SoftScheduler.HandlerK<Receipted<'S>> =
        SoftScheduler.handlerK (h.Name + "-receipted") h.Matches (fun intr ctx st ->
            task {
                let prior = st.Inner
                let! result = h.RunK intr ctx prior
                return
                    result
                    |> Result.map (fun posterior ->
                        let iv = ivFn prior posterior
                        let entropy = entropyFn posterior
                        let receipt = ComputeReceipt.fromIV iv costPerTick entropy
                        match onReceipt with
                        | Some cb -> cb receipt
                        | None -> ()
                        { st with
                            Inner = posterior
                            Tick = st.Tick + 1
                            HeatTicks = if receipt.DeltaU < 0.0 then st.HeatTicks + 1 else st.HeatTicks
                            ProfitTicks = if receipt.DeltaU > 0.0 then st.ProfitTicks + 1 else st.ProfitTicks
                            LastReceipt = Some receipt
                            TotalIV = st.TotalIV + iv
                            TotalDeltaJ = st.TotalDeltaJ + costPerTick })
            })

    /// **The receipt on a CORNER instead of through a hole** (2026-08-17, work item
    /// 081M08WE9R3087G0R003PAK63F; design `docs/research/2026-08-17-t-feedback-in-the-co-owned-fourth-
    /// corner-at-the-tick-boundary.md`).
    ///
    /// `wrapHandler` / `wrapHandlerK` above take `onReceipt : (Receipt -> unit) option`. A `-> unit`
    /// sink fired inside the tick loop cannot return its effect through `'S`, the `Source`, the seed,
    /// `IntrCtx`, or `Result` — so the receipt this module exists to emit leaves through a **hole**,
    /// not through the corner the module docstring above claims. That was measured, not inferred:
    /// `TickBoundaryProbe` TICK-3 shows two runs with every declared channel byte-identical producing
    /// different outcomes.
    ///
    /// This wrapper returns the receipt on `SoftScheduler`'s co-owned corner (`T In Feedback`). The
    /// receipt reaches the caller through the returned `'F` **and through nothing else**: there is no
    /// callback, no captured collection, and the corner is part of the value the probe compares.
    ///
    /// **The metering decision is NOT settled here.** Whether `onReceipt` is deleted, retired in
    /// favour of this, or kept and metered belongs to Aaron (workitem 081M08S4DQC087G0R002SH0C88).
    /// Both `-> unit` overloads above are untouched and keep working; what changed is that option 2
    /// no longer costs a shipped-signature change.
    ///
    /// Note honestly what this handler does NOT do: it never reads the incoming corner. It writes its
    /// half and leaves reading to whichever handler wants it — which is what "co-owned" permits, not a
    /// claim that this particular wrapper is symmetric.
    let wrapHandlerF
        (ivFn: 'S -> 'S -> float)
        (costPerTick: float)
        (entropyFn: 'S -> float)
        (h: SoftScheduler.HandlerK<'S>)
        : SoftScheduler.HandlerF<Receipted<'S>, ComputeReceipt.Receipt list> =
        SoftScheduler.handlerF (h.Name + "-receipted") h.Matches (fun intr _corner ctx st ->
            task {
                let prior = st.Inner
                let! result = h.RunK intr ctx prior
                return
                    result
                    |> Result.map (fun posterior ->
                        let iv = ivFn prior posterior
                        let entropy = entropyFn posterior
                        let receipt = ComputeReceipt.fromIV iv costPerTick entropy

                        { st with
                            Inner = posterior
                            Tick = st.Tick + 1
                            HeatTicks = if receipt.DeltaU < 0.0 then st.HeatTicks + 1 else st.HeatTicks
                            ProfitTicks = if receipt.DeltaU > 0.0 then st.ProfitTicks + 1 else st.ProfitTicks
                            LastReceipt = Some receipt
                            TotalIV = st.TotalIV + iv
                            TotalDeltaJ = st.TotalDeltaJ + costPerTick },
                        [ receipt ])
            })

    /// **DeltaU-driven adaptive tick rate** — the four-corner feedback made load-bearing.
    ///
    /// Given a `Receipted<'S>` state, returns a recommended interval multiplier:
    ///   - `1.0` — nominal rate (DeltaU ≥ 0, compute is profitable).
    ///   - `> 1.0` — slow down (DeltaU < 0, compute is wasteful; exponential backoff).
    ///   - `< 1.0` — speed up (DeltaU >> 0, compute is highly profitable; aggressive mode).
    ///
    /// The multiplier is bounded to `[minFactor, maxFactor]` to prevent runaway.
    /// `backoffBase` — the base for exponential backoff (default: 2.0).
    /// `speedupBase` — the base for speedup (default: 0.5).
    /// `minFactor` / `maxFactor` — bounds on the multiplier.
    let adaptiveIntervalMultiplier
        (backoffBase: float)
        (speedupBase: float)
        (minFactor: float)
        (maxFactor: float)
        (st: Receipted<'S>)
        : float =
        match st.LastReceipt with
        | None -> 1.0 // no data yet — nominal rate
        | Some r ->
            let raw =
                if r.DeltaU < 0.0 then
                    // Wasted compute: exponential backoff proportional to |DeltaU|
                    backoffBase ** (abs r.DeltaU)
                elif r.DeltaU > 1.0 then
                    // Highly profitable: speed up proportional to DeltaU
                    speedupBase ** r.DeltaU
                else
                    1.0 // nominal
            max minFactor (min maxFactor raw)
