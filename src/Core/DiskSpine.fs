namespace Zeta.Core

open System
open System.Buffers.Binary
open System.Collections.Generic
open System.IO
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Channels
open System.Threading.Tasks


/// Pluggable backing store for a spine level. Allows swapping in-memory
/// vs on-disk implementations so the same cascade-merge algorithm works
/// for relations that fit in RAM **and** relations that spill to disk.
///
/// This is the abstraction that lets us match Feldera's persistent-spine
/// story without committing to a particular storage backend up front.
type IBackingStore<'K when 'K : comparison> =
    /// Persist a Z-set level; return a handle that can reload it.
    abstract Save: level: int * batch: ZSet<'K> -> obj
    /// Reload a previously-saved batch.
    abstract Load: handle: obj -> ZSet<'K>
    /// Release the backing storage for a batch (called after merge).
    abstract Release: handle: obj -> unit


/// In-memory backing store — stores batches in a dictionary keyed by id.
/// This is what `Spine<'K>` effectively does internally.
[<Sealed>]
type InMemoryBackingStore<'K when 'K : comparison>() =
    let store = Dictionary<int64, ZSet<'K>>()
    let mutable nextId = 0L
    interface IBackingStore<'K> with
        member _.Save(_level, batch) =
            let id = Interlocked.Increment &nextId
            lock store (fun () -> store.[id] <- batch)
            id :> obj
        member _.Load handle =
            let id = handle :?> int64
            lock store (fun () -> store.[id])
        member _.Release handle =
            let id = handle :?> int64
            lock store (fun () -> store.Remove id |> ignore)


