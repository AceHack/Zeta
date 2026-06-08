module Zeta.Tests.FileTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Files

[<Fact>]
let ``write then read returns the content hash (reference-not-copy: hash, not bytes)`` () =
    let st = fold defaultBackend [ Write("/a.txt", "blake3:abc") ]
    Assert.Equal(Some "blake3:abc", readHash "/a.txt" st)

[<Fact>]
let ``write is upsert; idempotent by path`` () =
    let once = fold defaultBackend [ Write("/a", "h1") ]
    let twice = fold defaultBackend [ Write("/a", "h1"); Write("/a", "h1") ]
    Assert.Equal<Map<string, FileEntry>>(once.Entries, twice.Entries)

[<Fact>]
let ``remove cascades over a folder subtree`` () =
    let st =
        fold defaultBackend
            [ MkFolder "/d"
              Write("/d/x", "h1")
              Write("/d/sub/y", "h2")
              Write("/keep", "h3")
              Remove "/d" ]
    Assert.False(st.Entries.ContainsKey "/d")
    Assert.False(st.Entries.ContainsKey "/d/x")
    Assert.False(st.Entries.ContainsKey "/d/sub/y")
    Assert.True(st.Entries.ContainsKey "/keep")

[<Fact>]
let ``remove of an absent path is a no-op (idempotent)`` () =
    let st = fold defaultBackend [ Remove "/ghost"; Remove "/ghost" ]
    Assert.Equal<Map<string, FileEntry>>(Map.empty, st.Entries)

[<Fact>]
let ``move relocates a file`` () =
    let st = fold defaultBackend [ Write("/a", "h1"); Move("/a", "/b") ]
    Assert.False(st.Entries.ContainsKey "/a")
    Assert.Equal(Some "h1", readHash "/b" st)

[<Fact>]
let ``move relocates a whole subtree`` () =
    let st = fold defaultBackend [ Write("/d/x", "h1"); Write("/d/sub/y", "h2"); Move("/d", "/e") ]
    Assert.False(st.Entries.ContainsKey "/d/x")
    Assert.Equal(Some "h1", readHash "/e/x" st)
    Assert.Equal(Some "h2", readHash "/e/sub/y" st)

[<Fact>]
let ``copy duplicates a subtree, keeping the source`` () =
    let st = fold defaultBackend [ Write("/d/x", "h1"); Copy("/d", "/e") ]
    Assert.Equal(Some "h1", readHash "/d/x" st) // source kept
    Assert.Equal(Some "h1", readHash "/e/x" st) // copy made

[<Fact>]
let ``listFolder returns immediate children only, sorted ordinal`` () =
    let st = fold defaultBackend [ Write("/d/b", "h"); Write("/d/a", "h"); Write("/d/sub/deep", "h"); MkFolder "/d/sub" ]
    Assert.Equal<string list>([ "/d/a"; "/d/b"; "/d/sub" ], listFolder "/d" st)

[<Fact>]
let ``fold is deterministic / replayable: same stream, same tree`` () =
    let stream = [ Write("/a", "h1"); MkFolder "/d"; Write("/d/x", "h2"); Move("/a", "/d/a") ]
    Assert.Equal<Map<string, FileEntry>>((fold defaultBackend stream).Entries, (fold defaultBackend stream).Entries)

[<Fact>]
let ``default backend is DagFs (internal single-file); ExternalFs is opt-in`` () =
    Assert.Equal(DagFs, defaultBackend)

[<Fact>]
let ``name is unique within a folder: two same-named files under one folder are one node (last wins)`` () =
    // #7022: two files with the same name can't both depend on the same folder — same path = same node.
    let st = fold defaultBackend [ Write("/d/x", "h1"); Write("/d/x", "h2") ]
    Assert.Equal(Some "h2", readHash "/d/x" st) // last write wins
    Assert.Equal<string list>([ "/d/x" ], listFolder "/d" st) // one child, not two

[<Fact>]
let ``a file dependson its parent folder; ancestors are the dependson chain root-first`` () =
    Assert.Equal(Some "/d/sub", parent "/d/sub/x")
    Assert.Equal(None, parent "/x") // top-level: no folder dep
    Assert.Equal(None, parent "/") // root
    Assert.Equal<string list>([ "/d"; "/d/sub" ], ancestors "/d/sub/x")

[<Fact>]
let ``backend-invariance: same stream folds to the same tree on external fs and DagFs`` () =
    let stream = [ Write("/a", "h1"); MkFolder "/d"; Write("/d/x", "h2"); Move("/a", "/d/a") ]
    Assert.Equal<Map<string, FileEntry>>((fold ExternalFs stream).Entries, (fold DagFs stream).Entries)
    Assert.Equal<Map<string, FileEntry>>((fold ExternalFs stream).Entries, (fold ObjectStore stream).Entries)
