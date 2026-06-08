namespace Zeta.Core

/// **The Zeta CLI command grammar — `[seam] verb noun [dependson …]`, context-aware, as DATA.**
///
/// A command is a *value* (`ZetaCommand`), homoiconic with the CLI line and the `.ace` file (#6962): parse a
/// line → `ZetaCommand`, `render` it back → canonical line, round-trip stable. The reference-oracle parse layer
/// the `zs` (interpreter) and `zc` (durable CLI) front-ends thin-wrap over the data-plane verbs (`Command.fs`
/// `DbCommand`). F# is the reference; C#/Rust/TS ports follow (Vera/Lior).
///
/// Grammar (#6957/#6971/#6975):
///   `zeta <seam> <verb> <noun>`            — explicit seam (the integration plane)
///   `zeta <verb> <noun>`                   — implicit seam (filled from Context)
///   `ace <verb> <noun>`                    — the `ace` seam (#6959)
///   `zs` / `zc`                            — shorthands for `zeta run shell` / `zeta run cell`
///   `… dependson <noun> <noun> …`          — trailing dependency clause (the graph edges, #6971)
/// seam = integration plane (None = implicit, filled by Context); verb = action; noun = ZetaId / unique-in-
/// scope name (e.g. `npm[www.privaterepo.com].bar`, `compiler.rust`, `cell`); dependson = the deps this node
/// requires (edges). A statement is a NODE; `dependson` are its EDGES (#6971) — the infinite assembly's graph.
module ZetaCli =

    /// A parsed command: a node (`[seam] verb noun`) plus its outgoing dependency edges (`DependsOn`, #6971).
    /// `Seam = None` means implicit (resolved from `Context`).
    type ZetaCommand =
        { Seam: string option
          Verb: string
          Noun: string
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

    /// Parse already-split argv (a `dependson` clause may trail) into a `ZetaCommand`.
    let parseArgs (argv: string list) : Result<ZetaCommand, string> =
        // Split off a trailing `dependson <noun…>` clause, if present.
        let baseTokens, deps =
            match List.tryFindIndex (fun t -> t = DependsOnKw) argv with
            | Some i -> List.truncate i argv, List.skip (i + 1) argv
            | None -> argv, []

        let withDeps (cmd: ZetaCommand) = { cmd with DependsOn = deps }

        match baseTokens with
        | [] -> Error "empty command"
        | "zs" :: _ -> Ok(withDeps { Seam = None; Verb = "run"; Noun = "shell"; DependsOn = [] })
        | "zc" :: _ -> Ok(withDeps { Seam = None; Verb = "run"; Noun = "cell"; DependsOn = [] })
        | "ace" :: [ verb; noun ] -> Ok(withDeps { Seam = Some "ace"; Verb = verb; Noun = noun; DependsOn = [] })
        | "ace" :: _ -> Error "ace requires: ace <verb> <noun> [dependson …]"
        | "zeta" :: [ verb; noun ] -> Ok(withDeps { Seam = None; Verb = verb; Noun = noun; DependsOn = [] })
        | "zeta" :: [ seam; verb; noun ] ->
            Ok(withDeps { Seam = Some seam; Verb = verb; Noun = noun; DependsOn = [] })
        | "zeta" :: _ -> Error "zeta requires: zeta [<seam>] <verb> <noun> [dependson …]"
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

    /// Render a command back to its canonical `zeta [<seam>] <verb> <noun> [dependson …]` form (homoiconic
    /// round-trip: `parse (render c) = Ok c`).
    let render (cmd: ZetaCommand) : string =
        let head =
            match cmd.Seam with
            | None -> sprintf "zeta %s %s" cmd.Verb cmd.Noun
            | Some s -> sprintf "zeta %s %s %s" s cmd.Verb cmd.Noun

        match cmd.DependsOn with
        | [] -> head
        | deps -> sprintf "%s %s %s" head DependsOnKw (String.concat " " deps)
