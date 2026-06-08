module Zeta.Tests.ZetaGraphTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ZetaCli

// node helper: a command keyed by Noun with the given dependson edges (seam/verb irrelevant to ordering)
let private n noun deps : ZetaCommand =
    { Seam = None; Verb = "ensure"; Noun = noun; Fields = Map.empty; DependsOn = deps }
let private nouns (cmds: ZetaCommand list) = cmds |> List.map (fun c -> c.Noun)

[<Fact>]
let ``topoOrder: deps come before dependents (chain a->b->c)`` () =
    // a dependson b; b dependson c  =>  c, then b, then a
    let cmds = [ n "a" [ "b" ]; n "b" [ "c" ]; n "c" [] ]
    match ZetaGraph.topoOrder cmds with
    | Ok ordered -> Assert.Equal<string list>([ "c"; "b"; "a" ], nouns ordered)
    | Error e -> failwithf "unexpected cycle: %A" e

[<Fact>]
let ``topoOrder: order is derived from dependson, NOT input order (shuffle-invariant)`` () =
    let a, b, c = n "a" [ "b" ], n "b" [ "c" ], n "c" []
    let r1 = ZetaGraph.topoOrder [ a; b; c ]
    let r2 = ZetaGraph.topoOrder [ c; a; b ]
    let r3 = ZetaGraph.topoOrder [ b; c; a ]
    Assert.Equal<Result<ZetaCommand list, string list>>(r1, r2)
    Assert.Equal<Result<ZetaCommand list, string list>>(r1, r3)

[<Fact>]
let ``topoOrder: diamond d->[b,c], b->[a], c->[a] puts a first, d last`` () =
    let cmds = [ n "d" [ "b"; "c" ]; n "b" [ "a" ]; n "c" [ "a" ]; n "a" [] ]
    match ZetaGraph.topoOrder cmds with
    | Ok ordered ->
        let o = nouns ordered
        Assert.Equal("a", List.head o)
        Assert.Equal("d", List.last o)
        // b and c both after a, both before d
        let idx x = List.findIndex ((=) x) o
        Assert.True(idx "a" < idx "b" && idx "a" < idx "c")
        Assert.True(idx "b" < idx "d" && idx "c" < idx "d")
    | Error e -> failwithf "unexpected cycle: %A" e

[<Fact>]
let ``topoOrder: external deps (not in set) are ignored for ordering`` () =
    // a dependson compiler.rust (external/push-down, not in set) — still orders fine
    let cmds = [ n "a" [ "compiler.rust"; "b" ]; n "b" [] ]
    match ZetaGraph.topoOrder cmds with
    | Ok ordered -> Assert.Equal<string list>([ "b"; "a" ], nouns ordered)
    | Error e -> failwithf "unexpected cycle: %A" e

[<Fact>]
let ``topoOrder: a cycle is reported as Error with the cycle's nouns`` () =
    let cmds = [ n "a" [ "b" ]; n "b" [ "a" ] ]
    match ZetaGraph.topoOrder cmds with
    | Ok _ -> failwith "expected a cycle error"
    | Error c -> Assert.Equal<string list>([ "a"; "b" ], c)

[<Fact>]
let ``topoOrder: independent nodes ordered deterministically (ordinal tie-break)`` () =
    let cmds = [ n "z" []; n "a" []; n "m" [] ]
    match ZetaGraph.topoOrder cmds with
    | Ok ordered -> Assert.Equal<string list>([ "a"; "m"; "z" ], nouns ordered)
    | Error e -> failwithf "unexpected cycle: %A" e

[<Fact>]
let ``directDependents: who depends on a noun`` () =
    let cmds = [ n "a" [ "lib" ]; n "b" [ "lib" ]; n "c" [ "other" ]; n "lib" [] ]
    Assert.Equal<string list>([ "a"; "b" ], ZetaGraph.directDependents cmds "lib")
    Assert.Equal<string list>([], ZetaGraph.directDependents cmds "nobody")
