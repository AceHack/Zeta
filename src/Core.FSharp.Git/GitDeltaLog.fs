namespace Zeta.Core.FSharp.Git

open System
open System.Collections.Generic
open System.IO
open System.Text.Json
open System.Threading
open System.Threading.Tasks
open LibGit2Sharp
open Zeta.Core


/// Shared LibGit2Sharp helpers for the git-native adapters. Internal — the public
/// surface is the IDeltaLog / ISnapshotStore ports, never libgit2 types.
module internal GitBackend =

    /// Default commit identity for Zeta-authored log/snapshot commits. The logical
    /// truth is the seq (in the tree + message); the signature time is incidental,
    /// so an injectable clock keeps DST replays deterministic.
    let signature (now: unit -> DateTimeOffset) : Signature =
        Signature("zeta", "zeta@localhost", now ())

    /// Resolve a ref's tip commit, or None if the ref does not exist yet.
    let tryTip (repo: Repository) (refName: string) : Commit option =
        repo.Lookup<Commit>(refName) |> Option.ofObj

    /// Read a tree entry's blob bytes (entry must be a blob).
    let readBlob (entry: TreeEntry) : byte[] =
        let blob = entry.Target :?> Blob
        use src = blob.GetContentStream()
        use ms = new MemoryStream()
        src.CopyTo ms
        ms.ToArray()

    /// Create a blob from bytes.
    let createBlob (repo: Repository) (bytes: byte[]) : Blob =
        use ms = new MemoryStream(bytes)
        repo.ObjectDatabase.CreateBlob ms

    /// Point `refName` at `commit` (create the ref if absent) — the atomic publish.
    let updateRef (repo: Repository) (refName: string) (commit: Commit) =
        match repo.Refs.[refName] with
        | null -> repo.Refs.Add(refName, commit.Id) |> ignore
        | r -> repo.Refs.UpdateTarget(r, commit.Id) |> ignore

    /// Map<string,string> ⇄ JSON via Dictionary (System.Text.Json has no native F#
    /// Map support; Dictionary round-trips cleanly — same trick as DiskSnapshotStore).
    let mapToJson (m: Map<string, string>) : byte[] =
        let d = Dictionary<string, string>()
        m |> Map.iter (fun k v -> d.[k] <- v)
        JsonSerializer.SerializeToUtf8Bytes d

    let mapOfJson (bytes: byte[]) : Map<string, string> =
        match JsonSerializer.Deserialize<Dictionary<string, string>> bytes with
        | null -> Map.empty
        | d -> d |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq


