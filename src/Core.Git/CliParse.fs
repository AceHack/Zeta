namespace Zeta.Core.Git

/// CLI argument parser for the git-ref command verbs (roadmap #1, no-git-CLI; core-library-first). PURE:
/// `argv -> GitCommand` (or a usage error). Kept a library function so it's CI-tested; the runnable
/// `zeta` exe stays a trivial shell (open repo → `parse argv` → `GitCommand.run` → print). The MCP
/// wrapper maps tool-calls → GitCommand the same way. Mirrors a developer's git muscle-memory so the
/// done-test (a full work-cycle with zero `git` CLI) reads naturally: `zeta commit "msg"`, `zeta log`, …
module CliParse =

    let usage =
        "usage: zeta <commit <msg> | log [n] | branch <name> | checkout <ref> | status>"

    let parse (argv: string[]) : Result<GitCommand, string> =
        match List.ofArray argv with
        | [ "commit"; msg ] -> Ok(GitCommand.Commit msg)
        | [ "log" ] -> Ok(GitCommand.Log 20)
        | [ "log"; n ] ->
            match System.Int32.TryParse n with
            | true, v when v > 0 -> Ok(GitCommand.Log v)
            | _ -> Error(sprintf "log: expected a positive count, got '%s'" n)
        | [ "branch"; name ] -> Ok(GitCommand.Branch name)
        | [ "checkout"; refName ] -> Ok(GitCommand.Checkout refName)
        | [ "status" ] -> Ok GitCommand.Status
        | [] -> Error usage
        | other -> Error(sprintf "unknown command: '%s'\n%s" (String.concat " " other) usage)
