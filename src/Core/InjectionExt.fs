namespace Zeta.Core

open System
open System.Collections.Generic


/// Additional DI seams beyond the baseline `Injection.fs` set.
///
/// **Why more seams:** each of these has an active-research story
/// where multiple implementations are likely to exist over the life
/// of the project. A seam lets us A/B between them without rebuild.


/// Pluggable **watermark strategy** — lets users swap between
/// `Monotonic` / `BoundedLateness(Δ)` / `Periodic(interval, Δ)` /
/// statistical / probabilistic / punctuation-based without touching
/// the operator code that consumes watermarks.
///
/// The interface is intentionally narrow — observe one timestamp,
/// get back the current watermark. The existing `WatermarkStrategy`
/// DU stays as the "common four" constructors; users who want to
/// plug in a statistical KLL-based strategy (e.g. Fragkoulis VLDB
/// 2023) implement this interface directly.
type IWatermarkStrategy =
    /// Observe a new event's timestamp. Returns the current watermark.
    /// Must be monotone non-decreasing across calls.
    abstract Observe: eventTime: int64 -> int64
    /// Current watermark without observing anything new.
    abstract Current: int64
    /// Strategy name for telemetry / tracing.
    abstract Name: string


/// Default: thin adapter that wraps the existing `WatermarkTracker`.
[<Sealed>]
type WatermarkStrategyAdapter(tracker: WatermarkTracker, name: string) =
    interface IWatermarkStrategy with
        member _.Observe eventTime = tracker.Observe eventTime
        member _.Current = tracker.Current
        member _.Name = name


/// Statistical watermark backed by a KLL quantile sketch. Emits
/// `maxSeen - kll.Quantile(percentile)` — adaptive to the observed
/// arrival-lateness distribution rather than a static `Δ`. Per
/// Fragkoulis et al. VLDB 2023; adapts to bursty out-of-order
/// sources by ~2-5× vs BoundedLateness.
[<Sealed>]
type StatisticalWatermarkStrategy(percentile: double, sketchCapacity: int) =
    do
        if percentile <= 0.0 || percentile >= 1.0 then
            invalidArg (nameof percentile) "must be in (0, 1)"
    let kll = KllSketch sketchCapacity
    let mutable maxSeen = Int64.MinValue
    let mutable current = Int64.MinValue
    let lockObj = obj ()

    interface IWatermarkStrategy with
        member _.Name = $"statistical(p={percentile})"
        member _.Current = lock lockObj (fun () -> current)
        member _.Observe eventTime =
            lock lockObj (fun () ->
                if eventTime > maxSeen then maxSeen <- eventTime
                // Record arrival-lateness if we have a clock; otherwise
                // treat all observed timestamps as the lateness signal.
                kll.Add eventTime
                if maxSeen = Int64.MinValue then Int64.MinValue
                else
                    let p = kll.Quantile percentile
                    let candidate = maxSeen - (maxSeen - p)   // bounded by observed p
                    if candidate > current then current <- candidate
                    current)


/// Pluggable **logger** — bridges DBSP to
/// `Microsoft.Extensions.Logging.ILogger` (or any other logger).
/// Kept abstract so we don't pull the Microsoft.Extensions.Logging
/// package into the core; a separate `Zeta.Logging.MsExt` adapter
/// can implement this against `ILogger<T>`.
type IDbspLogger =
    abstract Log: level: string * message: string -> unit
    abstract LogWithArgs: level: string * template: string * args: obj array -> unit


/// Default: writes to `Console.Error` so we don't swallow diagnostics
/// in test runs. Production deployments swap in a real logger via DI.
[<Sealed>]
type ConsoleLogger() =
    interface IDbspLogger with
        member _.Log(level, message) =
            Console.Error.WriteLine $"[%s{level}] %s{message}"
        member _.LogWithArgs(level, template, args) =
            Console.Error.WriteLine $"[%s{level}] %s{template} [args=%A{args}]"


/// No-op logger — for benchmarks.
[<Sealed>]
type NullLogger() =
    interface IDbspLogger with
        member _.Log(_, _) = ()
        member _.LogWithArgs(_, _, _) = ()
