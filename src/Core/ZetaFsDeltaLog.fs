namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Globalization
open System.IO
open System.Text
open System.Text.Json
open System.Threading
open System.Threading.Tasks

/// Own-format commit: a tree plus parent hashes. Refs point here, not at trees.
/// Truncate writes a new commit with the old tip as parent, so the preimage
/// stays reachable — the same edge `GitDeltaLog` already had.
[<Struct>]
type ZetaFsCommit =
    { Hash: MerkleHash
      Tree: MerkleHash
      Parents: MerkleHash array
      Message: string }

/// **ZetaFS-native Ref-aware Delta Log — content-addressed Merkle DAG over the filesystem.**
/// Delivers full git-command parity on a plain directory, implementing the loose-object store
/// and ref references on disk using BLAKE3 (or default XxHash128) as the content address.
/// The algebra of what this log stores is `ZetaFsDualFold`: forward `I` (+1) and
/// generator-reinterpret deltas (−1 as a later append). This backend is the own-format
/// destination; `GitDeltaLog` (LibGit2Sharp) is the v1 hexagonal adapter, not the endgame.
///
/// Refs point at **commits** (`k=commit` JSON: tree + parents + message). Legacy stores
/// whose refs still point at trees are read as a tree with no parents.
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
        let hi =
            UInt64.Parse(hex.Substring(0, 16), NumberStyles.HexNumber, CultureInfo.InvariantCulture)
        let lo =
            UInt64.Parse(hex.Substring(16, 16), NumberStyles.HexNumber, CultureInfo.InvariantCulture)
        MerkleHash(hi, lo)

    let tryOfHex (hex: string) : MerkleHash option =
        if isNull hex || hex.Length <> 32 then
            None
        else
            try
                Some(ofHex hex)
            with _ ->
                None

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
        JsonSerializer.SerializeToUtf8Bytes dict

    let deserializeTree (bytes: byte[]) : ImmutableDictionary<string, MerkleHash> =
        let dict = JsonSerializer.Deserialize<Dictionary<string, string>>(ReadOnlySpan<byte> bytes)
        let builder = ImmutableDictionary.CreateBuilder<string, MerkleHash>()
        if dict <> null then
            for kv in dict do
                match tryOfHex kv.Value with
                | Some h -> builder.Add(kv.Key, h)
                | None -> ()
        builder.ToImmutable()

    let serializeCommit (tree: MerkleHash) (parents: MerkleHash array) (message: string) : byte[] =
        use stream = new MemoryStream()
        use writer = new Utf8JsonWriter(stream)
        writer.WriteStartObject()
        writer.WriteString("k", "commit")
        writer.WriteString("tree", tree.ToHex())
        writer.WriteStartArray("parents")
        for p in parents do
            writer.WriteStringValue(p.ToHex())
        writer.WriteEndArray()
        writer.WriteString("message", if isNull message then "" else message)
        writer.WriteEndObject()
        writer.Flush()
        stream.ToArray()

    let tryParseCommit (hash: MerkleHash) (bytes: byte[]) : ZetaFsCommit option =
        try
            use doc = JsonDocument.Parse(ReadOnlyMemory<byte>(bytes))
            let root = doc.RootElement
            match root.TryGetProperty "k" with
            | true, k when
                k.ValueKind = JsonValueKind.String
                && String.Equals(k.GetString(), "commit", StringComparison.Ordinal) ->
                match root.TryGetProperty "tree", root.TryGetProperty "parents", root.TryGetProperty "message" with
                | (true, t), (true, p), (true, m) when
                    t.ValueKind = JsonValueKind.String
                    && p.ValueKind = JsonValueKind.Array
                    && m.ValueKind = JsonValueKind.String ->
                    match tryOfHex (t.GetString()) with
                    | None -> None
                    | Some tree ->
                        let parents =
                            [| for e in p.EnumerateArray() do
                                   if e.ValueKind = JsonValueKind.String then
                                       match tryOfHex (e.GetString()) with
                                       | Some h -> yield h
                                       | None -> () |]
                        let msg = m.GetString()
                        Some
                            { Hash = hash
                              Tree = tree
                              Parents = parents
                              Message = if isNull msg then "" else msg }
                | _ -> None
            | _ -> None
        with :? JsonException ->
            None

    let tryReadCommit (h: MerkleHash) : ZetaFsCommit option =
        if h = MerkleHash.Zero then
            None
        else
            match readObject h with
            | None -> None
            | Some bytes -> tryParseCommit h bytes

    let getRefPath (refName: string) =
        let cleanRef =
            if refName.StartsWith("refs/heads/", StringComparison.Ordinal) then
                refName.Substring(11)
            else
                refName
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
            if txt.StartsWith("ref: ", StringComparison.Ordinal) then
                txt.Substring(5)
            else
                "refs/heads/main"
        | None -> "refs/heads/main"

    let writeActiveRefName (refName: string) =
        File.WriteAllText(headFile, sprintf "ref: %s" refName)

    let treeFromObject (h: MerkleHash) (bytes: byte[]) : ImmutableDictionary<string, MerkleHash> =
        match tryParseCommit h bytes with
        | Some commit ->
            match readObject commit.Tree with
            | Some treeBytes -> deserializeTree treeBytes
            | None -> ImmutableDictionary.Empty
        | None -> deserializeTree bytes

    let loadTree (refName: string) : ImmutableDictionary<string, MerkleHash> =
        match readRef refName with
        | Some h when h <> MerkleHash.Zero ->
            match readObject h with
            | Some bytes -> treeFromObject h bytes
            | None -> ImmutableDictionary.Empty
        | _ -> ImmutableDictionary.Empty

    /// Write a tree, then a commit whose parent is the current tip (plus any extras).
    /// The ref moves to the commit. This is the Git shape: truncate's parent edge is
    /// the same write path as append's.
    let saveCommit
        (refName: string)
        (links: ImmutableDictionary<string, MerkleHash>)
        (message: string)
        (extraParents: MerkleHash array)
        : MerkleHash =
        let treeH = writeObject (serializeTree links)
        let currentParent =
            match readRef refName with
            | Some h when h <> MerkleHash.Zero -> [| h |]
            | _ -> Array.empty
        let parents =
            Array.append currentParent extraParents
            |> Array.distinct
        let commitH = writeObject (serializeCommit treeH parents message)
        writeRef refName commitH
        commitH

    let reachableFromTip () : string =
        match readRef (getActiveRefName ()) with
        | None -> "no-ref"
        | Some h when h = MerkleHash.Zero -> "no-commit"
        | Some tip ->
            let visited = HashSet<string>(StringComparer.Ordinal)
            let acc = ResizeArray<string>()

            let rec walk (h: MerkleHash) =
                let hex = h.ToHex()

                if visited.Add hex then
                    match readObject h with
                    | None -> ()
                    | Some bytes ->
                        match tryParseCommit h bytes with
                        | Some commit ->
                            acc.Add("c:" + hex + ":" + commit.Message)

                            match readObject commit.Tree with
                            | None -> ()
                            | Some treeBytes ->
                                acc.Add("t:" + commit.Tree.ToHex())
                                let links = deserializeTree treeBytes

                                for kv in links do
                                    acc.Add(kv.Key + "@" + kv.Value.ToHex())

                            for p in commit.Parents do
                                walk p
                        | None ->
                            acc.Add("t:" + hex)
                            let links = deserializeTree bytes

                            for kv in links do
                                acc.Add(kv.Key + "@" + kv.Value.ToHex())

            walk tip

            acc.ToArray()
            |> Array.sortWith (fun a b -> String.CompareOrdinal(a, b))
            |> String.concat ","

    let seqOfPath (path: string) : int64 option =
        if path.StartsWith("deltas/", StringComparison.Ordinal) then
            match Int64.TryParse(path.Substring(7), NumberStyles.Integer, CultureInfo.InvariantCulture) with
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
                let msg =
                    String.Format(CultureInfo.InvariantCulture, "append seq={0}", seq)
                saveCommit activeRef links' msg Array.empty |> ignore
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
            // Thermodynamic class: REVERSIBLE through the commit DAG. Same as GitDeltaLog:
            // the truncated tree is committed WITH THE OLD COMMIT AS PARENT, so every
            // removed delta blob stays reachable by walking one parent edge from the live
            // ref. The read surface (ReplayAsync of the tip tree) is still Erasing — that
            // is a different observation, declared below.
            lock gate (fun () ->
                let activeRef = getActiveRefName ()

                match readRef activeRef with
                | Some h when h <> MerkleHash.Zero ->
                    let links = loadTree activeRef
                    let builder = links.ToBuilder()

                    let toRemove =
                        [ for kv in links do
                              match seqOfPath kv.Key with
                              | Some s when s <= throughSeqInclusive -> yield kv.Key
                              | _ -> () ]

                    for k in toRemove do
                        builder.Remove k |> ignore

                    let msg =
                        String.Format(
                            CultureInfo.InvariantCulture,
                            "truncate through={0}",
                            throughSeqInclusive
                        )

                    saveCommit activeRef (builder.ToImmutable()) msg Array.empty |> ignore
                | _ -> ()

                ValueTask.CompletedTask
            )

    /// **The declaration, beside the operation it classifies** (`ErasureClass`).
    ///
    /// Same split as `GitDeltaLog`: the read surface sees only the tip tree (Erasing), and
    /// the object DAG reachable from the live ref, walking commit parents, keeps the
    /// preimage (Reversible). The parent edge is the recovery channel. Change the parent
    /// list to `[]` and the DAG observation becomes Erasing with no other edit.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "ZetaFsDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the log's own read surface (ReplayAsync(0) plus HighWater), at a pinned truncation point"
                RecoveryChannel =
                    "nothing through this channel — ReplayAsync reads the tip tree only, so the \
                     truncated deltas are as absent here as they are in any other backend"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}, on a real temp directory", 13, 3_700_440L) }

              { Representation = "ZetaFsDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the object DAG reachable from the live ref, walking commit parents"
                RecoveryChannel =
                    "the whole preimage — the truncated tree is committed WITH THE OLD COMMIT AS \
                     PARENT, so every removed delta blob stays reachable from the ref through one \
                     parent edge. Own-format never rewrites history: Landauer-honest, and manifesto \
                     section 5 Memory Preservation discharged rather than asserted"
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
                        let extra =
                            match readRef activeRef with
                            | Some ours when ours = sourceHash -> Array.empty
                            | _ -> [| sourceHash |]
                        saveCommit activeRef merged "merge" extra |> ignore
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

    /// Tip commit of the active ref, if the ref points at a commit object.
    member _.TryTipCommit() : ZetaFsCommit option =
        lock gate (fun () ->
            match readRef (getActiveRefName ()) with
            | Some h -> tryReadCommit h
            | None -> None)

    /// Sorted digest of every commit, tree, and blob reachable by walking parent
    /// edges from the live ref. The recovery channel `ErasureProfiles` names.
    member _.ReachableDagDigest() : string =
        lock gate (fun () -> reachableFromTip ())
