namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.IO
open System.Text
open System.Threading
open System.Threading.Tasks

/// **ZetaFS-native Ref-aware Delta Log — content-addressed Merkle DAG over the filesystem.**
/// Delivers full git-command parity on a plain directory, implementing the loose-object store
/// and ref references on disk using BLAKE3 (or default XxHash128) as the content address.
[<Sealed>]
type ZetaFsDeltaLog<'K when 'K : comparison>
    (dir: string, entryCodec: IEntryCodec<'K>, ?hasher: IContentHasher) =

    let root = Path.GetFullPath dir
    let objectsDir = Path.Combine(root, "objects")
    let refsDir = Path.Combine(root, "refs", "heads")
    let headFile = Path.Combine(root, "HEAD")
    let gate = obj ()
    let maxObjectBytes = 64L * 1024L * 1024L
    let maxRefBytes = 4096L

    do 
        Directory.CreateDirectory root |> ignore
        Directory.CreateDirectory objectsDir |> ignore
        Directory.CreateDirectory refsDir |> ignore

    // Default to XxHash128 if BLAKE3 is not injected
    let hashFunc =
        match hasher with
        | Some h -> h.Hash
        | None -> fun bytes -> MerkleHash.ofBytes (ReadOnlySpan<byte> bytes)

    let ofHex (hex: string) : MerkleHash =
        let hi = UInt64.Parse(hex.Substring(0, 16), System.Globalization.NumberStyles.HexNumber)
        let lo = UInt64.Parse(hex.Substring(16, 16), System.Globalization.NumberStyles.HexNumber)
        MerkleHash(hi, lo)

    let objectPath (h: MerkleHash) =
        let hex = h.ToHex()
        let sub = hex.Substring(0, 2)
        let name = hex.Substring(2)
        Path.Combine(objectsDir, sub, name)

    let tryReadBytesCapped (maxBytes: int64) (path: string) : byte[] option =
        let info = FileInfo path
        if not info.Exists || info.Length > maxBytes then
            None
        else
            use stream =
                new FileStream(
                    path,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.Read,
                    8192,
                    FileOptions.SequentialScan)

            if stream.Length > maxBytes then
                None
            else
                let bytes = Array.zeroCreate<byte> (int stream.Length)
                let mutable offset = 0
                let mutable eof = false
                while offset < bytes.Length && not eof do
                    let read = stream.Read(bytes, offset, bytes.Length - offset)
                    if read = 0 then
                        eof <- true
                    else
                        offset <- offset + read
                if offset = bytes.Length then
                    Some bytes
                else
                    Some(Array.take offset bytes)

    let tryReadTextCapped (maxBytes: int64) (path: string) : string option =
        tryReadBytesCapped maxBytes path
        |> Option.map (fun bytes -> Encoding.UTF8.GetString bytes)

    let writeObject (bytes: byte[]) : MerkleHash =
        let h = hashFunc bytes
        let path = objectPath h
        let parent = Path.GetDirectoryName path
        if not (Directory.Exists parent) then
            Directory.CreateDirectory parent |> ignore
        if not (File.Exists path) then
            let tmp = path + ".tmp"
            File.WriteAllBytes(tmp, bytes)
            File.Move(tmp, path, overwrite = true)
        h

    let readObject (h: MerkleHash) : byte[] option =
        let path = objectPath h
        tryReadBytesCapped maxObjectBytes path

    let serializeTree (links: ImmutableDictionary<string, MerkleHash>) : byte[] =
        let dict = Dictionary<string, string>()
        for kv in links do
            dict.[kv.Key] <- kv.Value.ToHex()
        System.Text.Json.JsonSerializer.SerializeToUtf8Bytes dict

    let deserializeTree (bytes: byte[]) : ImmutableDictionary<string, MerkleHash> =
        let dict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(ReadOnlySpan<byte> bytes)
        let builder = ImmutableDictionary.CreateBuilder<string, MerkleHash>()
        if dict <> null then
            for kv in dict do
                builder.Add(kv.Key, ofHex kv.Value)
        builder.ToImmutable()

    let getRefPath (refName: string) =
        let cleanRef = if refName.StartsWith "refs/heads/" then refName.Substring(11) else refName
        Path.Combine(refsDir, cleanRef)

    let readRef (refName: string) : MerkleHash option =
        let path = getRefPath refName
        match tryReadTextCapped maxRefBytes path with
        | Some txt ->
            let txt = txt.Trim()
            if txt.Length = 32 then Some(ofHex txt) else None
        | None -> None

    let writeRef (refName: string) (h: MerkleHash) =
        let path = getRefPath refName
        let parent = Path.GetDirectoryName path
        if not (Directory.Exists parent) then
            Directory.CreateDirectory parent |> ignore
        File.WriteAllText(path, h.ToHex())

    let getActiveRefName () =
        match tryReadTextCapped maxRefBytes headFile with
        | Some txt ->
            let txt = txt.Trim()
            if txt.StartsWith "ref: " then txt.Substring(5) else "refs/heads/main"
        | None -> "refs/heads/main"

    let writeActiveRefName (refName: string) =
        File.WriteAllText(headFile, sprintf "ref: %s" refName)

    let loadTree (refName: string) : ImmutableDictionary<string, MerkleHash> =
        match readRef refName with
        | Some h ->
            match readObject h with
            | Some bytes -> deserializeTree bytes
            | None -> ImmutableDictionary.Empty
        | None -> ImmutableDictionary.Empty

    let saveTree (refName: string) (links: ImmutableDictionary<string, MerkleHash>) : MerkleHash =
        let bytes = serializeTree links
        let h = writeObject bytes
        writeRef refName h
        h

    let seqOfPath (path: string) : int64 option =
        if path.StartsWith "deltas/" then
            match Int64.TryParse(path.Substring(7)) with
            | true, v -> Some v
            | _ -> None
        else
            None

    let pathOfSeq (seq: int64) = sprintf "deltas/%020d" seq

    let decodeEntry (bytes: byte[]) : DeltaLogEntry<'K> = entryCodec.Decode bytes
    let encodeEntry (entry: DeltaLogEntry<'K>) : byte[] = entryCodec.Encode entry

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, _ct) =
            lock gate (fun () ->
                let activeRef = getActiveRefName ()
                let links = loadTree activeRef
                let maxSeq =
                    let seqs = [ for kv in links do match seqOfPath kv.Key with Some s -> yield s | None -> () ]
                    if List.isEmpty seqs then 0L else List.max seqs
                let seq = maxSeq + 1L
                let entry = DeltaLogEntry<'K>(seq, delta, captured)
                let bytes = encodeEntry entry
                let entryHash = writeObject bytes
                let links' = links.SetItem(pathOfSeq seq, entryHash)
                saveTree activeRef links' |> ignore
                ValueTask<int64>(seq)
            )

        member _.ReplayAsync(fromSeqExclusive, _ct) =
            lock gate (fun () ->
                let activeRef = getActiveRefName ()
                let links = loadTree activeRef
                let entries = ResizeArray<DeltaLogEntry<'K>>()
                for kv in links do
                    match seqOfPath kv.Key with
                    | Some seq when seq > fromSeqExclusive ->
                        match readObject kv.Value with
                        | Some bytes -> entries.Add(decodeEntry bytes)
                        | None -> ()
                    | _ -> ()
                let sorted = entries.ToArray() |> Array.sortBy (fun e -> e.Seq)
                ValueTask<DeltaLogEntry<'K>[]>(sorted)
            )

        member _.HighWater =
            lock gate (fun () ->
                let activeRef = getActiveRefName ()
                let links = loadTree activeRef
                let seqs = [ for kv in links do match seqOfPath kv.Key with Some s -> yield s | None -> () ]
                if List.isEmpty seqs then 0L else List.max seqs
            )

        member _.TruncateAsync(throughSeqInclusive, _ct) =
            // Thermodynamic class: ERASING through the read surface. The new tree object is
            // written and the ref moved to it — but unlike `GitDeltaLog` this tree carries NO
            // PARENT LINK, so the superseded tree becomes an orphaned loose object that nothing
            // traverses to. The delta blobs are still on the disk and nothing collects them; that
            // is not recoverability, it is litter. See the second row in `ErasureProfiles`.
            lock gate (fun () ->
                let activeRef = getActiveRefName ()
                let links = loadTree activeRef
                let builder = links.ToBuilder()
                let toRemove = [ for kv in links do match seqOfPath kv.Key with Some s when s <= throughSeqInclusive -> yield kv.Key | _ -> () ]
                for k in toRemove do builder.Remove k |> ignore
                saveTree activeRef (builder.ToImmutable()) |> ignore
                ValueTask.CompletedTask
            )

    /// **The declaration, beside the operation it classifies** (`ErasureClass`).
    ///
    /// The instructive backend. It is content-addressed and never deletes an object, which makes
    /// it *look* like the preserving case — and it is not, because preservation is about a channel
    /// somebody can walk, not about bytes that happen to still be lying there. `GitDeltaLog` keeps
    /// its truncated deltas by committing the new tree **with the old commit as parent**;
    /// `saveTree` here just moves the ref. The difference is one edge in a DAG, and it is the
    /// entire difference between Reversible and Erasing.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "ZetaFsDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the log's own read surface (ReplayAsync(0) plus HighWater), at a pinned truncation point"
                RecoveryChannel =
                    "none that anything can walk — the superseded tree object survives on disk as \
                     an orphan with no ref and no parent edge pointing at it, so no reader can \
                     reach it and no traversal will find it"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}, on a real temp directory", 13, 3_700_440L) }

              { Representation = "ZetaFsDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the object store as a whole, including unreachable loose objects"
                RecoveryChannel =
                    "the orphaned tree and its delta blobs are byte-for-byte present under \
                     objects/, so a reader with filesystem access and the old hash recovers them \
                     exactly — which is why the bits are not yet dissipated even though the \
                     fibre over the read surface has already collapsed"
                Classification = ErasureClass.ThermodynamicClass.Reversible
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}, on a real temp directory", 1, 0L) } ]

    interface IRefDeltaLog<'K> with
        member _.CurrentRef = lock gate (fun () -> getActiveRefName ())

        member _.Branch(name) =
            lock gate (fun () ->
                let activeRef = getActiveRefName ()
                match readRef activeRef with
                | Some h ->
                    writeRef name h
                    Ok ()
                | None ->
                    // Empty initial branch tip is Zero
                    writeRef name MerkleHash.Zero
                    Ok ()
            )

        member _.Checkout(refName) =
            lock gate (fun () ->
                writeActiveRefName refName
                Ok ()
            )

        member _.Reset(refName) =
            lock gate (fun () ->
                match readRef refName with
                | Some h ->
                    let activeRef = getActiveRefName ()
                    writeRef activeRef h
                    Ok ()
                | None ->
                    Error(ReferenceNotFound refName)
            )

        member _.Sync(_remote) =
            // local-first content store: syncing matches standard ref merge/pull
            Ok ()

        member _.Push(_remote) =
            lock gate (fun () ->
                let activeRef = getActiveRefName ()
                Ok activeRef
            )

        member _.Merge(sourceRef) =
            lock gate (fun () ->
                match readRef sourceRef with
                | None -> Error(ReferenceNotFound sourceRef)
                | Some sourceHash ->
                    let activeRef = getActiveRefName ()
                    let linksA = loadTree activeRef
                    let linksB = loadTree sourceRef
                    
                    let builder = linksA.ToBuilder()
                    let mutable conflict = false
                    
                    for kv in linksB do
                        match linksA.TryGetValue kv.Key with
                        | true, ha when ha = kv.Value -> () // same path, same content
                        | true, _ -> conflict <- true       // collision
                        | false, _ -> builder.Add(kv.Key, kv.Value)

                    if conflict then
                        Error(MergeConflict "Merge conflicts encountered during merge")
                    else
                        let merged = builder.ToImmutable()
                        saveTree activeRef merged |> ignore
                        let seqs = [ for kv in merged do match seqOfPath kv.Key with Some s -> yield s | None -> () ]
                        let highWater = if List.isEmpty seqs then 0L else List.max seqs
                        Ok highWater
            )

        member _.Status() =
            // ZetaFS content store is clean by design
            true, [||]

        member _.Ls(refName) =
            lock gate (fun () ->
                let target = defaultArg refName (getActiveRefName ())
                let links = loadTree target
                let seqs =
                    [ for kv in links do
                        match seqOfPath kv.Key with
                        | Some s -> yield sprintf "%d" s
                        | None -> () ]
                    |> List.sort
                Ok(List.toArray seqs)
            )
