namespace Zeta.Core

/// **The Zeta CLI command grammar — `[seam] verb noun [dependson …]`, context-aware, as DATA.**
///
/// A command is a *value* (`ZetaCommand`), homoiconic with the CLI line and the `.ace` file (#6962): parse a
/// line → `ZetaCommand`, `render` it back → canonical line, round-trip stable. The reference-oracle parse layer
/// the `zs` (interpreter) and `zc` (durable CLI) front-ends thin-wrap over the data-plane verbs (`Command.fs`
/// `DbCommand`). F# is the reference; C#/Rust/TS ports follow (Vera/Lior).
///
/// Grammar (#6957/#6971/#6975/#7045):
///   `zeta <seam> <verb> <noun>`            — explicit seam (the integration plane)
///   `zeta <verb> <noun>`                   — implicit seam (filled from Context)
///   `ace <verb> <noun>`                    — the `ace` seam (#6959)
///   `zs` / `zc`                            — shorthands for `zeta run shell` / `zeta run cell`
///   `… <key>=<value> …`                    — named FIELDS (#7045): the value/payload + qualifiers
///   `… dependson <noun> <noun> …`          — trailing dependency clause (the graph edges, #6971)
/// seam = integration plane (None = implicit, filled by Context); verb = action; noun = ZetaId / unique-in-
/// scope name (e.g. `npm[www.privaterepo.com].bar`, `compiler.rust`, `cell`); dependson = the deps this node
/// requires (edges). A statement is a NODE; `dependson` are its EDGES (#6971) — the infinite assembly's graph.
///
/// **Named fields (`k=v`, #7045)** are the long-term-flexible value/qualifier slot (Aaron's steer: "match with
/// and without versions/namespace/scope"): `value=` carries the payload (the thing the verb writes), and
/// `version=` / `ns=` / `scope=` / `os=` / `pm=` carry the dep qualifiers (#7043) — each present-or-absent,
/// matched partially. Any token containing `=` is a field; positional tokens (no `=`) stay seam/verb/noun.
/// Backward-compatible: a line with no `=` tokens parses exactly as before (empty `Fields`).
module ZetaCli =

    /// A parsed command: a node (`[seam] verb noun`) plus named `Fields` (#7045) and its outgoing dependency
    /// edges (`DependsOn`, #6971). `Seam = None` means implicit (resolved from `Context`).
    type ZetaCommand =
        { Seam: string option
          Verb: string
          Noun: string
          Fields: Map<string, string>
          DependsOn: string list }

    /// The resolution context that fills the "short, context-aware" omissions (#6971): the implicit seam and
    /// the namespace bare nouns resolve in. `empty` supplies nothing (everything must be explicit).
    type Context =
        { Seam: string option
          Namespace: string option }

        static member Empty = { Seam = None; Namespace = None }

    [<Literal>]
    let private DependsOnKw = "dependson"

    /// A noun is "bare" (unqualified) when it carries no namespace/source/path marker — eligible for
    /// `Context.Namespace` qualification.
    let private isBare (noun: string) : bool =
        not (noun.Contains "." || noun.Contains "[" || noun.Contains "/" || noun.Contains ":")

    /// A token is a named field iff it contains `=` (e.g. `value=blake3:abc`, `version=2`). Nouns/verbs/seams
    /// never contain `=`. Split on the FIRST `=` so values may themselves contain `=`.
    let private parseField (tok: string) : Result<string * string, string> =
        match tok.IndexOf '=' with
        | i when i > 0 -> Ok(tok.Substring(0, i), tok.Substring(i + 1))
        | _ -> Error(sprintf "malformed field '%s' (expected key=value with a non-empty key)" tok)

    /// Parse already-split argv (named `k=v` fields and a trailing `dependson` clause may appear) into a
    /// `ZetaCommand`.
    let parseArgs (argv: string list) : Result<ZetaCommand, string> =
        // Split off a trailing `dependson <noun…>` clause, if present.
        let beforeDeps, deps =
            match List.tryFindIndex (fun t -> t = DependsOnKw) argv with
            | Some i -> List.truncate i argv, List.skip (i + 1) argv
            | None -> argv, []

        // Partition the remaining tokens into positional (seam/verb/noun) and named fields (contain `=`).
        let positional, fieldToks = beforeDeps |> List.partition (fun t -> not (t.Contains "="))

        // Parse the field tokens into a map (first error wins).
        let fieldsResult =
            (Ok Map.empty, fieldToks)
            ||> List.fold (fun acc tok ->
                match acc, parseField tok with
                | Error e, _ -> Error e
                | Ok m, Ok(k, v) -> Ok(Map.add k v m)
                | Ok _, Error e -> Error e)

        match fieldsResult with
        | Error e -> Error e
        | Ok fields ->
            let mk seam verb noun =
                { Seam = seam; Verb = verb; Noun = noun; Fields = fields; DependsOn = deps }

            match positional with
            | [] -> Error "empty command"
            | "zs" :: _ -> Ok(mk None "run" "shell")
            | "zc" :: _ -> Ok(mk None "run" "cell")
            | "ace" :: [ verb; noun ] -> Ok(mk (Some "ace") verb noun)
            | "ace" :: _ -> Error "ace requires: ace <verb> <noun> [fields…] [dependson …]"
            | "zeta" :: [ verb; noun ] -> Ok(mk None verb noun)
            | "zeta" :: [ seam; verb; noun ] -> Ok(mk (Some seam) verb noun)
            | "zeta" :: _ -> Error "zeta requires: zeta [<seam>] <verb> <noun> [fields…] [dependson …]"
            | other :: _ -> Error(sprintf "unknown program '%s' (expected zeta|ace|zs|zc)" other)

    /// Parse a whitespace-delimited command line.
    let parse (line: string) : Result<ZetaCommand, string> =
        line.Split([| ' '; '\t' |], System.StringSplitOptions.RemoveEmptyEntries)
        |> List.ofArray
        |> parseArgs

    /// Resolve a command in a `Context` (#6971 "context-aware"): fill the implicit seam from the context, and
    /// qualify bare nouns (the noun + each `dependson`) with the context namespace. Idempotent: resolving an
    /// already-resolved command in the same context is a no-op (already explicit ⇒ unchanged).
    let resolve (ctx: Context) (cmd: ZetaCommand) : ZetaCommand =
        let seam = match cmd.Seam with Some _ -> cmd.Seam | None -> ctx.Seam

        let qualify (noun: string) =
            match ctx.Namespace with
            | Some ns when isBare noun -> sprintf "%s.%s" ns noun
            | _ -> noun

        { cmd with
            Seam = seam
            Noun = qualify cmd.Noun
            DependsOn = cmd.DependsOn |> List.map qualify }

    /// Render a command back to its canonical `zeta [<seam>] <verb> <noun> [<k>=<v>…] [dependson …]` form
    /// (homoiconic round-trip: `parse (render c) = Ok c`). Fields are emitted ordinal-sorted by key for
    /// deterministic, diffable output.
    let render (cmd: ZetaCommand) : string =
        let head =
            match cmd.Seam with
            | None -> sprintf "zeta %s %s" cmd.Verb cmd.Noun
            | Some s -> sprintf "zeta %s %s %s" s cmd.Verb cmd.Noun

        let withFields =
            if Map.isEmpty cmd.Fields then
                head
            else
                let fs =
                    cmd.Fields
                    |> Map.toList
                    |> List.sortWith (fun (a, _) (b, _) -> System.String.CompareOrdinal(a, b))
                    |> List.map (fun (k, v) -> sprintf "%s=%s" k v)
                    |> String.concat " "

                sprintf "%s %s" head fs

        match cmd.DependsOn with
        | [] -> withFields
        | deps -> sprintf "%s %s %s" withFields DependsOnKw (String.concat " " deps)
