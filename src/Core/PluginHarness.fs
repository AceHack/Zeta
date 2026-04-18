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
            tick <- tick + 1
        List.ofSeq outputs
