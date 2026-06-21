module Zeta.Tests.Git.CliParseTests

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Git

[<Fact>]
let ``parse maps the branch and checkout commands`` () =
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Branch "feature"), CliParse.parse [| "branch"; "feature" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Join("main", false)), CliParse.parse [| "checkout"; "main" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Status), CliParse.parse [| "status" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Ls None), CliParse.parse [| "ls" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Ls (Some "main")), CliParse.parse [| "ls"; "main" |])

[<Fact>]
let ``parse maps the network verbs with remote defaults`` () =
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Join("origin", true)), CliParse.parse [| "push" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Join("upstream", true)), CliParse.parse [| "push"; "upstream" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Join("origin", true)), CliParse.parse [| "fetch" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Join("upstream", true)), CliParse.parse [| "fetch"; "upstream" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Merge "feature"), CliParse.parse [| "merge"; "feature" |])

[<Fact>]
let ``parse maps log and get commands`` () =
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Fold -1L), CliParse.parse [| "log" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Fold 5L), CliParse.parse [| "log"; "5" |])
    Assert.Equal<Result<ZetaCliCommand, string>>(Ok(DbCommand.Fold(4L)), CliParse.parse [| "get"; "5" |])

[<Fact>]
let ``parse errors on empty, bad count, and unknown verbs`` () =
    match CliParse.parse [||] with Error _ -> () | Ok o -> Assert.Fail(sprintf "expected usage error, got %A" o)
    match CliParse.parse [| "log"; "abc" |] with Error _ -> () | Ok o -> Assert.Fail(sprintf "expected count error, got %A" o)
    match CliParse.parse [| "frobnicate" |] with Error _ -> () | Ok o -> Assert.Fail(sprintf "expected unknown-command error, got %A" o)
