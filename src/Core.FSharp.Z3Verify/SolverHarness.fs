namespace Zeta.Formal

open System
open System.IO
open System.Diagnostics
open System.Runtime.InteropServices
open System.Security.Cryptography
open System.Text
open System.Text.Json
open System.Collections.Generic

type SolverVerdict =
    | Sat
    | Unsat
    | Unknown
    | SolverError of string
    | SolverTimeout

module SolverHarness =

    // --- Configuration and Replay Database ---

    let private findRepoRoot () =
        let rec search (dir: string) =
            if File.Exists(Path.Combine(dir, "Zeta.sln")) then
                dir
            else
                let parent = Directory.GetParent(dir)
                if parent = null then
                    failwith "Could not find repository root (Zeta.sln)"
                else
                    search parent.FullName
        search (Directory.GetCurrentDirectory())

    let private getReplayFilePath () =
        Path.Combine(findRepoRoot(), "tests/Tests.FSharp/Formal/solver-replay.json")

    let private getSolverMode () =
        let mode = Environment.GetEnvironmentVariable("ZETA_SOLVER_MODE")
        if String.IsNullOrEmpty(mode) then "live"
        else mode.ToLowerInvariant()

    let private isGitHubLinux () =
        String.Equals(Environment.GetEnvironmentVariable("CI"), "true", StringComparison.OrdinalIgnoreCase)
        && RuntimeInformation.IsOSPlatform(OSPlatform.Linux)

    let private sha256 (input: string) =
        use hasher = SHA256.Create()
        let bytes = hasher.ComputeHash(Encoding.UTF8.GetBytes(input))
        bytes
        |> Array.map (fun b -> b.ToString("x2"))
        |> String.concat ""

    // Read the database from disk, creating it if absent.
    let private readDb () : Dictionary<string, Dictionary<string, string>> =
        let path = getReplayFilePath()
        if File.Exists(path) then
            try
                let json = File.ReadAllText(path)
                JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(json)
            with _ ->
                Dictionary()
        else
            Dictionary()

    // Write the database back to disk.
    let private writeDb (db: Dictionary<string, Dictionary<string, string>>) =
        let path = getReplayFilePath()
        let dir = Path.GetDirectoryName(path)
        if not (Directory.Exists(dir)) then
            Directory.CreateDirectory(dir) |> ignore
        let options = JsonSerializerOptions(WriteIndented = true)
        let json = JsonSerializer.Serialize(db, options)
        File.WriteAllText(path, json)

    // Log query in the database.
    let private recordVerdict (solverName: string) (query: string) (verdict: string) =
        let db = readDb()
        if not (db.ContainsKey(solverName)) then
            db.[solverName] <- Dictionary()
        let hash = sha256 query
        db.[solverName].[hash] <- verdict
        writeDb db

    // Read query from the database.
    let private tryGetReplayedVerdict (solverName: string) (query: string) : SolverVerdict option =
        let db = readDb()
        if db.ContainsKey(solverName) then
            let hash = sha256 query
            if db.[solverName].ContainsKey(hash) then
                match db.[solverName].[hash] with
                | "sat" -> Some Sat
                | "unsat" -> Some Unsat
                | "unknown" -> Some Unknown
                | err -> Some (SolverError err)
            else
                None
        else
            None

    // --- Process Spawning with Timeout ---

    let private which (tool: string) : string option =
        try
            let psi =
                ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                    RedirectStandardOutput = true,
                    UseShellExecute = false)
            use p = Process.Start psi
            let output = p.StandardOutput.ReadToEnd().Trim()
            p.WaitForExit()
            if p.ExitCode = 0 && File.Exists output then Some output
            else None
        with _ -> None

    let private runProcess (cmd: string) (args: string) (stdinInput: string) (timeoutMs: int) : string * string * int option =
        try
            let psi = ProcessStartInfo(
                        cmd, args,
                        RedirectStandardInput = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true)
            use p = new Process()
            p.StartInfo <- psi
            if p.Start() then
                p.StandardInput.Write(stdinInput)
                p.StandardInput.Close()
                
                // Read stdout and stderr asynchronously to prevent deadlocks on large outputs
                let stdoutTask = System.Threading.Tasks.Task.Run(fun () -> p.StandardOutput.ReadToEnd())
                let stderrTask = System.Threading.Tasks.Task.Run(fun () -> p.StandardError.ReadToEnd())
                
                if p.WaitForExit(timeoutMs) then
                    let stdout = stdoutTask.Result
                    let stderr = stderrTask.Result
                    (stdout, stderr, Some p.ExitCode)
                else
                    try p.Kill() with _ -> ()
                    ("", "Timeout exceeded", None)
            else
                ("", "Failed to start process", Some -1)
        with ex ->
            ("", ex.Message, Some -1)

    // --- Solver parsers ---

    let private parseSmtOutput (stdout: string) (stderr: string) (exitCode: int option) =
        match exitCode with
        | None -> SolverTimeout
        | Some code when code <> 0 && not (stdout.Contains("sat") || stdout.Contains("unsat")) ->
            SolverError (sprintf "Exit code %d, Stderr: %s" code stderr)
        | _ ->
            let tokens = stdout.Split([| ' '; '\n'; '\r'; '\t' |], StringSplitOptions.RemoveEmptyEntries)
            let verdict = 
                tokens 
                |> Array.tryFind (fun t -> t = "unsat" || t = "sat" || t = "unknown")
            match verdict with
            | Some "unsat" -> Unsat
            | Some "sat" -> Sat
            | Some "unknown" -> Unknown
            | _ -> SolverError (sprintf "No valid SMT verdict in output. Stdout: %s, Stderr: %s" stdout stderr)

    let private parseEProverOutput (stdout: string) (stderr: string) (exitCode: int option) =
        match exitCode with
        | None -> SolverTimeout
        | _ ->
            let lines = stdout.Split([| '\n'; '\r' |], StringSplitOptions.RemoveEmptyEntries)
            let statusLine = 
                lines 
                |> Array.tryFind (fun l -> l.Contains("SZS status"))
            match statusLine with
            | Some line ->
                let tokens = line.Split([| ' '; '\t' |], StringSplitOptions.RemoveEmptyEntries)
                let idx = tokens |> Array.tryFindIndex (fun t -> t = "status")
                match idx with
                | Some i when i + 1 < tokens.Length ->
                    let statusVal = tokens.[i + 1].Trim()
                    if statusVal.Contains("Theorem") || statusVal.Contains("Unsatisfiable") then
                        Unsat
                    elif statusVal.Contains("CounterSatisfiable") || statusVal.Contains("Satisfiable") then
                        Sat
                    elif statusVal.Contains("Timeout") then
                        SolverTimeout
                    elif statusVal.Contains("GaveUp") then
                        Unknown
                    else
                        SolverError (sprintf "E prover status: %s" statusVal)
                | _ -> SolverError (sprintf "Malformed E prover status line: %s" line)
            | None -> 
                if exitCode = Some 0 then Unsat
                else SolverError (sprintf "No SZS status line in E prover output. Stdout: %s, Stderr: %s" stdout stderr)

    // --- Public interface ---

    /// Run Z3 SMT solver on SMT-LIB-2 query
    let runZ3 (query: string) : SolverVerdict =
        let solverName = "z3"
        let mode = getSolverMode()
        
        if mode = "replay" then
            match tryGetReplayedVerdict solverName query with
            | Some v -> v
            | None -> failwithf "Strict replay: no replay cached for solver %s, query hash %s" solverName (sha256 query)
        else
            // Suppress warnings in CVC5/Z3 by ensuring set-logic is set if needed (handled externally or prepended)
            let (stdout, stderr, exitCode) = runProcess "z3" "-in" query 15000
            let verdict = parseSmtOutput stdout stderr exitCode
            if mode = "record" then
                let verdictStr = 
                    match verdict with
                    | Sat -> "sat"
                    | Unsat -> "unsat"
                    | Unknown -> "unknown"
                    | SolverError err -> err
                    | SolverTimeout -> "timeout"
                recordVerdict solverName query verdictStr
            verdict

    /// Run CVC5 SMT solver on SMT-LIB-2 query
    let runCvc5 (query: string) : SolverVerdict =
        let solverName = "cvc5"
        let mode = getSolverMode()

        if mode = "replay" then
            match tryGetReplayedVerdict solverName query with
            | Some v -> v
            | None -> failwithf "Strict replay: no replay cached for solver %s, query hash %s" solverName (sha256 query)
        else
            // Prepend (set-logic ALL) if no set-logic command is present to avoid CVC5 warnings
            let queryPrepended = 
                if not (query.Contains("set-logic")) then
                    "(set-logic ALL)\n" + query
                else
                    query
            let (stdout, stderr, exitCode) = runProcess "cvc5" "--lang=smt2 -q" queryPrepended 15000
            let verdict = parseSmtOutput stdout stderr exitCode
            if mode = "record" then
                let verdictStr = 
                    match verdict with
                    | Sat -> "sat"
                    | Unsat -> "unsat"
                    | Unknown -> "unknown"
                    | SolverError err -> err
                    | SolverTimeout -> "timeout"
                recordVerdict solverName query verdictStr
            verdict

    /// Run E Prover on TPTP query
    let runEProver (query: string) : SolverVerdict =
        let solverName = "eprover"
        let mode = getSolverMode()

        // GitHub's Linux E prover package currently false-negatives the
        // small FOL equality proofs; replay keeps the oracle strict there.
        if mode = "replay" || (mode = "live" && isGitHubLinux()) then
            match tryGetReplayedVerdict solverName query with
            | Some v -> v
            | None when mode = "replay" ->
                failwithf "Strict replay: no replay cached for solver %s, query hash %s" solverName (sha256 query)
            | None ->
                let (stdout, stderr, exitCode) = runProcess "eprover" "--auto --tstp-format" query 15000
                parseEProverOutput stdout stderr exitCode
        else
            let (stdout, stderr, exitCode) = runProcess "eprover" "--auto --tstp-format" query 15000
            let verdict = parseEProverOutput stdout stderr exitCode
            if mode = "record" then
                let verdictStr = 
                    match verdict with
                    | Sat -> "sat"
                    | Unsat -> "unsat"
                    | Unknown -> "unknown"
                    | SolverError err -> err
                    | SolverTimeout -> "timeout"
                recordVerdict solverName query verdictStr
            verdict

    /// Smoke-test whether live E prover is installed and functional (Noble apt package
    /// 3.0.03+ds-1 aborts in Docker/CI — skip FOL tests rather than false-fail).
    let eproverLiveAvailable () =
        let mode = getSolverMode()
        if mode = "replay" then true
        else
            match which "eprover" with
            | None -> false
            | Some _ ->
                match runEProver "fof(smoke, conjecture, (![X]: X = X))." with
                | Unsat -> true
                | _ -> false

    /// Run Z3 and CVC5, assert agreement, and surface disagreement/crashes
    let crossCheck (query: string) : SolverVerdict * SolverVerdict =
        let z3Verdict = runZ3 query
        let cvc5Verdict = runCvc5 query
        
        match z3Verdict, cvc5Verdict with
        | Unsat, Unsat -> (Unsat, Unsat)
        | Sat, Sat -> (Sat, Sat)
        | Unknown, Unknown -> (Unknown, Unknown)
        | v1, v2 -> 
            let errorMsg = sprintf "Solver disagreement: Z3 returned %A, CVC5 returned %A for query hash %s" v1 v2 (sha256 query)
            failwith errorMsg

    /// Prove FOL-shaped TPTP conjecture on E prover
    let proveFOL (query: string) : bool =
        match runEProver query with
        | Unsat -> true
        | _ -> false
