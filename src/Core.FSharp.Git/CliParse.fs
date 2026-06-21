namespace Zeta.Core.FSharp.Git

open System
open Zeta.Core

type ZetaCliCommand = Zeta.Core.DbCommand<Zeta.Core.DvKey>

module CliParse =

    let usage =
        "usage: zeta <commit <zset-json> [captured-json] | write <zset-json> [captured-json] | delete <zset-json> [captured-json] | "
        + "branch <name> | checkout <ref> | status | ls [refName] | push [remote] | fetch [remote] | merge <sourceRef> | "
        + "log | history [fromSeq] | get <seq>>"

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

    let private isAllNegative (z: ZSet<DvKey>) =
        let span = z.AsSpan()
        if span.IsEmpty then false
        else
            let mutable allNeg = true
            for i in 0 .. span.Length - 1 do
                if span.[i].Weight > 0L then allNeg <- false
            allNeg

    let parse (argv: string[]) : Result<ZetaCliCommand, string> =
        match List.ofArray argv with
        | [ "branch"; name ] -> Ok(DbCommand.Branch name)
        | [ "checkout"; refName ] -> Ok(DbCommand.Join(refName, false))
        | [ "status" ] -> Ok(DbCommand.Status)
        | [ "ls" ] -> Ok(DbCommand.Ls None)
        | [ "ls"; refName ] -> Ok(DbCommand.Ls(Some refName))
        | [ "push" ] -> Ok(DbCommand.Join("origin", true))
        | [ "push"; remote ] -> Ok(DbCommand.Join(remote, true))
        | [ "push"; remote; _branch ] -> Ok(DbCommand.Join(remote, true))
        | [ "fetch" ] -> Ok(DbCommand.Join("origin", true))
        | [ "fetch"; remote ] -> Ok(DbCommand.Join(remote, true))
        | [ "merge"; sourceRef ] -> Ok(DbCommand.Merge sourceRef)

        | [ "log" ] -> Ok(DbCommand.Fold -1L)
        | [ "log"; fromSeqStr ] ->
            match System.Int64.TryParse fromSeqStr with
            | true, v -> Ok(DbCommand.Fold v)
            | false, _ -> Error(sprintf "log: expected an integer sequence, got '%s'" fromSeqStr)
        | [ "history" ] -> Ok(DbCommand.Fold -1L)
        | [ "history"; fromSeqStr ] ->
            match System.Int64.TryParse fromSeqStr with
            | true, v -> Ok(DbCommand.Fold v)
            | false, _ -> Error(sprintf "history: expected an integer sequence, got '%s'" fromSeqStr)
        | [ "get"; seqStr ] ->
            match System.Int64.TryParse seqStr with
            | true, v -> Ok(DbCommand.Fold(v - 1L))
            | false, _ -> Error(sprintf "get: expected an integer sequence, got '%s'" seqStr)

        // db commands prefix support
        | [ "db"; "status" ] -> Ok(DbCommand.Status)
        | [ "db"; "history" ] -> Ok(DbCommand.Fold -1L)
        | [ "db"; "history"; fromSeqStr ] ->
            match System.Int64.TryParse fromSeqStr with
            | true, v -> Ok(DbCommand.Fold v)
            | false, _ -> Error(sprintf "db history: expected an integer sequence, got '%s'" fromSeqStr)
        | [ "db"; "get"; seqStr ] ->
            match System.Int64.TryParse seqStr with
            | true, v -> Ok(DbCommand.Fold(v - 1L))
            | false, _ -> Error(sprintf "db get: expected an integer sequence, got '%s'" seqStr)

        | cmd :: zsetJson :: rest when cmd = "commit" || cmd = "write" || cmd = "delete" || cmd = "append" || (cmd = "db" && rest <> [] && List.head rest = "append") ->
            let realRest = if cmd = "db" then List.tail rest else rest
            let realZsetJson = if cmd = "db" then List.head rest else zsetJson
            let capturedJson =
                match realRest with
                | [ cap ] -> cap
                | [] -> ""
                | _ -> null
            if isNull capturedJson then
                Error(sprintf "%s: too many arguments. usage: %s <zset-json> [captured-json]" cmd cmd)
            else
                match DynamicValue.fromCanonicalJson realZsetJson with
                | Ok dv ->
                    try
                        let zset = ZSetDynamic.ofDynamicValue DvKey.ofValue dv
                        match parseCaptured capturedJson with
                        | Ok captured ->
                            if cmd = "delete" then
                                Ok(DbCommand.Retract(zset, captured))
                            else
                                if isAllNegative zset then
                                    Ok(DbCommand.Retract(ZSet.scale -1L zset, captured))
                                else
                                    Ok(DbCommand.Emit(zset, captured))
                        | Error msg ->
                            Error (sprintf "%s: invalid captured JSON: %s" cmd msg)
                    with ex ->
                        Error (sprintf "%s: invalid zset dynamic value representation: %s" cmd ex.Message)
                | Error e ->
                    Error (sprintf "%s: failed to parse zset JSON: %A" cmd e)

        | [] -> Error usage
        | other -> Error(sprintf "unknown command: '%s'\n%s" (String.concat " " other) usage)
