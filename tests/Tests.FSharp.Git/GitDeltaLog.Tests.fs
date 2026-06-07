module Zeta.Tests.Git.GitDeltaLogTests

open System
open System.IO
open System.Threading
open FsUnit.Xunit
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.Git


// ═══════════════════════════════════════════════════════════════════
// GitDeltaLog — the delta log IS git. Each AppendAsync is a commit on
// refs/zeta/deltalog; recovery walks the tip tree. Proves real on-disk
// git persistence + recovery across a FRESH Repository instance.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private empty : Map<string, string> = Map.empty

// Fixed clock so commit signatures are deterministic (DST-friendly).
let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)

let private codec () = CborEntryCodec<int>((fun (i: int) -> DynamicValue.Int(int64 i)), (function DynamicValue.Int v -> int v | o -> failwithf "key not Int: %A" o)) :> IEntryCodec<int>

let mutable private counter = 0

let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "ddl-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

let private openLog (dir: string) : IDeltaLog<int> =
    let repo = new Repository(dir)
    GitDeltaLog<int>(repo, codec (), now = fixedClock) :> IDeltaLog<int>


[<Fact>]
let ``append + replay round-trips deltas and captured through git`` () =
    withRepoDir (fun dir ->
        let log = openLog dir
        log.AppendAsync(ZSet.ofKeys [ 1; 2 ], empty, ct).AsTask().Wait()
        log.AppendAsync(ZSet.ofKeys [ 3 ], Map.ofList [ "clock", "99" ], ct).AsTask().Wait()
        let entries = log.ReplayAsync(0L, ct).AsTask().Result
        entries |> Array.map (fun e -> e.Seq) |> should equal [| 1L; 2L |]
        entries.[0].Delta |> should equal (ZSet.ofKeys [ 1; 2 ])
        entries.[1].Captured |> should equal (Map.ofList [ "clock", "99" ]))


[<Fact>]
let ``HighWater tracks the highest assigned seq`` () =
    withRepoDir (fun dir ->
        let log = openLog dir
        log.HighWater |> should equal 0L
        log.AppendAsync(ZSet.ofKeys [ 1 ], empty, ct).AsTask().Wait()
        log.AppendAsync(ZSet.ofKeys [ 2 ], empty, ct).AsTask().Wait()
        log.HighWater |> should equal 2L)


[<Fact>]
let ``ReplayAsync honors fromSeqExclusive`` () =
    withRepoDir (fun dir ->
        let log = openLog dir
        for i in 1..5 do
            log.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask().Wait()
        let tail = log.ReplayAsync(3L, ct).AsTask().Result
        tail |> Array.map (fun e -> e.Seq) |> should equal [| 4L; 5L |])


[<Fact>]
let ``retraction (negative weights) round-trips and folds to empty`` () =
    withRepoDir (fun dir ->
        let log = openLog dir
        log.AppendAsync(ZSet.ofSeq [ 7, 1L ], empty, ct).AsTask().Wait()
        log.AppendAsync(ZSet.ofSeq [ 7, -1L ], empty, ct).AsTask().Wait()  // inverse-commit
        let folded =
            log.ReplayAsync(0L, ct).AsTask().Result
            |> Array.fold (fun acc e -> ZSet.add acc e.Delta) ZSet.empty
        ZSet.isEmpty folded |> should equal true
        folded.[7] |> should equal 0L)


[<Fact>]
let ``recovery across a FRESH Repository instance sees committed deltas`` () =
    withRepoDir (fun dir ->
        (let log1 = openLog dir
         log1.AppendAsync(ZSet.ofKeys [ 10; 20 ], Map.ofList [ "seed", "abc" ], ct).AsTask().Wait()
         log1.AppendAsync(ZSet.ofSeq [ 30, 5L ], empty, ct).AsTask().Wait())
        // Fresh instance over the same on-disk git repo — simulates a restart.
        let log2 = openLog dir
        log2.HighWater |> should equal 2L
        let entries = log2.ReplayAsync(0L, ct).AsTask().Result
        entries |> Array.map (fun e -> e.Seq) |> should equal [| 1L; 2L |]
        entries.[0].Captured |> should equal (Map.ofList [ "seed", "abc" ])
        entries.[1].Delta |> should equal (ZSet.ofSeq [ 30, 5L ]))


[<Fact>]
let ``TruncateAsync drops the absorbed tail but HighWater never rewinds`` () =
    withRepoDir (fun dir ->
        let log = openLog dir
        for i in 1..4 do
            log.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask().Wait()
        log.TruncateAsync(2L, ct).AsTask().Wait()
        let remaining = log.ReplayAsync(0L, ct).AsTask().Result
        remaining |> Array.map (fun e -> e.Seq) |> should equal [| 3L; 4L |]
        log.HighWater |> should equal 4L)


[<Fact>]
let ``HighWater survives restart after truncate (preserved in commit message)`` () =
    withRepoDir (fun dir ->
        (let log1 = openLog dir
         for i in 1..3 do
             log1.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask().Wait()
         log1.TruncateAsync(3L, ct).AsTask().Wait())
        let log2 = openLog dir
        // All blobs GC'd from the tree, but highwater is recovered from the message.
        log2.HighWater |> should equal 3L
        log2.ReplayAsync(0L, ct).AsTask().Result |> Array.length |> should equal 0
        // Next append continues the sequence (no reuse of 1..3).
        log2.AppendAsync(ZSet.ofKeys [ 99 ], empty, ct).AsTask().Result |> should equal 4L)
