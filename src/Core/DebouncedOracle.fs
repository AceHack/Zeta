module Zeta.Core.DebouncedOracle

/// **`DebouncedOracle` — the νF anamorphism with enforced L > 0.**
///
/// The problem this solves: in a full-duplex multi-sensor system, a sensor that
/// can re-read itself within its own decorrelation window is hearing its own
/// emission — correlation-to-one in a delay costume.
///
///   ρ(L) = 1/(1+L)
///
/// At L=0: ρ=1 (same-seed, correlation-to-one — the DST result).
/// At L→∞: ρ→0 (genuinely independent — the real sensor-fusion proof).
///
/// **Echolocation analogy:** a bat emits a pulse and listens for the return.
/// The round-trip time is L. The bat cannot pre-compute the return — the delay
/// is set by the physical distance to the object, which the bat does not control.
/// A bat that could set its own return delay would just be hearing its own
/// emission. The debounce window is the minimum round-trip time that guarantees
/// the return is from the world, not from the sender.
///
/// **Connection to DelayDecorrelation:** the `minDelay` parameter is the
/// minimum L in `DelayDecorrelation.effectiveCorrelation`. Below this threshold,
/// two readings of the same oracle are the same reading — the oracle is in the
/// `Correlated` regime (S=4, superdeterministic). Above it, the oracle enters
/// the `SharedState` or `Independent` regime.
///
/// **Connection to FerryThrottler:** the debounce window is not a capacity cap
/// (FerryThrottler's `MaxBatchSize`) — it is a TIME cap. A reading that arrives
/// within `minDelay` of the last reading is dropped, not queued. This is the
/// dual of the ferry's "a boat sails with whatever is queued right now" rule:
/// the debounced oracle "a reading is accepted only if the world has had time
/// to change since the last reading."
///
/// **DST compatibility:** when `syncContext = Some sc`, all timer callbacks are
/// posted to the injected `SynchronizationContext`. This makes the debounce
/// window pump-gated and replayable under `DeterministicSyncContext.PumpToIdle`.
/// In DST mode, `minDelay` is measured in pump ticks, not wall-clock time.
/// The noninterference door (§13): timing enters only through the injected
/// context, never the ambient threadpool.
///
/// **The vision monad:** `DebouncedOracle<'T>` is `IObservable<SoftValue<'T>>`
/// with L > 0 enforced. Each `OnNext` is a fixation (update step). Each
/// suppressed reading is a saccade (prediction step — the Infer.NET i-sensor).
/// The debounce window is the minimum saccade duration.

open System
open System.Threading
open System.Reactive.Subjects


/// Configuration for a `DebouncedOracle`.
type DebouncedOracleConfig =
    { /// The minimum time between accepted readings.
      /// This is the L in ρ = 1/(1+L). Below this threshold, two readings
      /// are the same reading (correlation-to-one).
      ///
      /// Deterministic default: 1 tick (L=1, ρ=0.5 — SharedState regime).
      /// For genuine independence (Classical regime), set to at least
      /// `DelayDecorrelation.latencyForBonus 0.9 |> Option.get` ticks.
      MinDelay: TimeSpan

      /// Optional injected SynchronizationContext for DST compatibility.
      /// None = production (wall-clock, threadpool timer).
      /// Some sc = pump-gated (replayable under DeterministicSyncContext).
      SyncContext: SynchronizationContext option

      /// The oracle index (0-4 for the five DLA oracles).
      /// Used to compute the prime offset that enforces seed independence
      /// in live mode: seed = wallClock + primeOffset[oracleIndex].
      OracleIndex: int }


