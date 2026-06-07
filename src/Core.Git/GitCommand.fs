namespace Zeta.Core.Git

open System
open LibGit2Sharp
open Zeta.Core

/// **Git-ref command verbs** — the source-repo / working-branch operations that retire Otto's `git` CLI
/// usage (roadmap #1, no-git-CLI). Distinct from `DbCommand` (Zeta.Core, the data-plane Log verbs over
/// `IDeltaLog`): these operate on an actual working git repository via LibGit2Sharp — the "DB layer that
/// understands git, running git-native." Verbs-as-data (a DU), interpreted by `run` over a `Repository`;
/// the CLI + MCP thin-wrap it. LOCAL verbs only here (branch / checkout / commit / log / status);
/// network verbs (push / sync) need credential handling and land in a follow-up slice.
/// Punch-list: workitem 081KTGPC2XP.
type GitCommand =
    /// Create a branch at the current tip (does not switch). `git branch <name>`.
    | Branch of name: string
    /// Switch the working tree to a branch/committish. `git checkout <ref>`.
    | Checkout of refName: string
    /// Stage all changes + commit. `git add -A && git commit -m <message>`.
    | Commit of message: string
    /// Recent commits (newest first), up to `count`. `git log -n <count> --oneline`.
    | Log of count: int
    /// Working-tree status. `git status`.
    | Status

type GitCommandResult =
    | Branched of name: string
    | CheckedOut of name: string
    | Committed of sha: string
    | Logged of entries: (string * string)[]
    | Statused of isClean: bool * pending: string[]

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module GitCommand =

    /// Interpret a git-ref command over a working `Repository`. `now` supplies the deterministic clock
    /// for commit signatures (DST-friendly — same seed, same commit metadata).
    let run (repo: Repository) (now: unit -> DateTimeOffset) (cmd: GitCommand) : GitCommandResult =
        match cmd with
        | Branch name ->
            let b = repo.CreateBranch name
            Branched b.FriendlyName
        | Checkout refName ->
            let b = Commands.Checkout(repo, refName)
            CheckedOut b.FriendlyName
        | Commit message ->
            Commands.Stage(repo, "*")
            let sig_ = GitBackend.signature now
            let c = repo.Commit(message, sig_, sig_)
            Committed(c.Sha)
        | Log count ->
            let entries =
                repo.Commits
                |> Seq.truncate (max 0 count)
                |> Seq.map (fun c -> c.Sha, c.MessageShort)
                |> Seq.toArray
            Logged entries
        | Status ->
            let st = repo.RetrieveStatus(StatusOptions())
            let pending = st |> Seq.map (fun e -> e.FilePath) |> Seq.toArray
            Statused(not st.IsDirty, pending)
