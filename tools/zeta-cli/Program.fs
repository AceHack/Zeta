module Zeta.Cli.Program

open System
open LibGit2Sharp
open Zeta.Core.FSharp.Git

/// The thin `zeta` CLI shell over the command core (roadmap #1, no-git-CLI; core-library-first). All the
/// logic lives in CliParse (argv -> GitCommand) + GitCommand.run (over the repo) — both CI-tested in
/// Zeta.Core.FSharp.Git. This shell just opens the repo in the cwd, runs, prints, and returns an exit code.
///
/// Network verbs (push / fetch) get a host-agnostic credential source: env token (GH_TOKEN / GITHUB_TOKEN)
/// over HTTPS. GitHub is a plugin, not git-native — the source only yields a handler or a clean error.
/// `zeta shape render <cartridge.lines> (svg|html)` — the cartridge's projection printed to stdout.
/// The cartridge is the single source; SVG/HTML are regenerated, never edited (sync by golden lock).
let private shapeRender (path: string) (kind: string) : int =
    match Zeta.Core.MediaLines.parse (IO.File.ReadAllText path) with
    | Error e ->
        eprintfn "zeta: %s: %s" path e
        1
    | Ok doc ->
        match kind with
        | "svg" -> printf "%s" (Zeta.Core.ShapeRender.toSvg doc); 0
        | "html" -> printf "%s" (Zeta.Core.ShapeRender.toHtml doc); 0
        | k ->
            eprintfn "zeta: unknown projection '%s' (svg|html)" k
            2

[<EntryPoint>]
let main argv =
    match argv with
    | [| "shape"; "render"; path; kind |] -> shapeRender path kind
    | _ ->

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
            let credSource = Some(EnvTokenCredentialSource() :> CredentialSource)

            try
                match GitCommand.run repo (fun () -> DateTimeOffset.UtcNow) credSource cmd with
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
                | Pushed(remote, refspec) -> printfn "pushed %s -> %s" refspec remote
                | Fetched remote -> printfn "fetched %s" remote
                0
            with ex ->
                eprintfn "zeta: %s" ex.Message
                1
