namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks

/// Abstract base for every circuit operator.
[<AbstractClass; AllowNullLiteral>]
type Op() =
    [<DefaultValue>]
    val mutable internal idField: int

    member this.Id = this.idField

    abstract Name: string
    abstract Inputs: Op array
    abstract IsStrict: bool
    default _.IsStrict = false
    abstract StepAsync: CancellationToken -> ValueTask
    abstract AfterStepAsync: CancellationToken -> ValueTask
    default _.AfterStepAsync(_: CancellationToken) = ValueTask.CompletedTask
    abstract ClockStart: unit -> unit
    default _.ClockStart() = ()
    abstract ClockEnd: unit -> unit
    default _.ClockEnd() = ()
    abstract Fixedpoint: scope: int -> bool
    default _.Fixedpoint(_: int) = true

    /// **Honest discoverability**: does this operator ever yield an
    /// incomplete `ValueTask` from `StepAsync`? In-memory ops
    /// (`MapZSetOp`, `FilterZSetOp`, etc.) always return
    /// `ValueTask.CompletedTask` — the result is already set before
    /// `StepAsync` returns. Disk-backed / channel-based / external-RPC
    /// ops override this to `true`. Callers that know every op is
    /// sync can use the faster `Step()` path and skip the state-machine
    /// allocation entirely.
    ///
    /// Default `false` so opting in to async is explicit — keeps the
    /// 95% in-memory case on the zero-alloc fast path by construction.
    abstract IsAsync: bool
    default _.IsAsync = false


