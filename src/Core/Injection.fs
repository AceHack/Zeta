namespace Zeta.Core

open System
open System.Collections.Generic
open System.Threading


/// Abstract seams for A/B testing and swapping subsystems at runtime.
///
/// The library defaults "just work" — you never have to touch these — but
/// every interface here is deliberately narrow so you can:
///   - **Shadow a prod path with a test double** (`IBackingStore`, `IClock`).
///   - **Route metrics through OpenTelemetry, Prometheus, or /dev/null**
///     (`IMetricsSink`) without re-linking.
///   - **Flip between two hashing strategies** and measure bucket skew
///     live (`IHashStrategy`).
///   - **Experiment with spine flavours** per-workload (`ISpineStrategy`).
///
/// The interfaces are deliberately *not* generic in too many parameters;
/// where a `'K` is required it's propagated, but coarse interfaces (like
/// `IClock`) stay monomorphic for easy mocking.


/// Pluggable clock. Swap in `SystemClock`, `FrozenClock` (for tests),
/// or `ChaosEnvironment` (for simulation).
type IClock =
    abstract UtcNow: unit -> DateTimeOffset
    abstract Elapsed: unit -> int64   // monotonic nanoseconds


/// Default: `DateTimeOffset.UtcNow` + `System.Diagnostics.Stopwatch`.
[<Sealed>]
type SystemClock() =
    let sw = System.Diagnostics.Stopwatch.StartNew()
    interface IClock with
        member _.UtcNow() = DateTimeOffset.UtcNow
        member _.Elapsed() = sw.ElapsedTicks * (1_000_000_000L / System.Diagnostics.Stopwatch.Frequency)


/// Deterministic clock for reproducible tests.
[<Sealed>]
type FrozenClock(initial: DateTimeOffset) =
    let mutable now = initial
    let mutable elapsed = 0L
    let lockObj = obj ()
    member _.Advance(delta: TimeSpan) =
        lock lockObj (fun () ->
            now <- now + delta
            elapsed <- elapsed + int64 (delta.TotalMilliseconds * 1_000_000.0))
    interface IClock with
        member _.UtcNow() = lock lockObj (fun () -> now)
        member _.Elapsed() = lock lockObj (fun () -> elapsed)


/// Pluggable metrics sink. The default fans out through
/// `System.Diagnostics.Metrics`; alternative implementations can skip
/// instrumentation entirely (for micro-benchmarks) or route to Prometheus.
type IMetricsSink =
    abstract RecordTick: unit -> unit
    abstract RecordRowsIn: opName: string * opId: int * count: int64 -> unit
    abstract RecordRowsOut: opName: string * opId: int * count: int64 -> unit
    abstract RecordTickDuration: microseconds: double -> unit
    abstract RecordAllocations: bytes: int64 -> unit


/// Default sink routes to `DbspMetrics` (System.Diagnostics.Metrics).
[<Sealed>]
type DefaultMetricsSink() =
    interface IMetricsSink with
        member _.RecordTick() = DbspMetrics.RecordTick()
        member _.RecordRowsIn(o, i, c) = DbspMetrics.RecordRowsIn(o, i, c)
        member _.RecordRowsOut(o, i, c) = DbspMetrics.RecordRowsOut(o, i, c)
        member _.RecordTickDuration ms = DbspMetrics.RecordTickDuration ms
        member _.RecordAllocations b = DbspMetrics.RecordAllocations b


/// No-op sink — use in benchmarks to strip instrumentation overhead.
[<Sealed>]
type NullMetricsSink() =
    interface IMetricsSink with
        member _.RecordTick() = ()
        member _.RecordRowsIn(_, _, _) = ()
        member _.RecordRowsOut(_, _, _) = ()
        member _.RecordTickDuration _ = ()
        member _.RecordAllocations _ = ()


/// In-memory sink that accumulates counters for test assertions.
[<Sealed>]
type RecordingMetricsSink() =
    let mutable ticks = 0L
    let rowsIn = Dictionary<string, int64>()
    let rowsOut = Dictionary<string, int64>()
    let lockObj = obj ()
    member _.Ticks = ticks
    member _.RowsIn = rowsIn :> IReadOnlyDictionary<_, _>
    member _.RowsOut = rowsOut :> IReadOnlyDictionary<_, _>
    interface IMetricsSink with
        member _.RecordTick() = Interlocked.Increment &ticks |> ignore
        member _.RecordRowsIn(o, _, c) =
            lock lockObj (fun () ->
                let mutable cur = 0L
                rowsIn.TryGetValue(o, &cur) |> ignore
                rowsIn.[o] <- cur + c)
        member _.RecordRowsOut(o, _, c) =
            lock lockObj (fun () ->
                let mutable cur = 0L
                rowsOut.TryGetValue(o, &cur) |> ignore
                rowsOut.[o] <- cur + c)
        member _.RecordTickDuration _ = ()
        member _.RecordAllocations _ = ()


/// Pluggable hash strategy for shard assignment. Lets callers try
/// different mixers (HashCode, XxHash3, FNV) and A/B-test bucket skew.
///
/// `'K` is **contravariant** (`in`) — a hasher for `obj` legitimately
/// hashes `string`, `int`, etc. Lets users pass an `IHashStrategy<obj>`
/// where an `IHashStrategy<MyKey>` is required.
type IHashStrategy<'K> =
    abstract Hash: key: 'K -> uint32


/// Default: salted `HashCode.Combine` — HashDoS-resistant.
[<Sealed>]
type DefaultHashStrategy<'K>() =
    interface IHashStrategy<'K> with
        member _.Hash k = uint32 (HashCode.Combine(k, Shard.Salt))


/// Cross-process-stable: no salt. Use when Kafka-compatible partitioning
/// is required.
[<Sealed>]
type StableHashStrategy<'K>() =
    interface IHashStrategy<'K> with
        member _.Hash k = uint32 (HashCode.Combine k)


/// Aggregate container so user code can pass a single struct of DI
/// dependencies instead of wiring each seam individually. Add fields
/// here rather than introducing new parameters at every call site.
[<Struct>]
type DbspServices = {
    Clock: IClock
    Metrics: IMetricsSink
}
with
    /// Default services: `SystemClock` + `DefaultMetricsSink`.
    static member Default =
        { Clock = SystemClock() :> IClock
          Metrics = DefaultMetricsSink() :> IMetricsSink }

    /// Null services: frozen clock + null metrics. Benchmark-friendly.
    static member ForBenchmark =
        { Clock = FrozenClock DateTimeOffset.UnixEpoch :> IClock
          Metrics = NullMetricsSink() :> IMetricsSink }

    /// Recording services: system clock + recording metrics sink. Tests
    /// can assert on `RowsIn`/`RowsOut` after a run.
    static member ForTest(recorder: RecordingMetricsSink) =
        { Clock = SystemClock() :> IClock
          Metrics = recorder :> IMetricsSink }
