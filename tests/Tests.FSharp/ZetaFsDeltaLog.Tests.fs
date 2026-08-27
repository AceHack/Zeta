module Zeta.Tests.ZetaFsDeltaLogTests

open System
open System.IO
open System.Threading
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

let codec = CborEntryCodec<string>(
    (fun (s: string) -> DynamicValue.String s),
    (fun (dv: DynamicValue) ->
        match dv with
        | DynamicValue.String s -> s
        | _ -> "")
)

let getTempDir () =
    let path = Path.Combine(Path.GetTempPath(), sprintf "zetafs-test-%s" (Guid.NewGuid().ToString("N")))
    Directory.CreateDirectory path |> ignore
    path

[<Fact>]
let ``ZetaFsDeltaLog: append and replay works successfully`` () =
    let dir = getTempDir ()
    try
        let log = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher) :> IRefDeltaLog<string>
        let delta1 = ZSet.ofSeq ["x", 1L]
        let delta2 = ZSet.ofSeq ["y", 2L]
        
        let seq1 = log.AppendAsync(delta1, Map.empty, CancellationToken.None).AsTask().Result
        let seq2 = log.AppendAsync(delta2, Map.empty, CancellationToken.None).AsTask().Result
        
        Assert.Equal(1L, seq1)
        Assert.Equal(2L, seq2)
        Assert.Equal(2L, log.HighWater)
        
        let replayed = log.ReplayAsync(0L, CancellationToken.None).AsTask().Result
        Assert.Equal(2, replayed.Length)
        Assert.Equal(1L, replayed.[0].Seq)
        Assert.Equal<ZSet<string>>(delta1, replayed.[0].Delta)
        Assert.Equal(2L, replayed.[1].Seq)
        Assert.Equal<ZSet<string>>(delta2, replayed.[1].Delta)
    finally
        Directory.Delete(dir, true)

[<Fact>]
let ``ZetaFsDeltaLog: branch and checkout works successfully`` () =
    let dir = getTempDir ()
    try
        let log = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher) :> IRefDeltaLog<string>
        let delta = ZSet.ofSeq ["x", 1L]
        
        log.AppendAsync(delta, Map.empty, CancellationToken.None).AsTask().Result |> ignore
        
        // Branch to "refs/heads/feature"
        let branchRes = log.Branch("refs/heads/feature")
        Assert.True(branchRes.IsOk)
        
        // Checkout "refs/heads/feature"
        let checkoutRes = log.Checkout("refs/heads/feature")
        Assert.True(checkoutRes.IsOk)
        Assert.Equal("refs/heads/feature", log.CurrentRef)
        
        // Append on feature branch
        let seq = log.AppendAsync(ZSet.ofSeq ["y", 2L], Map.empty, CancellationToken.None).AsTask().Result
        Assert.Equal(2L, seq)
        
        // Checkout main and assert it doesn't have the feature commit
        log.Checkout("refs/heads/main") |> ignore
        Assert.Equal(1L, log.HighWater)
        
        // Feature has high water 2
        log.Checkout("refs/heads/feature") |> ignore
        Assert.Equal(2L, log.HighWater)
    finally
        Directory.Delete(dir, true)

[<Fact>]
let ``ZetaFsDeltaLog: reset active tip to matches target ref`` () =
    let dir = getTempDir ()
    try
        let log = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher) :> IRefDeltaLog<string>
        log.AppendAsync(ZSet.ofSeq ["x", 1L], Map.empty, CancellationToken.None).AsTask().Result |> ignore
        log.Branch("refs/heads/feature") |> ignore
        
        // Add more commits to main
        log.AppendAsync(ZSet.ofSeq ["y", 2L], Map.empty, CancellationToken.None).AsTask().Result |> ignore
        Assert.Equal(2L, log.HighWater)
        
        // Reset main to feature tip (which was at seq 1)
        let resetRes = log.Reset("refs/heads/feature")
        Assert.True(resetRes.IsOk)
        Assert.Equal(1L, log.HighWater)
    finally
        Directory.Delete(dir, true)

