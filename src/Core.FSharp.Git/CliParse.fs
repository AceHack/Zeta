namespace Zeta.Core.FSharp.Git

open System
open Zeta.Core

/// Unified command type wrapping either a git-ref or a database-stream command.
[<RequireQualifiedAccess>]
type ZetaCliCommand =
    | Git of GitCommand
    | Db of Zeta.Core.DbCommand<Zeta.Core.DvKey>

/// CLI argument parser for the git-ref command verbs (roadmap #1, no-git-CLI; core-library-first). PURE:
/// `argv -> ZetaCliCommand` (or a usage error). Kept a library function so it's CI-tested; the runnable
/// `zeta` exe stays a trivial shell (open repo → parse argv → GitCommand/DbCommand run → print). The MCP
/// wrapper maps tool-calls → ZetaCliCommand the same way. Mirrors a developer's git muscle-memory so the
/// done-test (a full work-cycle with zero `git` CLI) reads naturally: `zeta commit "msg"`, `zeta log`, …
module CliParse =

    let usage =
        "usage: zeta <commit <msg> | log [n] | branch <name> | checkout <ref> | status | "
        + "push [remote] [branch] | fetch [remote] | "
        + "db append <zset-json> [captured-json] | db history [fromSeq] | db get <seq> | db status>"

    let private parseCaptured (capturedJson: string) : Result<Map<string, string>, string> =
        if String.IsNullOrEmpty capturedJson then
            Ok Map.empty
        else
            match DynamicValue.fromCanonicalJson capturedJson with
            | Ok (DynamicValue.Object kvs) ->
                let mutable err = None
                let map =
                    kvs |> List.choose (fun (k, v) ->
                        match v with
                        | DynamicValue.String s -> Some (k, s)
                        | _ ->
                            err <- Some (sprintf "captured field '%s' must be a string" k)
                            None)
                    |> Map.ofList
                match err with
                | Some msg -> Error msg
                | None -> Ok map
            | Ok _ -> Error "captured-json must be a JSON object"
            | Error e -> Error (sprintf "failed to parse captured JSON: %A" e)

    let parse (argv: string[]) : Result<ZetaCliCommand, string> =
        match List.ofArray argv with
        | [ "commit"; msg ] -> Ok(ZetaCliCommand.Git(GitCommand.Commit msg))
        | [ "log" ] -> Ok(ZetaCliCommand.Git(GitCommand.Log 20))
        | [ "log"; n ] ->
            match System.Int32.TryParse n with
            | true, v when v > 0 -> Ok(ZetaCliCommand.Git(GitCommand.Log v))
            | _ -> Error(sprintf "log: expected a positive count, got '%s'" n)
        | [ "branch"; name ] -> Ok(ZetaCliCommand.Git(GitCommand.Branch name))
        | [ "checkout"; refName ] -> Ok(ZetaCliCommand.Git(GitCommand.Checkout refName))
        | [ "status" ] -> Ok(ZetaCliCommand.Git GitCommand.Status)
        // push: remote defaults to origin, branch to current HEAD (None).
        | [ "push" ] -> Ok(ZetaCliCommand.Git(GitCommand.Push("origin", None)))
        | [ "push"; remote ] -> Ok(ZetaCliCommand.Git(GitCommand.Push(remote, None)))
        | [ "push"; remote; branch ] -> Ok(ZetaCliCommand.Git(GitCommand.Push(remote, Some branch)))
        // fetch: remote defaults to origin.
        | [ "fetch" ] -> Ok(ZetaCliCommand.Git(GitCommand.Fetch "origin"))
        | [ "fetch"; remote ] -> Ok(ZetaCliCommand.Git(GitCommand.Fetch remote))

        // db commands
        | [ "db"; "status" ] -> Ok(ZetaCliCommand.Db Zeta.Core.DbCommand.Status)
        | [ "db"; "history" ] -> Ok(ZetaCliCommand.Db(Zeta.Core.DbCommand.History -1L))
        | [ "db"; "history"; fromSeqStr ] ->
            match System.Int64.TryParse fromSeqStr with
            | true, v -> Ok(ZetaCliCommand.Db(Zeta.Core.DbCommand.History v))
            | false, _ -> Error(sprintf "db history: expected an integer sequence, got '%s'" fromSeqStr)
        | [ "db"; "get"; seqStr ] ->
            match System.Int64.TryParse seqStr with
            | true, v -> Ok(ZetaCliCommand.Db(Zeta.Core.DbCommand.Get v))
            | false, _ -> Error(sprintf "db get: expected an integer sequence, got '%s'" seqStr)
        | "db" :: "append" :: zsetJson :: rest ->
            let capturedJson =
                match rest with
                | [ cap ] -> cap
                | [] -> ""
                | _ -> null
            if isNull capturedJson then
                Error "db append: too many arguments. usage: db append <zset-json> [captured-json]"
            else
                match DynamicValue.fromCanonicalJson zsetJson with
                | Ok dv ->
                    try
                        let zset = ZSetDynamic.ofDynamicValue DvKey.ofValue dv
                        match parseCaptured capturedJson with
                        | Ok captured ->
                            Ok(ZetaCliCommand.Db(Zeta.Core.DbCommand.Append(zset, captured)))
                        | Error msg ->
                            Error (sprintf "db append: invalid captured JSON: %s" msg)
                    with ex ->
                        Error (sprintf "db append: invalid zset dynamic value representation: %s" ex.Message)
                | Error e ->
                    Error (sprintf "db append: failed to parse zset JSON: %A" e)
        | [] -> Error usage
        | other -> Error(sprintf "unknown command: '%s'\n%s" (String.concat " " other) usage)

