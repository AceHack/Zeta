namespace Zeta.Research

open System

/// Separate graph feasibility and explicitly incomplete hand slices only.
/// Behavior/cost execution remains refused before runtime admission.
module HiddenSwitchCompiledProgram =
    [<EntryPoint>]
    let main (arguments: string[]) =
        match arguments with
        | [| "certificate-check"; bindings; input; output |] ->
            match HiddenSwitchCompiledCertificateCheck.run bindings input output with
            | Ok () -> 0
            | Error failure -> Console.Error.WriteLine(failure.Stage + ": " + failure.Code + ": " + failure.Detail); 2
        | [| "hand-semantic"; output |] ->
            match HiddenSwitchCompiledSemantic.run output with
            | Ok () -> 0
            | Error failure -> Console.Error.WriteLine(failure.Stage + ": " + failure.Code + ": " + failure.Detail); 2
        | [| "hand-invocations"; output |] ->
            match HiddenSwitchCompiledWitness.run output with
            | Ok () -> 0
            | Error failure -> Console.Error.WriteLine(failure.Stage + ": " + failure.Code + ": " + failure.Detail); 2
        | [| "hand-core"; output |] ->
            match HiddenSwitchCompiledHand.run output with
            | Ok () -> 0
            | Error failure -> Console.Error.WriteLine(failure.Stage + ": " + failure.Code + ": " + failure.Detail); 2
        | [| "graph-hand"; output |] ->
            match HiddenSwitchCompiledGraph.run output with
            | Ok () -> 0
            | Error failure -> Console.Error.WriteLine(failure.Stage + ": " + failure.Code + ": " + failure.Detail); 2
        | _ ->
            Console.Error.WriteLine("hidden-switch-compiled: only graph-hand and incomplete hand-core slices are available; study execution requires runtime admission")
            2
