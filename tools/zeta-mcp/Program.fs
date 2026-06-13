module Zeta.Mcp.Program

open System
open System.Text.Json.Nodes
open LibGit2Sharp
open Zeta.Core.FSharp.Git
open Zeta.Core

// Minimal MCP stdio server (newline-delimited JSON-RPC 2.0) exposing the git-ref command verbs as tools
// (roadmap #1, no-git-CLI; the step that lets Otto drive the verbs as native tools). Server-only — the
// repo-root .mcp.json registration is a separate follow-up (blast radius). All logic is GitCommand.run;
// this is the protocol shell. Smoke-test: pipe initialize / tools/list / tools/call lines to stdin.

let private now () = DateTimeOffset.UtcNow

let private tool (name: string) (desc: string) (props: (string * string) list) (required: string list) : JsonNode =
    let p = JsonObject()
    for (k, ty) in props do
        let o = JsonObject()
        o["type"] <- JsonValue.Create ty
        p[k] <- (o :> JsonNode)
    let req = JsonArray()
    required |> List.iter (fun r -> req.Add(JsonValue.Create r))
    let schema = JsonObject()
    schema["type"] <- JsonValue.Create "object"
    schema["properties"] <- p
    schema["required"] <- req
    let t = JsonObject()
    t["name"] <- JsonValue.Create name
    t["description"] <- JsonValue.Create desc
    t["inputSchema"] <- schema
    t :> JsonNode

let private toolList () : JsonArray =
    let arr = JsonArray()
    arr.Add(tool "zeta_status" "Working-tree status (replaces git status)" [] [])
    arr.Add(tool "zeta_log" "Recent commits, newest first (replaces git log)" [ "count", "integer" ] [])
    arr.Add(tool "zeta_branch" "Create a branch at the tip (replaces git branch)" [ "name", "string" ] [ "name" ])
    arr.Add(tool "zeta_checkout" "Switch the working tree (replaces git checkout)" [ "ref", "string" ] [ "ref" ])
    arr.Add(tool "zeta_commit" "Stage all + commit (replaces git commit)" [ "message", "string" ] [ "message" ])
    arr.Add(tool "zeta_push" "Push a branch to a remote (replaces git push); creds via GH_TOKEN/GITHUB_TOKEN" [ "remote", "string"; "branch", "string" ] [])
    arr.Add(tool "zeta_fetch" "Fetch from a remote (replaces git fetch); creds via GH_TOKEN/GITHUB_TOKEN" [ "remote", "string" ] [])
    arr.Add(tool "zeta_db_append" "Append a delta and captured map to the delta log" [ "zset", "string"; "captured", "string" ] [ "zset" ])
    arr.Add(tool "zeta_db_history" "Replay delta log entries starting after from_seq" [ "from_seq", "integer" ] [])
    arr.Add(tool "zeta_db_get" "Retrieve a single delta log entry by sequence number" [ "seq", "integer" ] [ "seq" ])
    arr.Add(tool "zeta_db_status" "Get the current high-water sequence number" [] [])
    arr

let private argStr (args: JsonObject) (k: string) : string =
    let v = args[k]
    if isNull v then "" else v.GetValue<string>()

