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
            for p in toDelete do
                try FileSystem.Current.Delete p with _ -> ()
            ValueTask.CompletedTask


/// Segment-backed `IDeltaLog` with group-commit fsync. Unlike
/// `DiskDeltaLog`, which writes one file per entry for audit/git-native
/// inspectability, this hot-path backend appends framed records to segment
/// files and routes appends through `FerryThrottler<'TItem,'TResult>`. Each ferry
/// boat writes N records then performs one `Flush(true)` before completing the N
/// caller tasks. Single-WRITER (one active segment at a time), so
/// `MaxDegreeOfParallelism` must be 1; segment sharding/striping is a later
/// scale-out backend, not an implicit behavior here.
///
/// **Segment rollover + physical truncation** (081KTF9T0E4 / 081KTF48J3V —
/// the increment the v1 no-op `TruncateAsync` named next): segments are named
/// `delta-{firstSeq:020}.segment` (the first record's sequence — so a
/// segment's coverage is `[itsFirstSeq, nextSegment.firstSeq)`, derivable
/// from names alone, no index file to drift). The ACTIVE (last) segment
/// rolls when it reaches `maxSegmentBytes`: the next boat seals it and opens
/// a new segment named by that boat's first sequence. `TruncateAsync(seq)`
/// then physically deletes whole SEALED segments whose coverage lies at or
/// below `seq` (the snapshot has absorbed them) — the active segment is
/// never deleted. Classic WAL segment GC (ARIES; SQLite WAL; Kafka log
/// segments). A pre-rollover `delta.segment` is honoured as the FIRST
/// segment (sorted before every numbered one), so existing dirs upgrade in
/// place with no migration step.
///
/// Record frame:
/// `[len:int32-LE][crc32c:uint32-LE][payload]`, where payload is
/// `[seq:int64-LE][capLen:int32-LE][capturedJson][deltaLen:int32-LE][deltaBytes]`.
/// Recovery scans segments in order. Torn-write handling is POSITIONAL: only
/// the ACTIVE segment can carry a torn trailing record (every sealed segment
/// was flushed through by its final boat before the roll), so a torn tail
/// there is truncated/ignored — but ANY anomaly inside a SEALED segment is
/// genuine corruption and fails loudly, as does non-trailing CRC corruption
/// anywhere.
[<Sealed>]
type GroupCommitDiskDeltaLog<'K when 'K : comparison>
    (dir: string,
     entryCodec: IEntryCodec<'K>,
     ?config: FerryThrottlerConfig,
     ?maxBatchBytes: int,
     ?maxSegmentBytes: int64) =

    let root = Path.GetFullPath dir
    do FileSystem.Current.CreateDirectory root

    /// Roll threshold for the active segment. The default favours few large
    /// segments; tests dial it down to force rollover.
    let segmentCap = defaultArg maxSegmentBytes (64L * 1024L * 1024L)

    let legacySegmentPath = Path.Combine(root, "delta.segment")
    let segmentNameFor (firstSeq: int64) = Path.Combine(root, sprintf "delta-%020d.segment" firstSeq)

    /// Discover segments in coverage order: the legacy unnumbered segment (if
    /// present) FIRST — it predates rollover, so it holds the earliest
    /// sequences (sentinel key 0; real sequences start at 1) — then the
    /// numbered segments by their embedded first-sequence.
    let discoverSegments () : ResizeArray<struct (int64 * string)> =
        let found = ResizeArray<struct (int64 * string)>()
        if FileSystem.Current.Exists legacySegmentPath then
            found.Add(struct (0L, legacySegmentPath))
        FileSystem.Current.GetFiles(root, "delta-*.segment")
        |> Array.choose (fun p ->
            let stem = Path.GetFileNameWithoutExtension p          // delta-{seq:020}
            match Int64.TryParse(stem.AsSpan(6)) with
            | true, v -> Some(struct (v, p))
            | _ -> None)
        |> Array.sortBy (fun (struct (s, _)) -> s)
        |> found.AddRange
        found

    let gate = obj ()
    // Segment list + active-segment size, guarded by `gate` (the ferry is the
    // single writer, but TruncateAsync and recovery scans run off-boat).
    let segments = discoverSegments ()
    let segmentLength (path: string) : int64 =
        if not (FileSystem.Current.Exists path) then 0L
        else
            use fs = FileSystem.Current.OpenFile(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)
            fs.Length

    let mutable activeSize =
        if segments.Count = 0 then 0L
        else
            let struct (_, last) = segments.[segments.Count - 1]
            segmentLength last

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

    /// Scan one segment. `sealed'` segments admit NO anomaly (their final boat
    /// flushed through before the roll — a torn tail there is corruption, loud);
    /// the active segment's torn TRAILING record is truncated (`ReadWrite`
    /// recovery scan) or ignored (read-only live replay). Non-trailing CRC
    /// corruption is loud everywhere.
    let scanSegment (path: string) (sealed': bool) (truncateTrailingTornWrite: bool) : DeltaLogEntry<'K>[] =
        if not (FileSystem.Current.Exists path) then
            [||]
        else
            let access = if truncateTrailingTornWrite then FileAccess.ReadWrite else FileAccess.Read
            use fs: Stream = FileSystem.Current.OpenFile(path, FileMode.Open, access, FileShare.ReadWrite)
            use br = new BinaryReader(fs)
            let entries = ResizeArray<DeltaLogEntry<'K>>()
            let name = Path.GetFileName path
            let torn (recordStart: int64) (what: string) =
                if sealed' then
                    invalidOp $"GroupCommitDiskDeltaLog: {what} at byte {recordStart} in SEALED segment {name} — corruption (a torn write can only trail the active segment)."
                elif truncateTrailingTornWrite then
                    fs.SetLength recordStart
            let mutable scanning = true
            while scanning do
                let recordStart = fs.Position
                if fs.Length - fs.Position = 0L then
                    scanning <- false
                elif fs.Length - fs.Position < 8L then
                    torn recordStart "short record header"
                    scanning <- false
                else
                    let len = br.ReadInt32()
                    let expectedCrc = br.ReadUInt32()
                    if len < 0 then
                        invalidOp $"GroupCommitDiskDeltaLog: negative record length {len} at byte {recordStart} in {name}."
                    elif fs.Length - fs.Position < int64 len then
                        torn recordStart "short record body"
                        scanning <- false
                    else
                        let payload = br.ReadBytes len
                        let actualCrc = HardwareCrc.Crc32C(ReadOnlySpan payload)
                        if actualCrc <> expectedCrc then
                            if fs.Position = fs.Length && not sealed' then
                                torn recordStart "trailing CRC mismatch"
                                scanning <- false
                            else
                                invalidOp
                                    $"GroupCommitDiskDeltaLog: CRC mismatch at byte {recordStart} in {name} (expected 0x{expectedCrc:X8}, got 0x{actualCrc:X8})."
                        else
                            entries.Add(decodePayload payload)
            entries.ToArray()

    /// Scan every segment in coverage order. Only the LAST is active.
    let scanEntries (truncateTrailingTornWrite: bool) : DeltaLogEntry<'K>[] =
        let segs = lock gate (fun () -> segments.ToArray())
        [| for i in 0 .. segs.Length - 1 do
               let struct (_, path) = segs.[i]
               yield! scanSegment path (i < segs.Length - 1) (truncateTrailingTornWrite && i = segs.Length - 1) |]

    let mutable nextSeq =
        let recovered = scanEntries true
        // The recovery scan may have truncated a torn tail — re-read the active size.
        (if segments.Count > 0 then
             let struct (_, last) = segments.[segments.Count - 1]
             activeSize <- segmentLength last)
        if recovered.Length = 0 then 0L else recovered |> Array.maxBy _.Seq |> _.Seq

    let appendBoat (boat: ReadOnlyMemory<GroupCommitDeltaAppendRequest>) (ct: CancellationToken) : Task<int64 array> =
        task {
            // Roll decision at boat start: no segment yet, or the active one has
            // reached the cap — open a new segment named by this boat's first
            // sequence (so names alone encode coverage). Under `gate`: the ferry
            // is the only writer, but TruncateAsync reads the list concurrently.
            let struct (segPath, createdSegment) =
                lock gate (fun () ->
                    if segments.Count = 0 || activeSize >= segmentCap then
                        let path = segmentNameFor boat.Span.[0].Seq
                        segments.Add(struct (boat.Span.[0].Seq, path))
                        activeSize <- 0L
                        struct (path, true)
                    else
                        let struct (_, last) = segments.[segments.Count - 1]
                        struct (last, not (FileSystem.Current.Exists last)))
            use fs: Stream = FileSystem.Current.OpenFile(segPath, FileMode.Append, FileAccess.Write, FileShare.Read)
            let mutable written = 0L
            for i in 0 .. boat.Length - 1 do
                let req = boat.Span.[i]
                do! fs.WriteAsync(ReadOnlyMemory req.Record, ct).AsTask()
                written <- written + int64 req.Record.Length
            do! fs.FlushAsync ct
            match fs with
            | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
            | _ -> fs.Flush()
            if createdSegment then
                FileSync.fsyncDir root
            lock gate (fun () -> activeSize <- activeSize + written)
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

        member _.TruncateAsync(throughSeqInclusive, _ct) =
            // Physically drop whole SEALED segments fully absorbed by the
            // snapshot: sealed segment i covers [firstSeq(i), firstSeq(i+1)),
            // derivable from names alone. The ACTIVE (last) segment is never
            // deleted — logical filtering (`ReplayAsync(fromSeqExclusive)`)
            // continues to mask any absorbed prefix it still holds.
            let toDelete =
                lock gate (fun () ->
                    let dead = ResizeArray<string>()
                    // Walk sealed segments from the front; stop at the first survivor
                    // (coverage is monotone, so nothing after it can be dead either).
                    let mutable stop = false
                    while not stop && segments.Count > 1 do
                        let struct (_, path) = segments.[0]
                        let struct (nextFirst, _) = segments.[1]
                        if nextFirst - 1L <= throughSeqInclusive then
                            dead.Add path
                            segments.RemoveAt 0
                        else
                            stop <- true
                    dead)
            for p in toDelete do
                try
                    if FileSystem.Current.Exists p then FileSystem.Current.Delete p
                with ex ->
                    Console.Error.WriteLine $"GroupCommitDiskDeltaLog.TruncateAsync: Delete %s{p} failed: %s{ex.Message}"
            ValueTask.CompletedTask

    interface IDisposable with
        member _.Dispose() = (throttler :> IDisposable).Dispose()

    // Deterministic, non-blocking disposal — forwards to the throttler's awaited
    // drain. Prefer this over `Dispose` wherever an async disposal scope exists
    // (`use!` in a task/async), so the group-commit ferries flush replayably.
    interface IAsyncDisposable with
        member _.DisposeAsync() = (throttler :> IAsyncDisposable).DisposeAsync()
