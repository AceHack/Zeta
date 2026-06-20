module Zeta.Tests.FileTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Files
open Zeta.Core.FSharp.Blake3

let h1 = ContentHash256.ofHex "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
let h2 = ContentHash256.ofHex "0202030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
let h3 = ContentHash256.ofHex "0302030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
let h4 = ContentHash256.ofHex "0402030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
let hEmpty = ContentHash256.ofHex "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"

[<Fact>]
let ``write then read returns the content hash (reference-not-copy: hash, not bytes)`` () =
    let st = fold defaultBackend [ Write("/a.txt", h1) ]
    Assert.Equal(Some h1, readHash "/a.txt" st)

[<Fact>]
let ``write is upsert; idempotent by path`` () =
    let once = fold defaultBackend [ Write("/a", h1) ]
    let twice = fold defaultBackend [ Write("/a", h1); Write("/a", h1) ]
    Assert.Equal<Map<string, FileEntry>>(once.Entries, twice.Entries)

[<Fact>]
let ``remove cascades over a folder subtree`` () =
    let st =
        fold defaultBackend
            [ MkFolder "/d"
              Write("/d/x", h1)
              Write("/d/sub/y", h2)
              Write("/keep", h3)
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
    let st = fold defaultBackend [ Write("/a", h1); Move("/a", "/b") ]
    Assert.False(st.Entries.ContainsKey "/a")
    Assert.Equal(Some h1, readHash "/b" st)

[<Fact>]
let ``move relocates a whole subtree`` () =
    let st = fold defaultBackend [ Write("/d/x", h1); Write("/d/sub/y", h2); Move("/d", "/e") ]
    Assert.False(st.Entries.ContainsKey "/d/x")
    Assert.Equal(Some h1, readHash "/e/x" st)
    Assert.Equal(Some h2, readHash "/e/sub/y" st)

[<Fact>]
let ``copy duplicates a subtree, keeping the source`` () =
    let st = fold defaultBackend [ Write("/d/x", h1); Copy("/d", "/e") ]
    Assert.Equal(Some h1, readHash "/d/x" st) // source kept
    Assert.Equal(Some h1, readHash "/e/x" st) // copy made

[<Fact>]
let ``listFolder returns immediate children only, sorted ordinal`` () =
    let st = fold defaultBackend [ Write("/d/b", h1); Write("/d/a", h1); Write("/d/sub/deep", h1); MkFolder "/d/sub" ]
    Assert.Equal<string list>([ "/d/a"; "/d/b"; "/d/sub" ], listFolder "/d" st)

[<Fact>]
let ``fold is deterministic / replayable: same stream, same tree`` () =
    let stream = [ Write("/a", h1); MkFolder "/d"; Write("/d/x", h2); Move("/a", "/d/a") ]
    Assert.Equal<Map<string, FileEntry>>((fold defaultBackend stream).Entries, (fold defaultBackend stream).Entries)

[<Fact>]
let ``default backend is DagFs (internal single-file); ExternalFs is opt-in`` () =
    Assert.Equal(DagFs, defaultBackend)

[<Fact>]
let ``folder template yyyy/mm/dd instantiates to a concrete folder path`` () =
    let tmpl = [ Placeholder "yyyy"; Placeholder "mm"; Placeholder "dd" ]
    let bindings = Map [ "yyyy", "2026"; "mm", "06"; "dd", "07" ]
    Assert.Equal(Ok "/logs/2026/06/07", instantiate "/logs" bindings tmpl)

[<Fact>]
let ``template instantiation errors on an unbound placeholder`` () =
    let tmpl = [ Placeholder "yyyy"; Placeholder "mm" ]
    Assert.Equal(Error "mm", instantiate "/logs" (Map [ "yyyy", "2026" ]) tmpl)

[<Fact>]
let ``a file dependson an instance of the template chain (folders root-first, then the file)`` () =
    let tmpl = [ Placeholder "yyyy"; Placeholder "mm"; Placeholder "dd" ]
    let bindings = Map [ "yyyy", "2026"; "mm", "06"; "dd", "07" ]
    let chain = fileUnderTemplate "/logs" bindings tmpl "app.log"
    Assert.Equal<Result<string list, string>>(
        Ok [ "/logs"; "/logs/2026"; "/logs/2026/06"; "/logs/2026/06/07"; "/logs/2026/06/07/app.log" ],
        chain
    )

[<Fact>]
let ``literal segments mix with placeholders in a template`` () =
    let tmpl = [ Lit "logs"; Placeholder "yyyy" ]
    Assert.Equal(Ok "/srv/logs/2026", instantiate "/srv" (Map [ "yyyy", "2026" ]) tmpl)

[<Fact>]
let ``file entries can dependson a branch (git ref)`` () =
    Assert.Equal("branch:main", branchRef "main")
    Assert.True(isBranchDep (branchRef "main"))
    Assert.False(isBranchDep "/d/x") // a folder path is not a branch dep

[<Fact>]
let ``self-hosted meta-recursive fs: metadata is a file within the filesystem itself`` () =
    let bare = fold defaultBackend [ Write("/d/x", h1) ]
    Assert.False(isSelfHosted bare)
    let selfHosted = fold defaultBackend [ Write("/d/x", h1); Write(MetaPath, hEmpty) ]
    Assert.True(isSelfHosted selfHosted)
    Assert.Equal(Some hEmpty, readHash MetaPath selfHosted)

[<Fact>]
let ``name is unique within a folder: two same-named files under one folder are one node (last wins)`` () =
    // #7022: two files with the same name can't both depend on the same folder — same path = same node.
    let st = fold defaultBackend [ Write("/d/x", h1); Write("/d/x", h2) ]
    Assert.Equal(Some h2, readHash "/d/x" st) // last write wins
    Assert.Equal<string list>([ "/d/x" ], listFolder "/d" st) // one child, not two

[<Fact>]
let ``a file dependson its parent folder; ancestors are the dependson chain root-first`` () =
    Assert.Equal(Some "/d/sub", parent "/d/sub/x")
    Assert.Equal(None, parent "/x") // top-level: no folder dep
    Assert.Equal(None, parent "/") // root
    Assert.Equal<string list>([ "/d"; "/d/sub" ], ancestors "/d/sub/x")

[<Fact>]
let ``backend-invariance: same stream folds to the same tree on external fs and DagFs`` () =
    let stream = [ Write("/a", h1); MkFolder "/d"; Write("/d/x", h2); Move("/a", "/d/a") ]
    Assert.Equal<Map<string, FileEntry>>((fold ExternalFs stream).Entries, (fold DagFs stream).Entries)
    Assert.Equal<Map<string, FileEntry>>((fold ExternalFs stream).Entries, (fold ObjectStore stream).Entries)
