module Zeta.Tests.Plugin.HarnessTests

open System.Threading.Tasks
open Xunit
open FsUnit.Xunit
open Zeta.Core


/// Minimal `ILinearOperator` plugin — doubles its input. Used
/// to exercise `PluginHarness.runSingleInput` end-to-end without
/// a real circuit.
type private DoublerOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface ILinearOperator<int, int> with
        member _.Name = "doubler"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish (input.Current * 2)
            ValueTask.CompletedTask


/// Plugin that forgets to Publish — should fail the
/// exactly-one-Publish assertion in PluginHarness.
type private NoPublishOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface IOperator<int> with
        member _.Name = "no-publish"
        member _.ReadDependencies = deps
        member _.StepAsync(_out, _ct) =
            ValueTask.CompletedTask


/// Plugin that publishes twice per tick — should fail the
/// exactly-one-Publish assertion.
type private DoublePublishOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface IOperator<int> with
        member _.Name = "double-publish"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            out.Publish (input.Current + 1)
            ValueTask.CompletedTask


[<Fact>]
let ``PluginHarness runs a linear doubler and returns per-tick outputs`` () =
    let outputs =
        PluginHarness.runSingleInput
            (fun input -> DoublerOp input :> IOperator<int>)
            [ 1; 2; 3; 10; 100 ]
    outputs |> should equal [ 2; 4; 6; 20; 200 ]


[<Fact>]
let ``PluginHarness throws when the plugin never publishes`` () =
    let act () =
        PluginHarness.runSingleInput
            (fun input -> NoPublishOp input :> IOperator<int>)
            [ 1 ]
        |> ignore
    (fun () -> act ()) |> shouldFail


[<Fact>]
let ``PluginHarness throws when the plugin publishes twice`` () =
    let act () =
        PluginHarness.runSingleInput
            (fun input -> DoublePublishOp input :> IOperator<int>)
            [ 1 ]
        |> ignore
    (fun () -> act ()) |> shouldFail
