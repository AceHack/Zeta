module Zeta.Tests.ZetaCliTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ZetaCli

let private cmd seam verb noun deps = { Seam = seam; Verb = verb; Noun = noun; DependsOn = deps }

[<Fact>]
let ``zeta explicit seam: zeta git clone <noun>`` () =
    Assert.Equal<Result<ZetaCommand, string>>(Ok(cmd (Some "git") "clone" "abc123" []), parse "zeta git clone abc123")

[<Fact>]
let ``zeta implicit seam: zeta run cell`` () =
    Assert.Equal<Result<ZetaCommand, string>>(Ok(cmd None "run" "cell" []), parse "zeta run cell")

[<Fact>]
let ``zs and zc shorthands canonicalize to run shell / run cell`` () =
    Assert.Equal<Result<ZetaCommand, string>>(Ok(cmd None "run" "shell" []), parse "zs")
    Assert.Equal<Result<ZetaCommand, string>>(Ok(cmd None "run" "cell" []), parse "zc")

[<Fact>]
let ``ace seam: ace ensure with a source-bracketed dotted noun`` () =
    Assert.Equal<Result<ZetaCommand, string>>(
        Ok(cmd (Some "ace") "ensure" "npm[www.privaterepo.com].bar" []),
        parse "ace ensure npm[www.privaterepo.com].bar")

[<Fact>]
let ``test seam: zeta test run cell (DST plane)`` () =
    Assert.Equal<Result<ZetaCommand, string>>(Ok(cmd (Some "test") "run" "cell" []), parse "zeta test run cell")

[<Fact>]
let ``dependson clause: edges parsed into DependsOn`` () =
    Assert.Equal<Result<ZetaCommand, string>>(
        Ok(cmd (Some "ace") "ensure" "npm.foo" [ "compiler.rust"; "npm.bar" ]),
        parse "ace ensure npm.foo dependson compiler.rust npm.bar")

[<Fact>]
let ``dependson with implicit seam`` () =
    Assert.Equal<Result<ZetaCommand, string>>(
        Ok(cmd None "build" "app" [ "lib1"; "lib2" ]),
        parse "zeta build app dependson lib1 lib2")

[<Fact>]
let ``render produces canonical zeta form, incl. dependson`` () =
    Assert.Equal("zeta run cell", render (cmd None "run" "cell" []))
    Assert.Equal("zeta git clone abc", render (cmd (Some "git") "clone" "abc" []))
    Assert.Equal("zeta ace ensure foo dependson a b", render (cmd (Some "ace") "ensure" "foo" [ "a"; "b" ]))

[<Fact>]
let ``homoiconic round-trip: parse (render c) = Ok c (with deps)`` () =
    for c in
        [ cmd None "run" "shell" []
          cmd (Some "git") "clone" "zid" []
          cmd (Some "ace") "ensure" "npm[r].bar" [ "compiler.rust" ]
          cmd (Some "test") "message" "otto-cli1" [ "a"; "b"; "c" ] ] do
        Assert.Equal<Result<ZetaCommand, string>>(Ok c, parse (render c))

[<Fact>]
let ``shorthands canonicalize: render (parse zc) = zeta run cell`` () =
    match parse "zc" with
    | Ok c -> Assert.Equal("zeta run cell", render c)
    | Error e -> failwith e

[<Fact>]
let ``context: implicit seam filled from Context; bare nouns namespace-qualified`` () =
    let ctx = { Seam = Some "ace"; Namespace = Some "npm" }
    let resolved = resolve ctx (cmd None "ensure" "foo" [ "bar" ])
    Assert.Equal<ZetaCommand>(cmd (Some "ace") "ensure" "npm.foo" [ "npm.bar" ], resolved)

[<Fact>]
let ``context: explicit seam + already-qualified nouns unchanged + idempotent`` () =
    let ctx = { Seam = Some "ace"; Namespace = Some "npm" }
    let c = cmd (Some "git") "clone" "compiler.rust" [ "x[src].y" ]
    Assert.Equal<ZetaCommand>(c, resolve ctx c)
    Assert.Equal<ZetaCommand>(resolve ctx c, resolve ctx (resolve ctx c))

[<Fact>]
let ``context: empty context changes nothing`` () =
    let c = cmd None "ensure" "foo" [ "bar" ]
    Assert.Equal<ZetaCommand>(c, resolve Context.Empty c)

[<Fact>]
let ``errors: empty, bad arity, unknown program`` () =
    Assert.True(match parse "" with Error _ -> true | _ -> false)
    Assert.True(match parse "zeta" with Error _ -> true | _ -> false)
    Assert.True(match parse "ace ensure" with Error _ -> true | _ -> false)
    Assert.True(match parse "frobnicate x y" with Error _ -> true | _ -> false)
