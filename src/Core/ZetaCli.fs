namespace Zeta.Core

/// **The Zeta CLI command grammar — `zeta <seam> <verb> <noun>` (#6957), as DATA.**
///
/// A command is a *value* (`ZetaCommand`), homoiconic with the CLI line and the `.ace` file (#6962): parse a
/// line → `ZetaCommand`, `render` it back → canonical line, and the round-trip is stable. This is the
/// reference-oracle parse layer the `zs` (interpreter) and `zc` (durable CLI) front-ends thin-wrap over the
/// data-plane verbs (`Command.fs` `DbCommand`). F# is the reference; C#/Rust/TS ports follow (Vera/Lior).
///
/// Grammar:
///   `zeta <seam> <verb> <noun>`        — explicit seam (the integration plane)
///   `zeta <verb> <noun>`               — implicit seam (the local cell)
///   `ace <verb> <noun>`                — the `ace` seam (package-manager front-end, #6959)
///   `zs`                               — shorthand for `zeta run shell`
///   `zc`                               — shorthand for `zeta run cell`
/// seam = integration plane (None = implicit/local); verb = action; noun = ZetaId / unique-in-scope name
/// (e.g. `npm[www.privaterepo.com].bar`, `compiler.rust`, `cell`).
module ZetaCli =

    /// A parsed command. `Seam = None` means the implicit (local cell) plane.
    type ZetaCommand =
        { Seam: string option
          Verb: string
          Noun: string }

    /// Parse already-split argv into a `ZetaCommand`. Shorthands (`zs`/`zc`) and the `ace`/`zeta` programs
    /// all canonicalize to the same `seam/verb/noun` shape.
    let parseArgs (argv: string list) : Result<ZetaCommand, string> =
        match argv with
        | [] -> Error "empty command"
        | "zs" :: _ -> Ok { Seam = None; Verb = "run"; Noun = "shell" }
        | "zc" :: _ -> Ok { Seam = None; Verb = "run"; Noun = "cell" }
        | "ace" :: verb :: noun :: _ -> Ok { Seam = Some "ace"; Verb = verb; Noun = noun }
        | "ace" :: _ -> Error "ace requires: ace <verb> <noun>"
        | "zeta" :: [ verb; noun ] -> Ok { Seam = None; Verb = verb; Noun = noun }
        | "zeta" :: [ seam; verb; noun ] -> Ok { Seam = Some seam; Verb = verb; Noun = noun }
        | "zeta" :: _ -> Error "zeta requires: zeta [<seam>] <verb> <noun>"
        | other :: _ -> Error (sprintf "unknown program '%s' (expected zeta|ace|zs|zc)" other)

    /// Parse a whitespace-delimited command line.
    let parse (line: string) : Result<ZetaCommand, string> =
        line.Split([| ' '; '\t' |], System.StringSplitOptions.RemoveEmptyEntries)
        |> List.ofArray
        |> parseArgs

    /// Render a command back to its canonical `zeta [<seam>] <verb> <noun>` form (homoiconic round-trip:
    /// `parse (render c) = Ok c`).
    let render (cmd: ZetaCommand) : string =
        match cmd.Seam with
        | None -> sprintf "zeta %s %s" cmd.Verb cmd.Noun
        | Some s -> sprintf "zeta %s %s %s" s cmd.Verb cmd.Noun