[<Fact>]
let ``ZetaFsDeltaLog: merge handles non-conflicting branch merges and rejects conflicting ones`` () =
    let dir = getTempDir ()
    try
        let log = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher) :> IRefDeltaLog<string>
        log.AppendAsync(ZSet.ofSeq ["base", 1L], Map.empty, CancellationToken.None).AsTask().Result |> ignore
        
        // Branch out
        log.Branch("refs/heads/feature") |> ignore
        
        // Checkout feature and append a new seq 2
        log.Checkout("refs/heads/feature") |> ignore
        log.AppendAsync(ZSet.ofSeq ["feat", 2L], Map.empty, CancellationToken.None).AsTask().Result |> ignore
        
        // Checkout main
        log.Checkout("refs/heads/main") |> ignore
        
        // Non-conflicting merge: main has only seq 1, feature has seq 1 and seq 2. Should merge cleanly!
        let mergeRes = log.Merge("refs/heads/feature")
        Assert.True(mergeRes.IsOk)
        Assert.Equal(2L, log.HighWater)
        
        // Checkout feature and append divergent commit for seq 3
        log.Checkout("refs/heads/feature") |> ignore
        log.AppendAsync(ZSet.ofSeq ["feat-diverge", 3L], Map.empty, CancellationToken.None).AsTask().Result |> ignore
        
        // Checkout main and append a different commit for seq 3
        log.Checkout("refs/heads/main") |> ignore
        log.AppendAsync(ZSet.ofSeq ["main-diverge", 3L], Map.empty, CancellationToken.None).AsTask().Result |> ignore
        
        // Try merging feature into main -> conflict!
        let mergeRes2 = log.Merge("refs/heads/feature")
        Assert.True(mergeRes2.IsError)
        match mergeRes2 with
        | Error(MergeConflict _) -> ()
        | _ -> Assert.Fail("Expected MergeConflict error")
    finally
        Directory.Delete(dir, true)

[<Fact>]
let ``truncate writes a parent edge — ReplayAsync is empty, the DAG still has the blob`` () =
    let dir = getTempDir ()
    try
        let log = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher)
        let asLog = log :> IDeltaLog<string>
        let delta = ZSet.ofSeq [ "keep-me", 1L ]
        asLog.AppendAsync(delta, Map.empty, CancellationToken.None).AsTask().Result
        |> ignore

        let before = log.ReachableDagDigest()
        Assert.False(String.IsNullOrEmpty before)
        Assert.False(before.Equals("no-ref", StringComparison.Ordinal))

        match log.TryTipCommit() with
        | None -> Assert.Fail("append must write a commit object")
        | Some first ->
            Assert.Equal(0, first.Parents.Length)
            Assert.StartsWith("append seq=", first.Message, StringComparison.Ordinal)

        asLog.TruncateAsync(1L, CancellationToken.None).AsTask().Wait()

        let replayed = asLog.ReplayAsync(0L, CancellationToken.None).AsTask().Result
        Assert.Equal(0, replayed.Length)
        Assert.Equal(0L, asLog.HighWater)

        match log.TryTipCommit() with
        | None -> Assert.Fail("truncate must write a commit with a parent")
        | Some tip ->
            Assert.Equal(1, tip.Parents.Length)
            Assert.StartsWith("truncate through=", tip.Message, StringComparison.Ordinal)

        let after = log.ReachableDagDigest()
        // Set inclusion, not equality: truncate adds its own commit. Every blob that
        // was reachable before is still reachable after — the parent edge is the channel.
        let beforeItems = before.Split(',') |> Set.ofArray
        let afterItems = after.Split(',') |> Set.ofArray
        Assert.Empty(Set.difference beforeItems afterItems)
    finally
        Directory.Delete(dir, true)

[<Fact>]
let ``legacy tree-as-ref still replays (commit wrapper is additive)`` () =
    let dir = getTempDir ()
    try
        // A pre-commit-object store: ref points at a tree JSON, no k=commit wrapper.
        let log1 = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher) :> IDeltaLog<string>
        log1.AppendAsync(ZSet.ofSeq [ "x", 1L ], Map.empty, CancellationToken.None).AsTask().Result
        |> ignore

        let refsHeads = Path.Combine(dir, "refs", "heads")
        let tipHex = File.ReadAllText(Path.Combine(refsHeads, "main")).Trim()
        Assert.Equal(32, tipHex.Length)

        // Point the ref at the TREE inside the commit, simulating a legacy store.
        let logForRead = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher)
        match logForRead.TryTipCommit() with
        | None -> Assert.Fail("fresh append writes a commit")
        | Some c -> File.WriteAllText(Path.Combine(refsHeads, "main"), c.Tree.ToHex())

        let log2 = ZetaFsDeltaLog<string>(dir, codec, Blake3Hasher.hasher) :> IDeltaLog<string>
        let replayed = log2.ReplayAsync(0L, CancellationToken.None).AsTask().Result
        Assert.Equal(1, replayed.Length)
        Assert.Equal(1L, replayed.[0].Seq)
        Assert.Equal<ZSet<string>>(ZSet.ofSeq [ "x", 1L ], replayed.[0].Delta)
    finally
        Directory.Delete(dir, true)
