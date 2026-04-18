namespace Zeta.Core

open System
open System.Collections.Concurrent
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// CDC-style operations on a primary-keyed relation. An UPSERT source
/// translates these into Z-set deltas that retract the previous tuple for
/// a given key and insert the new one.
[<Struct>]
type UpsertOp<'K, 'V when 'K : comparison and 'V : comparison> =
    | Insert of ins: struct ('K * 'V)
    | Update of upd: struct ('K * 'V * 'V)   // key, oldValue, newValue
    | Delete of del: struct ('K * 'V)


/// `UpsertHandle<'K,'V>` — input port that accepts primary-key upserts
/// and produces correct DBSP deltas. Unlike `ZSetInputHandle` which
/// requires users to send `+new, -old` pairs, the upsert handle tracks
/// the live value per key and emits the cancellation pair automatically
/// on Update/Delete. Thread-safe; producers on any thread may call
/// `Insert` / `Update` / `Delete` concurrently.
[<Sealed>]
type internal UpsertInputOp<'K, 'V when 'K : comparison and 'V : comparison and 'K : not null>() =
    inherit Op<ZSet<'K * 'V>>()
    let pending = ConcurrentQueue<UpsertOp<'K, 'V>>()
    // Live-value map keyed by primary key. Thread-safe for producer reads
    // via ConcurrentDictionary; drained single-threaded in StepAsync.
    let live = ConcurrentDictionary<'K, 'V>(EqualityComparer.Default)

    member _.Enqueue(op: UpsertOp<'K, 'V>) = pending.Enqueue op
    member _.Live = live

    override _.Name = "upsertInput"
    override _.Inputs = Array.empty
    override this.StepAsync(_: CancellationToken) =
        let mutable buf = Pool.Rent<ZEntry<'K * 'V>> 16
        let mutable count = 0
        try
            let ensureCapacity need =
                if count + need > buf.Length then
                    let bigger = Pool.Rent<ZEntry<'K * 'V>> ((count + need) * 2)
                    Array.Copy(buf, bigger, count)
                    Pool.Return buf
                    buf <- bigger
            let mutable op = Unchecked.defaultof<UpsertOp<'K, 'V>>
            while pending.TryDequeue &op do
                match op with
                | Insert (struct (k, v)) ->
                    ensureCapacity 1
                    buf.[count] <- ZEntry((k, v), 1L)
                    count <- count + 1
                    live.[k] <- v
                | Update (struct (k, oldV, newV)) ->
                    ensureCapacity 2
                    buf.[count]     <- ZEntry((k, oldV), -1L)
                    buf.[count + 1] <- ZEntry((k, newV), 1L)
                    count <- count + 2
                    live.[k] <- newV
                | Delete (struct (k, oldV)) ->
                    ensureCapacity 1
                    buf.[count] <- ZEntry((k, oldV), -1L)
                    count <- count + 1
                    live.TryRemove k |> ignore
            if count = 0 then
                this.Value <- ZSet<'K * 'V>.Empty
            else
                let live = ZSetBuilder.sortAndConsolidate (Span<_>(buf, 0, count))
                this.Value <-
                    if live = 0 then ZSet<'K * 'V>.Empty
                    else ZSet(Pool.FreezeSlice(buf, live))
        finally
            Pool.Return buf
        ValueTask.CompletedTask


[<Sealed>]
type UpsertHandle<'K, 'V when 'K : comparison and 'V : comparison and 'K : not null>
    internal (op: UpsertInputOp<'K, 'V>) =

    member _.Stream : Stream<ZSet<'K * 'V>> = Stream op

    /// Thread-safe insert. Emits `+1` weight on `(key, value)` next tick.
    member _.Insert(key: 'K, value: 'V) : unit =
        op.Enqueue(Insert (struct (key, value)))

    /// Thread-safe update — automatically cancels the old tuple. `oldValue`
    /// must match the current live value under `key`; callers who don't
    /// know it can use `TryUpdate`.
    member _.Update(key: 'K, oldValue: 'V, newValue: 'V) : unit =
        op.Enqueue(Update (struct (key, oldValue, newValue)))

    /// Update using the live map's current value as `oldValue`. Returns
    /// `false` if no live value is present for `key`.
    member this.TryUpdate(key: 'K, newValue: 'V) : bool =
        let mutable cur = Unchecked.defaultof<'V>
        if op.Live.TryGetValue(key, &cur) then
            this.Update(key, cur, newValue)
            true
        else
            false

    /// Thread-safe delete with explicit old-value.
    member _.Delete(key: 'K, oldValue: 'V) : unit =
        op.Enqueue(Delete (struct (key, oldValue)))

    /// Delete using the live map's current value.
    member this.TryDelete(key: 'K) : bool =
        let mutable cur = Unchecked.defaultof<'V>
        if op.Live.TryGetValue(key, &cur) then
            this.Delete(key, cur)
            true
        else
            false


[<Extension>]
type UpsertExtensions =

    /// CDC-style input port: push `Insert`/`Update`/`Delete` ops keyed by
    /// a primary key; the engine generates the right Z-set deltas.
    [<Extension>]
    static member UpsertInput<'K, 'V
        when 'K : comparison and 'V : comparison and 'K : not null>
        (this: Circuit) : UpsertHandle<'K, 'V> =
        UpsertHandle (this.Register (UpsertInputOp<'K, 'V>()))
