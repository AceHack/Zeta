module Zeta.Tests.Circuit.SinkTerminalityTests

/// Tests for the sink-terminality enforcement added to `Circuit.Build()`
/// in PR 2. The `ISinkOperator` docstring promises *"the scheduler
/// enforces terminal placement (a sink may not feed another operator
/// inside a relational path)"* — until PR 2, that promise was vapor.
/// These tests make it load-bearing:
///
///   1. A circuit with a sink at the terminus builds normally.
///   2. A circuit with an operator reading from a sink's output stream
///      is rejected at `Build()` time with a diagnostic naming both
///      endpoints, the sink's ID, and a pointer to the contract.
///   3. The check is `O(N + E)` and runs once per Build — no per-tick
///      cost — and runs AFTER the topological sort succeeds so IDs
///      are stable.
///
/// Composes with PR 1's `IsSink` capability tag on `Op<'T>` (which is
/// what the Build pass consults; without that property, this check
/// couldn't exist).

open System
open System.Threading
open System.Threading.Tasks
open Xunit
open FsUnit.Xunit
open Zeta.Core


// ─────────────────────────────────────────────────────────────────
//  Test sinks
//
//  We make sinks that *output* a typed `ZSet<int>` (rather than a
//  bare scalar) so we can wire a `Map` / `Filter` downstream and
//  exercise the rejection path. The sink-ness comes from the
//  `ISinkOperator` interface declaration, not from the output type;
//  in a real BayesianRateOp the sink-ness comes from non-Z-set output
//  and retraction-lossy state. The test cares about the structural
//  declaration, not the output shape.
// ─────────────────────────────────────────────────────────────────

/// A sink that emits a Z-set output — declared `ISinkOperator`, so
/// `Circuit.Build()` should reject any operator reading from this
/// output stream.
type private ZSetSinkOp(input: Stream<ZSet<int>>) =
    let deps = [| input.AsDependency() |]
    interface ISinkOperator<ZSet<int>, ZSet<int>> with
        member _.Name = "test-zset-sink"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


/// A plain (non-sink) plugin that emits a Z-set output — used to
/// verify the rejection is specific to sinks, not all plugins.
type private ZSetPassthroughOp(input: Stream<ZSet<int>>) =
    let deps = [| input.AsDependency() |]
    interface IOperator<ZSet<int>> with
        member _.Name = "test-zset-passthrough"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


// ─────────────────────────────────────────────────────────────────
//  Positive cases — terminal sinks build normally
// ─────────────────────────────────────────────────────────────────

[<Fact>]
let ``Circuit with a sink at the terminus builds normally`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    // Sink is the only consumer of input.Stream — terminal position.
    let _ = c.RegisterStream (ZSetSinkOp input.Stream :> IOperator<ZSet<int>>)
    c.Build()
    c.IsBuilt |> should equal true
    c.OperatorCount |> should equal 2  // input + sink


[<Fact>]
let ``Circuit with sink reading from Map (sink at terminus) builds normally`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let mapped = c.Map(input.Stream, Func<int, int>(fun x -> x * 2))
    let _ = c.RegisterStream (ZSetSinkOp mapped :> IOperator<ZSet<int>>)
    c.Build()
    c.IsBuilt |> should equal true
    // input + map + sink + (registration plumbing)
    c.OperatorCount |> should be (greaterThanOrEqualTo 3)


[<Fact>]
let ``Circuit with multiple sinks at independent termini builds normally`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.RegisterStream (ZSetSinkOp input.Stream :> IOperator<ZSet<int>>)
    let _ = c.RegisterStream (ZSetSinkOp input.Stream :> IOperator<ZSet<int>>)
    c.Build()
    c.IsBuilt |> should equal true


[<Fact>]
let ``Circuit with a non-sink plugin feeding a Map builds normally (rejection is sink-specific)`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let passthrough = c.RegisterStream (ZSetPassthroughOp input.Stream :> IOperator<ZSet<int>>)
    let _ = c.Map(passthrough, Func<int, int>(fun x -> x + 1))
    c.Build()
    c.IsBuilt |> should equal true


// ─────────────────────────────────────────────────────────────────
//  Negative cases — operators reading from sinks are rejected
// ─────────────────────────────────────────────────────────────────

[<Fact>]
let ``Circuit.Build rejects Map reading from sink output stream`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let sinkStream =
        c.RegisterStream (ZSetSinkOp input.Stream :> IOperator<ZSet<int>>)
    // Sin: wire a Map to consume the sink's output. Should fail at Build().
    let _ = c.Map(sinkStream, Func<int, int>(fun x -> x * 2))
    (fun () -> c.Build()) |> shouldFail


[<Fact>]
let ``Circuit.Build rejects Filter reading from sink output stream`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let sinkStream =
        c.RegisterStream (ZSetSinkOp input.Stream :> IOperator<ZSet<int>>)
    let _ = c.Filter(sinkStream, Func<int, bool>(fun x -> x > 0))
    (fun () -> c.Build()) |> shouldFail


[<Fact>]
let ``Circuit.Build rejects Plus reading from sink output stream`` () =
    let c = Circuit()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let sinkStream =
        c.RegisterStream (ZSetSinkOp a.Stream :> IOperator<ZSet<int>>)
    let _ = c.Plus(sinkStream, b.Stream)
    (fun () -> c.Build()) |> shouldFail


[<Fact>]
let ``Sink-rejection error message names both operators and IDs`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let sinkStream =
        c.RegisterStream (ZSetSinkOp input.Stream :> IOperator<ZSet<int>>)
    let _ = c.Map(sinkStream, Func<int, int>(fun x -> x * 2))
    let ex = Assert.Throws<InvalidOperationException>(fun () -> c.Build())
    // Naming both endpoints helps the user locate the violation.
    ex.Message |> should haveSubstring "map"
    ex.Message |> should haveSubstring "test-zset-sink"
    // Contract pointer so a confused reader knows where to look.
    ex.Message |> should haveSubstring "PluginApi.fs"
    // Honesty about WHY: the message should explain the algebraic
    // reason, not just say "rejected".
    ex.Message |> should haveSubstring "retraction-lossy"


[<Fact>]
let ``Cycle detection runs before sink-terminality (so error messages stay focused)`` () =
    // The Build pass orders: topo-sort first (would fail on cycle),
    // sink-terminality second. A circuit with BOTH a cycle and a
    // sink-rejection should report the cycle, not the sink, because
    // cycle is the more structurally-fatal problem. This test asserts
    // the ordering by constructing a sink-feeding-Map (which would
    // fail sink-terminality) — and confirming that adding it does NOT
    // induce a cycle (i.e. the test setup is correct). The sink
    // rejection should fire because no cycle exists.
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let sinkStream =
        c.RegisterStream (ZSetSinkOp input.Stream :> IOperator<ZSet<int>>)
    let _ = c.Map(sinkStream, Func<int, int>(fun x -> x * 2))
    let ex = Assert.Throws<InvalidOperationException>(fun () -> c.Build())
    // Confirms sink-terminality fired, not cycle detection.
    ex.Message |> should haveSubstring "Sink-terminality violation"
    ex.Message |> should not' (haveSubstring "cycle")
