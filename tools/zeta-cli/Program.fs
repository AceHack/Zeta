module Zeta.Cli.Program

open System
open LibGit2Sharp
open Zeta.Core.Git

/// The thin `zeta` CLI shell over the command core (roadmap #1, no-git-CLI; core-library-first). All the
/// logic lives in CliParse (argv -> GitCommand) + GitCommand.run (over the repo) — both CI-tested in
/// Zeta.Core.Git. This shell just opens the repo in the cwd, runs, prints, and returns an exit code.
[<EntryPoint>]
let main argv =
    match CliParse.parse argv with
    | Error msg ->
        eprintfn "%s" msg
        2
    | Ok cmd ->
        match Repository.Discover(Environment.CurrentDirectory) with
        | null ->
            eprintfn "zeta: not inside a git repository"
            1
        | repoPath ->
            use repo = new Repository(repoPath)
            match GitCommand.run repo (fun () -> DateTimeOffset.UtcNow) cmd with
            | Branched n -> printfn "branched %s" n
            | CheckedOut n -> printfn "checked out %s" n
            | Committed sha -> printfn "committed %s" sha
            | Logged entries ->
                for (sha, msg) in entries do
                    printfn "%s %s" (sha.Substring(0, min 9 sha.Length)) msg
            | Statused(clean, pending) ->
                if clean then
                    printfn "clean"
                else
                    printfn "dirty (%d pending):" pending.Length
                    for p in pending do printfn "  %s" p
            0
