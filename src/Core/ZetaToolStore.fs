namespace Zeta.Core

open System
open System.Text

/// **The real F# backend behind the harness's closed tool surface** (Aaron 2026-07-04: "wire the real
/// F# DagFs/zetadb backend"). Binds the closed tool vocabulary — fs = `DagFs` (content-addressed tree),
/// db = zetadb (an append-only **Z-set** event log) — to the actual `DagFs.Tree` + `ZSet`. This is the
/// F# oracle of the TS `zeta-store.ts`: same semantics (fs round-trip, COW `editLocal` vs shared
/// `editEverywhere`, append/query/retract), on the real substrate.
///
/// The surface IS a total DU (`only-the-irreducible-is-primitive` / `interfaces-free-classes-earned`):
/// every tool is a case, there is no bash — the type is the sandbox. A tool call is recorded as an
/// event first (the call IS an IR node — db is the IR); a wrong call is a **Z-set retraction** (−1), not
/// a patch. Pure + DST-deterministic (DoP=1). Culture-invariant: keys are built by ordinal concat.
[<RequireQualifiedAccess>]
module ZetaToolStore =

    /// The closed tool vocabulary as a total type — fs (DagFs) + db (zetadb), nothing else.
    type ZetaTool =
        | FsResolve of path: string
        | FsLink of path: string * content: string
        | FsEditLocal of path: string * content: string
        | FsEditEverywhere of path: string * content: string
        | FsUnlink of path: string
        | DbAppend of event: string
        | DbQuery of view: string

    /// The store: a content-addressed `DagFs` tree (fs) + an append-only `ZSet` event log (db).
    [<NoEquality; NoComparison>]
    type Store =
        { Fs: DagFs.Tree<string>
          Log: ZSet<string> }

    let private hashOf (s: string) : MerkleHash =
        MerkleHash.ofBytes (ReadOnlySpan<byte>(Encoding.UTF8.GetBytes s))

    /// The empty store.
    let empty: Store = { Fs = DagFs.create hashOf; Log = ZSet.empty }

    let private logEvent (event: string) (s: Store) : Store =
        { s with Log = ZSet.add s.Log (ZSet.singleton event 1L) }

    /// Retract a prior event (Z-set −1) — correction, not deletion.
    let retract (event: string) (s: Store) : Store =
        { s with Log = ZSet.add s.Log (ZSet.singleton event -1L) }

    /// The net-present events (weight > 0) — the "log" view is a fold over the Z-set.
    let netEvents (s: Store) : string list =
        [ for e in s.Log do
              if e.Weight > 0L then
                  yield e.Key ]

    /// A stable, culture-invariant encoding of a call — recorded as the `tool_call` event.
    let private encode (call: ZetaTool) : string =
        match call with
        | FsResolve p -> "fs_resolve|" + p
        | FsLink (p, c) -> "fs_link|" + p + "|" + c
        | FsEditLocal (p, c) -> "fs_editLocal|" + p + "|" + c
        | FsEditEverywhere (p, c) -> "fs_editEverywhere|" + p + "|" + c
        | FsUnlink p -> "fs_unlink|" + p
        | DbAppend e -> "db_append|" + e
        | DbQuery v -> "db_query|" + v

    /// The outcome of executing a tool.
    type ToolResult =
        | Resolved of content: string option
        | Address of addr: MerkleHash option // link/editLocal/editEverywhere → resulting address (None if a no-op)
        | Unlinked of path: string
        | Appended of eventId: string
        | Queried of events: string list
        | Counted of count: int

    /// Execute a tool over the store. The call is recorded as an event FIRST (call = IR node), then
    /// applied. Pure: returns the result + the new store. Never partial — every case is total.
    let execute (call: ZetaTool) (s0: Store) : ToolResult * Store =
        let s = logEvent ("tool_call|" + encode call) s0
        match call with
        | FsResolve path -> Resolved(DagFs.resolve path s.Fs), s
        | FsLink (path, content) ->
            let fs' = DagFs.link path content s.Fs
            Address(DagFs.addressAt path fs'), { s with Fs = fs' }
        | FsEditLocal (path, content) ->
            let fs' = DagFs.editLocal path content s.Fs
            Address(DagFs.addressAt path fs'), { s with Fs = fs' }
        | FsEditEverywhere (path, content) ->
            let fs' = DagFs.editEverywhere path content s.Fs
            Address(DagFs.addressAt path fs'), { s with Fs = fs' }
        | FsUnlink path -> Unlinked path, { s with Fs = DagFs.unlink path s.Fs }
        | DbAppend event -> Appended event, logEvent event s
        | DbQuery view ->
            match view with
            | "log" -> Queried(netEvents s), s
            | "count" -> Counted(List.length (netEvents s)), s
            | _ -> Queried [], s

    /// Parse a (name, arg-lookup) into a `ZetaTool`, ENFORCING the closed surface: an off-surface name
    /// (not `fs_*`/`db_*`) is refused; an `fs_`/`db_` name that isn't a known op is an unknown-tool
    /// error. This mirrors `zeta-tools.domainOf` / `isClosedSurface` on the TS side.
    let parse (name: string) (getArg: string -> string option) : Result<ZetaTool, string> =
        let one k ctor =
            match getArg k with
            | Some v -> Ok(ctor v)
            | None -> Error(name + ": '" + k + "' required")

        let two ctor =
            match getArg "path", getArg "content" with
            | Some p, Some c -> Ok(ctor (p, c))
            | _ -> Error(name + ": 'path' and 'content' required")

        match name with
        | "fs_resolve" -> one "path" FsResolve
        | "fs_unlink" -> one "path" FsUnlink
        | "fs_link" -> two FsLink
        | "fs_editLocal" -> two FsEditLocal
        | "fs_editEverywhere" -> two FsEditEverywhere
        | "db_append" -> one "event" DbAppend
        | "db_query" -> one "view" DbQuery
        | _ when name.StartsWith("fs_", StringComparison.Ordinal) || name.StartsWith("db_", StringComparison.Ordinal) ->
            Error("unknown tool: " + name)
        | _ -> Error("off-surface tool refused: " + name + " (only fs_*/db_* are permitted)")
