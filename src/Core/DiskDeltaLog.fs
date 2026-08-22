namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO
open System.Threading
open System.Threading.Tasks


[<Struct>]
type private GroupCommitDeltaAppendRequest =
    { Seq: int64
      Record: byte[] }


/// Disk-backed `IDeltaLog` — one file per entry under a directory, named by
/// zero-padded sequence (`{seq:020}.delta`). File-per-entry is git-native-friendly
/// (diffable, mirrors the agent-bus folder/G-Set pattern) and makes truncation a
/// delete, not a rewrite. Delta bytes go through the pluggable `IDeltaCodec`
/// (Checkpoint today, canonical CBOR/YAML later — no log changes). Genuine async
/// I/O (`File.*Async`); `fsyncPerAppend` writes through to stable storage before
/// the append completes. Single-writer per shard (writer-actor model).
///
/// Frame per file: `[capLen:int32-LE][capturedJson][deltaLen:int32-LE][deltaBytes]`
/// (seq lives in the filename). Captured non-determinism is a JSON object so the
/// metadata stays readable independent of the delta codec.
[<Sealed>]
type DiskDeltaLog<'K when 'K : comparison>
    (dir: string, entryCodec: IEntryCodec<'K>, ?fsyncPerAppend: bool) =

    let fsync = defaultArg fsyncPerAppend false
    let root = Path.GetFullPath dir
    do FileSystem.Current.CreateDirectory root
    let gate = obj ()

    let nameFor (seq: int64) = Path.Combine(root, sprintf "%020d.delta" seq)
    let seqOf (path: string) =
        match Int64.TryParse(Path.GetFileNameWithoutExtension path) with
        | true, v -> ValueSome v
        | _ -> ValueNone

    // Recover the high-water mark from any existing entry files on construction
    // (so a reopened log continues its sequence rather than restarting at 0).
    let mutable nextSeq =
        let existing =
            Directory.GetFiles(root, "*.delta")
            |> Array.choose (fun p -> match seqOf p with ValueSome v -> Some v | ValueNone -> None)
        if existing.Length = 0 then 0L else Array.max existing

    // One file = the WHOLE entry (Seq + Delta + Captured) through the canonical `IEntryCodec`
    // (the 4-language byte-locked DeltaLogEntryCodec format) — no per-backend framing, no System.Text.Json.
    let frame (entry: DeltaLogEntry<'K>) : byte[] = entryCodec.Encode entry

    let unframe (bytes: byte[]) : DeltaLogEntry<'K> = entryCodec.Decode bytes

    // Atomic append: write to a `.delta.tmp` then rename to `.delta`. A crash
    // mid-write leaves at most an orphan `.tmp` (ignored by the `*.delta` glob),
    // never a partial/torn `.delta` entry — so recovery never sees a corrupt entry
    // (crash-consistency by construction, like the snapshot store's temp+rename).
    let writeFileAsync (path: string) (bytes: byte[]) (ct: CancellationToken) : Task =
        task {
            let tmp = path + ".tmp"
            do! (task {
                    use fs: Stream = FileSystem.Current.OpenWrite(tmp, fsync)
                    do! fs.WriteAsync(ReadOnlyMemory bytes, ct).AsTask()
                    do! fs.FlushAsync ct
                    if fsync then
                        match fs with
                        | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
                        | _ -> ()
                 } : Task)
            FileSystem.Current.Move(tmp, path, true)   // atomic publish of the complete entry
            if fsync then FileSync.fsyncDir root      // durably commit the new dir entry
        }
        :> Task

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, ct) =
            let seq = lock gate (fun () -> nextSeq <- nextSeq + 1L; nextSeq)
            let bytes = frame (DeltaLogEntry<'K>(seq, delta, captured))
            task {
                do! writeFileAsync (nameFor seq) bytes ct
                return seq
            }
            |> ValueTask<int64>

        member _.ReplayAsync(fromSeqExclusive, ct) =
            let files =
                FileSystem.Current.GetFiles(root, "*.delta")
                |> Array.choose (fun p ->
                    match seqOf p with
                    | ValueSome v when v > fromSeqExclusive -> Some(v, p)
                    | _ -> None)
                |> Array.sortBy fst
            task {
                let entries = ResizeArray<DeltaLogEntry<'K>>()
                for (_seq, path) in files do
                    let! bytes = FileSystem.Current.ReadAllBytesAsync(path, ct)
                    // The entry's Seq rides inside the canonical bytes (== the file-name seq we wrote).
                    entries.Add(unframe bytes)
                return entries.ToArray()
            }
            |> ValueTask<DeltaLogEntry<'K>[]>

        member _.HighWater = lock gate (fun () -> nextSeq)

        member _.TruncateAsync(throughSeqInclusive, _ct) =
            let toDelete =
                FileSystem.Current.GetFiles(root, "*.delta")
                |> Array.choose (fun p ->
                    match seqOf p with
                    | ValueSome v when v <= throughSeqInclusive -> Some p
                    | _ -> None)
            // Thermodynamic class: ERASING through the read surface (the files are unlinked and
            // this backend keeps no second copy) and UNMEASURED at the medium — see the two rows
            // in `ErasureProfiles`. Note the swallowed failure: a delete that throws leaves the
            // file in place, so a *failed* call is quietly the identity. That is sound in the
            // Landauer direction (never over-charges) and unsound in the privacy direction, which
            // is why the medium-level row is not allowed to claim erasure.
            for p in toDelete do
                try FileSystem.Current.Delete p with _ -> ()
            ValueTask.CompletedTask

    /// **The declaration, beside the operation it classifies** (`ErasureClass`).
    ///
    /// Two rows for one method, because "is the preimage recoverable" is not a question until you
    /// say *through what*. Through this log's own read surface the deltas are gone. Through the
    /// storage medium nobody in this process can say: `Delete` unlinks a name, and whether the
    /// bytes survive in a journal, an SSD's remapped block, a snapshot or a backup is outside
    /// anything a sweep here can observe. Averaging those two into one class would be a guess
    /// wearing a measurement's clothes.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "DiskDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the log's own read surface (ReplayAsync(0) plus HighWater), at a pinned truncation point"
                RecoveryChannel =
                    "none — the .delta files are unlinked; unlike GitDeltaLog no parent commit \
                     retains them, and unlike ZetaFsDeltaLog no orphaned object is left behind. \
                     HighWater survives, because it is a field rather than a fold over the files, \
                     so how MANY entries were destroyed is still legible after they are gone"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}, on a real temp directory", 9, 3_169_925L) }

              { Representation = "DiskDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the storage medium after unlink"
                RecoveryChannel =
                    "unknown — File.Delete removes a directory entry; journal replay, SSD block \
                     remapping, filesystem snapshots and backups are all outside this process's \
                     observation, and the catch-all on the delete means even the unlink is not \
                     guaranteed to have happened"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "no sweep run from inside this process can observe the medium; classifying this as Reversible would claim recoverability we cannot deliver and classifying it as Erasing would claim destruction we cannot deliver either" } ]


