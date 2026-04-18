module Zeta.Feldera.Bench.Program

open BenchmarkDotNet.Running

[<EntryPoint>]
let main argv =
    BenchmarkSwitcher
        .FromAssembly(System.Reflection.Assembly.GetExecutingAssembly())
        .Run(argv)
    |> ignore
    0
