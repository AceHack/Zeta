module Zeta.Tests.ZetaExecTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ZetaCli
open Zeta.Core.ZetaExec

// parse-or-fail helper
let private p (line: string) =
    match parse line with
    | Ok c -> c
    | Error e -> failwithf "parse failed: %s" e

[<Fact>]
let ``table upsert via grammar: value= field becomes a DynamicValue row`` () =
    match run [ p "zeta table upsert users.42 value=alice" ] with
    | Ok ws -> Assert.Equal(DynamicValue.String "alice", ws.Table.["users.42"])
    | Error e -> failwith e

[<Fact>]
let ``file write via grammar: value= is the content hash`` () =
    match run [ p "zeta file write /a value=blake3:abc" ] with
    | Ok ws -> Assert.Equal(Some "blake3:abc", Files.readHash "/a" ws.Files)
    | Error e -> failwith e

[<Fact>]
let ``file move via grammar: to= field is the destination`` () =
    match run [ p "zeta file write /a value=h"; p "zeta file move /a to=/b" ] with
    | Ok ws ->
        Assert.Equal(Some "h", Files.readHash "/b" ws.Files)
        Assert.False(ws.Files.Entries.ContainsKey "/a")
    | Error e -> failwith e

[<Fact>]
let ``db create via grammar routes to the db state`` () =
    match run [ p "zeta db create users.1 value=v" ] with
    | Ok ws -> Assert.Equal("v", ws.Db.Files.["users.1"])
    | Error e -> failwith e

[<Fact>]
let ``dependson orders execution: parent folder before the file that needs it`` () =
    // /d/x depends on /d; topo-order ensures /d's mkfolder runs first
    let cmds =
        [ p "zeta file write /d/x value=h dependson /d"; p "zeta file mkfolder /d" ]
    match converge cmds with
    | Ok ws ->
        Assert.Equal(Some "h", Files.readHash "/d/x" ws.Files)
        Assert.Equal(Some Files.Folder, Map.tryFind "/d" ws.Files.Entries)
    | Error e -> failwith e

[<Fact>]
let ``missing value= is surfaced as an error, never silently dropped`` () =
    match run [ p "zeta table upsert k" ] with
    | Ok _ -> failwith "expected an error for missing value="
    | Error e -> Assert.Contains("value=", e)

[<Fact>]
let ``unwired seam is an explicit error`` () =
    match run [ p "zeta bogus frob x" ] with
    | Ok _ -> failwith "expected an error for unwired seam"
    | Error e -> Assert.Contains("bogus", e)

[<Fact>]
let ``retract removes a table row`` () =
    match run [ p "zeta table upsert k value=v"; p "zeta table retract k" ] with
    | Ok ws -> Assert.False(ws.Table.ContainsKey "k")
    | Error e -> failwith e
