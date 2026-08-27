module Zeta.Tests.TasControlledPair

open System.Numerics
open System.Threading.Tasks
open Xunit
open Zeta.Core

let private ok result =
    match result with
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private channels () =
    ChannelSet.tryCreate
        [ { Channel = "ram"
            Direction = ChannelDirection.Read
            StartAddress = 0x200
            EndAddress = 0x2FF }
          { Channel = "ram"
            Direction = ChannelDirection.Write
            StartAddress = 0x200
            EndAddress = 0x2FF } ]
    |> ok

let private cleanRunKey () =
    Chip8CrossRunStore.runKey
        [| 0x60uy; 0x01uy |]
        4UL
        0x200
        "chip8"
        Chip8CrossRunStore.RunChannelLabel.clean

let private budget =
    { MaxAgentActions = 40
      MaxEnvironmentSteps = 80
      Attribution = "rung-k-test" }

let private issuer = ExperimenterId.tryCreate "arc-pair-harness" |> ok

[<Fact>]
let ``pair holds subject run identity and budget fixed while reporting assistance`` () : Task =
    task {
        let contexts = ResizeArray<TasRunContext>()

        let execute context =
            task {
                contexts.Add context

                match context.Mode, context.Grant with
                | TasRunMode.Clean, None ->
                    return
                        Ok
                            { Outcome =
                                { NormalizedScore = 0.25
                                  AgentActions = 20
                                  EnvironmentSteps = 40 }
                              Meter = None }
                | TasRunMode.Assisted, Some grant ->
                    let meter =
                        ChannelMeter.zero grant
                        |> ChannelMeter.crossRange grant "ram" ChannelDirection.Read 0x200 0x202
                        |> ok

                    return
                        Ok
                            { Outcome =
                                { NormalizedScore = 0.75
                                  AgentActions = 12
                                  EnvironmentSteps = 40 }
                              Meter = Some meter }
                | mode, _ ->
                    return
                        Error
                            { Code = "grant-mismatch"
                              Detail = sprintf "%A" mode }
            }

        let! result = TasControlledPair.run issuer "agent-under-test" (cleanRunKey ()) (channels ()) budget execute
        let report = ok result

        Assert.Equal(0.5, report.ScoreDelta)
        Assert.Equal(-8L, report.AgentActionDelta)
        Assert.Equal(0L, report.EnvironmentStepDelta)
        Assert.Equal<BigInteger>(3I, report.Crossings.Read)
        Assert.Equal<BigInteger>(0I, report.Crossings.Write)
        Assert.Equal<BigInteger>(3I, report.Crossings.Total)
        Assert.Equal(2, contexts.Count)
        Assert.True(contexts[0].Grant.IsNone)
        Assert.True(contexts[1].Grant.IsSome)

        let assistedAsClean =
            { report.AssistedRunKey with
                ChannelLabel = Chip8CrossRunStore.RunChannelLabel.clean }

        Assert.Equal(report.CleanRunKey, assistedAsClean)
    }
    :> Task

[<Fact>]
let ``non-clean baseline refuses before either leg executes`` () : Task =
    task {
        let mutable calls = 0
        let assistedLabel = channels () |> ChannelSet.runLabel |> ok

        let execute _ =
            task {
                calls <- calls + 1

                return
                    Ok
                        { Outcome =
                            { NormalizedScore = 0.0
                              AgentActions = 0
                              EnvironmentSteps = 0 }
                          Meter = None }
            }

        let assistedBaseline =
            { cleanRunKey () with
                ChannelLabel = assistedLabel }

        let! result = TasControlledPair.run issuer "agent-under-test" assistedBaseline (channels ()) budget execute

        match result with
        | Error(CleanRunKeyRequired actual) -> Assert.StartsWith("assisted:", actual)
        | other -> failwithf "expected clean-run-key refusal, got %A" other

        Assert.Equal(0, calls)
    }
    :> Task

[<Fact>]
let ``typed clean refusal prevents the assisted leg`` () : Task =
    task {
        let modes = ResizeArray<TasRunMode>()

        let execute context =
            task {
                modes.Add context.Mode

                return
                    Error
                        { Code = "fixture-refusal"
                          Detail = "no observation" }
            }

        let! result = TasControlledPair.run issuer "agent-under-test" (cleanRunKey ()) (channels ()) budget execute

        match result with
        | Error(TasRunRefused(TasRunMode.Clean, "fixture-refusal", "no observation")) -> ()
        | other -> failwithf "expected typed clean refusal, got %A" other

        Assert.Equal<TasRunMode list>([ TasRunMode.Clean ], modes |> Seq.toList)
    }
    :> Task

[<Fact>]
let ``outcome above the shared action budget is refused`` () : Task =
    task {
        let execute _ =
            Task.FromResult(
                Ok
                    { Outcome =
                        { NormalizedScore = 0.5
                          AgentActions = 41
                          EnvironmentSteps = 1 }
                      Meter = None }
            )

        let! result = TasControlledPair.run issuer "agent-under-test" (cleanRunKey ()) (channels ()) budget execute

        match result with
        | Error(AgentActionBudgetExceeded(TasRunMode.Clean, 41, 40)) -> ()
        | other -> failwithf "expected action-budget refusal, got %A" other
    }
    :> Task
