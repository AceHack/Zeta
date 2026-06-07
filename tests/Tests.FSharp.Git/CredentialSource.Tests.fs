module Zeta.Tests.Git.CredentialSourceTests

open System
open global.Xunit
open Zeta.Core.FSharp.Git

// Pluggable, host-agnostic credential source (roadmap #1 push/sync). GitHub/gh/GitLab are HOST PLUGINS,
// not git-native (Aaron 2026-06-07) — the git layer only knows "a source yields a handler or an error".
// We test source-SELECTION (env present -> Ok handler; absent -> Error), never a live push (side-effecting).

let private withEnv (pairs: (string * string option) list) (f: unit -> unit) =
    let saved = pairs |> List.map (fun (k, _) -> k, Environment.GetEnvironmentVariable k)
    try
        for k, v in pairs do
            Environment.SetEnvironmentVariable(k, Option.toObj v)
        f ()
    finally
        for k, v in saved do
            Environment.SetEnvironmentVariable(k, v)

[<Fact>]
let ``EnvToken resolves GH_TOKEN, prefers it over GITHUB_TOKEN, and yields a handler`` () =
    withEnv [ "GH_TOKEN", Some "tok-gh"; "GITHUB_TOKEN", Some "tok-github" ] (fun () ->
        let src = EnvTokenCredentialSource()
        Assert.Equal(Some "GH_TOKEN", src.ResolvedVar())
        match (src :> CredentialSource).TryHandler() with
        | Ok h -> Assert.NotNull(box h)
        | Error e -> Assert.Fail(sprintf "expected handler, got %s" e))

[<Fact>]
let ``EnvToken falls through to GITHUB_TOKEN when GH_TOKEN is unset`` () =
    withEnv [ "GH_TOKEN", None; "GITHUB_TOKEN", Some "tok-github" ] (fun () ->
        Assert.Equal(Some "GITHUB_TOKEN", EnvTokenCredentialSource().ResolvedVar()))

[<Fact>]
let ``EnvToken errors (no throw) when no env var is set, so a caller can fall through`` () =
    withEnv [ "GH_TOKEN", None; "GITHUB_TOKEN", None ] (fun () ->
        let src = EnvTokenCredentialSource()
        Assert.Equal(None, src.ResolvedVar())
        match (src :> CredentialSource).TryHandler() with
        | Error _ -> ()
        | Ok _ -> Assert.Fail "expected Error when no credential env var is set")
