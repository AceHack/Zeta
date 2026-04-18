module Zeta.Tests.Infra.SinkTests
#nowarn "0893"

open System.Threading
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ISink — exactly-once 2PC (moved from Round6Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``InMemorySink commits a staged tx`` () =
    task {
        let sink = InMemorySink<int>(DeliveryMode.ExactlyOnce) :> ISink<int>
        let! handle = sink.BeginTx(1L, CancellationToken.None)
        do! sink.Write(handle, ZSet.ofKeys [ 1; 2; 3 ], CancellationToken.None)
        do! sink.PreCommit(handle, CancellationToken.None)
        do! sink.Commit(handle, CancellationToken.None)
        let actual = sink :?> InMemorySink<int>
        actual.Committed.Count |> should equal 1
        actual.InFlightCount |> should equal 0
    }


[<Fact>]
let ``InMemorySink abort discards in-flight`` () =
    task {
        let sink = InMemorySink<int>(DeliveryMode.ExactlyOnce) :> ISink<int>
        let! handle = sink.BeginTx(1L, CancellationToken.None)
        do! sink.Write(handle, ZSet.ofKeys [ 1; 2 ], CancellationToken.None)
        do! sink.Abort(handle, CancellationToken.None)
        let actual = sink :?> InMemorySink<int>
        actual.Committed.Count |> should equal 0
    }


[<Fact>]
let ``InMemorySink commit is idempotent across retries`` () =
    task {
        let sink = InMemorySink<int>(DeliveryMode.ExactlyOnce) :> ISink<int>
        let! handle = sink.BeginTx(42L, CancellationToken.None)
        do! sink.Write(handle, ZSet.ofKeys [ 1 ], CancellationToken.None)
        do! sink.Commit(handle, CancellationToken.None)
        do! sink.Commit(handle, CancellationToken.None)   // retry
        let actual = sink :?> InMemorySink<int>
        actual.Committed.Count |> should equal 1   // idempotent
    }


[<Fact>]
let ``NullSink accepts everything without throwing`` () =
    task {
        let sink = NullSink<int>() :> ISink<int>
        let! handle = sink.BeginTx(1L, CancellationToken.None)
        do! sink.Write(handle, ZSet.ofKeys [ 1 ], CancellationToken.None)
        do! sink.Commit(handle, CancellationToken.None)
        sink.Mode |> should equal DeliveryMode.AtMostOnce
    }


// ═══════════════════════════════════════════════════════════════════
// AppendResult / ExpectedRevision DU (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``AppendResult pattern matches all cases`` () =
    let ok = AppendResult.Ok 42L
    let conflict = AppendResult.Conflict 100L
    let unavail = AppendResult.Unavailable "node down"
    let tag r =
        match r with
        | AppendResult.Ok _ -> "ok"
        | AppendResult.Conflict _ -> "conflict"
        | AppendResult.Unavailable _ -> "unavail"
    tag ok |> should equal "ok"
    tag conflict |> should equal "conflict"
    tag unavail |> should equal "unavail"


[<Fact>]
let ``ExpectedRevision pattern matches all cases`` () =
    let tag r =
        match r with
        | ExpectedRevision.Any -> "any"
        | ExpectedRevision.NoStream -> "none"
        | ExpectedRevision.StreamExists -> "exists"
        | ExpectedRevision.Exact n -> $"exact-{n}"
    tag ExpectedRevision.Any |> should equal "any"
    tag (ExpectedRevision.Exact 5L) |> should equal "exact-5"