/// **Git-native delta log — the log IS git.** Each `AppendAsync` is a commit on
/// `refs/zeta/deltalog`; the commit tree accumulates one blob per entry under
/// `deltas/{seq:020}` (the WHOLE entry — Seq + Delta + Captured — through the canonical
/// `IEntryCodec` = the 4-language byte-locked `DeltaLogEntryCodec` format; the blob IS the
/// cross-language treaty unit, no per-backend framing, no System.Text.Json). History = the commit DAG
/// = the log for free; Z-set **retraction** = a later commit appending the inverse delta
/// (git never rewrites history — Landauer-honest, Memory-Preservation §5). Endgame: Zeta
/// IS a git server, so the DB and the git remote are the same object.
///
/// **Honest async (FoundationDB north-star):** libgit2 — and therefore LibGit2Sharp —
/// has NO async surface; every call is a synchronous native call. So this adapter does
/// its work inline and returns a COMPLETED ValueTask. That is truthful (exactly as
/// `InMemoryDeltaLog` does for genuinely-synchronous work), NOT `Task.Run`-over-sync I/O
/// fakery (which is the smell). A future pure-managed loose-object backend behind this
/// same port can be genuinely async.
///
/// **First adapter behind a port we own.** LibGit2Sharp is v1; it can be phased out for
/// a pure-managed backend without touching any caller (hexagonal architecture).
///
/// Single-writer per shard (the writer-actor model): the in-process `gate` serialises
/// the read-tip → build-tree → commit → update-ref sequence; cross-process single-writer
/// is the caller's contract (one clone writes its shard).
[<Sealed>]
type GitDeltaLog<'K when 'K : comparison>
    (repo: Repository, entryCodec: IEntryCodec<'K>, ?refName: string, ?now: unit -> DateTimeOffset) =

    let refName = defaultArg refName "refs/zeta/deltalog"
    let now = defaultArg now (fun () -> DateTimeOffset.UtcNow)
    let gate = obj ()

    let entryPath (seq: int64) = sprintf "deltas/%020d" seq

    // One blob = the WHOLE entry (Seq + Delta + Captured) through the canonical `IEntryCodec`
    // (the 4-language byte-locked DeltaLogEntryCodec format). The Seq rides inside the bytes, so the
    // blob is the cross-language treaty unit — no per-backend framing, no System.Text.Json.
    let encodeEntry (entry: DeltaLogEntry<'K>) : byte[] = entryCodec.Encode entry

    let decodeEntry (bytes: byte[]) : DeltaLogEntry<'K> = entryCodec.Decode bytes

    // The `deltas/` subtree of a commit, or None.
    let deltasSubtree (c: Commit) : Tree option =
        match c.Tree.["deltas"] with
        | null -> None
        | te ->
            match te.Target with
            | :? Tree as sub -> Some sub
            | _ -> None

    let seqOfName (name: string) : int64 option =
        match Int64.TryParse name with
        | true, v -> Some v
        | _ -> None

    let maxSeqInTree (c: Commit) : int64 =
        match deltasSubtree c with
        | None -> 0L
        | Some sub -> sub |> Seq.choose (fun e -> seqOfName e.Name) |> Seq.fold max 0L

    // Highwater is preserved across restart in the commit message ("seq=N"), so it never
    // rewinds even after a TruncateAsync removed the high blobs from the tree.
    let seqOfMessage (c: Commit) : int64 =
        let msg = c.MessageShort
        let idx = msg.LastIndexOf "seq="
        if idx < 0 then 0L
        else
            match Int64.TryParse(msg.Substring(idx + 4).Trim()) with
            | true, v -> v
            | _ -> 0L

    // Highest assigned seq ever (monotone, never rewinds) — recovered on open.
    let mutable nextSeq =
        match GitBackend.tryTip repo refName with
        | None -> 0L
        | Some c -> max (maxSeqInTree c) (seqOfMessage c)

    let commitTree (tree: Tree) (message: string) (parents: Commit list) : Commit =
        let s = GitBackend.signature now
        repo.ObjectDatabase.CreateCommit(s, s, message, tree, parents, false)

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, ct) =
            // Honor pre-work cancellation; once committing we do not abandon a durable write.
            ct.ThrowIfCancellationRequested()
            let seq =
                lock gate (fun () ->
                    let s = nextSeq + 1L
                    let tip = GitBackend.tryTip repo refName
                    let td =
                        match tip with
                        | Some c -> TreeDefinition.From c.Tree
                        | None -> TreeDefinition()
                    let blob = GitBackend.createBlob repo (encodeEntry (DeltaLogEntry<'K>(s, delta, captured)))
                    td.Add(entryPath s, blob, Mode.NonExecutableFile) |> ignore
                    let tree = repo.ObjectDatabase.CreateTree td
                    let commit = commitTree tree (sprintf "delta seq=%d" s) (Option.toList tip)
                    GitBackend.updateRef repo refName commit
                    nextSeq <- s
                    s)
            ValueTask<int64> seq

        member _.ReplayAsync(fromSeqExclusive, ct) =
            ct.ThrowIfCancellationRequested()
            let entries =
                lock gate (fun () ->
                    match GitBackend.tryTip repo refName |> Option.bind deltasSubtree with
                    | None -> [||]
                    | Some sub ->
                        [| for e in sub do
                             match seqOfName e.Name with
                             | Some s when s > fromSeqExclusive -> yield decodeEntry (GitBackend.readBlob e)
                             | _ -> () |]
                        |> Array.sortBy (fun e -> e.Seq))
            ValueTask<DeltaLogEntry<'K>[]> entries

        member _.HighWater = lock gate (fun () -> nextSeq)

        member _.TruncateAsync(throughSeqInclusive, ct) =
            ct.ThrowIfCancellationRequested()
            lock gate (fun () ->
                match GitBackend.tryTip repo refName with
                | None -> ()
                | Some c ->
                    let td = TreeDefinition.From c.Tree
                    match deltasSubtree c with
                    | None -> ()
                    | Some sub ->
                        for e in sub do
                            match seqOfName e.Name with
                            | Some s when s <= throughSeqInclusive -> td.Remove(entryPath s) |> ignore
                            | _ -> ()
                    let tree = repo.ObjectDatabase.CreateTree td
                    // Keep highwater in the message so it survives restart after GC.
                    let commit =
                        commitTree tree (sprintf "truncate through=%d seq=%d" throughSeqInclusive nextSeq) [ c ]
                    GitBackend.updateRef repo refName commit)
            ValueTask.CompletedTask
