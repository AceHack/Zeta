module Zeta.Tests.Storage.SpineTests
#nowarn "0893"

open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Spine / LSM trace tests (moved from InfrastructureTests / CoverageTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Spine consolidates all inserted batches`` () =
    let spine = Spine<int>()
    spine.Insert(ZSet.ofKeys [ 1 ; 2 ; 3 ])
    spine.Insert(ZSet.ofKeys [ 3 ; 4 ; 5 ])
    spine.Insert(ZSet.ofKeys [ 5 ; 6 ])
    let full = spine.Consolidate()
    full.[1] |> should equal 1L
    full.[3] |> should equal 2L
    full.[5] |> should equal 2L
    full.[6] |> should equal 1L


[<Fact>]
let ``IntegrateToTrace exposes Levels view`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let trace = c.IntegrateToTrace input.Stream

        input.Send(ZSet.ofKeys [ 1 ; 2 ])
        do! c.StepAsync()
        input.Send(ZSet.ofKeys [ 3 ; 4 ])
        do! c.StepAsync()

        let consolidated = trace.Consolidate()
        consolidated.Count |> should equal 4
        (trace.Levels |> Seq.length) |> should be (greaterThanOrEqualTo 1)
    }


// ─── Spine: deeper cases (moved from CoverageTests) ────────

[<Fact>]
let ``Spine.Clear resets`` () =
    let spine = Spine<int>()
    spine.Insert(ZSet.ofKeys [ 1 ; 2 ; 3 ])
    spine.Insert(ZSet.ofKeys [ 4 ; 5 ])
    spine.Clear()
    spine.Depth |> should equal 0
    spine.Count |> should equal 0
    spine.Consolidate().IsEmpty |> should be True


[<Fact>]
let ``Spine empty batch no-op`` () =
    let spine = Spine<int>()
    spine.Insert ZSet<int>.Empty
    spine.Depth |> should equal 0


[<Fact>]
let ``Spine Levels emits sorted-run view`` () =
    let spine = Spine<int>()
    spine.Insert(ZSet.ofKeys [ 1 ])
    spine.Insert(ZSet.ofKeys [ 2 ])
    let levels = spine.Levels |> Seq.toArray
    levels.Length |> should be (greaterThanOrEqualTo 1)


[<Fact>]
let ``SpineAsync roundtrips through Flush`` () =
    task {
        use spine = new SpineAsync<int>()
        spine.Insert(ZSet.ofKeys [ 1 ; 2 ; 3 ])
        spine.Insert(ZSet.ofKeys [ 4 ; 5 ])
        do! spine.Flush()
        let total = spine.Consolidate()
        total.Count |> should equal 5
        spine.Depth |> should be (greaterThanOrEqualTo 1)
    }
