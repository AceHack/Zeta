namespace Zeta.Core

open System
open Zeta.Core.Abstractions
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


/// In-memory backing store — stores batches in a dictionary keyed by MerkleHash.
/// This is what `Spine<'K>` effectively does internally.
[<Sealed>]
type InMemoryBackingStore<'K when 'K : comparison>() =
    let store = Dictionary<MerkleHash, ZSet<'K>>()
    interface IBackingStore<'K> with
        member _.Save(_level, batch) =
            let bytes = Checkpoint.toBytes batch
            let hash = MerkleHash.ofBytes(ReadOnlySpan bytes)
            lock store (fun () -> store.[hash] <- batch)
            hash :> obj
        member _.Load handle =
            let hash = handle :?> MerkleHash
            lock store (fun () -> store.[hash])
        member _.Release handle =
            let hash = handle :?> MerkleHash
            lock store (fun () -> store.Remove hash |> ignore)


/// **Disk-backed level store.** Persists Z-sets to a workspace folder using
/// double-buffered, frame-first atomic file updates.
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
    (workDir: string, inMemoryQuotaBytes: int64, ?fsyncPerSave: bool, ?cryptoProvider: ICryptoProvider) =
    let fsync = defaultArg fsyncPerSave false
    let crypto = defaultArg cryptoProvider null
    let rootDir = Path.GetFullPath workDir
    do FileSystem.Current.CreateDirectory rootDir
    let hot = Dictionary<MerkleHash, ZSet<'K>>()
    let paths = Dictionary<MerkleHash, string>()
    let mutable heapBytes = 0L
    let hotLock = obj ()

    let approxSize (z: ZSet<'K>) : int64 =
        int64 (z.Count * 24)

    /// Is Windows / macOS case-insensitive filesystem? Path comparisons
    /// must tolerate "C:\\foo" vs "c:\\foo" and HFS+/APFS case folding.
    let isCaseInsensitivePathFs =
        OperatingSystem.IsWindows() || OperatingSystem.IsMacOS()

    let pathComparison =
        if isCaseInsensitivePathFs then StringComparison.OrdinalIgnoreCase
        else StringComparison.Ordinal

    /// Build a spill path for `hash` and assert it's inside `rootDir`.
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

    /// Frame-first/header-second transaction commit protocol with fsync boundary support.
    let writeAtomicFrame (candidate: string) (bytes: byte[]) =
        let headPath = candidate + ".head"
        let dataPath = candidate + ".data"
        let opts =
            if fsync then FileOptions.WriteThrough
            else FileOptions.None

        // 1. Write payload data frame
        do
            use fs: Stream = FileSystem.Current.OpenWrite(dataPath, fsync)
            if isNull crypto then
                fs.Write(bytes, 8, bytes.Length - 8)
            else
                let original = Array.zeroCreate<byte> (bytes.Length - 8)
                Array.Copy(bytes, 8, original, 0, bytes.Length - 8)
                let encrypted = crypto.Encrypt original
                fs.Write(ReadOnlySpan encrypted)
            fs.Flush()
            if fsync then
                match fs with
                | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
                | _ -> ()

        // 2. Write header frame
        do
            use fs: Stream = FileSystem.Current.OpenWrite(headPath, fsync)
            fs.Write(bytes, 0, 8)
            fs.Flush()
            if fsync then
                match fs with
                | :? FileStream as fileStream -> fileStream.Flush(flushToDisk = true)
                | _ -> ()

        // 3. Rename header to candidate
        if FileSystem.Current.Exists candidate then FileSystem.Current.Delete candidate
        FileSystem.Current.Move(headPath, candidate, true)

        // 4. fsync parent directory
        if fsync then
            let parent = Path.GetDirectoryName candidate
            FileSync.fsyncDir parent

        // 5. SimulatedFs Flush hook
        SimulatedFs.Flush candidate

    /// Read data from frame-first files
    let readAtomicFrame (candidate: string) : byte[] =
        let dataPath = candidate + ".data"
        let header = FileSystem.Current.ReadAllBytes candidate
        if header.Length <> 8 then
            failwithf "Spine batch corruption: header length is %d (expected 8)" header.Length
        let rawData = FileSystem.Current.ReadAllBytes dataPath
        let data =
            if isNull crypto then rawData
            else crypto.Decrypt rawData
        let bytes = Array.zeroCreate<byte> (8 + data.Length)
        Array.Copy(header, 0, bytes, 0, 8)
        Array.Copy(data, 0, bytes, 8, data.Length)
        bytes

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

    interface IBackingStore<'K> with
        member _.Save(_level, batch) =
            let bytes = Checkpoint.toBytes batch
            let hash = MerkleHash.ofBytes(ReadOnlySpan bytes)
            let writes =
                lock hotLock (fun () ->
                    hot.[hash] <- batch
                    heapBytes <- heapBytes + approxSize batch
                    evictIfOverQuotaLocked ())
            for (path, b) in writes do
                writeAtomicFrame path b
            hash :> obj

        member _.Load handle =
            let hash = handle :?> MerkleHash
            let hotHit =
                lock hotLock (fun () ->
                    match hot.TryGetValue hash with
                    | true, z -> ValueSome z
                    | _ -> ValueNone)
            match hotHit with
            | ValueSome z -> z
            | ValueNone ->
                let pathOpt =
                    lock hotLock (fun () ->
                        match paths.TryGetValue hash with
                        | true, p -> ValueSome p
                        | _ -> ValueNone)
                match pathOpt with
                | ValueNone -> failwithf "Spine batch %s not found" (sprintf "%016x%016x" hash.Hi hash.Lo)
                | ValueSome p ->
                    let bytes = readAtomicFrame p
                    let z = Checkpoint.ofBytes<'K> bytes
                    lock hotLock (fun () ->
                        if heapBytes + approxSize z <= inMemoryQuotaBytes
                           && not (hot.ContainsKey hash) then
                            hot.[hash] <- z
                            heapBytes <- heapBytes + approxSize z)
                    z

        member _.Release handle =
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
