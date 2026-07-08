module Zeta.Tests.ZetaShellTests

open System
open System.IO
open System.Text
open global.Xunit
open Zeta.Core
open Zeta.Cli

[<Fact>]
let ``ZetaShell: runs REPL session with schema reification and data mutations`` () =
    let dir = Path.Combine(Path.GetTempPath(), sprintf "zs-test-%s" (Guid.NewGuid().ToString("N")))
    Directory.CreateDirectory dir |> ignore
    try
        let repo = new LibGit2Sharp.Repository(LibGit2Sharp.Repository.Init(dir))
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
            File.WriteAllText("/tmp/repl-debug.txt", output)
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
        Directory.Delete(dir, true)
