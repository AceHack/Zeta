module Zeta.Tests.DbTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ZetaCli
open Zeta.Core.Db

// db-seam command helper
let private db verb noun deps : ZetaCommand =
    { Seam = Some Db.SeamName; Verb = verb; Noun = noun; DependsOn = deps }

[<Fact>]
let ``fold: create then update then delete -> empty`` () =
    let st = fold defaultBackend [ Create("/a", "1"); Update("/a", "2"); Delete "/a" ]
    Assert.Equal<Map<string, string>>(Map.empty, st.Files)

[<Fact>]
let ``fold: create/update upsert by path`` () =
    let st = fold defaultBackend [ Create("/a", "1"); Update("/a", "2"); Create("/b", "x") ]
    Assert.Equal("2", st.Files.["/a"])
    Assert.Equal("x", st.Files.["/b"])

[<Fact>]
let ``idempotency: applying the same Create twice == once (apply-N == apply-once)`` () =
    let once = fold defaultBackend [ Create("/a", "1") ]
    let twice = fold defaultBackend [ Create("/a", "1"); Create("/a", "1") ]
    Assert.Equal<Map<string, string>>(once.Files, twice.Files)

[<Fact>]
let ``idempotency: deleting an absent path is a no-op`` () =
    let st = fold defaultBackend [ Delete "/ghost"; Delete "/ghost" ]
    Assert.Equal<Map<string, string>>(Map.empty, st.Files)

[<Fact>]
let ``default backend is GitNative`` () =
    Assert.Equal(GitNative, defaultBackend)

[<Fact>]
let ``backend-invariance: same stream folds to the same Files on every backend`` () =
    let stream = [ Create("/a", "1"); Update("/a", "2"); Create("/b", "y"); Delete "/b" ]
    let files b = (fold b stream).Files
    Assert.Equal<Map<string, string>>(files GitNative, files MultiFile)
    Assert.Equal<Map<string, string>>(files GitNative, files SingleFile)

[<Fact>]
let ``toEvent: verbs map to events; read is a query (None)`` () =
    Assert.Equal(Some(Create("/a", "1")), toEvent (Some "1") (db "create" "/a" []))
    Assert.Equal(Some(Update("/a", "2")), toEvent (Some "2") (db "update" "/a" []))
    Assert.Equal(Some(Update("/a", "3")), toEvent (Some "3") (db "write" "/a" [])) // write = upsert
    Assert.Equal(Some(Delete "/a"), toEvent None (db "delete" "/a" []))
    Assert.Equal(None, toEvent None (db "read" "/a" []))

[<Fact>]
let ``materialize: deps are set up (DepSetup events) before the data event that needs them`` () =
    // /b dependson /a  =>  topo puts /a first; each command emits DepSetup (if it has deps) then its data event
    let cmds = [ db "create" "/b" [ "/a" ]; db "create" "/a" [] ]
    let payload (c: ZetaCommand) = if c.Noun = "/a" then Some "AV" else Some "BV"
    match materialize defaultBackend payload cmds with
    | Error e -> failwithf "unexpected cycle: %A" e
    | Ok st ->
        Assert.Equal("AV", st.Files.["/a"])
        Assert.Equal("BV", st.Files.["/b"])
        // the structural edge for /b was recorded on the stream (deps "set up")
        Assert.Equal<string list>([ "/a" ], st.Deps.["/b"])

[<Fact>]
let ``materialize: cyclic deps -> Error (no strict stream order)`` () =
    let cmds = [ db "create" "/a" [ "/b" ]; db "create" "/b" [ "/a" ] ]
    match materialize defaultBackend (fun _ -> Some "v") cmds with
    | Error cycle -> Assert.Equal<string list>([ "/a"; "/b" ], cycle)
    | Ok _ -> failwith "expected a cycle error"

[<Fact>]
let ``structural events fold: PushDown and JitResolve land on the same stream`` () =
    let st =
        fold defaultBackend [ PushDown "compiler.rust"; JitResolve("npm.left-pad", "1.3.0"); Create("/a", "1") ]
    Assert.True(st.PushedDown.Contains "compiler.rust")
    Assert.Equal("1.3.0", st.Resolved.["npm.left-pad"])
    Assert.Equal("1", st.Files.["/a"])

[<Fact>]
let ``clever-declarative: data upserts are order-independent (CRDT/CAS-like) - reorder lands same Files`` () =
    // two independent file writes converge regardless of order (no imperative sequencing needed)
    let s1 = fold defaultBackend [ Create("/a", "1"); Create("/b", "2") ]
    let s2 = fold defaultBackend [ Create("/b", "2"); Create("/a", "1") ]
    Assert.Equal<Map<string, string>>(s1.Files, s2.Files)
