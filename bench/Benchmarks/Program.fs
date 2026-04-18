module Zeta.Benchmarks.Program

open BenchmarkDotNet.Running

[<EntryPoint>]
let main argv =
    BenchmarkSwitcher
        .FromAssembly(typeof<ZSetBench.ZSetOps>.Assembly)
        .Run(argv)
    |> ignore
    0
