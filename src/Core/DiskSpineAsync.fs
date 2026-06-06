namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO
open System.Threading
open System.Threading.Tasks


/// **Truthfully-async** backing store — the async mirror of `IBackingStore<'K>`.
/// Every method genuinely yields on I/O (`File.*Async`, awaited); there is NO
/// `Task.Run` wrapping synchronous disk calls to *look* async (that would be the
/// async-over-sync lie — see `.claude/rules/async-all-the-way-truthful-signatures.md`).
/// Additive: the synchronous `IBackingStore` / `BackedSpine` / `DiskBackingStore`
/// are unchanged and remain the right choice for in-RAM workloads.
type IAsyncBackingStore<'K when 'K : comparison> =
    /// Persist a Z-set level; return a handle that can reload it.
    abstract SaveAsync: level: int * batch: ZSet<'K> * ct: CancellationToken -> ValueTask<obj>
    /// Reload a previously-saved batch.
    abstract LoadAsync: handle: obj * ct: CancellationToken -> ValueTask<ZSet<'K>>
    /// Release the backing storage for a batch (called after merge).
    abstract ReleaseAsync: handle: obj * ct: CancellationToken -> ValueTask


/// In-memory async store. The work is genuinely synchronous (a dictionary), so
/// these return *completed* ValueTasks — which is TRUTHFUL, not fakery: there is
/// no I/O to yield on, and we never spin up a thread to pretend otherwise.
[<Sealed>]
type InMemoryAsyncBackingStore<'K when 'K : comparison>() =
    let store = Dictionary<int64, ZSet<'K>>()
    let mutable nextId = 0L
    interface IAsyncBackingStore<'K> with
        member _.SaveAsync(_level, batch, _ct) =
            let id = Interlocked.Increment &nextId
            lock store (fun () -> store.[id] <- batch)
            ValueTask<obj>(id :> obj)
        member _.LoadAsync(handle, _ct) =
            let id = handle :?> int64
            ValueTask<ZSet<'K>>(lock store (fun () -> store.[id]))
        member _.ReleaseAsync(handle, _ct) =
            let id = handle :?> int64
            lock store (fun () -> store.Remove id |> ignore)
            ValueTask.CompletedTask


