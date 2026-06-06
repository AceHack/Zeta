namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO
open System.Text.Json
open System.Threading
open System.Threading.Tasks


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

    let writeFileAsync (path: string) (bytes: byte[]) (ct: CancellationToken) : Task =
        task {
            let opts =
                if fsync then FileOptions.Asynchronous ||| FileOptions.WriteThrough
                else FileOptions.Asynchronous
            use fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 4096, opts)
            do! fs.WriteAsync(ReadOnlyMemory bytes, ct).AsTask()
            do! fs.FlushAsync ct
            if fsync then fs.Flush(flushToDisk = true)
            if fsync then FileSync.fsyncDir root   // durably commit the new dir entry
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