/// Disk-backed store that overflows large batches to a working directory
/// as binary files. Above a configurable in-RAM quota, levels spill to
/// disk; below, they stay in memory.
///
/// Serialisation is the same JSON form used by `Checkpoint` — convenient
/// but not fastest; production deployments would use Apache Arrow / Parquet.
///
/// The threshold `inMemoryQuotaBytes` bounds heap usage: once a spine's
/// active batches exceed the quota, the smallest-level batches spill
/// first (they're the most frequently re-read during merge — keep them
/// resident if anything).
[<Sealed>]
type DiskBackingStore<'K when 'K : comparison>
    (workDir: string, inMemoryQuotaBytes: int64) =
    // Canonicalise the work dir once, up front. We want to guarantee every
    // spill path we produce lives under this root — a later sanity check
    // proves it. Without `GetFullPath`, a caller-supplied relative or
    // `..`-laden path would let a poisoned file-id sneak writes outside
    // the intended directory. Belt-and-braces for a server-side caller.
    let rootDir = Path.GetFullPath workDir
    do Directory.CreateDirectory rootDir |> ignore
    // Per-instance prefix — if two `DiskBackingStore` instances share the
    // same `workDir`, their `nextId` counters would collide (each restarts
    // at 0) and they'd clobber each other's `spine-{id}.json` files.
    // GUID gives cross-instance isolation without needing cross-process
    // coordination.
    let instancePrefix = Guid.NewGuid().ToString("N")
    let hot = Dictionary<int64, ZSet<'K>>()
    let paths = Dictionary<int64, string>()
    let mutable nextId = 0L
    let mutable heapBytes = 0L
    // `hotLock` guards `hot`, `paths`, `heapBytes`, `nextId` metadata; I/O
    // operations (File.Read/Write/Delete) are always performed **outside**
    // this lock to avoid serialising disk access across all store ops.
    let hotLock = obj ()

    let approxSize (z: ZSet<'K>) : int64 =
        // Rough estimate: 24 bytes per entry (struct overhead + key ptr + weight).
        int64 (z.Count * 24)

    /// Is Windows / macOS case-insensitive filesystem? Path comparisons
    /// must tolerate "C:\\foo" vs "c:\\foo" and HFS+/APFS case folding.
    let isCaseInsensitivePathFs =
        OperatingSystem.IsWindows() || OperatingSystem.IsMacOS()

    let pathComparison =
        if isCaseInsensitivePathFs then StringComparison.OrdinalIgnoreCase
        else StringComparison.Ordinal

    /// Build a spill path for `id` and assert it's inside `rootDir`.
    /// Uses platform-appropriate case sensitivity — Windows/macOS ignore
    /// case in path roots, which a strict `Ordinal` check would miss.
    /// Also rejects NTFS alternate data streams (embedded `:`) in the
    /// filename portion as a defense-in-depth.
    let pathFor (id: int64) : string =
        let filename = $"spine-{instancePrefix}-{id}.json"
        let candidate = Path.GetFullPath(Path.Combine(rootDir, filename))
        let rootWithSep = rootDir.TrimEnd(Path.DirectorySeparatorChar) + string Path.DirectorySeparatorChar
        if not (candidate.StartsWith(rootWithSep, pathComparison)) then
            invalidOp $"Refused spine spill path outside working directory: {candidate}"
        // Reject NTFS alternate-data-stream suffixes in the filename.
        let finalName = Path.GetFileName candidate
        if finalName.Contains ':' then
            invalidOp $"Refused spine spill with ADS suffix in filename: {finalName}"
        candidate

    /// Spill an id from `hot` to disk. Caller must hold `hotLock`.
    /// The actual `File.WriteAllBytes` happens *outside* the lock so other
    /// store operations don't serialise on the disk write.
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

    interface IBackingStore<'K> with
        member _.Save(_level, batch) =
            let id = Interlocked.Increment &nextId
            let writes =
                lock hotLock (fun () ->
                    hot.[id] <- batch
                    heapBytes <- heapBytes + approxSize batch
                    evictIfOverQuotaLocked ())
            // Disk writes *after* lock release — we already swapped the
            // path in `paths` under lock, so concurrent Load/Release see
            // the path entry even if the write is mid-flight (they'd
            // either find it in `hot` (if not yet evicted) or in `paths`;
            // the latter means they'd read the file we're about to write,
            // which creates a small race window but matches the semantics
            // of "Save isn't durable until it returns").
            for (path, bytes) in writes do
                File.WriteAllBytes(path, bytes)
            id :> obj

        member _.Load handle =
            let id = handle :?> int64
            // Phase 1: see if it's hot.
            let hotHit =
                lock hotLock (fun () ->
                    match hot.TryGetValue id with
                    | true, z -> ValueSome z
                    | _ -> ValueNone)
            match hotHit with
            | ValueSome z -> z
            | ValueNone ->
                // Phase 2: look up the path under lock, *then* read outside.
                let pathOpt =
                    lock hotLock (fun () ->
                        match paths.TryGetValue id with
                        | true, p -> ValueSome p
                        | _ -> ValueNone)
                match pathOpt with
                | ValueNone -> failwithf "Spine batch %d not found" id
                | ValueSome p ->
                    let bytes = File.ReadAllBytes p   // I/O outside lock
                    let z = Checkpoint.ofBytes<'K> bytes
                    // Phase 3: re-hot so the next Load is O(1). Respect
                    // the quota — if we'd exceed it we skip the re-hot
                    // and accept the next Load re-reading from disk.
                    lock hotLock (fun () ->
                        if heapBytes + approxSize z <= inMemoryQuotaBytes
                           && not (hot.ContainsKey id) then
                            hot.[id] <- z
                            heapBytes <- heapBytes + approxSize z)
                    z

        member _.Release handle =
            let id = handle :?> int64
            // Pull the path (if any) out under lock; delete outside.
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
            match pathOpt with
            | ValueSome p ->
                try File.Delete p
                with ex ->
                    // Don't swallow silently — log to stderr so a full
                    // disk or permission error surfaces.
                    Console.Error.WriteLine $"DiskBackingStore.Release: File.Delete %s{p} failed: %s{ex.Message}"
            | ValueNone -> ()


/// Spine variant parameterised by its backing store. For workloads that
/// fit in RAM, use `InMemoryBackingStore`; for larger-than-RAM relations,
/// use `DiskBackingStore`. The cascade-merge algorithm is identical.
[<Sealed>]
type BackedSpine<'K when 'K : comparison>(store: IBackingStore<'K>) =
    // levels[i] = handle into the store, or None if empty.
    let levels = ResizeArray<obj voption>()

    member _.Depth = levels.Count
    member _.Store = store

    member _.Insert(batch: ZSet<'K>) =
        if batch.IsEmpty then ()
        else
            let mutable curHandle = store.Save(0, batch)
            let mutable i = 0
            let mutable keepGoing = true
            while keepGoing && i < levels.Count do
                match levels.[i] with
                | ValueSome existing ->
                    let merged = ZSet.add (store.Load curHandle) (store.Load existing)
                    store.Release curHandle
                    store.Release existing
                    levels.[i] <- ValueNone
                    curHandle <- store.Save(i + 1, merged)
                    i <- i + 1
                | ValueNone ->
                    keepGoing <- false
            if i = levels.Count then levels.Add(ValueSome curHandle)
            else levels.[i] <- ValueSome curHandle

    member _.Consolidate() : ZSet<'K> =
        let mutable acc = ZSet<'K>.Empty
        for lvl in levels do
            match lvl with
            | ValueSome handle -> acc <- ZSet.add acc (store.Load handle)
            | _ -> ()
        acc

    member _.Clear() =
        for lvl in levels do
            match lvl with
            | ValueSome handle -> store.Release handle
            | _ -> ()
        levels.Clear()
