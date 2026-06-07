module Zeta.Tests.CommandTests

open System.Threading
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

// The data-plane command core (roadmap #1, no-git-CLI; core-library-first). DbCommand is verbs-as-data;
// `run` interprets over any IDeltaLog. CLI + MCP are thin wrappers over this; these tests exercise the
// core directly over InMemoryDeltaLog (the DST/reference log).

let private ct = CancellationToken.None
let private run (log: IDeltaLog<string>) cmd = (DbCommand.run log ct cmd).Result

[<Fact>]
let ``Append assigns monotonic seqs; History replays them; Status reports high-water`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let a1 = run log (DbCommand.Append(ZSet.ofKeys [ "a" ], Map.empty))
    let a2 = run log (DbCommand.Append(ZSet.ofKeys [ "b" ], Map.ofList [ "k", "v" ]))
    Assert.Equal(DbCommandResult.Appended 1L, a1)
    Assert.Equal(DbCommandResult.Appended 2L, a2)

    match run log (DbCommand.History 0L) with
    | DbCommandResult.History entries ->
        Assert.Equal<int64[]>([| 1L; 2L |], entries |> Array.map _.Seq)
    | o -> Assert.Fail(sprintf "expected History, got %A" o)

    match run log DbCommand.Status with
    | DbCommandResult.Status hw -> Assert.Equal(2L, hw)
    | o -> Assert.Fail(sprintf "expected Status, got %A" o)

[<Fact>]
let ``Get fetches a single entry by seq; captured round-trips`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    run log (DbCommand.Append(ZSet.ofKeys [ "x" ], Map.empty)) |> ignore
    run log (DbCommand.Append(ZSet.ofKeys [ "y" ], Map.ofList [ "actor", "otto" ])) |> ignore

    match run log (DbCommand.Get 2L) with
    | DbCommandResult.Got(Some e) ->
        Assert.Equal(2L, e.Seq)
        Assert.Equal<Map<string, string>>(Map.ofList [ "actor", "otto" ], e.Captured)
    | o -> Assert.Fail(sprintf "expected Got(Some) for seq 2, got %A" o)

    match run log (DbCommand.Get 99L) with
    | DbCommandResult.Got None -> ()
    | o -> Assert.Fail(sprintf "expected Got(None) for absent seq, got %A" o)
