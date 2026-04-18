namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// A nested sub-circuit with its own clock. Each outer tick of the parent
/// circuit drives the nested circuit to a fixed point — its inner clock
/// advances repeatedly until every operator in the nested scope reports
/// `Fixedpoint`. This is the machinery that implements Section 5-6 of the
/// DBSP paper: recursive queries with incremental re-evaluation per outer
/// transaction.
///
/// The nested circuit's own inner-clock tick counter resets to 0 at the
/// start of each outer tick, so strict operators inside the nested scope
/// see a fresh clock per outer step.
[<Sealed>]
type NestedCircuit internal (parent: Circuit) =
    let inner = Circuit()
    let maxIterations = 64
    let mutable innerTick = 0L
    // Cache `inner.Ops` after `Build` so `Iterate` doesn't allocate a
    // fresh `Seq.toArray` per outer tick. `inner.Build` is idempotent
    // + guarded under `registerLock` in `Circuit`, so once `built =
    // true` the op set is frozen and the cache is forever valid.
    // Scalability win flagged by the scalability-audit agent —
    // at 10k outer ticks/sec × 10k ops that's ~100M avoided allocs/sec.
    let mutable opsCache : Op array = [||]

    /// The inner circuit object itself — operators register here.
    member _.Inner = inner

    /// The parent circuit that drives this nested scope.
    member _.Parent = parent

    /// How many inner iterations we last ran (exposed for metrics/debug).
    member _.LastIterationCount = innerTick

    /// Was the last `Iterate` call converged (hit fixedpoint before
    /// `maxIterations`)? Exposed for metrics/tests that need to assert the
    /// nested scope actually reached its LFP rather than hitting the cap.
    member val Converged = false with get, set

    /// The per-scope iteration cap (default 64). Change this if your
    /// recursion depth exceeds the default.
    member val MaxIterations = maxIterations with get, set

    /// Drive the nested circuit to a fixed point. Called once per outer tick.
    /// Returns the iteration count actually executed.
    member this.Iterate() : int =
        inner.Build()
        // Populate `opsCache` once on first call after Build. Subsequent
        // calls reuse the same array — zero allocation per outer tick
        // from this point. See constructor comment for scalability
        // motivation.
        let opsSnap =
            if opsCache.Length = 0 && inner.OperatorCount > 0 then
                opsCache <- Seq.toArray inner.Ops
                opsCache
            else opsCache
        // Reset all operators' inner-clock state at the start of this outer
        // tick (per the paper's nested-stream semantics).
        for op in opsSnap do op.ClockStart()
        innerTick <- 0L
        let mutable iteration = 0
        let mutable converged = false
        let cap = this.MaxIterations
        while not converged && iteration < cap do
            inner.Step()
            iteration <- iteration + 1
            innerTick <- innerTick + 1L
            // Check fixedpoint: every operator must claim convergence at
            // scope-0 (our only nesting level for now).
            let mutable allFixed = true
            for op in opsSnap do
                if not (op.Fixedpoint 0) then allFixed <- false
            converged <- allFixed
        for op in opsSnap do op.ClockEnd()
        this.Converged <- converged
        iteration


/// An operator that drives a nested circuit each outer tick. Registers in
/// the parent circuit; internally runs the nested child circuit to a
/// fixed point per outer step and pipes one chosen inner output out.
[<Sealed>]
type internal IterateOp<'T>(nested: NestedCircuit, extract: unit -> 'T) =
    inherit Op<'T>()
    override _.Name = "iterate"
    override _.Inputs = Array.empty
    override this.StepAsync(_: CancellationToken) =
        nested.Iterate() |> ignore
        this.Value <- extract()
        ValueTask.CompletedTask


[<Extension>]
type NestedCircuitExtensions =

    /// Build a new nested sub-circuit. The `build` callback receives a
    /// `NestedCircuit` to register inner operators against, and returns a
    /// `Stream<'T>` from that inner circuit whose current value will be
    /// materialised as the outer operator's output.
    [<Extension>]
    static member Nest<'T>
        (this: Circuit, build: Func<NestedCircuit, Stream<'T>>) : Stream<'T> =
        let nested = NestedCircuit(this)
        let innerOutput = build.Invoke nested
        let outerOp = IterateOp(nested, fun () -> innerOutput.Current)
        this.RegisterStream outerOp

    /// Like `Nest`, but also returns the `NestedCircuit` so callers can
    /// observe `Converged`, adjust `MaxIterations`, or inspect
    /// `LastIterationCount` from outside. Without this overload, those
    /// getters on `NestedCircuit` are unreachable.
    [<Extension>]
    static member NestWithHandle<'T>
        (this: Circuit, build: Func<NestedCircuit, Stream<'T>>) : struct (Stream<'T> * NestedCircuit) =
        let nested = NestedCircuit(this)
        let innerOutput = build.Invoke nested
        let outerOp = IterateOp(nested, fun () -> innerOutput.Current)
        struct (this.RegisterStream outerOp, nested)
