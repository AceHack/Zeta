namespace Zeta.Research

open System

/// Only the explicit separate graph-hand feasibility command is currently
/// available. Behavior/cost execution remains refused before runtime admission.
module HiddenSwitchCompiledProgram =
    [<EntryPoint>]
    let main (arguments: string[]) =
        match arguments with
        | [| "graph-hand"; output |] ->
            match HiddenSwitchCompiledGraph.run output with
            | Ok () -> 0
            | Error failure -> Console.Error.WriteLine(failure.Stage + ": " + failure.Code + ": " + failure.Detail); 2
        | _ ->
            Console.Error.WriteLine("hidden-switch-compiled: only graph-hand feasibility is available; study execution requires runtime admission")
            2
