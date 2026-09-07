namespace Zeta.Research

open System

/// File-backed entry point is parked before graph admission. It exposes no
/// behavior/cost command and performs no policy or source-stream initialization.
module HiddenSwitchCompiledProgram =
    [<EntryPoint>]
    let main (_arguments: string[]) =
        Console.Error.WriteLine("hidden-switch-compiled: runtime-graph admission is not yet implemented; no study execution is available")
        2