/// Segment-backed `IDeltaLog` with group-commit fsync. Unlike
/// `DiskDeltaLog`, which writes one file per entry for audit/git-native
/// inspectability, this hot-path backend appends framed records to one segment
/// file and routes appends through `FerryThrottler<'TItem,'TResult>`. Each ferry
/// boat writes N records then performs one `Flush(true)` before completing the N
/// caller tasks. This v1 backend is a single-segment writer, so
/// `MaxDegreeOfParallelism` must be 1; segment sharding/striping is a later
/// scale-out backend, not an implicit behavior here.
///
/// Record frame:
/// `[len:int32-LE][crc32c:uint32-LE][payload]`, where payload is
/// `[seq:int64-LE][capLen:int32-LE][capturedJson][deltaLen:int32-LE][deltaBytes]`.
/// Recovery scans from the start, ignores/truncates a torn trailing record, and
/// fails loudly for non-trailing CRC corruption.
[<Sealed>]
type GroupCommitDiskDeltaLog<'K when 'K : comparison>
    (dir: string,
     entryCodec: IEntryCodec<'K>,
     ?config: FerryThrottlerConfig,
     ?maxBatchBytes: int) =

    let root = Path.GetFullPath dir
    do FileSystem.Current.CreateDirectory root

    let segmentPath = Path.Combine(root, "delta.segment")
    let gate = obj ()

    let baseConfig =
        match config with
        | Some c -> c
        | None -> { FerryThrottlerConfig.deterministic with MaxBatchSize = 64 }

    let ferryConfig =
        match maxBatchBytes with
        | Some bytes -> { baseConfig with MaxBatchBytes = Some bytes }
        | None -> baseConfig
    do
        if ferryConfig.MaxDegreeOfParallelism <> 1 then
            invalidArg
                (nameof config)
                "GroupCommitDiskDeltaLog writes one segment file; MaxDegreeOfParallelism must be 1."

    // The record PAYLOAD is the WHOLE entry (Seq + Delta + Captured) through the canonical `IEntryCodec`
    // (the 4-language byte-locked format); the record wrapper (`frameRecord`: [len][crc][payload]) is kept
    // for torn-write scanning. No per-payload framing, no System.Text.Json.
    let framePayload (entry: DeltaLogEntry<'K>) : byte[] = entryCodec.Encode entry

    let frameRecord (payload: byte[]) : byte[] =
        use ms = new MemoryStream()
        use bw = new BinaryWriter(ms)
        bw.Write(payload.Length)
        bw.Write(HardwareCrc.Crc32C(ReadOnlySpan payload))
        bw.Write(payload)
        bw.Flush()
        ms.ToArray()

    let decodePayload (payload: byte[]) : DeltaLogEntry<'K> = entryCodec.Decode payload

    let scanEntries (truncateTrailingTornWrite: bool) : DeltaLogEntry<'K>[] =
        if not (FileSystem.Current.Exists segmentPath) then
            [||]
        else
            let access = if truncateTrailingTornWrite then FileAccess.ReadWrite else FileAccess.Read
            use fs: Stream = FileSystem.Current.OpenFile(segmentPath, FileMode.Open, access, FileShare.ReadWrite)
            use br = new BinaryReader(fs)
            let entries = ResizeArray<DeltaLogEntry<'K>>()
            let mutable scanning = true
            while scanning do
                let recordStart = fs.Position
                if fs.Length - fs.Position = 0L then
                    scanning <- false
                elif fs.Length - fs.Position < 8L then
                    if truncateTrailingTornWrite then
                        fs.SetLength recordStart
                    scanning <- false
                else
                    let len = br.ReadInt32()
                    let expectedCrc = br.ReadUInt32()
                    if len < 0 then
                        invalidOp $"GroupCommitDiskDeltaLog: negative record length {len} at byte {recordStart}."
                    elif fs.Length - fs.Position < int64 len then
                        if truncateTrailingTornWrite then
                            fs.SetLength recordStart
                        scanning <- false
                    else
                        let payload = br.ReadBytes len
                        let actualCrc = HardwareCrc.Crc32C(ReadOnlySpan payload)
                        if actualCrc <> expectedCrc then
                            if fs.Position = fs.Length then
                                if truncateTrailingTornWrite then
                                    fs.SetLength recordStart
                                scanning <- false
                            else
                                invalidOp
                                    $"GroupCommitDiskDeltaLog: CRC mismatch at byte {recordStart} (expected 0x{expectedCrc:X8}, got 0x{actualCrc:X8})."
                        else
                            entries.Add(decodePayload payload)
            entries.ToArray()

    let mutable nextSeq =
        let recovered = scanEntries true
        if recovered.Length = 0 then 0L else recovered |> Array.maxBy _.Seq |> _.Seq

    let appendBoat (boat: ReadOnlyMemory<GroupCommitDeltaAppendRequest>) (ct: CancellationToken) : Task<int64 array> =
        task {
            let createdSegment = not (FileSystem.Current.Exists segmentPath)
            use fs: Stream = FileSystem.Current.OpenFile(segmentPath, FileMode.Append, FileAccess.Write, FileShare.Read)
            for i in 0 .. boat.Length - 1 do
                let req = boat.Span.[i]
                do! fs.WriteAsync(ReadOnlyMemory req.Record, ct).AsTask()
            do! fs.FlushAsync ct
            match fs with
            | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
            | _ -> fs.Flush()
            if createdSegment then
                FileSync.fsyncDir root
            return [| for i in 0 .. boat.Length - 1 -> boat.Span.[i].Seq |]
        }

    let throttler =
        new FerryThrottler<GroupCommitDeltaAppendRequest, int64>(
            ferryConfig,
            appendBoat,
            itemSizeBytes = (fun req -> req.Record.Length))

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, ct) =
            if ct.IsCancellationRequested then
                ValueTask<int64>(Task.FromCanceled<int64> ct)
            else
                let seq = lock gate (fun () -> nextSeq <- nextSeq + 1L; nextSeq)
                let payload = framePayload (DeltaLogEntry<'K>(seq, delta, captured))
                let req = { Seq = seq; Record = frameRecord payload }
                throttler.ProcessAsync(req, CancellationToken.None) |> ValueTask<int64>

        member _.ReplayAsync(fromSeqExclusive, _ct) =
            scanEntries false
            |> Array.filter (fun e -> e.Seq > fromSeqExclusive)
            |> Array.sortBy _.Seq
            |> ValueTask<DeltaLogEntry<'K>[]>

        member _.HighWater = lock gate (fun () -> nextSeq)

        member _.TruncateAsync(_throughSeqInclusive, _ct) =
            // Segment compaction/rollover is the next perf-tier increment. Recovery
            // and callers already pass `fromSeqExclusive`, so the correctness
            // invariant does not depend on physical deletion in this v1 backend.
            //
            // Thermodynamic class: REVERSIBLE, and for a third distinct reason. This one is the
            // identity function — it does not preserve the preimage through a clever channel, it
            // simply never touches it. Three backends, three reasons, one method name.
            ValueTask.CompletedTask

    /// **The declaration, beside the operation it classifies** (`ErasureClass`).
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "GroupCommitDiskDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the log's own read surface (ReplayAsync(0) plus HighWater), at a pinned truncation point"
                RecoveryChannel =
                    "everything — the call is a no-op, so the post-state is the pre-state and the \
                     segment still holds every record. Reversible because unimplemented, which is \
                     worth writing down: the class is honest today and will change the day \
                     compaction lands, and this declaration is what will fail when it does"
                Classification = ErasureClass.ThermodynamicClass.Reversible
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}, on a real temp directory", 1, 0L) } ]

    interface IDisposable with
        member _.Dispose() = (throttler :> IDisposable).Dispose()

    // Deterministic, non-blocking disposal — forwards to the throttler's awaited
    // drain. Prefer this over `Dispose` wherever an async disposal scope exists
    // (`use!` in a task/async), so the group-commit ferries flush replayably.
    interface IAsyncDisposable with
        member _.DisposeAsync() = (throttler :> IAsyncDisposable).DisposeAsync()
