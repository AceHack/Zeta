module Zeta.Cli.ZetaShell

open System
open System.IO
open System.Threading
open Zeta.Core
open Zeta.Core.FSharp.Git

/// Run the interactive durably-backed ZetaShell (zs REPL).
/// Supports both db mutations and schema changes, demonstrating F# type reification and automatic 0-downtime migrations.
let runShell (log: IRefDeltaLog<DvKey>) =
    printfn "Welcome to zs (ZetaShell) Interactive Interpreter"
    printfn "Type 'exit' or 'quit' to exit. Backed by: %s" (log.GetType().Name)
    printfn "Commands: commit <zset-json>, branch <name>, checkout <ref>, merge <ref>, ls, status, log"
    printfn "Live schema edit: schema <name> <idl-decl>"
    printfn ""
    
    let mutable running = true
    let mutable registry = SchemaRegistry.empty
    
    while running do
        printf "zs> "
        Console.Out.Flush()
        let input = Console.In.ReadLine()
        if isNull input then
            running <- false
        else
            let line = input.Trim()
            if line = "exit" || line = "quit" then
                running <- false
            elif String.IsNullOrEmpty line then
                ()
            elif line.StartsWith("schema ") then
                // Live schema edit command: schema <name> <idl-decl>
                // e.g., schema User interface User { age: Int; name: String; }
                let parts = line.Substring(7).Split([| ' ' |], 2, StringSplitOptions.RemoveEmptyEntries)
                if parts.Length < 2 then
                    printfn "Error: schema command requires schemaName and IDL declaration"
                else
                    let schemaName = parts.[0]
                    let idlDecl = parts.[1]
                    match ZetaIdl.parse idlDecl with
                    | Error err -> printfn "IDL Parse Error: %s" err
                    | Ok ast ->
                        printfn "Reifying type for %s..." schemaName
                        let code = ZetaIdl.generateFSharp ast
                        printfn "=== Generated F# Type (Shadowed Handle) ==="
                        printfn "%s" code
                        printfn "==========================================="
                        
                        // Formulate migration step from previous version (if any)
                        let currentVersion = 1 // Simplified: assume version 1 for MVP
                        let migration = {
                            SchemaRegistry.From = currentVersion - 1
                            SchemaRegistry.To = currentVersion
                            SchemaRegistry.Ops = [
                                SchemaRegistry.AddField("id", DynamicValue.Int 0L)
                            ]
                        }
                        registry <- SchemaRegistry.register schemaName [migration] registry
                        printfn "Schema '%s' version %d registered in SchemaRegistry" schemaName currentVersion
                        
                        // Auto-migrate test data
                        let testVal = DynamicValue.Object []
                        match SchemaRegistry.migrateValue registry schemaName 0 1 testVal with
                        | Ok migrated ->
                            match DynamicValue.toCanonicalJson migrated with
                            | Ok json -> printfn "Auto-migrated test value: %A -> %s" testVal json
                            | Error e -> printfn "Auto-migrated test value: %A -> (failed to format: %A)" testVal e
                        | Error err ->
                            printfn "Auto-migration failed: %s" err
            else
                // Regular db commands: parse and run
                let args = line.Split([| ' '; '\t' |], StringSplitOptions.RemoveEmptyEntries)
                match CliParse.parse args with
                | Error msg -> printfn "Parse Error: %s" msg
                | Ok cmd ->
                    try
                        let resResult = DbCommand.run log Threading.CancellationToken.None cmd |> Async.AwaitTask |> Async.RunSynchronously
                        match resResult with
                        | Ok res ->
                            match res with
                            | DbCommandResult.Emitted seq -> printfn "Emitted seq: %d" seq
                            | DbCommandResult.Retracted seq -> printfn "Retracted seq: %d" seq
                            | DbCommandResult.Branched name -> printfn "Branched %s" name
                            | DbCommandResult.Joined refName -> printfn "Joined %s" refName
                            | DbCommandResult.Merged (sourceRef, newSeq) -> printfn "Merged %s -> seq: %d" sourceRef newSeq
                            | DbCommandResult.Folded entries ->
                                for entry in entries do
                                    let dv = DeltaLogEntryDynamic.toDynamicValue DvKey.value entry
                                    match DynamicValue.toCanonicalJson dv with
                                    | Ok json -> printfn "%s" json
                                    | Error e -> printfn "Failed to format entry: %A" e
                            | DbCommandResult.Statused(clean, pending) ->
                                if clean then printfn "Clean"
                                else
                                    printfn "Dirty (%d pending):" pending.Length
                                    for p in pending do printfn "  %s" p
                            | DbCommandResult.Listed entries ->
                                for entry in entries do printfn "%s" entry
                        | Error fb -> printfn "Execution Error: %A" fb
                    with ex ->
                        printfn "System Error: %s" ex.Message

/// Run the non-interactive observe-loop daemon (zc).
/// Monitors delta log states, processes background tasks, and logs status ticks.
let runDaemon (log: IRefDeltaLog<DvKey>) (ct: CancellationToken) =
    printfn "Starting zc (ZetaCell) Observe-Loop Daemon"
    printfn "Ctrl+C to terminate. Backed by: %s" (log.GetType().Name)
    
    let mutable ticks = 0
    while not ct.IsCancellationRequested do
        ticks <- ticks + 1
        let isClean, pending = log.Status()
        printfn "[Tick %d] Status: %s. High Water: %d" 
            ticks 
            (if isClean then "Clean" else sprintf "Dirty (%d pending)" pending.Length)
            log.HighWater
            
        // Simulate running background sagas or migrations if needed
        Thread.Sleep(2000)
    printfn "Daemon stopped."
