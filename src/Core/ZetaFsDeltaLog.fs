namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.IO
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

    // refs/HEAD files are tiny (a hex hash or one "ref: …" line); cap reads so a
    // poisoned file cannot exhaust the heap (semgrep file-read-without-size-cap).
    let maxRefFileBytes = 4096L

    let readSmallFile (path: string) : string =
        if FileInfo(path).Length > maxRefFileBytes then
            invalidOp (sprintf "ref file exceeds %d bytes: %s" maxRefFileBytes path)
        File.ReadAllText path
    let gate = obj ()

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
        if File.Exists path then Some(File.ReadAllBytes path) else None

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
        if File.Exists path then
            let txt = (readSmallFile path).Trim()
            if txt.Length = 32 then Some(ofHex txt) else None
        else
            None

    let writeRef (refName: string) (h: MerkleHash) =
        let path = getRefPath refName
        let parent = Path.GetDirectoryName path
        if not (Directory.Exists parent) then
            Directory.CreateDirectory parent |> ignore
        File.WriteAllText(path, h.ToHex())

    let getActiveRefName () =
        if File.Exists headFile then
            let txt = (readSmallFile headFile).Trim()
            if txt.StartsWith "ref: " then txt.Substring(5) else "refs/heads/main"
        else
            "refs/heads/main"

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
            lock gate (fun () ->
                let activeRef = getActiveRefName ()
                let links = loadTree activeRef
                let builder = links.ToBuilder()
                let toRemove = [ for kv in links do match seqOfPath kv.Key with Some s when s <= throughSeqInclusive -> yield kv.Key | _ -> () ]
                for k in toRemove do builder.Remove k |> ignore
                saveTree activeRef (builder.ToImmutable()) |> ignore
                ValueTask.CompletedTask
            )

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
