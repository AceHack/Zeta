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
type DeltaLogEntry<'K when 'K : comparison> =
    { Seq: int64
      Delta: ZSet<'K>
      Captured: Map<string, string> }


/// **Append-only delta log** — the durable-tier mechanism for "persist inputs,
/// recompute derived". Single-writer per agent shard (matches the writer-actor
/// model: one clone writes its shard), so ordering is a local total order.
///
/// `ReplayAsync` returns the tail (seq > `fromSeqExclusive`) in seq order, which
/// recovery folds through the deterministic dataflow after restoring a snapshot.
/// (v1 returns an array — the live log between snapshots is bounded by snapshot
/// cadence; a streaming `IAsyncEnumerable` variant can come later if needed.)
///
/// **Backends map onto this abstraction differently:**
///   - *Filesystem* — builds the log/history/branch/merge itself (the hard way).
///   - *Git-native* — IS git: `AppendAsync` = a commit (the delta is the committed
///     content), recovery walk = `git log` over the commit DAG (history = the log
///     for free), branches = relativistic frames/shards, Z-set **retraction** =
///     appending the inverse delta as a new commit (git never rewrites history —
///     Landauer-honest; Memory-Preservation §5), cross-branch merge = MRDT
///     three-way via git's LCA. Endgame: Zeta is a git server, so the DB and the
///     git remote are the same thing.
type IDeltaLog<'K when 'K : comparison> =
    /// Append a committed delta; returns the assigned sequence number (monotonic,
    /// starting at 1). `captured` carries any non-determinism for replay.
    abstract AppendAsync:
        delta: ZSet<'K> * captured: Map<string, string> * ct: CancellationToken
            -> ValueTask<int64>
    /// Replay entries with seq strictly greater than `fromSeqExclusive`, in order.
    abstract ReplayAsync:
        fromSeqExclusive: int64 * ct: CancellationToken
            -> ValueTask<DeltaLogEntry<'K>[]>
    /// Highest assigned sequence number (0 if empty).
    abstract HighWater: int64


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
                    entries.Add { Seq = nextSeq; Delta = delta; Captured = captured }
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
