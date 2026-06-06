namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO
open System.Text.Json
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
    (dir: string, codec: IDeltaCodec<'K>, ?fsyncPerAppend: bool) =

    let fsync = defaultArg fsyncPerAppend false
    let root = Path.GetFullPath dir
    do Directory.CreateDirectory root |> ignore
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

    let frame (captured: Map<string, string>) (delta: ZSet<'K>) : byte[] =
        let dict = Dictionary<string, string>()
        for KeyValue (k, v) in captured do dict.[k] <- v
        let capBytes = JsonSerializer.SerializeToUtf8Bytes dict
        let deltaBytes = codec.Encode delta
        use ms = new MemoryStream()
        use bw = new BinaryWriter(ms)
        bw.Write(capBytes.Length)
        bw.Write(capBytes)
        bw.Write(deltaBytes.Length)
        bw.Write(deltaBytes)
        bw.Flush()
        ms.ToArray()

    let unframe (bytes: byte[]) : Map<string, string> * ZSet<'K> =
        use ms = new MemoryStream(bytes)
        use br = new BinaryReader(ms)
        let capLen = br.ReadInt32()
        let capBytes = br.ReadBytes capLen
        let captured =
            JsonSerializer.Deserialize<Dictionary<string, string>> capBytes
            |> fun d ->
                match d with
                | null -> Map.empty
                | _ -> d |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq
        let deltaLen = br.ReadInt32()
        let deltaBytes = br.ReadBytes deltaLen
        captured, codec.Decode deltaBytes

    // Atomic append: write to a `.delta.tmp` then rename to `.delta`. A crash
    // mid-write leaves at most an orphan `.tmp` (ignored by the `*.delta` glob),
    // never a partial/torn `.delta` entry — so recovery never sees a corrupt entry
    // (crash-consistency by construction, like the snapshot store's temp+rename).
    let writeFileAsync (path: string) (bytes: byte[]) (ct: CancellationToken) : Task =
        task {
            let tmp = path + ".tmp"
            let opts =
                if fsync then FileOptions.Asynchronous ||| FileOptions.WriteThrough
                else FileOptions.Asynchronous
            do! (task {
                    use fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None, 4096, opts)
                    do! fs.WriteAsync(ReadOnlyMemory bytes, ct).AsTask()
                    do! fs.FlushAsync ct
                    if fsync then fs.Flush(flushToDisk = true)
                 } : Task)
            File.Move(tmp, path, overwrite = true)   // atomic publish of the complete entry
            if fsync then FileSync.fsyncDir root      // durably commit the new dir entry
        }
        :> Task

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, ct) =
            let seq = lock gate (fun () -> nextSeq <- nextSeq + 1L; nextSeq)
            let bytes = frame captured delta
            task {
                do! writeFileAsync (nameFor seq) bytes ct
                return seq
            }
            |> ValueTask<int64>

        member _.ReplayAsync(fromSeqExclusive, ct) =
            let files =
                Directory.GetFiles(root, "*.delta")
                |> Array.choose (fun p ->
                    match seqOf p with
                    | ValueSome v when v > fromSeqExclusive -> Some(v, p)
                    | _ -> None)
                |> Array.sortBy fst
            task {
                let entries = ResizeArray<DeltaLogEntry<'K>>()
                for (seq, path) in files do
                    let! bytes = File.ReadAllBytesAsync(path, ct)
                    let captured, delta = unframe bytes
                    entries.Add { Seq = seq; Delta = delta; Captured = captured }
                return entries.ToArray()
            }
            |> ValueTask<DeltaLogEntry<'K>[]>

        member _.HighWater = lock gate (fun () -> nextSeq)

        member _.TruncateAsync(throughSeqInclusive, _ct) =
            let toDelete =
                Directory.GetFiles(root, "*.delta")
                |> Array.choose (fun p ->
                    match seqOf p with
                    | ValueSome v when v <= throughSeqInclusive -> Some p
                    | _ -> None)
            for p in toDelete do
                try File.Delete p with _ -> ()
            ValueTask.CompletedTask


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
     codec: IDeltaCodec<'K>,
     ?config: FerryThrottlerConfig,
     ?maxBatchBytes: int) =

    let root = Path.GetFullPath dir
    do Directory.CreateDirectory root |> ignore

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

    let framePayload (seq: int64) (captured: Map<string, string>) (delta: ZSet<'K>) : byte[] =
        let dict = Dictionary<string, string>()
        for KeyValue (k, v) in captured do
            dict.[k] <- v
        let capBytes = JsonSerializer.SerializeToUtf8Bytes dict
        let deltaBytes = codec.Encode delta
        use ms = new MemoryStream()
        use bw = new BinaryWriter(ms)
        bw.Write(seq)
        bw.Write(capBytes.Length)
        bw.Write(capBytes)
        bw.Write(deltaBytes.Length)
        bw.Write(deltaBytes)
        bw.Flush()
        ms.ToArray()

    let frameRecord (payload: byte[]) : byte[] =
        use ms = new MemoryStream()
        use bw = new BinaryWriter(ms)
        bw.Write(payload.Length)
        bw.Write(HardwareCrc.Crc32C(ReadOnlySpan payload))
        bw.Write(payload)
        bw.Flush()
        ms.ToArray()

    let decodePayload (payload: byte[]) : DeltaLogEntry<'K> =
        use ms = new MemoryStream(payload)
        use br = new BinaryReader(ms)
        let seq = br.ReadInt64()
        let capLen = br.ReadInt32()
        let capBytes = br.ReadBytes capLen
        let captured =
            JsonSerializer.Deserialize<Dictionary<string, string>> capBytes
            |> fun d ->
                match d with
                | null -> Map.empty
                | _ -> d |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq
        let deltaLen = br.ReadInt32()
        let deltaBytes = br.ReadBytes deltaLen
        { Seq = seq; Delta = codec.Decode deltaBytes; Captured = captured }

    let scanEntries (truncateTrailingTornWrite: bool) : DeltaLogEntry<'K>[] =
        if not (File.Exists segmentPath) then
            [||]
        else
            let access = if truncateTrailingTornWrite then FileAccess.ReadWrite else FileAccess.Read
            use fs = new FileStream(segmentPath, FileMode.Open, access, FileShare.ReadWrite)
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
            let createdSegment = not (File.Exists segmentPath)
            use fs =
                new FileStream(
                    segmentPath,
                    FileMode.Append,
                    FileAccess.Write,
                    FileShare.Read,
                    4096,
                    FileOptions.Asynchronous ||| FileOptions.WriteThrough)
            for i in 0 .. boat.Length - 1 do
                let req = boat.Span.[i]
                do! fs.WriteAsync(ReadOnlyMemory req.Record, ct).AsTask()
            do! fs.FlushAsync ct
            fs.Flush(flushToDisk = true)
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
                let payload = framePayload seq captured delta
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
            ValueTask.CompletedTask

    interface IDisposable with
        member _.Dispose() = (throttler :> IDisposable).Dispose()
