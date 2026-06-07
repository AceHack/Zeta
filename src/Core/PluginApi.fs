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
    interface IStreamHandle
    val internal op: Op
    internal new(op: Op) = { op = op }


/// Write-only output channel handed to a plugin operator's
/// `StepAsync`. The only public operation is `Publish`: the
/// plugin calls it exactly once per tick to publish the
/// current tick's output. No read side; no way to obtain
/// another operator's `OutputBuffer`.
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type OutputBuffer<'TOut> =
    interface IOutputBuffer<'TOut> with
        member this.Publish(value: 'TOut) = this.Publish(value)
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


// Plugin-author interfaces (IOperator, IStrictOperator, IAsyncOperator, INestedFixpointParticipant, capabilities) are defined in C# (Zeta.Core.Abstractions).


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

    // Algebra capability detection via non-generic markers. The typed
    // interfaces (`ILinearOperator<_,_>` etc.) inherit from these
    // markers, so a plugin implementing `ILinearOperator<int, string>`
    // satisfies `ILinearMarker` automatically. Cached once at
    // construction; the adapter pays zero per-tick cost for capability
    // surfacing.
    let isLinearCap         = (box plugin) :? ILinearMarker
    let isBilinearCap       = (box plugin) :? IBilinearMarker
    let isSinkCap           = (box plugin) :? ISinkMarker
    let isStatefulStrictCap = (box plugin) :? IStatefulStrictMarker

    member internal _.PublishCount = publishCount

    override _.Name = plugin.Name

    override _.Inputs = inputOps

    override _.IsStrict = asStrict.IsSome

    override _.IsAsync =
        match asAsync with
        | Some a -> a.IsAsync
        | None -> false

    override _.IsLinear         = isLinearCap
    override _.IsBilinear       = isBilinearCap
    override _.IsSink           = isSinkCap
    override _.IsStatefulStrict = isStatefulStrictCap

    override this.StepAsync(ct: CancellationToken) : ValueTask =
        let buffer = OutputBuffer<'TOut>(this, publishCount)
        plugin.StepAsync(buffer :> IOutputBuffer<'TOut>, ct)

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

        /// Obtain an opaque `IStreamHandle` naming this stream's
        /// producing operator. Plugin authors list handles in
        /// `IOperator.ReadDependencies`; the scheduler resolves
        /// them at `Circuit.Build()` to build the DAG.
        member this.AsDependency() : IStreamHandle =
            StreamHandle(this.Op :> Op) :> IStreamHandle

    type Circuit with

        /// Register an external plugin operator and return a
        /// typed `Stream<'TOut>` naming its output. The public
        /// plugin-registration path. Core's internal catalogue
        /// keeps using the abstract-class `RegisterStream(op:
        /// Op<'TOut>)` overload; external callers must use this
        /// interface-typed path.
        member this.RegisterStream<'TOut>(op: IOperator<'TOut>) : Stream<'TOut> =
            let deps = op.ReadDependencies
            let inputOps =
                Array.init deps.Length (fun i ->
                    match deps.[i] with
                    | :? StreamHandle as h -> h.op
                    | _ -> failwith "Invalid stream handle type")
            let adapter = PluginOperatorAdapter<'TOut>(op, inputOps)
            this.RegisterStream adapter
