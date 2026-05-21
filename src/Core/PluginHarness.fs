namespace Zeta.Core

open System.Collections.Generic
open System.Threading
open System.Threading.Tasks


/// Minimal scheduler-less test harness for plugin operator authors.
/// Drive an `IOperator<'T>` through a sequence of inputs without
/// building a full `Circuit`. Asserts exactly-one-`Publish` per
/// tick and returns the sequence of published outputs.
///
/// Intended for unit-testing plugin operators in isolation —
/// sits alongside the plugin's own test project. For
/// circuit-integration tests, use a real `Circuit` and the
/// plugin's registration extension method.
[<RequireQualifiedAccess>]
module PluginHarness =

    /// Internal source op driven by the harness: holds a single
    /// current value, publishes it when the harness sets it.
    /// Not registered in any real circuit; lives only for the
    /// duration of a harness run.
    type private HarnessSourceOp<'TIn>() =
        inherit Op<'TIn>()
        override _.Name = "harness-source"
        override _.Inputs = [||]
        override _.StepAsync(_ct) = ValueTask.CompletedTask
        member this.Feed(v: 'TIn) = this.SetValue v

    /// Drive a single-input plugin operator through a list of
    /// inputs. `makeOp` receives a mock `Stream<'TIn>` bound to
    /// the harness source and must return the plugin op ready to
    /// run. Returns the list of outputs the plugin publishes in
    /// order (one per input). Asserts exactly-one-`Publish` per
    /// tick; throws `InvalidOperationException` on zero or
    /// multiple publishes.
    let runSingleInput<'TIn, 'TOut>
        (makeOp: Stream<'TIn> -> IOperator<'TOut>)
        (inputs: seq<'TIn>)
        : 'TOut list =
        let source = HarnessSourceOp<'TIn>()
        // Assigning a synthetic id so the source can serve as a
        // StreamHandle target. Real circuits set this during
        // `Circuit.Build`; the harness does it by hand.
        source.idField <- 0
        let sourceStream = Stream<'TIn>(source)
        let plugin = makeOp sourceStream

        // Wrap the plugin in the same adapter the real Circuit
        // would use, so we hit identical code paths (including
        // the exactly-one-publish counter).
        let inputOps : Op array =
            plugin.ReadDependencies
            |> Array.map (fun h -> h.op)
        let adapter = PluginOperatorAdapter<'TOut>(plugin, inputOps)
        adapter.idField <- 1

        let outputs = ResizeArray<'TOut>()
        let ct = CancellationToken.None
        let mutable tick = 0
        for input in inputs do
            source.Feed input
            let before = adapter.PublishCount.Value
            let vt = (adapter :> Op).StepAsync ct
            if not vt.IsCompletedSuccessfully then
                vt.AsTask().GetAwaiter().GetResult()
            let after = adapter.PublishCount.Value
            let delta = after - before
            if delta <> 1 then
                invalidOp (
                    sprintf
                        "PluginHarness: tick %d expected exactly one Publish; saw %d."
                        tick delta)
            outputs.Add adapter.Value
            // Strict-op post-step hook — see runTwoInputs for the
            // rationale; same fix applies symmetrically to single-
            // input strict plugins (e.g. IStrictOperator-tagged
            // ops exercised via LawRunner.checkLinear).
            let postVt = (adapter :> Op).AfterStepAsync ct
            if not postVt.IsCompletedSuccessfully then
                postVt.AsTask().GetAwaiter().GetResult()
            // nosemgrep: plain-tick-increment -- method-local loop counter, not shared across threads
            tick <- tick + 1
        List.ofSeq outputs

    /// Drive a two-input plugin operator through a pair of parallel
    /// input sequences. Each tick advances BOTH inputs in lock-step;
    /// the shorter sequence determines the run length (`Seq.zip`
    /// semantics).
    ///
    /// Used by `LawRunner.checkBilinear` to exercise per-argument
    /// linearity and sign-distribution. Same exactly-one-`Publish`
    /// assertion as `runSingleInput`.
    let runTwoInputs<'TIn1, 'TIn2, 'TOut>
        (makeOp: Stream<'TIn1> -> Stream<'TIn2> -> IOperator<'TOut>)
        (inputs1: seq<'TIn1>)
        (inputs2: seq<'TIn2>)
        : 'TOut list =
        let source1 = HarnessSourceOp<'TIn1>()
        let source2 = HarnessSourceOp<'TIn2>()
        // Synthetic ids — sources at 0+1, adapter at 2. Real circuits
        // assign these during `Circuit.Build`; the harness mirrors
        // the layout so the adapter's per-tick state semantics match
        // production exactly.
        source1.idField <- 0
        source2.idField <- 1
        let stream1 = Stream<'TIn1>(source1)
        let stream2 = Stream<'TIn2>(source2)
        let plugin = makeOp stream1 stream2

        let inputOps : Op array =
            plugin.ReadDependencies
            |> Array.map (fun h -> h.op)
        let adapter = PluginOperatorAdapter<'TOut>(plugin, inputOps)
        adapter.idField <- 2

        let outputs = ResizeArray<'TOut>()
        let ct = CancellationToken.None
        let mutable tick = 0
        let zipped = Seq.zip inputs1 inputs2
        for (in1, in2) in zipped do
            source1.Feed in1
            source2.Feed in2
            let before = adapter.PublishCount.Value
            let vt = (adapter :> Op).StepAsync ct
            if not vt.IsCompletedSuccessfully then
                vt.AsTask().GetAwaiter().GetResult()
            let after = adapter.PublishCount.Value
            let delta = after - before
            if delta <> 1 then
                invalidOp (
                    sprintf
                        "PluginHarness: tick %d expected exactly one Publish; saw %d."
                        tick delta)
            outputs.Add adapter.Value
            // Mirror Circuit.Step/StepAsync's strict-op post-step
            // hook: after StepAsync completes, invoke AfterStepAsync
            // so strict bilinear/stateful ops commit per-tick state
            // before the next tick begins. Without this, plugins
            // implementing IStrictOperator would see different
            // semantics in `runTwoInputs` than in real circuit
            // execution, and `LawRunner.checkBilinear` would
            // validate against incorrect strict-op state.
            let postVt = (adapter :> Op).AfterStepAsync ct
            if not postVt.IsCompletedSuccessfully then
                postVt.AsTask().GetAwaiter().GetResult()
            // nosemgrep: plain-tick-increment -- method-local loop counter, not shared across threads
            tick <- tick + 1
        List.ofSeq outputs
