namespace Zeta.Core

open System.Collections.Generic
open System.Threading
open System.Threading.Tasks


/// One entry in the **delta log** — the durable record of a committed input
/// Z-set delta (a "command", VoltDB-style: we log the input, not the derived
/// state) at a logical sequence number, plus any captured non-determinism the
/// producer read (clock/RNG/external) so replay is deterministic (DST §7).
///
/// `Captured` is empty when the producer was pure. Keys are caller-chosen names
/// (e.g. "clock", "seed"); values are the byte-verified-serializable form re-fed
/// on replay. (Stored as string here — v1; the disk-backed log will route this
/// through the byte-verified canonical codec behind the serialization seam.)
type DeltaLogEntry<'K when 'K : comparison> = DeltaLogEntry<'K, ZSet<'K>>
type IDeltaLog<'K when 'K : comparison> = IDeltaLog<'K, ZSet<'K>>


/// In-memory delta log — the reference implementation + the DST/test substrate.
/// Genuinely synchronous (a list under a lock), so returns completed ValueTasks;
/// that is truthful, not Task.Run fakery (there is no I/O to yield on).
[<Sealed>]
type InMemoryDeltaLog<'K when 'K : comparison>() =
    let entries = List<DeltaLogEntry<'K>>()
    let gate = obj ()
    let mutable nextSeq = 0L

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, _ct) =
            let seq =
                lock gate (fun () ->
                    nextSeq <- nextSeq + 1L
                    entries.Add(DeltaLogEntry<'K>(nextSeq, delta, captured))
                    nextSeq)
            ValueTask<int64>(seq)

        member _.ReplayAsync(fromSeqExclusive, _ct) =
            let tail =
                lock gate (fun () ->
                    // entries are appended in seq order, so a linear scan from the
                    // first entry past the bound preserves order; copy under lock.
                    [| for e in entries do if e.Seq > fromSeqExclusive then yield e |])
            ValueTask<DeltaLogEntry<'K>[]>(tail)

        member _.HighWater = lock gate (fun () -> nextSeq)

        member _.TruncateAsync(throughSeqInclusive, _ct) =
            lock gate (fun () ->
                entries.RemoveAll(fun e -> e.Seq <= throughSeqInclusive) |> ignore)
            ValueTask.CompletedTask
