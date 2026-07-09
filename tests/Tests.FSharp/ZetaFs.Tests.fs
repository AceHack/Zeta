module Zeta.Tests.ZetaFsTests

open System
open global.Xunit
open Zeta.Core

let private encI (i: int) : byte[] =
    let b = Array.zeroCreate<byte> 4
    System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(Span<byte> b, i)
    b

let private tree () : ZetaFs.Tree<ZSet<int>> = ZetaFs.create (ZSetMerkle.root encI)
let private v (xs: (int * int64) list) = ZSet.ofSeq xs

[<Fact>]
let ``Patricia trie: basic prefix collapse, insertion, find, toList`` () =
    let trie = Patricia.empty
    let trie' =
        trie
        |> Patricia.insert "apple" 1
        |> Patricia.insert "apricot" 2
        |> Patricia.insert "banana" 3
        |> Patricia.insert "app" 4

    Assert.Equal(Some 1, Patricia.tryFind "apple" trie')
    Assert.Equal(Some 2, Patricia.tryFind "apricot" trie')
    Assert.Equal(Some 3, Patricia.tryFind "banana" trie')
    Assert.Equal(Some 4, Patricia.tryFind "app" trie')
    Assert.Equal(None, Patricia.tryFind "ap" trie')
    Assert.Equal(None, Patricia.tryFind "cherry" trie')

    let kvs = Patricia.toList trie' |> List.sortBy fst
    Assert.Equal<string list>([ "app"; "apple"; "apricot"; "banana" ], kvs |> List.map fst)
    Assert.Equal<int list>([ 4; 1; 2; 3 ], kvs |> List.map snd)

[<Fact>]
let ``Patricia trie: deletion collapses nodes and removes value`` () =
    let trie = Patricia.empty
    let trie' =
        trie
        |> Patricia.insert "app" 1
        |> Patricia.insert "apple" 2
        |> Patricia.remove "apple"

    Assert.Equal(Some 1, Patricia.tryFind "app" trie')
    Assert.Equal(None, Patricia.tryFind "apple" trie')

    let trie'' = Patricia.remove "app" trie'
    Assert.True(Patricia.toList trie'' |> List.isEmpty)

[<Fact>]
let ``ZetaFs: nested write, read, delete, move operations`` () =
    let t = tree ()
    let c1 = v [ 1, 1L ]
    let c2 = v [ 2, 2L ]

    // Write nested files
    let t2 =
        t
        |> ZetaFs.writePath "/a/b/file1.txt" c1
        |> ZetaFs.writePath "/a/b/c/file2.txt" c2

    Assert.Equal(Some c1, ZetaFs.readPath "/a/b/file1.txt" t2)
    Assert.Equal(Some c2, ZetaFs.readPath "/a/b/c/file2.txt" t2)

    // Move file
    let t3 = ZetaFs.movePath "/a/b/file1.txt" "/a/moved.txt" t2
    Assert.Equal(None, ZetaFs.readPath "/a/b/file1.txt" t3)
    Assert.Equal(Some c1, ZetaFs.readPath "/a/moved.txt" t3)
    Assert.Equal(Some c2, ZetaFs.readPath "/a/b/c/file2.txt" t3)

    // Move folder
    let t4 = ZetaFs.movePath "/a/b/c" "/c_root" t3
    Assert.Equal(None, ZetaFs.readPath "/a/b/c/file2.txt" t4)
    Assert.Equal(Some c2, ZetaFs.readPath "/c_root/file2.txt" t4)

    // Delete path
    let t5 = ZetaFs.deletePath "/c_root/file2.txt" t4
    Assert.Equal(None, ZetaFs.readPath "/c_root/file2.txt" t5)

[<Fact>]
let ``ZetaFs: listFolder returns directory contents`` () =
    let t =
        tree ()
        |> ZetaFs.writePath "/docs/intro.md" (v [1, 1L])
        |> ZetaFs.writePath "/docs/tutorial.md" (v [2, 1L])
        |> ZetaFs.writePath "/images/logo.png" (v [3, 1L])

    let entriesOpt = ZetaFs.listFolder "/docs" t
    Assert.True(entriesOpt.IsSome)
    let entries = entriesOpt.Value |> List.sortBy fst
    Assert.Equal(2, entries.Length)
    Assert.Equal("intro.md", fst entries.[0])
    Assert.Equal("tutorial.md", fst entries.[1])

[<Fact>]
let ``ZetaFs: merge folder-by-folder combines files and resolves collisions`` () =
    let c1 = v [ 1, 1L ]
    let c2 = v [ 2, 2L ]
    let c3 = v [ 3, 3L ]

    let treeA =
        tree ()
        |> ZetaFs.writePath "/shared/colliding.txt" c1
        |> ZetaFs.writePath "/a_only.txt" c2

    let treeB =
        tree ()
        |> ZetaFs.writePath "/shared/colliding.txt" c3
        |> ZetaFs.writePath "/b_only.txt" c2

    // Commutative resolver: simply adds the ZSets
    let resolve (name: string) (va: ZSet<int>) (vb: ZSet<int>) =
        va + vb

    let merged = ZetaFs.merge resolve treeA treeB

    // Read combined file content
    let expectedColliding = c1 + c3
    Assert.Equal(Some expectedColliding, ZetaFs.readPath "/shared/colliding.txt" merged)
    Assert.Equal(Some c2, ZetaFs.readPath "/a_only.txt" merged)
    Assert.Equal(Some c2, ZetaFs.readPath "/b_only.txt" merged)

[<Fact>]
let ``ZetaFs: extractEdges returns parent-child edges of the directory hierarchy`` () =
    let t =
        tree ()
        |> ZetaFs.writePath "/a/b/file.txt" (v [1, 1L])

    let edges = ZetaFs.extractEdges t
    // Root directory node -> subdirectory 'a' -> subdirectory 'b' -> file.txt
    // There should be exactly 3 edges
    Assert.Equal(3, edges.Length)

    // Check that root has a child
    let rootHash = t.root
    let hasRootEdge = edges |> List.exists (fun (struct (p, _)) -> p = rootHash)
    Assert.True(hasRootEdge)
