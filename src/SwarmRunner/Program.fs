namespace Zeta.SwarmRunner

open System
open System.Diagnostics
open System.IO
open System.Threading

module Program =

    type RunResult = {
        Seed: int64
        Success: bool
        Output: string
        DurationMs: int64
    }

    /// Spawns a parallel process running the test runner with ZETA_SIM_SEED.
    let runTest (seed: int64) (filter: string) (projectPath: string) =
        async {
            let sw = Stopwatch.StartNew()
            
            let startInfo = ProcessStartInfo()
            startInfo.FileName <- "dotnet"
            startInfo.Arguments <- sprintf "test %s --filter \"%s\" --logger:console;verbosity=quiet" projectPath filter
            
            // Set the simulation seed environment variable
            startInfo.EnvironmentVariables.["ZETA_SIM_SEED"] <- string seed
            startInfo.UseShellExecute <- false
            startInfo.RedirectStandardOutput <- true
            startInfo.RedirectStandardError <- true
            startInfo.CreateNoWindow <- true
            
            use p = new Process()
            p.StartInfo <- startInfo
            
            try
                let _ = p.Start()
                let! stdout = p.StandardOutput.ReadToEndAsync() |> Async.AwaitTask
                let! stderr = p.StandardError.ReadToEndAsync() |> Async.AwaitTask
                
                // Wait for the test process to terminate
                do! Async.AwaitTask(p.WaitForExitAsync())
                
                sw.Stop()
                let success = p.ExitCode = 0
                return {
                    Seed = seed
                    Success = success
                    Output = stdout + "\n" + stderr
                    DurationMs = sw.ElapsedMilliseconds
                }
            with ex ->
                sw.Stop()
                return {
                    Seed = seed
                    Success = false
                    Output = ex.ToString()
                    DurationMs = sw.ElapsedMilliseconds
                }
        }

    [<EntryPoint>]
    let main argv =
        printfn "=========================================================="
        printfn "          ZETA DST SWARM TEST RUNNER (FDB PARITY)"
        printfn "=========================================================="

        // Simple argument parsing
        let args = argv |> Array.toList
        let rec parse (argsList: string list) (seeds, concurrency, filter, startSeed) =
            match argsList with
            | "--seeds" :: s :: tail -> parse tail (int s, concurrency, filter, startSeed)
            | "--parallelism" :: p :: tail -> parse tail (seeds, int p, filter, startSeed)
            | "--filter" :: f :: tail -> parse tail (seeds, concurrency, f, startSeed)
            | "--seed-start" :: ss :: tail -> parse tail (seeds, concurrency, filter, int64 ss)
            | _ :: tail -> parse tail (seeds, concurrency, filter, startSeed)
            | [] -> (seeds, concurrency, filter, startSeed)

        let totalSeeds, parallelism, filter, startSeed =
            parse args (10, Environment.ProcessorCount, "InMemoryFileSystem swarm stress test scenario", 990L)

        let projectPath = "tests/Tests.FSharp/Tests.FSharp.fsproj"

        printfn "Target Project: %s" projectPath
        printfn "Filter Pattern: %s" filter
        printfn "Total Seeds:    %d" totalSeeds
        printfn "Concurrency:    %d" parallelism
        printfn "Starting Seed:  %d" startSeed
        printfn "----------------------------------------------------------"

        let computations =
            [| 0 .. totalSeeds - 1 |]
            |> Array.map (fun i ->
                let seed = startSeed + int64 i
                async {
                    let! result = runTest seed filter projectPath
                    if result.Success then
                        printfn "[PASS] Seed %d (%dms)" seed result.DurationMs
                    else
                        printfn "[FAIL] Seed %d (%dms)" seed result.DurationMs
                    return result
                }
            )

        // Throttle and run in parallel using AsyncLocal / F# task pool throttler
        let sw = Stopwatch.StartNew()
        let results = 
            Async.Parallel(computations, parallelism) 
            |> Async.RunSynchronously
        sw.Stop()

        let failures = results |> Array.filter (fun r -> not r.Success)
        let successCount = results.Length - failures.Length

        printfn "=========================================================="
        printfn "                      SWARM REPORT"
        printfn "=========================================================="
        printfn "Total Executions: %d" results.Length
        printfn "Passed:           %d" successCount
        printfn "Failed:           %d" failures.Length
        printfn "Elapsed Time:     %dms" sw.ElapsedMilliseconds
        printfn "----------------------------------------------------------"

        if failures.Length > 0 then
            printfn "FAILING SEEDS FOUND:"
            for f in failures do
                printfn "\n[FAIL] Seed: %d (Duration: %dms)" f.Seed f.DurationMs
                printfn "Replication command:"
                printfn "    ZETA_SIM_SEED=%d dotnet test %s --filter \"%s\"" f.Seed projectPath filter
                printfn "--- Fail Log Snippet ---"
                let lines = f.Output.Split([| '\r'; '\n' |], StringSplitOptions.RemoveEmptyEntries)
                let errorLines = lines |> Array.filter (fun l -> l.Contains("fail") || l.Contains("Error") || l.Contains("Exception"))
                for el in errorLines |> Seq.truncate 5 do
                    printfn "    %s" el
                printfn "------------------------"
            1 // Exit code indicates failure
        else
            printfn "ALL SEEDS PASSED!"
            0 // Success
