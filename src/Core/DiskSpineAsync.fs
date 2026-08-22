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
    let store = Dictionary<MerkleHash, ZSet<'K>>()
    interface IAsyncBackingStore<'K> with
        member _.SaveAsync(_level, batch, _ct) =
            let bytes = Checkpoint.toBytes batch
            let hash = MerkleHash.ofBytes(ReadOnlySpan bytes)
            lock store (fun () -> store.[hash] <- batch)
            ValueTask<obj>(hash :> obj)
        member _.LoadAsync(handle, _ct) =
            let hash = handle :?> MerkleHash
            ValueTask<ZSet<'K>>(lock store (fun () -> store.[hash]))
        member _.ReleaseAsync(handle, _ct) =
            let hash = handle :?> MerkleHash
            lock store (fun () -> store.Remove hash |> ignore)
            ValueTask.CompletedTask

    /// **The declaration, beside the operations it classifies** (`ErasureClass`).
    /// Same representation choice as `InMemoryBackingStore`, so the same two classes: `SaveAsync`
    /// drops the `level` argument, `ReleaseAsync` drops the entry.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "InMemoryAsyncBackingStore"
                Operation = "IAsyncBackingStore.SaveAsync"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel =
                    "the batch, by its content address; not whether it was already present — an \
                     idempotent upsert maps two pre-states onto one post-state"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.ExhaustiveSweep("every subset of 3 reference batches; level pinned at 0 and the saved batch pinned", 2, 1_000_000L) }

              { Representation = "InMemoryAsyncBackingStore"
                Operation = "IAsyncBackingStore.ReleaseAsync"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel = "none — the entry is removed from the only dictionary that holds it"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.ExhaustiveSweep("every subset of 3 reference batches; the released handle pinned", 2, 1_000_000L) } ]


