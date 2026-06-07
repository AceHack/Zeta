namespace Zeta.Core.FSharp.Git

open System
open LibGit2Sharp
open LibGit2Sharp.Handlers

/// Credential source for remote git operations (push/fetch) — PLUGGABLE + host-AGNOSTIC.
///
/// Architectural rule (Aaron 2026-06-07): **GitHub is NOT git-native — it's a plugin.** Host-specific
/// things (GitHub, GitLab, the `gh` CLI) do not belong in the git-native core. So the credential
/// mechanism is an abstraction the git-native push/fetch consume; concrete sources are *plugins*:
/// `EnvToken` (HTTPS PAT from env), `GhCli` (`gh auth token`), `GitHelper` (`git credential fill`), `Ssh`
/// (ssh-agent/key). Multiple sources can be tried in order. A source yields a LibGit2Sharp
/// `CredentialsHandler`; the git layer never names a host. v1 ships `EnvToken` (Aaron is HTTPS-logged-in);
/// the rest land as needed — same pluggable contract.
type CredentialSource =
    /// Produce a credentials handler, or an error explaining why this source can't supply one
    /// (so a caller can fall through to the next source in priority order).
    abstract TryHandler: unit -> Result<CredentialsHandler, string>

/// HTTPS token from an environment variable (default order: `GH_TOKEN`, then `GITHUB_TOKEN`).
/// Host-AGNOSTIC at the git layer: a token used as the password with username `x-access-token` works for
/// any HTTPS git host that accepts a PAT-as-password (GitHub, GitLab, …). The token's *provenance*
/// (a `gh` login, a GitLab PAT) is the host plugin's concern, never git's.
[<Sealed>]
type EnvTokenCredentialSource(?envVars: string list) =
    let vars = defaultArg envVars [ "GH_TOKEN"; "GITHUB_TOKEN" ]

    /// The env var that supplied the token (or None), without building a handler — for diagnostics/tests.
    member _.ResolvedVar() : string option =
        vars
        |> List.tryPick (fun v ->
            match Environment.GetEnvironmentVariable v with
            | null
            | "" -> None
            | _ -> Some v)

    interface CredentialSource with
        member this.TryHandler() =
            match this.ResolvedVar() with
            | Some v ->
                let token = Environment.GetEnvironmentVariable v
                Ok(
                    CredentialsHandler(fun _ _ _ ->
                        UsernamePasswordCredentials(Username = "x-access-token", Password = token) :> Credentials)
                )
            | None -> Error(sprintf "no credential: set one of %s" (String.concat ", " vars))
