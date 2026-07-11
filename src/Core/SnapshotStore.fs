namespace Zeta.Core

open System.Collections.Generic
open System.IO
open System.Text.Json
open System.Threading
open System.Threading.Tasks


/// A durable pointer to a snapshot: the store handle + the delta-log sequence the
/// snapshot covers. Recovery needs only this + the log to rebuild. The handle is
/// store-specific (an int64 id in memory; a stable filename on disk).
type ISnapshotStore<'K when 'K : comparison> = ISnapshotStore<'K, ZSet<'K>>


/// In-memory snapshot store — the reference + test substrate. The "manifest" is a
/// field; survives only within the process (tests simulate restart by sharing the
/// instance, or use `DiskSnapshotStore` for true cross-restart).
[<Sealed>]
type InMemorySnapshotStore<'K when 'K : comparison>() =
    let store = Dictionary<int64, ZSet<'K>>()
    let gate = obj ()
    let mutable latest : SnapshotPointer option = None
    interface ISnapshotStore<'K> with
        member _.WriteAsync(seq, state, _ct) =
            let p = SnapshotPointer(box seq, seq)
            lock gate (fun () ->
                store.[seq] <- state
                latest <- Some p)
            Task.FromResult p
        member _.ReadAsync(pointer, _ct) =
            let seq = pointer.Handle :?> int64
            Task.FromResult(lock gate (fun () -> store.[seq]))
        member _.LatestAsync(_ct) =
            Task.FromResult(match latest with Some p -> p | None -> null)


/// Disk snapshot store — stable filenames (`snapshot-{seq:020}.snap`) + a durable
/// `LATEST.json` manifest, both written atomically (temp + rename) with optional
/// fsync. A fresh instance over the same dir reads the manifest and reloads the
/// snapshot — cross-restart snapshot+tail recovery. Delta bytes via `IDeltaCodec`.
[<Sealed>]
type DiskSnapshotStore<'K when 'K : comparison>
    (dir: string, codec: IDeltaCodec<'K>, ?fsyncOnWrite: bool) =

    let fsync = defaultArg fsyncOnWrite false
    let root = Path.GetFullPath dir
    do FileSystem.Current.CreateDirectory root
    let manifestPath = Path.Combine(root, "LATEST.json")
    let snapName (seq: int64) = sprintf "snapshot-%020d.snap" seq

    let writeAtomicAsync (path: string) (bytes: byte[]) (ct: CancellationToken) : Task =
        task {
            let tmp = path + ".tmp"
            let opts =
                if fsync then FileOptions.Asynchronous ||| FileOptions.WriteThrough
                else FileOptions.Asynchronous
            do! (task {
                    use fs: Stream = FileSystem.Current.OpenWrite(tmp, fsync)
                    do! fs.WriteAsync(System.ReadOnlyMemory bytes, ct).AsTask()
                    do! fs.FlushAsync ct
                    if fsync then
                        match fs with
                        | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
                        | _ -> ()
                 } : Task)
            FileSystem.Current.Move(tmp, path, true)   // atomic replace on the same volume
            if fsync then FileSync.fsyncDir root     // durably commit the rename in the dir
        }
        :> Task

    interface ISnapshotStore<'K> with
        member _.WriteAsync(seq, state, ct) =
            task {
                let file = snapName seq
                do! writeAtomicAsync (Path.Combine(root, file)) (codec.Encode state) ct
                // Manifest as a small string→string map (robust JSON round-trip).
                let m = Dictionary<string, string>()
                m.["seq"] <- string seq
                m.["file"] <- file
                do! writeAtomicAsync manifestPath (JsonSerializer.SerializeToUtf8Bytes m) ct
                return SnapshotPointer(box file, seq)
            }

        member _.ReadAsync(pointer, ct) =
            task {
                let file = pointer.Handle :?> string
                let! bytes = FileSystem.Current.ReadAllBytesAsync(Path.Combine(root, file), ct)
                return codec.Decode bytes
            }

        member _.LatestAsync(ct) =
            task {
                if not (FileSystem.Current.Exists manifestPath) then
                    return null
                else
                    let! bytes = FileSystem.Current.ReadAllBytesAsync(manifestPath, ct)
                    let m = JsonSerializer.Deserialize<Dictionary<string, string>> bytes
                    match m with
                    | null -> return null
                    | _ ->
                        let seq = int64 m.["seq"]
                        return SnapshotPointer(box m.["file"], seq)
            }
