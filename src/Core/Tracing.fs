namespace Zeta.Core

open System
open System.Diagnostics
open System.Runtime.CompilerServices


/// First-class distributed tracing + structured metrics via
/// `System.Diagnostics.ActivitySource` — the .NET-native equivalent
/// of OpenTelemetry's Tracer. Any OTel exporter (Jaeger, Zipkin,
/// Azure Monitor, etc.) hooks in at the edge via `ActivityListener`.
///
/// ## Why ActivitySource and not AsyncLocal directly
///
/// `Activity` lives on an `AsyncLocal<Activity?>` slot that .NET
/// propagates across `await` / `Task.Run` / `ThreadPool.QueueUserWorkItem`.
/// That propagation is **the** feature the ExecutionContext subsystem
/// exists to provide. Every flow path in this codebase that awaits —
/// `StepAsync`, `SpineAsync`, `WorkStealingRuntime`, `MailboxRuntime`,
/// `backgroundTask { }`, `Task.Run` — is already `ExecutionContext`-
/// correct by virtue of `Task` plumbing. The one exception is raw
/// `ThreadPool.UnsafeQueueUserWorkItem` which we don't call.
///
/// ## The Kleisli alternative
///
/// You're right that AsyncLocal is semantically grubby — it's a hidden
/// side channel. A Kleisli arrow `'A -> ReaderT<TraceCtx, Task<'B>>`
/// threads trace context explicitly through composition, no hidden
/// state. Python/Java streaming engines reach for this because their
/// runtime lacks ExecutionContext; .NET has it, so the ergonomic cost
/// of Kleisli outweighs the purity win. We expose a **Kleisli-shaped
/// helper** below for code that wants the explicit form — but the
/// default is the `Activity` ambient context, which just works under
/// our `backgroundTask` / `task` CEs.
///
/// ## What we instrument
///
/// - Per-tick: `circuit.tick` span.
/// - Per-operator: `op.step` span with `op.name` / `op.id` tags.
/// - Per-channel boundary: `channel.send` / `channel.receive` spans.
/// - Per-sink transaction: `sink.tx` span with `epoch` tag + lifecycle
///   events (BeginTx/PreCommit/Commit/Abort).
///
/// All spans respect W3C Trace Context (traceparent/tracestate) so a
/// request flowing from an HTTP ingress through a DBSP pipeline to a
/// downstream DB lights up end-to-end in the UI.
[<AbstractClass; Sealed>]
type DbspTracing =

    /// The shared `ActivitySource`. External callers can enable it
    /// with an `ActivityListener` or via OpenTelemetry's
    /// `AddSource("Zeta.Core")` on a `TracerProvider`.
    static member val Source : ActivitySource =
        new ActivitySource("Zeta.Core", "1.0.0")

    /// Start a span for a tick. Returns `null` when no listener is
    /// active — callers must null-check. Inline so the JIT elides the
    /// span allocation when inactive.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member StartTick(circuitId: int) : Activity =
        let act = DbspTracing.Source.StartActivity("circuit.tick")
        if not (isNull act) then
            act.SetTag("circuit.id", box circuitId) |> ignore
        act

    /// Start a per-operator step span.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member StartOp(opName: string, opId: int) : Activity =
        let act = DbspTracing.Source.StartActivity("op.step")
        if not (isNull act) then
            act.SetTag("op.name", box opName) |> ignore
            act.SetTag("op.id", box opId) |> ignore
        act

    /// Start a sink-transaction span.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member StartSinkTx(sinkName: string, epoch: int64) : Activity =
        let act = DbspTracing.Source.StartActivity("sink.tx")
        if not (isNull act) then
            act.SetTag("sink.name", box sinkName) |> ignore
            act.SetTag("sink.epoch", box epoch) |> ignore
        act


/// Kleisli-shaped explicit trace-context helper for code that wants
/// to thread context without AsyncLocal. Use `Traced.withCtx ctx f`
/// to run `f` with `ctx` as the current `Activity.Parent`.
[<RequireQualifiedAccess>]
module Traced =

    /// Run `f` with `parentCtx` as its trace parent. No AsyncLocal
    /// reliance; the context is restored on exit.
    let withCtx<'T> (parentCtx: ActivityContext) (f: unit -> 'T) : 'T =
        let prevParent = Activity.Current
        let act = DbspTracing.Source.StartActivity("traced", ActivityKind.Internal, parentCtx)
        try
            f ()
        finally
            if not (isNull act) then act.Stop()
            if not (isNull prevParent) then Activity.Current <- prevParent

    /// A Kleisli arrow `'A -> Task<'B>` that carries trace context
    /// explicitly — for folks who want the pure-FP shape. Simpler
    /// than a full ReaderT monad but captures the key idea.
    type Arrow<'A, 'B> = ActivityContext -> 'A -> System.Threading.Tasks.Task<'B>

    let compose<'A, 'B, 'C> (f: Arrow<'A, 'B>) (g: Arrow<'B, 'C>) : Arrow<'A, 'C> =
        fun ctx a ->
            task {
                let! b = f ctx a
                return! g ctx b
            }
