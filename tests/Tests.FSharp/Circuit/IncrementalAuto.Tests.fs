module Zeta.Tests.Circuit.IncrementalAutoTests

/// Tests for `IncrementalAuto` — the capability-aware incremental
/// dispatcher added in PR 4. The dispatcher consumes the `IsLinear`
/// and `IsSink` capability tags on `Op<'T>` (from PR 1) to pick the
/// right incrementalization at construction time:
///
///   - Linear op   →  `Q^Δ = Q` (deltas pass through unchanged)
///   - Sink op     →  throw (terminal; can't incrementalize)
///   - Otherwise   →  fall back to `D ∘ Q ∘ I`
///
/// The end-to-end correctness check: both `IncrementalAuto(q, input)`
/// and the manually-written reference form (`q(input)` for linear,
/// `D∘Q∘I` for fallback) must produce bit-identical output streams
/// across all ticks. We test by running both forms in parallel
/// inside a single circuit.

open System
open System.Threading.Tasks
open Xunit
open FsUnit.Xunit
open Zeta.Core


// ─────────────────────────────────────────────────────────────────
//  Helpers — run a circuit a few ticks and capture the output
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
//  Linear case — Map. IncrementalAuto should return Q directly.
// ─────────────────────────────────────────────────────────────────

[<Fact>]
let ``IncrementalAuto with linear Map produces same delta stream as direct Q`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let doubleIt = Func<Stream<ZSet<int>>, Stream<ZSet<int>>>(fun s ->
        c.Map(s, Func<int, int>(fun x -> x * 2)))

    // Both ops registered in the same circuit; they share the input stream.
    let reference = doubleIt.Invoke input.Stream    // direct: q(delta) for linear is correct
    let subject   = c.IncrementalAuto(doubleIt, input.Stream)

    let refHandle = c.Output reference
    let subHandle = c.Output subject

    let deltas =
        [ ZSet.ofSeq [ (1, 1L); (2, 1L) ]
          ZSet.ofSeq [ (3, 1L) ]
          ZSet.ofSeq [ (1, -1L) ]
          ZSet.Empty ]

    for delta in deltas do
        input.Send delta
        c.Step()
        // Each tick, both should produce the same output.
        subHandle.Current |> should equal refHandle.Current


// ─────────────────────────────────────────────────────────────────
//  Non-linear case — Distinct. IncrementalAuto should fall back to
//  D ∘ Q ∘ I, which equals IncrementalizeZSet's output.
// ─────────────────────────────────────────────────────────────────

[<Fact>]
let ``IncrementalAuto with terminal-linear-but-inner-non-linear chain falls back (Map ∘ Distinct)`` () =
    // Regression test for the bug Codex flagged: checking only the
    // probed terminal op's IsLinear misses non-linear ops inside the
    // chain. `q(s) = Map(Distinct(s))` ends on a linear Map but the
    // composed query is non-linear; the dispatcher MUST fall back to
    // D∘Q∘I to produce correct incremental semantics.
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let mapAfterDistinct =
        Func<Stream<ZSet<int>>, Stream<ZSet<int>>>(fun s ->
            c.Map(c.Distinct s, Func<int, int>(fun x -> x * 10)))

    let reference = c.IncrementalizeZSet(mapAfterDistinct, input.Stream)
    let subject   = c.IncrementalAuto(mapAfterDistinct, input.Stream)

    let refHandle = c.Output reference
    let subHandle = c.Output subject

    // Scenario: duplicate insertions across ticks. If the dispatcher
    // incorrectly took the Q^Δ=Q path, the subject would emit the
    // Map of the delta directly each tick — wrong because Distinct
    // clamps cumulative state, so the second insertion of key 1
    // should produce no new output. The reference path (D∘Q∘I)
    // computes this correctly; subject must match.
    let deltas =
        [ ZSet.ofSeq [ (1, 1L) ]      // distinct: {1→1}, mapped: {10→1}; emit Δ {10→+1}
          ZSet.ofSeq [ (1, 1L) ]      // distinct: still {1→1}; mapped same; emit Δ {} (no change)
          ZSet.ofSeq [ (2, 1L) ]      // distinct: {1,2}; mapped: {10,20}; emit Δ {20→+1}
          ZSet.ofSeq [ (1, -2L) ]     // distinct: {2}; mapped: {20}; emit Δ {10→-1}
        ]

    for delta in deltas do
        input.Send delta
        c.Step()
        subHandle.Current |> should equal refHandle.Current


[<Fact>]
let ``IncrementalAuto with non-linear Distinct falls back to D-Q-I`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let distinctOp = Func<Stream<ZSet<int>>, Stream<ZSet<int>>>(fun s -> c.Distinct s)

    let reference = c.IncrementalizeZSet(distinctOp, input.Stream)
    let subject   = c.IncrementalAuto(distinctOp, input.Stream)

    let refHandle = c.Output reference
    let subHandle = c.Output subject

    let deltas =
        [ ZSet.ofSeq [ (1, 1L); (2, 1L) ]
          ZSet.ofSeq [ (1, 1L) ]      // duplicate of 1; distinct should not emit it again
          ZSet.ofSeq [ (3, 1L) ]
          ZSet.ofSeq [ (1, -1L) ]     // retract one instance of 1
          ZSet.ofSeq [ (1, -1L) ]     // retract the last instance — distinct should drop 1
          ZSet.Empty ]

    for delta in deltas do
        input.Send delta
        c.Step()
        subHandle.Current |> should equal refHandle.Current


