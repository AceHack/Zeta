namespace Zeta.Benchmarks

open System
open System.IO
open System.Diagnostics
open BenchmarkDotNet.Attributes

[<MemoryDiagnoser>]
type GitBench() =

    let mutable tempFile = ""
    let dummyPayload = Array.create 1024 42uy

    [<GlobalSetup>]
    member this.Setup() =
        tempFile <- Path.GetTempFileName()

    [<GlobalCleanup>]
    member this.Cleanup() =
        try File.Delete(tempFile) with _ -> ()

    [<Benchmark(Baseline = true)>]
    member this.DirectWrite() =
        File.WriteAllBytes(tempFile, dummyPayload)

    [<Benchmark>]
    member this.GitCliStatus() =
        let psi = ProcessStartInfo("git", "status --porcelain")
        psi.RedirectStandardOutput <- true
        psi.UseShellExecute <- false
        psi.CreateNoWindow <- true
        use p = Process.Start(psi)
        p.WaitForExit()