let private runTool (name: string) (args: JsonObject) : string =
    let cmd =
        match name with
        | "zeta_status" -> Some (Choice1Of2 GitCommand.Status)
        | "zeta_log" ->
            let cv = args["count"]
            let n = if isNull cv then 20 else cv.GetValue<int>()
            Some(Choice1Of2(GitCommand.Log n))
        | "zeta_branch" -> Some(Choice1Of2(GitCommand.Branch(argStr args "name")))
        | "zeta_checkout" -> Some(Choice1Of2(GitCommand.Checkout(argStr args "ref")))
        | "zeta_commit" -> Some(Choice1Of2(GitCommand.Commit(argStr args "message")))
        | "zeta_push" ->
            let remote = match argStr args "remote" with "" -> "origin" | r -> r
            let branch = match argStr args "branch" with "" -> None | b -> Some b
            Some(Choice1Of2(GitCommand.Push(remote, branch)))
        | "zeta_fetch" ->
            let remote = match argStr args "remote" with "" -> "origin" | r -> r
            Some(Choice1Of2(GitCommand.Fetch remote))
        | "zeta_db_status" -> Some (Choice2Of2 DbCommand.Status)
        | "zeta_db_history" ->
            let fv = args["from_seq"]
            let fromSeq = if isNull fv then -1L else int64 (fv.GetValue<int>())
            Some (Choice2Of2 (DbCommand.History fromSeq))
        | "zeta_db_get" ->
            let seq = int64 (args["seq"].GetValue<int>())
            Some (Choice2Of2 (DbCommand.Get seq))
        | "zeta_db_append" ->
            let zsetJson = argStr args "zset"
            let capturedJson = argStr args "captured"
            match DynamicValue.fromCanonicalJson zsetJson with
            | Ok dv ->
                try
                    let zset = ZSetDynamic.ofDynamicValue DvKey.ofValue dv
                    let captured =
                        if String.IsNullOrEmpty capturedJson then
                            Map.empty
                        else
                            match DynamicValue.fromCanonicalJson capturedJson with
                            | Ok (DynamicValue.Object kvs) ->
                                kvs |> List.choose (fun (k, v) ->
                                    match v with
                                    | DynamicValue.String s -> Some (k, s)
                                    | _ -> None)
                                |> Map.ofList
                            | _ -> Map.empty
                    Some (Choice2Of2 (DbCommand.Append(zset, captured)))
                with ex ->
                    None
            | Error _ -> None
        | _ -> None
    match cmd with
    | None -> sprintf "unknown tool or invalid arguments: %s" name
    | Some c ->
        match Repository.Discover(Environment.CurrentDirectory) with
        | null -> "not inside a git repository"
        | path ->
            let credSource = Some(EnvTokenCredentialSource() :> CredentialSource)
            use repo = new Repository(path)
            try
                match c with
                | Choice1Of2 gitCmd ->
                    match GitCommand.run repo now credSource gitCmd with
                    | Branched n -> sprintf "branched %s" n
                    | CheckedOut n -> sprintf "checked out %s" n
                    | Committed sha -> sprintf "committed %s" sha
                    | Logged es -> es |> Array.map (fun (s, m) -> sprintf "%s %s" (s.Substring(0, min 9 s.Length)) m) |> String.concat "\n"
                    | Statused(clean, pending) ->
                        if clean then "clean"
                        else sprintf "dirty (%d pending):\n%s" pending.Length (String.concat "\n" pending)
                    | Pushed(remote, refspec) -> sprintf "pushed %s -> %s" refspec remote
                    | Fetched remote -> sprintf "fetched %s" remote
                | Choice2Of2 dbCmd ->
                    let codec = CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)
                    let log = GitDeltaLog<DvKey>(repo, codec)
                    let res = DbCommand.run log Threading.CancellationToken.None dbCmd |> Async.AwaitTask |> Async.RunSynchronously
                    match res with
                    | DbCommandResult.Appended seq -> sprintf "appended seq: %d" seq
                    | DbCommandResult.History entries ->
                        entries |> Array.map (fun entry ->
                            let dv = DeltaLogEntryDynamic.toDynamicValue DvKey.value entry
                            match DynamicValue.toCanonicalJson dv with
                            | Ok json -> json
                            | Error e -> sprintf "error formatting: %A" e
                        ) |> String.concat "\n"
                    | DbCommandResult.Got (Some entry) ->
                        let dv = DeltaLogEntryDynamic.toDynamicValue DvKey.value entry
                        match DynamicValue.toCanonicalJson dv with
                        | Ok json -> json
                        | Error e -> sprintf "error formatting: %A" e
                    | DbCommandResult.Got None -> "not found"
                    | DbCommandResult.Status highWater -> sprintf "highwater: %d" highWater
            with ex -> sprintf "error: %s" ex.Message

[<EntryPoint>]
let main _ =
    let out = Console.Out
    let respond (idNode: JsonNode option) (result: JsonNode) =
        let resp = JsonObject()
        resp["jsonrpc"] <- JsonValue.Create "2.0"
        match idNode with
        | Some i -> resp["id"] <- i.DeepClone()
        | None -> ()
        resp["result"] <- result
        out.WriteLine(resp.ToJsonString())
        out.Flush()
    let mutable line = Console.In.ReadLine()
    while not (isNull line) do
        if line.Trim() <> "" then
            try
                let msg = JsonNode.Parse(line).AsObject()
                let method = msg["method"].GetValue<string>()
                let idNode =
                    let v = msg["id"]
                    if isNull v then None else Some v
                match method with
                | "initialize" ->
                    let caps = JsonObject()
                    caps["tools"] <- JsonObject()
                    let si = JsonObject()
                    si["name"] <- JsonValue.Create "zeta"
                    si["version"] <- JsonValue.Create "0.1.0"
                    let r = JsonObject()
                    r["protocolVersion"] <- JsonValue.Create "2024-11-05"
                    r["capabilities"] <- caps
                    r["serverInfo"] <- si
                    respond idNode r
                | "tools/list" ->
                    let r = JsonObject()
                    r["tools"] <- toolList ()
                    respond idNode r
                | "tools/call" ->
                    let p = msg["params"].AsObject()
                    let toolName = p["name"].GetValue<string>()
                    let argsObj =
                        let v = p["arguments"]
                        if isNull v then JsonObject() else v.AsObject()
                    let item = JsonObject()
                    item["type"] <- JsonValue.Create "text"
                    item["text"] <- JsonValue.Create(runTool toolName argsObj)
                    let content = JsonArray()
                    content.Add item
                    let r = JsonObject()
                    r["content"] <- content
                    respond idNode r
                | _ -> () // notifications (e.g. notifications/initialized) + unknown: no response
            with _ -> () // malformed line: ignore, never crash the server
        line <- Console.In.ReadLine()
    0
