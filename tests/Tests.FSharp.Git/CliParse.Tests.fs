module Zeta.Tests.Git.CliParseTests

open global.Xunit
open Zeta.Core.FSharp.Git

// The CLI arg parser (roadmap #1, no-git-CLI). Pure argv -> GitCommand; the runnable `zeta` exe is a
// trivial shell over this + GitCommand.run. Keeping the brain a tested library fn = the exe stays thin.

[<Fact>]
let ``parse maps the git-ref verbs`` () =
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Commit "msg")), CliParse.parse [| "commit"; "msg" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Log 20)), CliParse.parse [| "log" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Log 5)), CliParse.parse [| "log"; "5" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Branch "feature")), CliParse.parse [| "branch"; "feature" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Checkout "main")), CliParse.parse [| "checkout"; "main" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git GitCommand.Status), CliParse.parse [| "status" |])

[<Fact>]
let ``parse maps the network verbs with remote/branch defaults`` () =
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Push("origin", None))), CliParse.parse [| "push" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Push("upstream", None))), CliParse.parse [| "push"; "upstream" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(
        Ok(ZetaCliCommand.Git(GitCommand.Push("origin", Some "main"))),
        CliParse.parse [| "push"; "origin"; "main" |]
    )
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Fetch "origin")), CliParse.parse [| "fetch" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(ZetaCliCommand.Git(GitCommand.Fetch "upstream")), CliParse.parse [| "fetch"; "upstream" |])

[<Fact>]
let ``parse errors on empty, bad count, and unknown verbs`` () =
    match CliParse.parse [||] with Error _ -> () | Ok o -> Assert.Fail(sprintf "expected usage error, got %A" o)
    match CliParse.parse [| "log"; "abc" |] with Error _ -> () | Ok o -> Assert.Fail(sprintf "expected count error, got %A" o)
    match CliParse.parse [| "frobnicate" |] with Error _ -> () | Ok o -> Assert.Fail(sprintf "expected unknown-command error, got %A" o)
