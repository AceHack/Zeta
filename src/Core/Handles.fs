namespace Zeta.Core

open System
open System.Collections.Concurrent
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Channels
open System.Threading.Tasks


[<Sealed>]
type internal ZSetInputOp<'K when 'K : comparison>() =
    inherit Op<ZSet<'K>>()
    let pending = ConcurrentQueue<ZSet<'K>>()

    member _.Enqueue(value: ZSet<'K>) =
        if not value.IsEmpty then pending.Enqueue value

    override _.Name = "input"
    override _.Inputs = Array.empty
    override this.StepAsync(_: CancellationToken) =
        let mutable acc = ZSet<'K>.Empty
        let mutable item = Unchecked.defaultof<ZSet<'K>>
        while pending.TryDequeue &item do
            acc <- if acc.IsEmpty then item else ZSet.add acc item
        this.Value <- acc
        ValueTask.CompletedTask


[<Sealed>]
type internal ScalarInputOp<'T>() =
    inherit Op<'T>()
    // Single-slot store with atomic publish. Producer and consumer
    // synchronise via `Interlocked.Exchange` on `hasValue`, which fences
    // both the preceding `pending` write and the subsequent `pending`
    // read. This avoids the lost-update race where the scheduler clears
    // `hasValue=0` after a producer has already re-armed it with a fresh
    // value.
    let lockObj = obj ()
    let mutable pending = Unchecked.defaultof<'T>
    let mutable hasValue = false

    member _.Set(value: 'T) =
        lock lockObj (fun () ->
            pending <- value
            hasValue <- true)

    override _.Name = "input-scalar"
    override _.Inputs = Array.empty
    override this.StepAsync(_: CancellationToken) =
        lock lockObj (fun () ->
            if hasValue then
                this.Value <- pending
                hasValue <- false
            else
                this.Value <- Unchecked.defaultof<'T>)
        ValueTask.CompletedTask


[<Sealed>]
type internal ChannelZSetInputOp<'K when 'K : comparison>(capacity: int) =
    inherit Op<ZSet<'K>>()
    let channel =
        Channel.CreateBounded<ZSet<'K>>(
            BoundedChannelOptions(capacity,
                SingleReader = true,
                SingleWriter = false,
                AllowSynchronousContinuations = false,
                FullMode = BoundedChannelFullMode.Wait))

    member _.SendAsync(value: ZSet<'K>) : ValueTask =
        if value.IsEmpty then ValueTask.CompletedTask
        else channel.Writer.WriteAsync(value, CancellationToken.None)

    member _.SendAsync(value: ZSet<'K>, ct: CancellationToken) : ValueTask =
        if value.IsEmpty then ValueTask.CompletedTask
        else channel.Writer.WriteAsync(value, ct)

    member _.TryWrite(value: ZSet<'K>) : bool =
        if value.IsEmpty then true
        else channel.Writer.TryWrite value

    member _.Complete() = channel.Writer.TryComplete() |> ignore

    override _.Name = "input-channel"
    override _.Inputs = Array.empty
    override this.StepAsync(_: CancellationToken) =
        let mutable acc = ZSet<'K>.Empty
        let mutable item = Unchecked.defaultof<ZSet<'K>>
        while channel.Reader.TryRead &item do
            acc <- if acc.IsEmpty then item else ZSet.add acc item
        this.Value <- acc
        ValueTask.CompletedTask


[<Sealed>]
type ZSetInputHandle<'K when 'K : comparison> internal (op: ZSetInputOp<'K>) =
    member _.Stream : Stream<ZSet<'K>> = Stream op

    /// Enqueue a delta for the next tick. Thread-safe, lock-free.
    member _.Send(value: ZSet<'K>) : unit = op.Enqueue value

    /// Async variant — completes synchronously (returns a completed `ValueTask`)
    /// because the queue is unbounded. Exists so library code can use the
    /// same shape on every input kind.
    member _.SendAsync(value: ZSet<'K>) : ValueTask =
        op.Enqueue value
        ValueTask.CompletedTask


[<Sealed>]
type ChannelZSetInputHandle<'K when 'K : comparison> internal (op: ChannelZSetInputOp<'K>) =
    member _.Stream : Stream<ZSet<'K>> = Stream op
    member _.SendAsync(value: ZSet<'K>) : ValueTask = op.SendAsync value
    member _.SendAsync(value: ZSet<'K>, ct: CancellationToken) : ValueTask = op.SendAsync(value, ct)
    member _.TryWrite(value: ZSet<'K>) : bool = op.TryWrite value
    member _.Complete() = op.Complete()


[<Sealed>]
type ScalarInputHandle<'T> internal (op: ScalarInputOp<'T>) =
    member _.Stream : Stream<'T> = Stream op
    member _.Set(value: 'T) : unit = op.Set value


[<Struct; IsReadOnly; NoComparison; NoEquality>]
type OutputHandle<'T> =
    val internal Op: Op<'T>
    internal new(op: Op<'T>) = { Op = op }
    member this.Current = this.Op.Value
    member this.Stream = Stream this.Op


[<Extension>]
type HandleExtensions =

    [<Extension>]
    static member ZSetInput<'K when 'K : comparison>(this: Circuit) : ZSetInputHandle<'K> =
        let op = this.Register (ZSetInputOp<'K>())
        ZSetInputHandle op

    [<Extension>]
    static member ScalarInput<'T>(this: Circuit) : ScalarInputHandle<'T> =
        let op = this.Register (ScalarInputOp<'T>())
        ScalarInputHandle op

    [<Extension>]
    static member ChannelZSetInput<'K when 'K : comparison>(this: Circuit, capacity: int) : ChannelZSetInputHandle<'K> =
        let op = this.Register (ChannelZSetInputOp<'K>(capacity))
        ChannelZSetInputHandle op

    [<Extension>]
    static member Output<'T>(this: Circuit, s: Stream<'T>) : OutputHandle<'T> =
        ignore this
        OutputHandle s.Op