[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module DebouncedOracleConfig =

    /// The first five primes > 1000 — the same offsets used by the JS site.
    /// These guarantee that no two oracles share a seed even if sampled
    /// in the same millisecond (L = prime_gap > 0).
    let primeOffsets = [| 1009; 1013; 1019; 1021; 1031 |]

    /// Deterministic default: 1 tick, no injected context, oracle 0.
    /// L = 1 → ρ = 0.5 (SharedState regime — marginal independence).
    /// Use this on the simulation / seed / DST path.
    let deterministic =
        { MinDelay   = TimeSpan.FromTicks 1L
          SyncContext = None
          OracleIndex = 0 }

    /// Production default: 1 second minimum between readings, no injected context.
    /// L = 1s → ρ = 1/(1+1s) ≈ 0.5 at 1Hz tick rate.
    /// Increase MinDelay to push ρ toward 0 (Classical / Independent regime).
    let production (oracleIndex: int) =
        { MinDelay    = TimeSpan.FromSeconds 1.0
          SyncContext  = None
          OracleIndex  = oracleIndex }

    /// The prime offset for a given oracle index.
    let primeOffset (oracleIndex: int) : int =
        primeOffsets[oracleIndex % primeOffsets.Length]

    /// The effective correlation ρ for a given MinDelay (in seconds).
    /// Uses the FeedbackThrottle model: ρ = 1/(1+L).
    let effectiveCorrelation (cfg: DebouncedOracleConfig) : float =
        let L = cfg.MinDelay.TotalSeconds
        1.0 / (1.0 + max 0.0 L)

    /// The Condorcet bonus (independence value) for a given MinDelay.
    /// bonus = L/(1+L) = 1 - ρ.
    let condorcetBonus (cfg: DebouncedOracleConfig) : float =
        1.0 - effectiveCorrelation cfg


/// A debounced oracle: an `IObservable<'T>` that suppresses readings that
/// arrive within `MinDelay` of the last accepted reading.
///
/// This enforces L > 0 in ρ = 1/(1+L), breaking correlation-to-one.
/// The oracle is the bat's sonar pulse: it only accepts a return if the
/// world has had time to change since the last emission.
type DebouncedOracle<'T>(source: IObservable<'T>, config: DebouncedOracleConfig) =

    let subject = new Subject<'T>()
    let mutable lastAccepted = DateTime.MinValue
    // DST-mode monotonic clock: "time is pump ticks, not wall clock" (§13 noninterference).
    // Advances one tick per delivered callback; the injected pump drives delivery
    // deterministically, so replay is exact. Live mode (SyncContext = None) uses the
    // fenced wall-clock door instead — see Subscribe.
    let mutable dstTick = 0L
    let mutable subscription: IDisposable = null

    /// The effective correlation ρ for this oracle's MinDelay.
    member _.EffectiveCorrelation = DebouncedOracleConfig.effectiveCorrelation config

    /// The Condorcet bonus (independence value) for this oracle's MinDelay.
    member _.CondorcetBonus = DebouncedOracleConfig.condorcetBonus config

    /// The prime offset for this oracle's index.
    member _.PrimeOffset = DebouncedOracleConfig.primeOffset config.OracleIndex

    /// Subscribe to the debounced stream.
    /// Each `OnNext` is a fixation (update step) — a reading accepted because
    /// L > 0 since the last accepted reading.
    /// Suppressed readings are saccades (prediction step — the i-sensor).
    member _.Subscribe() =
        subscription <- source.Subscribe(fun value ->
            let now =
                match config.SyncContext with
                | None    ->
                    // Live mode: the fenced wall-clock door. Debounce is local rate-control
                    // ("has the world had time to change since the last reading?") — a local
                    // timing decision, never evidence entering the shared commutative fold.
                    DateTime.UtcNow
                | Some _  ->
                    // DST mode: time is PUMP TICKS, not wall clock. Advance a monotonic
                    // counter once per delivered callback; the injected pump drives delivery
                    // deterministically, so `elapsed` — and every accept/suppress decision —
                    // replays byte-for-byte. No ambient clock crosses the §13 membrane here
                    // (this is the fix: the old code read the ambient wall clock in this branch too).
                    dstTick <- dstTick + 1L
                    DateTime.MinValue + TimeSpan.FromTicks dstTick

            let elapsed = now - lastAccepted
            if elapsed >= config.MinDelay then
                // L > 0: this reading is from the world, not from the sender.
                // Accept it — this is a fixation.
                lastAccepted <- now
                match config.SyncContext with
                | None    -> subject.OnNext value
                | Some sc -> sc.Post((fun _ -> subject.OnNext value), null)
            // else: L = 0 (within debounce window) — suppress.
            //   This reading is correlation-to-one: the oracle is hearing
            //   its own emission. Drop it. This is a saccade.
        )

    /// The debounced observable stream.
    member _.Observable : IObservable<'T> = subject :> IObservable<'T>

    interface IDisposable with
        member _.Dispose() =
            if subscription <> null then subscription.Dispose()
            subject.Dispose()


/// Convenience operators for composing debounced oracles.
[<RequireQualifiedAccess>]
module DebouncedOracle =

    /// Wrap an observable with a debounce window, using the given config.
    let debounce (config: DebouncedOracleConfig) (source: IObservable<'T>) : DebouncedOracle<'T> =
        let oracle = new DebouncedOracle<'T>(source, config)
        oracle.Subscribe()
        oracle

    /// Wrap an observable with a production debounce window for the given oracle index.
    let forOracle (oracleIndex: int) (source: IObservable<'T>) : DebouncedOracle<'T> =
        debounce (DebouncedOracleConfig.production oracleIndex) source

    /// The effective correlation ρ for a given MinDelay in seconds.
    /// ρ = 1/(1+L). At L=0: ρ=1 (correlation-to-one). At L→∞: ρ→0 (independent).
    let rho (minDelaySeconds: float) : float =
        1.0 / (1.0 + max 0.0 minDelaySeconds)

    /// The minimum delay needed to achieve a target correlation ρ ∈ (0,1).
    /// Invert: ρ = 1/(1+L) ⟹ L = (1-ρ)/ρ.
    let minDelayForRho (targetRho: float) : TimeSpan option =
        if targetRho <= 0.0 || targetRho >= 1.0 then None
        else Some (TimeSpan.FromSeconds ((1.0 - targetRho) / targetRho))

    /// The minimum delay needed to reach the Classical (Independent) regime.
    /// Uses the Tsirelson point as the boundary: L = √2 ticks.
    /// Above this delay, the oracle is in the Classical regime (ρ < ρ*).
    let classicalRegimeDelay : TimeSpan =
        TimeSpan.FromSeconds (sqrt 2.0)  // L = √2 → ρ = 1/(1+√2) ≈ 0.414

    /// The five-oracle array for the DLA multi-oracle proof.
    /// Each oracle gets its own prime offset (the same offsets used by the JS site).
    /// This is the F# equivalent of the live-seed mode in the browser visualizer.
    let dlaOracleConfigs (minDelay: TimeSpan) : DebouncedOracleConfig[] =
        [| 0 .. 4 |] |> Array.map (fun i ->
            { MinDelay    = minDelay
              SyncContext  = None
              OracleIndex  = i })
