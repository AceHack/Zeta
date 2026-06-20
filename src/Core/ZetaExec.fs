namespace Zeta.Core

/// **The executor — wires the `ZetaCli` grammar to the noun-classes (Aaron #7045, shadow*).**
///
/// Closes the loop the whole grammar assumed: a parsed `ZetaCommand` (`[seam] verb noun k=v… [dependson …]`)
/// is *routed by seam* to the matching noun-class, turned into that class's event, and folded into a unified
/// `Workspace`. Order comes from `dependson` (`ZetaGraph.topoOrder`, #6984) — deps before dependents — so a
/// list of commands assembles deterministically (DST §7), idempotently (#6).
///
/// **The value/payload lives in the `value=` field (#7045)** — the long-term-flexible slot (Aaron's steer):
/// `zeta table upsert users.42 value=alice`, `zeta file write /a value=blake3:abc`. Qualifiers (`version=`,
/// `ns=`, `scope=`, `os=`, `pm=`, #7043) ride the same field map, matched with-or-without. Verbs that need no
/// payload (mkfolder/remove/move/copy/delete/retract) take none; `move`/`copy` take `to=`.
///
/// Routed seams: `table`/`stream` (#7029), `db` (#6996), `file` (#7002). Each is a thin map command→event;
/// the noun-class folds do the work. F# reference oracle; C#/Rust/TS ports follow.
module ZetaExec =

    open ZetaCli

    /// The unified state a command stream folds into — one materialized view per routed noun-class.
    type Workspace =
        { Table: TableStream.Table
          Db: Db.DbState
          Files: Files.FileState }

    let empty =
        { Table = TableStream.emptyTable
          Db = Db.empty Db.defaultBackend
          Files = Files.empty Files.defaultBackend }

    let private field k (cmd: ZetaCommand) = Map.tryFind k cmd.Fields
    let private valueOf cmd = field "value" cmd

    /// Apply one resolved command to the workspace, routing by seam. Unknown seam/verb is a no-op-with-reason
    /// `Error` so a bad line is surfaced, never silently dropped (BP: no silent failure).
    let applyCommand (ws: Workspace) (cmd: ZetaCommand) : Result<Workspace, string> =
        let needValue f =
            match valueOf cmd with
            | Some v -> Ok(f v)
            | None -> Error(sprintf "%s %s requires value=<…>" cmd.Verb cmd.Noun)

        let needTo f =
            match field "to" cmd with
            | Some d -> Ok(f d)
            | None -> Error(sprintf "%s %s requires to=<dest>" cmd.Verb cmd.Noun)

        match cmd.Seam with
        | Some s when s = TableStream.TableSeamName || s = TableStream.StreamSeamName ->
            match cmd.Verb with
            | "upsert"
            | "write"
            | "set" ->
                needValue (fun v ->
                    { ws with
                        Table = TableStream.applyDelta ws.Table (TableStream.Upsert(cmd.Noun, DynamicValue.String v)) })
            | "retract"
            | "delete"
            | "remove" -> Ok { ws with Table = TableStream.applyDelta ws.Table (TableStream.Retract cmd.Noun) }
            | v -> Error(sprintf "table: unknown verb '%s'" v)

        | Some s when s = Db.SeamName ->
            // the grammar's `value=` is a string field; wrap as a homoiconic DynamicValue.String (#7041)
            match Db.toEvent (valueOf cmd |> Option.map DynamicValue.String) cmd with
            | Some ev -> Ok { ws with Db = Db.apply ws.Db ev }
            | None -> Error(sprintf "db: verb '%s' is not a mutation (or missing value=)" cmd.Verb)

        | Some s when s = Files.SeamName ->
            match cmd.Verb with
            | "write" -> needValue (fun h -> { ws with Files = Files.apply ws.Files (Files.Write(cmd.Noun, Zeta.Core.FSharp.Blake3.ContentHash256.ofHex h)) })
            | "mkfolder"
            | "mkdir" -> Ok { ws with Files = Files.apply ws.Files (Files.MkFolder cmd.Noun) }
            | "remove"
            | "rm" -> Ok { ws with Files = Files.apply ws.Files (Files.Remove cmd.Noun) }
            | "move"
            | "mv" -> needTo (fun d -> { ws with Files = Files.apply ws.Files (Files.Move(cmd.Noun, d)) })
            | "copy"
            | "cp" -> needTo (fun d -> { ws with Files = Files.apply ws.Files (Files.Copy(cmd.Noun, d)) })
            | v -> Error(sprintf "file: unknown verb '%s'" v)

        | Some s -> Error(sprintf "no executor wired for seam '%s'" s)
        | None -> Error(sprintf "command '%s %s' has no seam (resolve it first)" cmd.Verb cmd.Noun)

    /// Fold a list of commands into a workspace **in input order** — the imperative command stream (a stream is
    /// ordered, #6997; declarative lowers to this imperative sequence, #6998). The same noun may recur (e.g.
    /// `write /a` then `move /a`); order is the truth. `Error` on the first command that fails to apply.
    let run (cmds: ZetaCommand list) : Result<Workspace, string> =
        (Ok empty, cmds)
        ||> List.fold (fun acc cmd ->
            match acc with
            | Error e -> Error e
            | Ok ws -> applyCommand ws cmd)

    /// **`converge`** (#7047) — the DECLARATIVE counterpart to `run`: order the commands by `dependson`
    /// (topo-sort, #6984) FIRST, then `run` them, driving the workspace to the desired state the command set
    /// describes. Idempotent reconcile (Aaron's intuition: "like a thread join if it's already running" — if
    /// the desired state already holds, converging is a no-op, the way joining an already-finished thread
    /// returns immediately). For unordered command sets whose order comes from `dependson` (the within-stream
    /// push-down graph, #7005), NOT for imperative sequences (topo-order keys by noun, so a repeated noun is a
    /// declarative error). `Error` on a dependency cycle (the cycle nouns) or the first failing command.
    let converge (cmds: ZetaCommand list) : Result<Workspace, string> =
        match ZetaGraph.topoOrder cmds with
        | Error cycle -> Error(sprintf "dependency cycle: %s" (String.concat ", " cycle))
        | Ok ordered -> run ordered
