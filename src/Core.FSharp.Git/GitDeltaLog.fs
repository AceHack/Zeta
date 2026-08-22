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
    (repo: Repository, entryCodec: IEntryCodec<'K>, ?refName: string, ?now: unit -> DateTimeOffset, ?credSource: CredentialSource) =

    let mutable currentRef = defaultArg refName "refs/zeta/deltalog"
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

    let getCurrentNextSeq () =
        match GitBackend.tryTip repo currentRef with
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
                    let tip = GitBackend.tryTip repo currentRef
                    let lastSeq =
                        match tip with
                        | None -> 0L
                        | Some c -> max (maxSeqInTree c) (seqOfMessage c)
                    let s = lastSeq + 1L
                    let td =
                        match tip with
                        | Some c -> TreeDefinition.From c.Tree
                        | None -> TreeDefinition()
                    let blob = GitBackend.createBlob repo (encodeEntry (DeltaLogEntry<'K>(s, delta, captured)))
                    td.Add(entryPath s, blob, Mode.NonExecutableFile) |> ignore
                    let tree = repo.ObjectDatabase.CreateTree td
                    let commit = commitTree tree (sprintf "delta seq=%d" s) (Option.toList tip)
                    GitBackend.updateRef repo currentRef commit
                    s)
            ValueTask<int64> seq

        member _.ReplayAsync(fromSeqExclusive, ct) =
            ct.ThrowIfCancellationRequested()
            let entries =
                lock gate (fun () ->
                    match GitBackend.tryTip repo currentRef |> Option.bind deltasSubtree with
                    | None -> [||]
                    | Some sub ->
                        [| for e in sub do
                             match seqOfName e.Name with
                             | Some s when s > fromSeqExclusive -> yield decodeEntry (GitBackend.readBlob e)
                             | _ -> () |]
                        |> Array.sortBy (fun e -> e.Seq))
            ValueTask<DeltaLogEntry<'K>[]> entries

        member _.HighWater = lock gate (fun () -> getCurrentNextSeq ())

        member _.TruncateAsync(throughSeqInclusive, ct) =
            ct.ThrowIfCancellationRequested()
            lock gate (fun () ->
                match GitBackend.tryTip repo currentRef with
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
                    let currentSeq = max (maxSeqInTree c) (seqOfMessage c)
                    // Keep highwater in the message so it survives restart after GC.
                    // ── the preserving truncation ──────────────────────────────────────────
                    // Thermodynamic class: REVERSIBLE. The parent list is `[ c ]` — the commit we
                    // just truncated. Every removed delta blob is still reachable by walking one
                    // parent edge from the live ref, so the post-state determines the pre-state
                    // exactly and no fibre collapses. This is the *same interface method* as
                    // `InMemoryDeltaLog.TruncateAsync`, reached from the *same* call site in
                    // `RecoverableSpine.CommitAsync`, with the opposite class. Change `[ c ]` to
                    // `[]` and this becomes an erasing operation with no other edit — which is
                    // exactly what the law pack measures.
                    let commit =
                        commitTree tree (sprintf "truncate through=%d seq=%d" throughSeqInclusive currentSeq) [ c ]
                    GitBackend.updateRef repo currentRef commit)
            ValueTask.CompletedTask

    /// **The declaration, beside the operation it classifies** (`ErasureClass`).
    ///
    /// The preserving half of the pair, and the reason a name-keyed list of erasing operations
    /// cannot be written. `IDeltaLog.TruncateAsync` is one method with one call site; here it is
    /// Reversible, in `InMemoryDeltaLog` it is Erasing, and in `GroupCommitDiskDeltaLog` it is
    /// Reversible-because-unimplemented. The class is a property of *this* representation, so the
    /// declaration lives in *this* file.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "GitDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the object DAG reachable from the live ref, walking commit parents"
                RecoveryChannel =
                    "the whole preimage — the truncated tree is committed WITH THE OLD COMMIT AS \
                     PARENT, so every removed delta blob stays reachable from the ref through one \
                     parent edge. Git never rewrites history: Landauer-honest, and manifesto \
                     section 5 Memory Preservation discharged rather than asserted"
                Classification = ErasureClass.ThermodynamicClass.Reversible
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}, on a real libgit2 repository", 1, 0L) }

              { Representation = "GitDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the log's own read surface (ReplayAsync(0) plus HighWater), at a pinned truncation point"
                RecoveryChannel =
                    "nothing through this channel — ReplayAsync reads the tip tree only, so the \
                     truncated deltas are as absent here as they are in any other backend. The \
                     row exists so the pair is comparable to InMemoryDeltaLog on IDENTICAL terms: \
                     the two backends differ in what OTHER channel survives, not in this one"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}, on a real libgit2 repository", 9, 3_169_925L) } ]

    interface IRefDeltaLog<'K> with
        member _.CurrentRef = lock gate (fun () -> currentRef)
        member _.Branch(name) =
            lock gate (fun () ->
                try
                    let branchName = if name.StartsWith "refs/heads/" then name.Substring(11) else name
                    let tip = GitBackend.tryTip repo currentRef
                    match tip with
                    | Some c -> repo.CreateBranch(branchName, c) |> ignore
                    | None -> repo.CreateBranch(branchName) |> ignore
                    Ok ()
                with ex ->
                    Error (InvalidOperation ex.Message))
        member _.Checkout(refName') =
            lock gate (fun () ->
                try
                    let b = Commands.Checkout(repo, refName')
                    currentRef <- b.CanonicalName
                    Ok ()
                with ex ->
                    Error (InvalidOperation ex.Message))
        member _.Reset(refName') =
            lock gate (fun () ->
                let targetCommit =
                    match GitBackend.tryTip repo refName' with
                    | Some c -> Some c
                    | None ->
                        match repo.Branches.[refName'] with
                        | null -> None
                        | b -> Some b.Tip
                match targetCommit with
                | None -> Error (ReferenceNotFound refName')
                | Some tc ->
                    try
                        repo.Reset(ResetMode.Hard, tc)
                        Ok ()
                    with ex ->
                        Error (InvalidOperation ex.Message))
        member _.Sync(remoteName) =
            lock gate (fun () ->
                let handlerResult =
                    match credSource with
                    | Some cs ->
                        match cs.TryHandler() with
                        | Ok h -> Ok h
                        | Error e -> Error (ConnectionFailed (sprintf "Failed to resolve credentials: %s" e))
                    | None -> Ok null
                
                match handlerResult with
                | Error fb -> Error fb
                | Ok handler ->
                    match repo.Network.Remotes.[remoteName] with
                    | null -> Error (RemoteNotFound remoteName)
                    | r ->
                        try
                            let refspecs = r.FetchRefSpecs |> Seq.map (fun s -> s.Specification)
                            let fetchOpts = FetchOptions()
                            if handler <> null then fetchOpts.CredentialsProvider <- handler
                            Commands.Fetch(repo, remoteName, refspecs, fetchOpts, null)
                            
                            let activeBranch = repo.Head
                            let rb =
                                if activeBranch <> null && activeBranch.TrackedBranch <> null then
                                    activeBranch.TrackedBranch
                                else
                                    repo.Branches.[sprintf "%s/%s" remoteName activeBranch.FriendlyName]
                            if rb <> null && rb.Tip <> null then
                                let sig_ = GitBackend.signature now
                                let mergeResult = repo.Merge(rb, sig_, MergeOptions())
                                if mergeResult.Status = MergeStatus.Conflicts then
                                    Error (MergeConflict "Merge conflicts encountered during sync")
                                else
                                    Ok ()
                            else
                                Ok ()
                        with ex ->
                            Error (InvalidOperation ex.Message))
        member _.Push(remoteName) =
            lock gate (fun () ->
                let handlerResult =
                    match credSource with
                    | Some cs ->
                        match cs.TryHandler() with
                        | Ok h -> Ok h
                        | Error e -> Error (ConnectionFailed (sprintf "Failed to resolve credentials: %s" e))
                    | None -> Ok null
                
                match handlerResult with
                | Error fb -> Error fb
                | Ok handler ->
                    match repo.Network.Remotes.[remoteName] with
                    | null -> Error (RemoteNotFound remoteName)
                    | r ->
                        try
                            let activeBranchName = repo.Head.FriendlyName
                            let refspec = sprintf "refs/heads/%s:refs/heads/%s" activeBranchName activeBranchName
                            let pushOpts = PushOptions()
                            if handler <> null then pushOpts.CredentialsProvider <- handler
                            repo.Network.Push(r, refspec, pushOpts)
                            Ok refspec
                        with ex ->
                            Error (InvalidOperation ex.Message))
        member _.Merge(sourceRef') =
            lock gate (fun () ->
                let sourceCommit =
                    match GitBackend.tryTip repo sourceRef' with
                    | Some c -> Some c
                    | None ->
                        match repo.Branches.[sourceRef'] with
                        | null -> None
                        | b -> Some b.Tip
                match sourceCommit with
                | None -> Error (ReferenceNotFound sourceRef')
                | Some sc ->
                    try
                        let sig_ = GitBackend.signature now
                        let mergeResult = repo.Merge(sc, sig_, MergeOptions())
                        if mergeResult.Status = MergeStatus.Conflicts then
                            Error (MergeConflict "Merge conflicts encountered during merge")
                        else
                            let newTip = repo.Head.Tip
                            Ok (max (maxSeqInTree newTip) (seqOfMessage newTip))
                    with ex ->
                        Error (InvalidOperation ex.Message))
        member _.Status() =
            lock gate (fun () ->
                let st = repo.RetrieveStatus(StatusOptions())
                let pending = st |> Seq.map (fun e -> e.FilePath) |> Seq.toArray
                not st.IsDirty, pending)
        member _.Ls(refName') =
            lock gate (fun () ->
                let target = defaultArg refName' currentRef
                match GitBackend.tryTip repo target |> Option.bind deltasSubtree with
                | None ->
                    if repo.Refs.[target] = null && repo.Branches.[target] = null then
                        Error (ReferenceNotFound target)
                    else
                        Ok [||]
                | Some sub ->
                    let entries =
                        [| for e in sub do
                             match seqOfName e.Name with
                             | Some s -> yield sprintf "%d" s
                             | _ -> () |]
                        |> Array.sortBy Int64.Parse
                    Ok entries)
