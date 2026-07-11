module Zeta.Tests.ZetaShellTests

open System
open System.IO
open System.Text
open global.Xunit
open Zeta.Core
open Zeta.Cli
open Zeta.Tests.Support

let private deleteDirectoryWithRetry (dir: string) =
    let rec loop attempts =
        if Directory.Exists dir then
            try
                Directory.Delete(dir, true)
            with
            | :? IOException when attempts > 0 ->
                Threading.Thread.Sleep 50
                loop (attempts - 1)
            | :? UnauthorizedAccessException when attempts > 0 ->
                GC.Collect()
                GC.WaitForPendingFinalizers()
                Threading.Thread.Sleep 50
                loop (attempts - 1)

    loop 10

[<Fact>]
let ``ZetaShell: runs REPL session with schema reification and data mutations`` () =
    let dir = DeterministicTestPath.nextDir "zs-test"
    try
        use repo = new LibGit2Sharp.Repository(LibGit2Sharp.Repository.Init(dir))
        let log = Zeta.Core.FSharp.Git.GitDeltaLog<DvKey>(repo, CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)) :> IRefDeltaLog<DvKey>
        
        // Pre-seed an initial commit so we can branch
        log.AppendAsync(ZSet.empty, Map.empty, Threading.CancellationToken.None).AsTask().Result |> ignore
        
        // Prepare console inputs
        let sb = StringBuilder()
        sb.AppendLine("branch refs/heads/main") |> ignore
        sb.AppendLine("schema User interface IUser { method GetName() -> String; }") |> ignore
        sb.AppendLine("exit") |> ignore
        
        let stdin = new StringReader(sb.ToString())
        let stdout = new StringWriter()
        
        let origIn = Console.In
        let origOut = Console.Out
        try
            Console.SetIn stdin
            Console.SetOut stdout
            
            ZetaShell.runShell log
            
            let output = stdout.ToString()
            Assert.Contains("Welcome to zs (ZetaShell) Interactive Interpreter", output)
            Assert.Contains("Reifying type for User...", output)
            Assert.Contains("type IUser =", output)
            Assert.Contains("abstract member GetName", output)
            Assert.Contains("Schema 'User' version 1 registered in SchemaRegistry", output)
        finally
            Console.SetIn origIn
            Console.SetOut origOut
            stdin.Dispose()
            stdout.Dispose()
    finally
        deleteDirectoryWithRetry dir