// ─────────────────────────────────────────────────────────────────
//  Sink case — should throw
// ─────────────────────────────────────────────────────────────────

/// A sink that outputs a Z-set (so its output type matches the
/// `IncrementalAuto<'K>` signature). Sink-ness is declarative — the
/// dispatcher should reject before stepping.
type private ZSetSinkOp(input: Stream<ZSet<int>>) =
    let deps = [| input.AsDependency() |]
    interface ISinkOperator<ZSet<int>, ZSet<int>> with
        member _.Name = "test-zset-sink"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


[<Fact>]
let ``IncrementalAuto throws when the operator is a sink`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let sinkBuilder =
        Func<Stream<ZSet<int>>, Stream<ZSet<int>>>(fun s ->
            c.RegisterStream (ZSetSinkOp s :> IOperator<ZSet<int>>))
    let ex =
        Assert.Throws<InvalidOperationException>(fun () ->
            c.IncrementalAuto(sinkBuilder, input.Stream) |> ignore)
    ex.Message |> should haveSubstring "IncrementalAuto"
    ex.Message |> should haveSubstring "sink"
    ex.Message |> should haveSubstring "test-zset-sink"


// ─────────────────────────────────────────────────────────────────
//  Structural fast-path verification — the linear case should take
//  the passthrough dispatch (no Integrate, no Differentiate), so the
//  number of operators registered after `IncrementalAuto` matches
//  the count from a direct `q.Invoke` (one operator: just the Map).
//
//  This test verifies the dispatch path via operator-count delta —
//  the indirect-but-deterministic signal that the fast path was
//  taken. A stronger reference-equality assertion (the returned
//  Stream's underlying Op IS the probed Op) would require exposing
//  the internal `Stream.Op` accessor, which is internal-only today.
// ─────────────────────────────────────────────────────────────────

[<Fact>]
let ``IncrementalAuto with linear op adds exactly one operator (passthrough, no D-I)`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let countBefore = c.OperatorCount
    let _ =
        c.IncrementalAuto(
            Func<Stream<ZSet<int>>, Stream<ZSet<int>>>(fun s ->
                c.Map(s, Func<int, int>(fun x -> x * 2))),
            input.Stream)
    let countAfter = c.OperatorCount
    // Linear path: only the Map op registers. No Integrate, no Differentiate.
    (countAfter - countBefore) |> should equal 1


[<Fact>]
let ``IncrementalAuto with non-linear op adds four operators (probe-orphan + Integrate + new Q + Differentiate)`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let countBefore = c.OperatorCount
    let _ =
        c.IncrementalAuto(
            Func<Stream<ZSet<int>>, Stream<ZSet<int>>>(fun s -> c.Distinct s),
            input.Stream)
    let countAfter = c.OperatorCount
    // Fallback path registers:
    //   1. Probe q.Invoke(input) → orphan Distinct
    //   2. IntegrateZSet(input)
    //   3. q.Invoke(integrated) → second Distinct
    //   4. DifferentiateZSet(processed)
    // Total: 4 new operators (one is orphan, see IncrementalAuto docstring).
    (countAfter - countBefore) |> should equal 4
