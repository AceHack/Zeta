module Zeta.Tests.ZetaCliTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ZetaCli

[<Fact>]
let ``zeta explicit seam: zeta git clone <noun>`` () =
    Assert.Equal<Result<ZetaCommand, string>>(
        Ok { Seam = Some "git"; Verb = "clone"; Noun = "abc123" },
        parse "zeta git clone abc123")

[<Fact>]
let ``zeta implicit seam: zeta run cell`` () =
    Assert.Equal<Result<ZetaCommand, string>>(
        Ok { Seam = None; Verb = "run"; Noun = "cell" },
        parse "zeta run cell")

[<Fact>]
let ``zs and zc shorthands canonicalize to run shell / run cell`` () =
    Assert.Equal<Result<ZetaCommand, string>>(Ok { Seam = None; Verb = "run"; Noun = "shell" }, parse "zs")
    Assert.Equal<Result<ZetaCommand, string>>(Ok { Seam = None; Verb = "run"; Noun = "cell" }, parse "zc")

[<Fact>]
let ``ace seam: ace ensure with a source-bracketed dotted noun`` () =
    Assert.Equal<Result<ZetaCommand, string>>(
        Ok { Seam = Some "ace"; Verb = "ensure"; Noun = "npm[www.privaterepo.com].bar" },
        parse "ace ensure npm[www.privaterepo.com].bar")

[<Fact>]
let ``test seam: zeta test run cell (DST plane)`` () =
    Assert.Equal<Result<ZetaCommand, string>>(
        Ok { Seam = Some "test"; Verb = "run"; Noun = "cell" },
        parse "zeta test run cell")

[<Fact>]
let ``render produces canonical zeta form (implicit vs explicit seam)`` () =
    Assert.Equal("zeta run cell", render { Seam = None; Verb = "run"; Noun = "cell" })
    Assert.Equal("zeta git clone abc", render { Seam = Some "git"; Verb = "clone"; Noun = "abc" })

[<Fact>]
let ``homoiconic round-trip: parse (render c) = Ok c`` () =
    for c in
        [ { Seam = None; Verb = "run"; Noun = "shell" }
          { Seam = Some "git"; Verb = "clone"; Noun = "zid" }
          { Seam = Some "ace"; Verb = "ensure"; Noun = "npm[r].bar" }
          { Seam = Some "test"; Verb = "message"; Noun = "otto-cli1" } ] do
        Assert.Equal<Result<ZetaCommand, string>>(Ok c, parse (render c))

[<Fact>]
let ``shorthands canonicalize: render (parse zc) = zeta run cell`` () =
    match parse "zc" with
    | Ok c -> Assert.Equal("zeta run cell", render c)
    | Error e -> failwith e

[<Fact>]
let ``errors: empty, bad arity, unknown program`` () =
    Assert.True(match parse "" with Error _ -> true | _ -> false)
    Assert.True(match parse "zeta" with Error _ -> true | _ -> false)
    Assert.True(match parse "ace ensure" with Error _ -> true | _ -> false)
    Assert.True(match parse "frobnicate x y" with Error _ -> true | _ -> false)
