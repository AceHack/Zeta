module Zeta.Tests.Operators.UpsertTests
#nowarn "0893"

open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Upsert handle (moved from InfrastructureTests / CoverageTests2)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Upsert Insert produces +1 weight`` () =
    task {
        let c = Circuit.create ()
        let ups = c.UpsertInput<int, string>()
        let out = c.Output ups.Stream
        ups.Insert(1, "alice")
        ups.Insert(2, "bob")
        do! c.StepAsync()
        out.Current.[(1, "alice")] |> should equal 1L
        out.Current.[(2, "bob")]   |> should equal 1L
    }


[<Fact>]
let ``Upsert Update cancels old and inserts new`` () =
    task {
        let c = Circuit.create ()
        let ups = c.UpsertInput<int, string>()
        let snapshot = c.IntegrateZSet ups.Stream
        let out = c.Output snapshot

        ups.Insert(1, "alice")
        do! c.StepAsync()
        out.Current.[(1, "alice")] |> should equal 1L

        ups.Update(1, "alice", "alicia")
        do! c.StepAsync()
        out.Current.[(1, "alice")]  |> should equal 0L
        out.Current.[(1, "alicia")] |> should equal 1L
    }


[<Fact>]
let ``Upsert TryUpdate uses live map`` () =
    task {
        let c = Circuit.create ()
        let ups = c.UpsertInput<int, string>()
        let snapshot = c.IntegrateZSet ups.Stream
        let out = c.Output snapshot

        ups.Insert(1, "alice")
        do! c.StepAsync()

        ups.TryUpdate(1, "alicia") |> should be True
        do! c.StepAsync()
        out.Current.[(1, "alicia")] |> should equal 1L
        out.Current.[(1, "alice")]  |> should equal 0L
    }


// ─── Upsert edge cases (moved from CoverageTests2) ──

[<Fact>]
let ``Upsert TryUpdate returns false for missing key`` () =
    task {
        let c = Circuit.create ()
        let ups = c.UpsertInput<int, string>()
        let _ = c.Output ups.Stream
        ups.TryUpdate(99, "new") |> should be False
    }


[<Fact>]
let ``Upsert TryDelete returns false for missing key`` () =
    task {
        let c = Circuit.create ()
        let ups = c.UpsertInput<int, string>()
        let _ = c.Output ups.Stream
        ups.TryDelete 99 |> should be False
    }


[<Fact>]
let ``Upsert Delete then TryDelete returns false`` () =
    task {
        let c = Circuit.create ()
        let ups = c.UpsertInput<int, string>()
        let _ = c.Output ups.Stream
        ups.Insert(1, "alice")
        do! c.StepAsync()
        ups.TryDelete 1 |> should be True
        do! c.StepAsync()
        ups.TryDelete 1 |> should be False
    }