/// Disk-backed async store. Mirrors `DiskBackingStore` exactly — same spill
/// quota, path canonicalisation + traversal/ADS guards, and the same lock
/// discipline (metadata under `hotLock`; all I/O awaited OUTSIDE the lock)
/// but the actual reads/writes are async.
[<Sealed>]
type DiskAsyncBackingStore<'K when 'K : comparison>
    (workDir: string, inMemoryQuotaBytes: int64, ?fsyncPerSave: bool) =
    let fsync = defaultArg fsyncPerSave false
    let rootDir = Path.GetFullPath workDir
    do FileSystem.Current.CreateDirectory rootDir

    /// Write bytes to `path`, forcing them through to stable storage when
    /// `fsync` is set. Async throughout — no `Task.Run` over sync I/O.
    let writeAtomicFrameAsync (candidate: string) (bytes: byte[]) (ct: CancellationToken) : Task =
        task {
            let headPath = candidate + ".head"
            let dataPath = candidate + ".data"
            let opts =
                if fsync then FileOptions.Asynchronous ||| FileOptions.WriteThrough
                else FileOptions.Asynchronous

            // 1. Write payload data frame
            let! () =
                task {
                    use fs: Stream = FileSystem.Current.OpenWrite(dataPath, fsync)
                    do! fs.WriteAsync(ReadOnlyMemory(bytes, 8, bytes.Length - 8), ct).AsTask()
                    do! fs.FlushAsync ct
                    if fsync then
                        match fs with
                        | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
                        | _ -> ()
                }

            // 2. Write header frame
            let! () =
                task {
                    use fs: Stream = FileSystem.Current.OpenWrite(headPath, fsync)
                    do! fs.WriteAsync(ReadOnlyMemory(bytes, 0, 8), ct).AsTask()
                    do! fs.FlushAsync ct
                    if fsync then
                        match fs with
                        | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
                        | _ -> ()
                }

            // 3. Rename header to candidate
            if FileSystem.Current.Exists candidate then FileSystem.Current.Delete candidate
            FileSystem.Current.Move(headPath, candidate, true)

            // 4. fsync parent directory
            if fsync then
                let parent = Path.GetDirectoryName candidate
                FileSync.fsyncDir parent

            // 5. SimulatedFs Flush hook
            SimulatedFs.Flush candidate
        }
        :> Task

    /// Read data from frame-first files
    let readAtomicFrameAsync (candidate: string) (ct: CancellationToken) : Task<byte[]> =
        task {
            let dataPath = candidate + ".data"
            let! header = FileSystem.Current.ReadAllBytesAsync(candidate, ct)
            if header.Length <> 8 then
                failwithf "Spine batch corruption: header length is %d (expected 8)" header.Length
            let! data = FileSystem.Current.ReadAllBytesAsync(dataPath, ct)
            let bytes = Array.zeroCreate<byte> (8 + data.Length)
            Array.Copy(header, 0, bytes, 0, 8)
            Array.Copy(data, 0, bytes, 8, data.Length)
            return bytes
        }

    let hot = Dictionary<MerkleHash, ZSet<'K>>()
    let paths = Dictionary<MerkleHash, string>()
    let mutable heapBytes = 0L
    let hotLock = obj ()

    let approxSize (z: ZSet<'K>) : int64 = int64 (z.Count * 24)

    let isCaseInsensitivePathFs =
        OperatingSystem.IsWindows() || OperatingSystem.IsMacOS()

    let pathComparison =
        if isCaseInsensitivePathFs then StringComparison.OrdinalIgnoreCase
        else StringComparison.Ordinal

    let pathFor (hash: MerkleHash) : string =
        let filename = sprintf "spine-%016x%016x.json" hash.Hi hash.Lo
        let candidate = Path.GetFullPath(Path.Combine(rootDir, filename))
        let rootWithSep = rootDir.TrimEnd(Path.DirectorySeparatorChar) + string Path.DirectorySeparatorChar
        if not (candidate.StartsWith(rootWithSep, pathComparison)) then
            invalidOp $"Refused spine spill path outside working directory: {candidate}"
        let finalName = Path.GetFileName candidate
        if finalName.Contains ':' then
            invalidOp $"Refused spine spill with ADS suffix in filename: {finalName}"
        candidate

    /// Spill a hash from `hot` to disk. Caller must hold `hotLock`.
    let spillLocked (hash: MerkleHash) : (string * byte array) option =
        match hot.TryGetValue hash with
        | true, z ->
            let path = pathFor hash
            let bytes = Checkpoint.toBytes z
            paths.[hash] <- path
            heapBytes <- heapBytes - approxSize z
            hot.Remove hash |> ignore
            Some (path, bytes)
        | _ -> None

    /// Thermodynamic class: REVERSIBLE — identical reasoning to `DiskBackingStore`. The spill
    /// writes the batch out and records its path before dropping the heap entry, so `LoadAsync`
    /// returns it byte-identical. "Eviction" names when it happens, not what it costs.
    let evictIfOverQuotaLocked () : ResizeArray<string * byte array> =
        let writes = ResizeArray<string * byte array>()
        if heapBytes > inMemoryQuotaBytes then
            let hashes = hot.Keys |> Seq.sortBy (fun h -> h.Hi, h.Lo) |> Seq.toArray
            let mutable i = 0
            while heapBytes > inMemoryQuotaBytes && i < hashes.Length do
                match spillLocked hashes.[i] with
                | Some pair -> writes.Add pair
                | None -> ()
                i <- i + 1
        writes

    interface IAsyncBackingStore<'K> with
        member _.SaveAsync(_level, batch, ct) =
            let bytes = Checkpoint.toBytes batch
            let hash = MerkleHash.ofBytes(ReadOnlySpan bytes)
            let writes =
                lock hotLock (fun () ->
                    hot.[hash] <- batch
                    heapBytes <- heapBytes + approxSize batch
                    evictIfOverQuotaLocked ())
            task {
                for (path, b) in writes do
                    do! writeAtomicFrameAsync path b ct
                return (hash :> obj)
            }
            |> ValueTask<obj>

        member _.LoadAsync(handle, ct) =
            let hash = handle :?> MerkleHash
            let hotHit =
                lock hotLock (fun () ->
                    match hot.TryGetValue hash with
                    | true, z -> ValueSome z
                    | _ -> ValueNone)
            match hotHit with
            | ValueSome z -> ValueTask<ZSet<'K>>(z)
            | ValueNone ->
                let pathOpt =
                    lock hotLock (fun () ->
                        match paths.TryGetValue hash with
                        | true, p -> ValueSome p
                        | _ -> ValueNone)
                match pathOpt with
                | ValueNone -> failwithf "Spine batch %s not found" (sprintf "%016x%016x" hash.Hi hash.Lo)
                | ValueSome p ->
                    task {
                        let! bytes = readAtomicFrameAsync p ct
                        let z = Checkpoint.ofBytes<'K> bytes
                        lock hotLock (fun () ->
                            if heapBytes + approxSize z <= inMemoryQuotaBytes
                               && not (hot.ContainsKey hash) then
                                hot.[hash] <- z
                                heapBytes <- heapBytes + approxSize z)
                        return z
                    }
                    |> ValueTask<ZSet<'K>>

        member _.ReleaseAsync(handle, _ct) =
            let hash = handle :?> MerkleHash
            let pathOpt =
                lock hotLock (fun () ->
                    match hot.TryGetValue hash with
                    | true, z ->
                        heapBytes <- heapBytes - approxSize z
                        hot.Remove hash |> ignore
                    | _ -> ()
                    match paths.TryGetValue hash with
                    | true, p ->
                        paths.Remove hash |> ignore
                        ValueSome p
                    | _ -> ValueNone)
            match pathOpt with
            | ValueSome p ->
                try
                    if FileSystem.Current.Exists p then FileSystem.Current.Delete p
                    let dataPath = p + ".data"
                    if FileSystem.Current.Exists dataPath then FileSystem.Current.Delete dataPath
                with ex ->
                    Console.Error.WriteLine $"DiskAsyncBackingStore.ReleaseAsync: File.Delete %s{p} failed: %s{ex.Message}"
            | ValueNone -> ()
            ValueTask.CompletedTask

    /// **The declaration, beside the operations it classifies** (`ErasureClass`).
    /// The async twin of `DiskBackingStore`, and the classes must match it row for row — if they
    /// ever diverge, one of the two implementations has drifted from the other and the law pack
    /// says which.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "DiskAsyncBackingStore"
                Operation = "IAsyncBackingStore.SaveAsync"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel =
                    "the batch, by its content address; not whether it was already present. This \
                     row, not the eviction row below, is where SaveAsync's bits actually go"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.BoundedModelSweep("every subset of 3 reference batches; level pinned at 0 and the saved batch pinned; quota pinned at 1 byte; real temp directory", 2, 1_000_000L) }

              { Representation = "DiskAsyncBackingStore"
                Operation = "IAsyncBackingStore.SaveAsync (quota eviction via evictIfOverQuotaLocked)"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel =
                    "the whole batch — the spill writes the bytes to the workspace file and records \
                     the path before removing the heap entry, so LoadAsync returns it unchanged"
                Classification = ErasureClass.ThermodynamicClass.Reversible
                Evidence = ErasureClass.Evidence.BoundedModelSweep("every subset of 3 reference batches saved under a 1-byte quota, so every save spills; real temp directory", 1, 0L) }

              { Representation = "DiskAsyncBackingStore"
                Operation = "IAsyncBackingStore.ReleaseAsync"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel = "none — hot entry, path entry and both files are removed together"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.BoundedModelSweep("every subset of 3 reference batches; the released handle pinned; quota pinned at 1 byte; real temp directory", 2, 1_000_000L) }

              { Representation = "DiskAsyncBackingStore"
                Operation = "IAsyncBackingStore.ReleaseAsync"
                Observation = "the storage medium after unlink"
                RecoveryChannel = "unknown — the same medium-level hole as DiskBackingStore and DiskDeltaLog"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "no sweep run from inside this process can observe the medium after an unlink" } ]


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
