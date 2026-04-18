namespace Zeta.Core

open System
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


[<Sealed>]
type internal DelayOp<'T>(input: Op<'T>, initial: 'T) =
    inherit Op<'T>()
    let inputs = [| input :> Op |]
    let mutable state = initial
    override _.Name = "z^-1"
    override _.Inputs = inputs
    override _.IsStrict = true
    override this.StepAsync(_: CancellationToken) =
        this.Value <- state
        ValueTask.CompletedTask
    override _.AfterStepAsync(_: CancellationToken) =
        state <- input.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal IntegrateOp<'T>(input: Op<'T>, zero: 'T, add: Func<'T, 'T, 'T>) =
    inherit Op<'T>()
    let inputs = [| input :> Op |]
    let mutable state = zero
    override _.Name = "integrate"
    override _.Inputs = inputs
    // Integration is causal but NOT strict (per the DBSP paper, §2.18). The
    // scheduler runs us in topological order *after* `input`, so at StepAsync
    // time `input.Value` is the current tick's delta. We update state and
    // publish the running sum in one step.
    override this.StepAsync(_: CancellationToken) =
        state <- add.Invoke(state, input.Value)
        this.Value <- state
        ValueTask.CompletedTask


[<Sealed>]
type internal DifferentiateOp<'T>(input: Op<'T>, zero: 'T, sub: Func<'T, 'T, 'T>) =
    inherit Op<'T>()
    let inputs = [| input :> Op |]
    let mutable prev = zero
    override _.Name = "differentiate"
    override _.Inputs = inputs
    // IsStrict remains false — non-strict ops run in topo order so by the time
    // we execute, the input operator's `Value` reflects the current tick.
    override this.StepAsync(_: CancellationToken) =
        let cur = input.Value
        this.Value <- sub.Invoke(cur, prev)
        prev <- cur
        ValueTask.CompletedTask


[<Sealed>]
type internal ConstantOp<'T>(value: 'T) =
    inherit Op<'T>()
    override _.Name = "const"
    override _.Inputs = Array.empty
    override this.StepAsync(_: CancellationToken) =
        this.Value <- value
        ValueTask.CompletedTask


/// Primitive-operator builders. Exposed as C#-visible extension methods so
/// that both F# (`circuit.Delay(s)`) and C# (same syntax) work naturally.
[<Extension>]
type PrimitiveExtensions =

    [<Extension>]
    static member Delay<'T>(this: Circuit, s: Stream<'T>) : Stream<'T> =
        this.RegisterStream (DelayOp<'T>(s.Op, Unchecked.defaultof<'T>))

    [<Extension>]
    static member Delay<'T>(this: Circuit, s: Stream<'T>, initial: 'T) : Stream<'T> =
        this.RegisterStream (DelayOp<'T>(s.Op, initial))

    [<Extension>]
    static member Integrate<'T>(this: Circuit, s: Stream<'T>, zero: 'T, add: Func<'T, 'T, 'T>) : Stream<'T> =
        this.RegisterStream (IntegrateOp<'T>(s.Op, zero, add))

    [<Extension>]
    static member Differentiate<'T>(this: Circuit, s: Stream<'T>, zero: 'T, sub: Func<'T, 'T, 'T>) : Stream<'T> =
        this.RegisterStream (DifferentiateOp<'T>(s.Op, zero, sub))

    [<Extension>]
    static member Constant<'T>(this: Circuit, value: 'T) : Stream<'T> =
        this.RegisterStream (ConstantOp<'T>(value))

    /// `z^-1` for Z-sets (initial value = empty Z-set).
    [<Extension>]
    static member DelayZSet<'K when 'K : comparison>(this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (DelayOp<ZSet<'K>>(s.Op, ZSet<'K>.Empty))

    /// Integrate Z-sets with `ZSet.add` as the group operation.
    [<Extension>]
    static member IntegrateZSet<'K when 'K : comparison>(this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (IntegrateOp<ZSet<'K>>(s.Op, ZSet<'K>.Empty, Func<_, _, _>(ZSet.add)))

    /// Differentiate Z-sets.
    [<Extension>]
    static member DifferentiateZSet<'K when 'K : comparison>(this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (DifferentiateOp<ZSet<'K>>(s.Op, ZSet<'K>.Empty, Func<_, _, _>(ZSet.sub)))