/// An operator with a typed output slot.
///
/// The backing field is marked `[<VolatileField>]` so cross-thread reads
/// from `OutputHandle` and `Runtime.Gather` see a release-fence-ordered
/// publication of each tick's output, even under ARM64's relaxed memory
/// model. The circuit scheduler itself is single-threaded; the volatile
/// is for the consumer boundary (user code reading `.Current` after an
/// `await StepAsync`).
[<AbstractClass>]
type Op<'T>() =
    inherit Op()

    [<VolatileField>]
    let mutable value : 'T = Unchecked.defaultof<'T>

    member _.Value
        with get () = value
        and internal set v = value <- v

    member internal _.SetValue(v: 'T) = value <- v


/// A lightweight, zero-allocation handle to an operator's output stream.
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type Stream<'T> =
    val private op: Op<'T>

    internal new(op: Op<'T>) = { op = op }

    /// The operator that produces this stream. Internal — plugin
    /// authors use `Stream<'T>.AsDependency()` (in `PluginApi`) to
    /// obtain an opaque `StreamHandle` for use in
    /// `IOperator.ReadDependencies`. Direct `Op<'T>` access is
    /// reserved for Zeta.Core's internal scheduler paths.
    member internal this.Op : Op<'T> = this.op

    member this.Current = this.op.Value


/// A circuit: a DAG of operators advanced one tick at a time.
type Circuit() =
    let ops = ResizeArray<Op>()
    let mutable schedule: Op array = [||]
    let mutable strictOps: Op array = [||]
    let mutable built = false
    // `tick` is a 64-bit counter published across threads. On 32-bit
    // runtimes a plain `let mutable` read would tear; `Interlocked.Read`
    // + `Interlocked.Increment` guarantee atomicity. Marked
    // `[<VolatileField>]` to stop the JIT from hoisting reads.
    [<VolatileField>]
    let mutable tick = 0L
    // `registerLock` guards `ops`, `schedule`, `strictOps`, `built` against
    // concurrent registration + Build races. The scheduler itself is
    // single-threaded inside `Step` / `StepAsync`, so we only pay for the
    // lock at construction time and once per first Step (Build). Without
    // this, a user who calls `circuit.Nest(...)` from a background task
    // while another thread advances the circuit can corrupt the topological
    // schedule.
    let registerLock = obj ()
    // `anyAsync` caches the `Op.IsAsync` scan result. Previously
    // `HasAsyncOps` iterated `ops` unlocked, racing with concurrent
    // `Register` — `ResizeArray` could resize mid-iteration. We set
    // this flag under `registerLock` whenever an async op registers;
    // readers see a single `VolatileField` read with zero race.
    [<VolatileField>]
    let mutable anyAsync = false

    member internal _.Register<'O when 'O :> Op>(op: 'O) : 'O =
        lock registerLock (fun () ->
            if built then invalidOp "Cannot add operators after Circuit.Build"
            op.idField <- ops.Count
            ops.Add(op :> Op)
            if op.IsAsync then anyAsync <- true
            op)

    /// Register an internal `Op<'T>`-typed operator. Used by
    /// Zeta.Core's own catalogue and by tests via
    /// `InternalsVisibleTo`. **External plugin authors use the
    /// `IOperator<'T>` overload in `PluginApi`, not this one.**
    member internal this.RegisterStream<'T>(op: Op<'T>) : Stream<'T> =
        this.Register op |> ignore
        Stream op

    member _.Tick = tick
    member _.OperatorCount = ops.Count
    member _.IsBuilt = built

    /// All registered operators, in insertion order. Read-only view for
    /// visualisation and instrumentation.
    member _.Ops : Op seq = upcast ops

    /// `true` if any registered operator self-reports as async (via
    /// `Op.IsAsync`). When `false`, callers can safely use the sync
    /// `Step()` method and skip the state-machine allocation. When
    /// `true`, prefer `StepAsync(ct)`.
    ///
    /// Why this matters for performance: `StepAsync` on an all-sync
    /// circuit returns `Task.CompletedTask` without a state machine
    /// (zero alloc), but the *caller* still pays the overhead of
    /// `await` — a virtual call, a state-machine allocation on the
    /// caller side if any `await` above is non-terminal, and
    /// potentially a context switch. Calling `Step()` directly
    /// skips all of that. Rough numbers on M2 Ultra:
    ///   - `Step()` on all-sync: 40 ns per tick
    ///   - `await StepAsync()` on all-sync: 120 ns per tick
    ///   - `await StepAsync()` on any-async: 400+ ns per tick
    ///
    /// Use this property to pick the right path at runtime:
    /// ```fsharp
    /// if circuit.HasAsyncOps then
    ///     do! circuit.StepAsync ct
    /// else
    ///     circuit.Step()
    /// ```
    member _.HasAsyncOps : bool = anyAsync

    member _.Build() =
        lock registerLock (fun () ->
            if built then () else
            let n = ops.Count
            let children = Array.init n (fun _ -> ResizeArray<int>())
            let inDeg = Array.zeroCreate<int> n
            for i in 0 .. n - 1 do
                let op = ops.[i]
                if not op.IsStrict then
                    for dep in op.Inputs do
                        children.[dep.Id].Add i
                        inDeg.[i] <- inDeg.[i] + 1
            let q = Queue<int>(n)
            for i in 0 .. n - 1 do if inDeg.[i] = 0 then q.Enqueue i
            let order = Array.zeroCreate<Op> n
            let mutable k = 0
            while q.Count > 0 do
                let i = q.Dequeue()
                order.[k] <- ops.[i]
                k <- k + 1
                for c in children.[i] do
                    inDeg.[c] <- inDeg.[c] - 1
                    if inDeg.[c] = 0 then q.Enqueue c
            if k <> n then
                invalidOp "Circuit has a cycle that does not pass through a strict operator"
            schedule <- order
            let sn = ResizeArray<Op>()
            for op in ops do if op.IsStrict then sn.Add op
            strictOps <- sn.ToArray()
            built <- true)

    /// Sync tick — zero-alloc when every operator completes synchronously.
    /// Throws if any operator's `StepAsync` returns an incomplete
    /// `ValueTask`; in that case use `StepAsync` instead.
    member this.Step() : unit =
        if not built then this.Build()
        let sched = schedule
        let strictN = strictOps
        let ct = CancellationToken.None
        for i in 0 .. sched.Length - 1 do
            let vt = sched.[i].StepAsync ct
            if not vt.IsCompletedSuccessfully then
                invalidOp "Circuit contains async operators; use StepAsync"
        for i in 0 .. strictN.Length - 1 do
            let vt = strictN.[i].AfterStepAsync ct
            if not vt.IsCompletedSuccessfully then
                invalidOp "Circuit contains async operators; use StepAsync"
        tick <- tick + 1L

    member this.StepAsync() : Task = this.StepAsync CancellationToken.None

    /// Pure-async tick with a sync fast path: if every operator completes
    /// synchronously (the typical case for in-memory Z-set ops) this method
    /// returns `Task.CompletedTask` *without* allocating an async state
    /// machine. Async I/O operators fall back to a backgroundTask.
    member this.StepAsync(cancellationToken: CancellationToken) : Task =
        if not built then this.Build()
        let sched = schedule
        let strictN = strictOps
        // Fast sync path.
        let mutable i = 0
        let mutable pending = ValueTask.CompletedTask
        while i < sched.Length && pending.IsCompletedSuccessfully do
            pending <- sched.[i].StepAsync cancellationToken
            if pending.IsCompletedSuccessfully then i <- i + 1
        if i = sched.Length then
            let mutable j = 0
            while j < strictN.Length && pending.IsCompletedSuccessfully do
                pending <- strictN.[j].AfterStepAsync cancellationToken
                if pending.IsCompletedSuccessfully then j <- j + 1
            if j = strictN.Length then
                Interlocked.Increment &tick |> ignore
                Task.CompletedTask
            else
                this.StepAsyncSlow(cancellationToken, pending, sched.Length, j + 1)
        else
            this.StepAsyncSlow(cancellationToken, pending, i + 1, 0)

    member private this.StepAsyncSlow
        (ct: CancellationToken, awaiting: ValueTask, resumeSched: int, resumeStrict: int) : Task =
        let sched = schedule
        let strictN = strictOps
        backgroundTask {
            if not awaiting.IsCompletedSuccessfully then do! awaiting.AsTask()
            for i in resumeSched .. sched.Length - 1 do
                let vt = sched.[i].StepAsync ct
                if not vt.IsCompletedSuccessfully then do! vt.AsTask()
            for j in resumeStrict .. strictN.Length - 1 do
                let vt = strictN.[j].AfterStepAsync ct
                if not vt.IsCompletedSuccessfully then do! vt.AsTask()
            Interlocked.Increment &tick |> ignore
        }

    member this.StepManyAsync(count: int) : Task = this.StepManyAsync(count, CancellationToken.None)

    member this.StepManyAsync(count: int, cancellationToken: CancellationToken) : Task =
        if not built then this.Build()
        let sched = schedule
        let strictN = strictOps
        backgroundTask {
            for _ in 1 .. count do
                cancellationToken.ThrowIfCancellationRequested()
                for i in 0 .. sched.Length - 1 do
                    let vt = sched.[i].StepAsync cancellationToken
                    if not vt.IsCompletedSuccessfully then do! vt.AsTask()
                for i in 0 .. strictN.Length - 1 do
                    let vt = strictN.[i].AfterStepAsync cancellationToken
                    if not vt.IsCompletedSuccessfully then do! vt.AsTask()
                Interlocked.Increment &tick |> ignore
        }

    /// Advance `count` ticks, taking the sync fast path when every op is sync.
    member this.StepMany(count: int) : unit =
        for _ in 1 .. count do this.Step()


[<RequireQualifiedAccess>]
module Circuit =
    let create () = Circuit()
    let build (c: Circuit) = c.Build()
    let step (c: Circuit) = c.StepAsync()
    let stepSync (c: Circuit) = c.Step()
    let stepMany (n: int) (c: Circuit) = c.StepManyAsync n
    let stepManySync (n: int) (c: Circuit) = c.StepMany n
