namespace Zeta.Core.FSharp.Git

open System
open LibGit2Sharp
open LibGit2Sharp.Handlers
open Zeta.Core

/// **Git-ref command verbs** — the source-repo / working-branch operations that retire Otto's `git` CLI
/// usage (roadmap #1, no-git-CLI). Distinct from `DbCommand` (Zeta.Core, the data-plane Log verbs over
/// `IDeltaLog`): these operate on an actual working git repository via LibGit2Sharp — the "DB layer that
/// understands git, running git-native." Verbs-as-data (a DU), interpreted by `run` over a `Repository`;
/// the CLI + MCP thin-wrap it. Local verbs (branch / checkout / commit / log / status) ignore credentials
/// and stay deterministic; network verbs (push / fetch) take a `CredentialSource` (host-agnostic — GitHub
/// is a plugin, not git-native). Punch-list: workitem 081KTGPC2XP.
///
/// Not a 1:1 git mirror (Aaron 2026-06-07): a curated, retractable-by-nature surface with compensating
/// actions where an op is not truly retractable — see `Push` (you cannot un-send a push; its compensation
/// is a forward revert-commit or a ref-restore, the latter irreversible and never auto-executed).
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
    /// Push a branch (default: current HEAD) to a remote (default: origin). `git push <remote> <branch>`.
    /// NETWORK + credentialed. NOT retractable at the wire — compensation is a forward revert-commit
    /// (safe) or a remote-ref restore (force-push, irreversible → never auto-executed; a human decides).
    | Push of remote: string * branch: string option
    /// Fetch from a remote (default: origin). `git fetch <remote>`. NETWORK + credentialed. Read-only on
    /// the remote, so retractable locally (drop the fetched refs); no compensation needed.
    | Fetch of remote: string

type GitCommandResult =
    | Branched of name: string
    | CheckedOut of name: string
    | Committed of sha: string
    | Logged of entries: (string * string)[]
    | Statused of isClean: bool * pending: string[]
    | Pushed of remote: string * refspec: string
    | Fetched of remote: string

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module GitCommand =

    /// Resolve a credential handler for a network verb, or fail with a clean message (no credential
    /// source wired, or the source can't supply one). Kept separate so the host stays a plugin: the git
    /// layer only knows "a source yields a handler or an error."
    let private resolveHandler (verb: string) (credSource: CredentialSource option) : CredentialsHandler =
        match credSource with
        | None -> invalidOp (sprintf "%s requires a credential source (none wired)" verb)
        | Some source ->
            match source.TryHandler() with
            | Ok handler -> handler
            | Error e -> invalidOp (sprintf "%s: %s" verb e)

    let private remoteOrFail (repo: Repository) (name: string) : Remote =
        match repo.Network.Remotes.[name] with
        | null -> invalidOp (sprintf "no remote '%s'" name)
        | r -> r

    /// Interpret a git-ref command over a working `Repository`. `now` supplies the deterministic clock for
    /// commit signatures (DST-friendly — same seed, same commit metadata). `credSource` is consumed only
    /// by the network verbs (push / fetch); local verbs ignore it and stay deterministic. Network/cred
    /// failures raise `InvalidOperationException` with a clean message (the CLI/MCP shell prints it).
    let run
        (repo: Repository)
        (now: unit -> DateTimeOffset)
        (credSource: CredentialSource option)
        (cmd: GitCommand)
        : GitCommandResult =
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
        | Push(remote, branch) ->
            let handler = resolveHandler "push" credSource
            let r = remoteOrFail repo remote
            let br = branch |> Option.defaultValue repo.Head.FriendlyName
            let refspec = sprintf "refs/heads/%s:refs/heads/%s" br br
            repo.Network.Push(r, refspec, PushOptions(CredentialsProvider = handler))
            Pushed(remote, refspec)
        | Fetch remote ->
            let handler = resolveHandler "fetch" credSource
            let r = remoteOrFail repo remote
            let refspecs = r.FetchRefSpecs |> Seq.map (fun s -> s.Specification)
            Commands.Fetch(repo, remote, refspecs, FetchOptions(CredentialsProvider = handler), null)
            Fetched remote
