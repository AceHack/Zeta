module Zeta.Tests.CommandTests

open System.Threading
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private ct = CancellationToken.None
let private run (log: IDeltaLog<string>) cmd =
    match (DbCommand.run log ct cmd).Result with
    | Ok res -> res
    | Error fb -> failwithf "Command failed with feedback: %A" fb

[<Fact>]
let ``Emit and Retract assign monotonic seqs; Fold replays them; Status/Ls query them`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let a1 = run log (DbCommand.Emit(ZSet.ofKeys [ "a" ], Map.empty))
    let a2 = run log (DbCommand.Retract(ZSet.ofKeys [ "b" ], Map.ofList [ "k", "v" ]))
    Assert.Equal(DbCommandResult.Emitted 1L, a1)
    Assert.Equal(DbCommandResult.Retracted 2L, a2)

    match run log (DbCommand.Fold 0L) with
    | DbCommandResult.Folded entries ->
        Assert.Equal<int64[]>([| 1L; 2L |], entries |> Array.map _.Seq)
        Assert.Equal(-1L, entries.[1].Delta.["b"])
    | o -> Assert.Fail(sprintf "expected Folded, got %A" o)

    match run log DbCommand.Status with
    | DbCommandResult.Statused(isClean, pending) ->
        Assert.True(isClean)
        Assert.Empty(pending)
    | o -> Assert.Fail(sprintf "expected Statused, got %A" o)

    match run log (DbCommand.Ls None) with
    | DbCommandResult.Listed entries ->
        Assert.Equal<string[]>([| "1"; "2" |], entries)
    | o -> Assert.Fail(sprintf "expected Listed, got %A" o)

[<Fact>]
let ``Branch, Join, and Merge operations on InMemoryDeltaLog work`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    run log (DbCommand.Emit(ZSet.ofKeys [ "a" ], Map.empty)) |> ignore
    
    // Create feature branch
    match run log (DbCommand.Branch "refs/heads/feature") with
    | DbCommandResult.Branched name -> Assert.Equal("refs/heads/feature", name)
    | o -> Assert.Fail(sprintf "expected Branched, got %A" o)
    
    // Checkout/Join feature branch
    match run log (DbCommand.Join("refs/heads/feature", false)) with
    | DbCommandResult.Joined name -> Assert.Equal("refs/heads/feature", name)
    | o -> Assert.Fail(sprintf "expected Joined, got %A" o)
    
    // Emit on feature branch
    run log (DbCommand.Emit(ZSet.ofKeys [ "b" ], Map.empty)) |> ignore
    
    // Checkout/Join main
    run log (DbCommand.Join("refs/heads/main", false)) |> ignore
    
    // Merge feature branch into main
    match run log (DbCommand.Merge "refs/heads/feature") with
    | DbCommandResult.Merged(src, newSeq) ->
        Assert.Equal("refs/heads/feature", src)
        Assert.Equal(3L, newSeq)
    | o -> Assert.Fail(sprintf "expected Merged, got %A" o)
