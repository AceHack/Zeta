namespace Zeta.Core.FSharp.Git

open System
open System.Collections.Generic
open System.IO
open System.Text.Json
open System.Threading
open System.Threading.Tasks
open LibGit2Sharp
open Zeta.Core


/// **Git-native snapshot store.** Each `WriteAsync` is a commit on `refs/zeta/snapshots`;
/// the tree accumulates `snapshots/{seq:020}.snap` blobs (consolidated fold via the
/// byte-verified `IDeltaCodec`) plus a `LATEST.json` manifest blob. The manifest lives in
/// the committed tree, so `LatestAsync` survives process restart — the cross-restart
/// snapshot+tail recovery the `RecoverableSpine` relies on. `SnapshotPointer.Handle` is
/// the blob path (a stable string), matching `DiskSnapshotStore`'s addressing.
///
/// **Honest async:** libgit2 is synchronous; this adapter does its work inline and returns
/// a completed Task — not Task.Run-over-sync fakery (see `GitDeltaLog`). Phaseable behind
/// the port for a genuinely-async pure-managed backend later.
[<Sealed>]
type GitSnapshotStore<'K when 'K : comparison>
    (repo: Repository, codec: IDeltaCodec<'K>, ?refName: string, ?now: unit -> DateTimeOffset) =

    let refName = defaultArg refName "refs/zeta/snapshots"
    let now = defaultArg now (fun () -> DateTimeOffset.UtcNow)
    let gate = obj ()
    let manifestPath = "LATEST.json"

    let snapPath (seq: int64) = sprintf "snapshots/%020d.snap" seq

    let commitTree (tree: Tree) (message: string) (parents: Commit list) : Commit =
        let s = GitBackend.signature now
        repo.ObjectDatabase.CreateCommit(s, s, message, tree, parents, false)

    interface ISnapshotStore<'K> with
        member _.WriteAsync(seq, state, ct) =
            ct.ThrowIfCancellationRequested()
            let pointer =
                lock gate (fun () ->
                    let tip = GitBackend.tryTip repo refName
                    let td =
                        match tip with
                        | Some c -> TreeDefinition.From c.Tree
                        | None -> TreeDefinition()
                    let file = snapPath seq
                    let snapBlob = GitBackend.createBlob repo (codec.Encode state)
                    td.Add(file, snapBlob, Mode.NonExecutableFile) |> ignore
                    // Manifest as string→string map (robust JSON round-trip).
                    let m = Map.ofList [ "seq", string seq; "file", file ]
                    let mBlob = GitBackend.createBlob repo (GitBackend.mapToJson m)
                    td.Add(manifestPath, mBlob, Mode.NonExecutableFile) |> ignore
                    let tree = repo.ObjectDatabase.CreateTree td
                    let commit = commitTree tree (sprintf "snapshot seq=%d" seq) (Option.toList tip)
                    GitBackend.updateRef repo refName commit
                    SnapshotPointer(box file, seq))
            Task.FromResult pointer

        member _.ReadAsync(pointer, ct) =
            ct.ThrowIfCancellationRequested()
            let file = pointer.Handle :?> string
            let state =
                lock gate (fun () ->
                    match GitBackend.tryTip repo refName with
                    | None -> failwith "GitSnapshotStore: no snapshots written"
                    | Some c ->
                        match c.Tree.[file] with
                        | null -> failwithf "GitSnapshotStore: snapshot not found: %s" file
                        | te -> codec.Decode(GitBackend.readBlob te))
            Task.FromResult state

        member _.LatestAsync(ct) =
            ct.ThrowIfCancellationRequested()
            let pointer =
                lock gate (fun () ->
                    match GitBackend.tryTip repo refName with
                    | None -> null
                    | Some c ->
                        match c.Tree.[manifestPath] with
                        | null -> null
                        | te ->
                            let m = GitBackend.mapOfJson (GitBackend.readBlob te)
                            match Map.tryFind "seq" m, Map.tryFind "file" m with
                            | Some s, Some f -> SnapshotPointer(box f, int64 s)
                            | _ -> null)
            Task.FromResult pointer