/// Disk-backed async store. Mirrors `DiskBackingStore` exactly — same spill
/// quota, per-instance GUID prefix, path canonicalisation + traversal/ADS guards,
/// and the same lock discipline (metadata under `hotLock`; **all I/O awaited
/// OUTSIDE the lock**) — but the actual reads/writes are `File.*Async`.
/// `fsyncPerSave` (default false) selects the durability mode:
///   • false ⇒ **OS-buffered** — `File.WriteAllBytesAsync`; durable across a
///     process crash, last ~sec lost on a host/kernel crash.
///   • true  ⇒ **fsync-per-save** — the spill is written through to stable
///     storage (`FileOptions.WriteThrough` + `Flush(flushToDisk=true)`) before
///     `SaveAsync` completes. HONESTY CAVEAT: this fsyncs the file's data +
///     metadata; it does NOT yet fsync the *parent directory*, so a brand-new
///     file's directory entry could be lost on a crash between create and dir
///     fsync. Parent-dir fsync is a documented follow-up before this is claimed
///     as full buffered-durable-linearizability (Izraelevitz DISC'16).
[<Sealed>]
type DiskAsyncBackingStore<'K when 'K : comparison>
    (workDir: string, inMemoryQuotaBytes: int64, ?fsyncPerSave: bool) =
    let fsync = defaultArg fsyncPerSave false
    let rootDir = Path.GetFullPath workDir
    do Directory.CreateDirectory rootDir |> ignore

    /// Write bytes to `path`, forcing them through to stable storage when
    /// `fsync` is set. Async throughout — no `Task.Run` over sync I/O.
    let writeBytesAsync (path: string) (bytes: byte[]) (ct: CancellationToken) : Task =
        task {
            let opts =
                if fsync then FileOptions.Asynchronous ||| FileOptions.WriteThrough
                else FileOptions.Asynchronous
            use fs =
                new FileStream(
                    path, FileMode.Create, FileAccess.Write, FileShare.None,
                    bufferSize = 4096, options = opts)
            do! fs.WriteAsync(ReadOnlyMemory(bytes), ct).AsTask()
            do! fs.FlushAsync ct
            // WriteThrough already bypasses the OS write-back cache; the explicit
            // flush-to-disk is belt-and-braces for platforms where WriteThrough
            // is advisory.
            if fsync then fs.Flush(flushToDisk = true)
        }
        :> Task
    let instancePrefix = Guid.NewGuid().ToString("N")
    let hot = Dictionary<int64, ZSet<'K>>()
    let paths = Dictionary<int64, string>()
    let mutable nextId = 0L
    let mutable heapBytes = 0L
    let hotLock = obj ()

    let approxSize (z: ZSet<'K>) : int64 = int64 (z.Count * 24)

    let isCaseInsensitivePathFs =
        OperatingSystem.IsWindows() || OperatingSystem.IsMacOS()

    let pathComparison =
        if isCaseInsensitivePathFs then StringComparison.OrdinalIgnoreCase
        else StringComparison.Ordinal

    let pathFor (id: int64) : string =
        let filename = $"spine-{instancePrefix}-{id}.json"
        let candidate = Path.GetFullPath(Path.Combine(rootDir, filename))
        let rootWithSep = rootDir.TrimEnd(Path.DirectorySeparatorChar) + string Path.DirectorySeparatorChar
        if not (candidate.StartsWith(rootWithSep, pathComparison)) then
            invalidOp $"Refused spine spill path outside working directory: {candidate}"
        let finalName = Path.GetFileName candidate
        if finalName.Contains ':' then
            invalidOp $"Refused spine spill with ADS suffix in filename: {finalName}"
        candidate

    /// Spill an id from `hot` to disk. Caller must hold `hotLock`. The actual
    /// `File.WriteAllBytesAsync` happens *outside* the lock (the returned pair
    /// carries the bytes to write).
    let spillLocked (id: int64) : (string * byte array) option =
        match hot.TryGetValue id with
        | true, z ->
            let path = pathFor id
            let bytes = Checkpoint.toBytes z
            paths.[id] <- path
            heapBytes <- heapBytes - approxSize z
            hot.Remove id |> ignore
            Some (path, bytes)
        | _ -> None

    let evictIfOverQuotaLocked () : ResizeArray<string * byte array> =
        let writes = ResizeArray<string * byte array>()
        if heapBytes > inMemoryQuotaBytes then
            let ids = hot.Keys |> Seq.sort |> Seq.toArray
            let mutable i = 0
            while heapBytes > inMemoryQuotaBytes && i < ids.Length do
                match spillLocked ids.[i] with
                | Some pair -> writes.Add pair
                | None -> ()
                i <- i + 1
        writes

    interface IAsyncBackingStore<'K> with
        member _.SaveAsync(_level, batch, ct) =
            let id = Interlocked.Increment &nextId
            let writes =
                lock hotLock (fun () ->
                    hot.[id] <- batch
                    heapBytes <- heapBytes + approxSize batch
                    evictIfOverQuotaLocked ())
            task {
                for (path, bytes) in writes do
                    do! writeBytesAsync path bytes ct
                return (id :> obj)
            }
            |> ValueTask<obj>

        member _.LoadAsync(handle, ct) =
            let id = handle :?> int64
            let hotHit =
                lock hotLock (fun () ->
                    match hot.TryGetValue id with
                    | true, z -> ValueSome z
                    | _ -> ValueNone)
            match hotHit with
            | ValueSome z -> ValueTask<ZSet<'K>>(z)
            | ValueNone ->
                let pathOpt =
                    lock hotLock (fun () ->
                        match paths.TryGetValue id with
                        | true, p -> ValueSome p
                        | _ -> ValueNone)
                match pathOpt with
                | ValueNone -> failwithf "Spine batch %d not found" id
                | ValueSome p ->
                    task {
                        let! bytes = File.ReadAllBytesAsync(p, ct)   // I/O outside lock
                        let z = Checkpoint.ofBytes<'K> bytes
                        lock hotLock (fun () ->
                            if heapBytes + approxSize z <= inMemoryQuotaBytes
                               && not (hot.ContainsKey id) then
                                hot.[id] <- z
                                heapBytes <- heapBytes + approxSize z)
                        return z
                    }
                    |> ValueTask<ZSet<'K>>

        member _.ReleaseAsync(handle, _ct) =
            let id = handle :?> int64
            let pathOpt =
                lock hotLock (fun () ->
                    match hot.TryGetValue id with
                    | true, z ->
                        heapBytes <- heapBytes - approxSize z
                        hot.Remove id |> ignore
                    | _ -> ()
                    match paths.TryGetValue id with
                    | true, p ->
                        paths.Remove id |> ignore
                        ValueSome p
                    | _ -> ValueNone)
            // File.Delete has no async variant; it is a fast metadata syscall, so
            // a completed ValueTask is truthful (we are not hiding latency behind
            // a thread).
            match pathOpt with
            | ValueSome p ->
                try File.Delete p
                with ex ->
                    Console.Error.WriteLine $"DiskAsyncBackingStore.ReleaseAsync: File.Delete %s{p} failed: %s{ex.Message}"
            | ValueNone -> ()
            ValueTask.CompletedTask


/// Async cascade-merge spine over an `IAsyncBackingStore`. The merge algorithm is
/// identical to `BackedSpine`; only the store calls are awaited. Like the sync
/// spine it is single-writer (drive `InsertAsync` calls sequentially).
[<Sealed>]
type BackedSpineAsync<'K when 'K : comparison>(store: IAsyncBackingStore<'K>) =
    let levels = ResizeArray<obj voption>()

    member _.Depth = levels.Count
    member _.Store = store

    member _.InsertAsync(batch: ZSet<'K>, ?cancellationToken: CancellationToken) : Task =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            if batch.IsEmpty then ()
            else
                let! saved = store.SaveAsync(0, batch, ct)
                let mutable curHandle = saved
                let mutable i = 0
                let mutable keepGoing = true
                while keepGoing && i < levels.Count do
                    match levels.[i] with
                    | ValueSome existing ->
                        let! cur = store.LoadAsync(curHandle, ct)
                        let! other = store.LoadAsync(existing, ct)
                        let merged = ZSet.add cur other
                        do! store.ReleaseAsync(curHandle, ct)
                        do! store.ReleaseAsync(existing, ct)
                        levels.[i] <- ValueNone
                        let! next = store.SaveAsync(i + 1, merged, ct)
                        curHandle <- next
                        i <- i + 1
                    | ValueNone ->
                        keepGoing <- false
                if i = levels.Count then levels.Add(ValueSome curHandle)
                else levels.[i] <- ValueSome curHandle
        }
        :> Task

    member _.ConsolidateAsync(?cancellationToken: CancellationToken) : Task<ZSet<'K>> =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let mutable acc = ZSet<'K>.Empty
            for lvl in levels do
                match lvl with
                | ValueSome handle ->
                    let! z = store.LoadAsync(handle, ct)
                    acc <- ZSet.add acc z
                | _ -> ()
            return acc
        }

    member _.ClearAsync(?cancellationToken: CancellationToken) : Task =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            for lvl in levels do
                match lvl with
                | ValueSome handle -> do! store.ReleaseAsync(handle, ct)
                | _ -> ()
            levels.Clear()
        }
        :> Task
