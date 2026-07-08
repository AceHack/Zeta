module Zeta.Cli.Program

open System
open System.IO
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.FSharp.Git

/// The thin `zeta` CLI shell over the command core (roadmap #1, no-git-CLI; core-library-first). All the
/// logic lives in CliParse (argv -> GitCommand) + GitCommand.run (over the repo) — both CI-tested in
/// Zeta.Core.FSharp.Git. This shell just opens the repo in the cwd, runs, prints, and returns an exit code.
///
/// Network verbs (push / fetch) get a host-agnostic credential source: env token (GH_TOKEN / GITHUB_TOKEN)
/// over HTTPS. GitHub is a plugin, not git-native — the source only yields a handler or a clean error.
/// `zeta shape render <cartridge.lines> (svg|html)` — the cartridge's projection printed to stdout.
/// The cartridge is the single source; SVG/HTML are regenerated, never edited (sync by golden lock).
/// THE GATE IS WIRED (silent-failure hunt 2026-06-12: "the HARD GATE gated nothing" — acceptance
/// ran only in tests while zeta-cli rendered failing cartridges identically to passing ones):
/// render now REFUSES a cartridge that fails bytes/geometry/honest-labels (exit 3, verdicts on
/// stderr); `zeta shape accept` runs the gate standalone. Meaning verdicts are reported, never
/// gated — unchanged.
let private shapeAccept (path: string) : int =
    if not (IO.File.Exists path) then
        eprintfn "zeta: %s: not found" path
        1
    else
        match Zeta.Core.MediaLines.parse (IO.File.ReadAllText path) with
        | Error e ->
            eprintfn "zeta: %s: %s" path e
            1
        | Ok doc ->
            let verdicts = Zeta.Core.ShapeAcceptance.acceptOne doc
            for v in verdicts do
                let mark = if v.Accepted then "ok " else "FAIL"
                eprintfn "  [%s] %A: %s" mark v.Register v.Evidence
            if Zeta.Core.ShapeAcceptance.accepted verdicts then
                printfn "accepted"
                0
            else
                eprintfn "zeta: %s REFUSED by the gate (no shape is accepted because it looks good)" path
                3

let private shapeRender (path: string) (kind: string) : int =
    if not (IO.File.Exists path) then
        eprintfn "zeta: %s: not found" path
        1
    else
        match Zeta.Core.MediaLines.parse (IO.File.ReadAllText path) with
        | Error e ->
            eprintfn "zeta: %s: %s" path e
            1
        | Ok doc ->
            let verdicts = Zeta.Core.ShapeAcceptance.acceptOne doc
            if not (Zeta.Core.ShapeAcceptance.accepted verdicts) then
                for v in verdicts do
                    if not v.Accepted then eprintfn "  [FAIL] %A: %s" v.Register v.Evidence
                eprintfn "zeta: %s REFUSED by the gate — fix the cartridge or run 'zeta shape accept' for the full verdicts" path
                3
            else
                match kind with
                | "svg" -> printf "%s" (Zeta.Core.ShapeRender.toSvg doc); 0
                | "html" -> printf "%s" (Zeta.Core.ShapeRender.toHtml doc); 0
                | k ->
                    eprintfn "zeta: unknown projection '%s' (svg|html)" k
                    2

/// `zeta flash …` — USB/ISO install media router (delegates to Core.TypeScript/zflash).
let private runFlash (args: string list) : int =
    match Repository.Discover(Environment.CurrentDirectory) with
    | null ->
        eprintfn "zeta: not inside a git repository (needed to locate zflash router)"
        1
    | repoPath ->
        let root = Path.GetDirectoryName(repoPath)
        let router = Path.Combine(root, "src", "Core.TypeScript", "zflash", "zeta-flash.ts")
        if not (IO.File.Exists router) then
            eprintfn "zeta: zflash router not found at %s" router
            1
        else
            use proc = new Diagnostics.Process()
            proc.StartInfo.FileName <- "bun"
            proc.StartInfo.WorkingDirectory <- root
            proc.StartInfo.UseShellExecute <- false
            proc.StartInfo.ArgumentList.Add(router)
            for a in args do proc.StartInfo.ArgumentList.Add(a)
            proc.Start() |> ignore
            proc.WaitForExit()
            proc.ExitCode

[<EntryPoint>]
let main argv =
    match Array.toList argv with
    | "flash" :: rest -> runFlash rest
    | _ ->
    match argv with
    | [| "shape"; "render"; path; kind |] -> shapeRender path kind
    | [| "shape"; "accept"; path |] -> shapeAccept path
    | [| "shape"; "render"; _ |] -> eprintfn "zeta: usage: zeta shape render <cartridge.lines> (svg|html)"; 2
    | [| "zs" |]
    | [| "run"; "shell" |] ->
        match Repository.Discover(Environment.CurrentDirectory) with
        | null ->
            eprintfn "zeta: not inside a git repository"
            1
        | repoPath ->
            use repo = new Repository(repoPath)
            let codec = CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)
            let log = GitDeltaLog<DvKey>(repo, codec)
            ZetaShell.runShell log
            0
    | [| "zc" |]
    | [| "run"; "cell" |] ->
        match Repository.Discover(Environment.CurrentDirectory) with
        | null ->
            eprintfn "zeta: not inside a git repository"
            1
        | repoPath ->
            use repo = new Repository(repoPath)
            let codec = CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)
            let log = GitDeltaLog<DvKey>(repo, codec)
            ZetaShell.runDaemon log Threading.CancellationToken.None
            0
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
            let credSource = EnvTokenCredentialSource() :> CredentialSource

            try
                let codec = CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)
                let log = GitDeltaLog<DvKey>(repo, codec, credSource = credSource)
                let resResult = Zeta.Core.DbCommand.run log Threading.CancellationToken.None cmd |> Async.AwaitTask |> Async.RunSynchronously
                match resResult with
                | Ok res ->
                    match res with
                    | DbCommandResult.Emitted seq ->
                        printfn "emitted seq: %d" seq
                    | DbCommandResult.Retracted seq ->
                        printfn "retracted seq: %d" seq
                    | DbCommandResult.Branched name ->
                        printfn "branched %s" name
                    | DbCommandResult.Joined refName ->
                        printfn "joined %s" refName
                    | DbCommandResult.Merged (sourceRef, newSeq) ->
                        printfn "merged %s -> seq: %d" sourceRef newSeq
                    | DbCommandResult.Folded entries ->
                        for entry in entries do
                            let dv = DeltaLogEntryDynamic.toDynamicValue DvKey.value entry
                            match DynamicValue.toCanonicalJson dv with
                            | Ok json -> printfn "%s" json
                            | Error e -> eprintfn "failed to format entry: %A" e
                    | DbCommandResult.Statused(clean, pending) ->
                        if clean then
                            printfn "clean"
                        else
                            printfn "dirty (%d pending):" pending.Length
                            for p in pending do printfn "  %s" p
                    | DbCommandResult.Listed entries ->
                        for entry in entries do
                            printfn "%s" entry
                    0
                | Error fb ->
                    match fb with
                    | ReferenceNotFound refName -> eprintfn "zeta: reference '%s' not found" refName
                    | RemoteNotFound remoteName -> eprintfn "zeta: remote '%s' not found" remoteName
                    | ConnectionFailed msg -> eprintfn "zeta: connection failed: %s" msg
                    | MergeConflict msg -> eprintfn "zeta: merge conflict: %s" msg
                    | InvalidOperation msg -> eprintfn "zeta: invalid operation: %s" msg
                    1
            with ex ->
                eprintfn "zeta: %s" ex.Message
                1
