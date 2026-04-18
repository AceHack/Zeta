namespace Zeta.Core

open System
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// Opaque handle naming an upstream stream. Plugin authors list
/// these in `IOperator.ReadDependencies` so the scheduler can
/// build the DAG; plugin authors do not invoke anything on the
/// handle directly — they read stream values via the typed
/// `Stream<'T>` captured at construction time.
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type StreamHandle =
    val internal op: Op

    internal new(op: Op) = { op = op }


/// Write-only output channel handed to a plugin operator's
/// `StepAsync`. The only public operation is `Publish`: the
/// plugin calls it exactly once per tick to publish the
/// current tick's output. No read side; no way to obtain
/// another operator's `OutputBuffer`.
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type OutputBuffer<'TOut> =
    val internal target: Op<'TOut>
    val internal countRef: int ref

    internal new(target: Op<'TOut>, countRef: int ref) =
        { target = target; countRef = countRef }

    /// Publish this tick's output. Calling `Publish` more than
    /// once per `StepAsync` is a bug (last write wins); calling
    /// it zero times leaves consumers reading the previous tick.
    /// The publish counter increment is atomic so async plugins
    /// publishing from a continuation do not race a same-tick
    /// sync publish.
    member this.Publish(value: 'TOut) : unit =
        this.target.SetValue value
        System.Threading.Interlocked.Increment(&this.countRef.contents) |> ignore


/// Plugin-author contract for a custom operator with a typed
/// output. External plugin libraries implement this to extend
/// Zeta's operator catalogue without touching internal scheduler
/// types.
type IOperator<'TOut> =

    /// Short diagnostic label for the operator instance. Used
    /// for tracing and visualisation; not identity.
    abstract Name : string

    /// Every upstream stream this operator reads inside
    /// `StepAsync`. Populate once at construction — the array
    /// is read by the scheduler each `Circuit.Build`.
    abstract ReadDependencies : StreamHandle array

    /// Compute the current tick's output. Must call
    /// `output.Publish` exactly once before the returned
    /// `ValueTask` completes. Synchronous implementations
    /// return `ValueTask.CompletedTask`.
    abstract StepAsync : output: OutputBuffer<'TOut> * ct: CancellationToken -> ValueTask


/// Optional capability: strict operator (feedback-cut).
/// `StepAsync` publishes the *delayed* output (state captured on
/// the previous tick); `AfterStepAsync` captures the current
/// tick's input for publication next tick. `z^-1` is the
/// canonical strict operator.
type IStrictOperator<'TOut> =
    inherit IOperator<'TOut>
    abstract AfterStepAsync : ct: CancellationToken -> ValueTask


/// Optional capability: issues genuinely asynchronous work
/// (disk I/O, network RPC). Without this, the scheduler uses
/// the zero-alloc sync fast path. Implementing this forces
/// the slow async state-machine path — only opt in when
/// needed.
type IAsyncOperator =
    abstract IsAsync : bool


/// Optional capability: participates in a nested fixed-point
/// scope. `scope` numbers the enclosing fixed-point level; the
/// operator returns `true` iff it has reached its fixed point
/// in that scope. Default behaviour is `true` (not a fixed-
/// point participant); override to signal progress.
type INestedFixpointParticipant =
    abstract Fixedpoint : scope: int -> bool


/// Algebra capability: the operator is *linear* — `op(a + b) =
/// op(a) + op(b)` and `op(0) = 0`. Retraction-native: a
/// negative weight un-accumulates correctly. Declared at the
/// type level so the scheduler can run `LinearLaw` at
/// `Circuit.Build()`.
type ILinearOperator<'TIn, 'TOut> =
    inherit IOperator<'TOut>


/// Algebra capability: the operator is *bilinear* in two
/// inputs (e.g. a join). Incrementalisation generates the
/// standard `Δa ⋈ Δb + z^-1(I(a)) ⋈ Δb + Δa ⋈ z^-1(I(b))`
/// form.
type IBilinearOperator<'TIn1, 'TIn2, 'TOut> =
    inherit IOperator<'TOut>


/// Algebra capability: the operator is a *sink* — terminal,
/// non-Z-set-emitting, potentially retraction-lossy. Sink
/// operators are consciously exempt from relational
/// composition laws and the scheduler enforces terminal
/// placement (a sink may not feed another operator inside a
/// relational path). Bayesian aggregates are the canonical
/// example.
type ISinkOperator<'TIn, 'TOut> =
    inherit IOperator<'TOut>


/// Algebra capability: the operator carries explicit stateful
/// strict semantics — init / step / retract triple. Distinct
/// from `IStrictOperator` (feedback-cut): stateful-strict ops
/// hold per-key or per-instance state that must retract
/// cleanly when a negative weight arrives.
type IStatefulStrictOperator<'TIn, 'TState, 'TOut> =
    inherit IOperator<'TOut>


/// Internal adapter: wraps an `IOperator<'T>` inside an
/// `Op<'T>` subclass so the scheduler — which operates over
/// `Op`-typed arrays — can treat external plugin operators
/// identically to Core's internal catalogue. Core operators
/// keep inheriting `Op<'T>` directly, so only externally-
/// registered plugins pay the one-adapter-instance cost at
/// registration time.
type internal PluginOperatorAdapter<'TOut>(plugin: IOperator<'TOut>, inputOps: Op array) =
    inherit Op<'TOut>()

    // Publish counter shared between the adapter and the
    // OutputBuffer handed into StepAsync. Used to assert
    // exactly-one-publish-per-tick under PluginHarness; in
    // circuit execution it is incremented and left alone.
    let publishCount = ref 0

    // `asStrict` / `asAsync` / `asFixpoint` are cached
    // interface checks. The cost is paid once at
    // construction instead of every tick.
    let asStrict =
        match box plugin with
        | :? IStrictOperator<'TOut> as s -> Some s
        | _ -> None
    let asAsync =
        match box plugin with
        | :? IAsyncOperator as a -> Some a
        | _ -> None
    let asFixpoint =
        match box plugin with
        | :? INestedFixpointParticipant as f -> Some f
        | _ -> None

    member internal _.PublishCount = publishCount

    override _.Name = plugin.Name

    override _.Inputs = inputOps

    override _.IsStrict = asStrict.IsSome

    override _.IsAsync =
        match asAsync with
        | Some a -> a.IsAsync
        | None -> false

    override this.StepAsync(ct: CancellationToken) : ValueTask =
        let buffer = OutputBuffer<'TOut>(this, publishCount)
        plugin.StepAsync(buffer, ct)

    override _.AfterStepAsync(ct: CancellationToken) : ValueTask =
        match asStrict with
        | Some s -> s.AfterStepAsync ct
        | None -> ValueTask.CompletedTask

    override _.Fixedpoint(scope: int) : bool =
        match asFixpoint with
        | Some f -> f.Fixedpoint scope
        | None -> true


/// Public plugin-registration API and `Stream<'T>` extensions.
/// `Circuit.RegisterStream(op: IOperator<'T>)` is the sole entry
/// point for external plugin libraries.
[<AutoOpen>]
module PluginApi =

    type Stream<'T> with

        /// Obtain an opaque `StreamHandle` naming this stream's
        /// producing operator. Plugin authors list handles in
        /// `IOperator.ReadDependencies`; the scheduler resolves
        /// them at `Circuit.Build()` to build the DAG.
        member this.AsDependency() : StreamHandle =
            StreamHandle(this.Op :> Op)

    type Circuit with

        /// Register an external plugin operator and return a
        /// typed `Stream<'TOut>` naming its output. The public
        /// plugin-registration path. Core's internal catalogue
        /// keeps using the abstract-class `RegisterStream(op:
        /// Op<'TOut>)` overload; external callers must use this
        /// interface-typed path.
        member this.RegisterStream<'TOut>(op: IOperator<'TOut>) : Stream<'TOut> =
            let deps = op.ReadDependencies
            let inputOps = Array.init deps.Length (fun i -> deps.[i].op)
            let adapter = PluginOperatorAdapter<'TOut>(op, inputOps)
            this.RegisterStream adapter
