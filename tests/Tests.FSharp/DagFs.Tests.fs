module Zeta.Tests.DagFsTests

open System
open global.Xunit
open Zeta.Core

module FS = Zeta.Core.DagFs

let private encI (i: int) : byte[] =
    let b = Array.zeroCreate<byte> 4
    System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(Span<byte> b, i)
    b

let private tree () : FS.Tree<ZSet<int>> = FS.create (ZSetMerkle.root encI)
let private v (xs: (int * int64) list) = ZSet.ofSeq xs

[<Fact>]
let ``same content under two paths is one node (single-instance) referenced by both (multi-parent)`` () =
    let content = v [ 1, 1L ]
    let t = tree () |> FS.link "/a/file" content |> FS.link "/b/file" content
    Assert.Equal(2, FS.pathCount t)
    Assert.Equal(1, FS.nodeCount t) // dedup — one stored node
    let h = (FS.addressAt "/a/file" t).Value
    Assert.Equal<string list>([ "/a/file"; "/b/file" ] |> List.sort, FS.pathsOf h t |> List.sort)
    Assert.Equal<ZSet<int> option>(Some content, FS.resolve "/b/file" t)

[<Fact>]
let ``editLocal forks copy-on-write — only this path changes (default, regular-fs feel)`` () =
    let t =
        tree () |> FS.link "/a" (v [ 1, 1L ]) |> FS.link "/b" (v [ 1, 1L ]) // shared content
    let t2 = FS.editLocal "/a" (v [ 1, 2L ]) t
    Assert.Equal<ZSet<int> option>(Some(v [ 1, 2L ]), FS.resolve "/a" t2) // changed
    Assert.Equal<ZSet<int> option>(Some(v [ 1, 1L ]), FS.resolve "/b" t2) // untouched
    Assert.Equal(2, FS.nodeCount t2) // now two distinct nodes

[<Fact>]
let ``editEverywhere updates every path that shared the content (shared-object edit)`` () =
    let t =
        tree () |> FS.link "/a" (v [ 1, 1L ]) |> FS.link "/b" (v [ 1, 1L ]) |> FS.link "/c" (v [ 9, 9L ])
    let t2 = FS.editEverywhere "/a" (v [ 1, 2L ]) t
    Assert.Equal<ZSet<int> option>(Some(v [ 1, 2L ]), FS.resolve "/a" t2)
    Assert.Equal<ZSet<int> option>(Some(v [ 1, 2L ]), FS.resolve "/b" t2) // followed the shared edit
    Assert.Equal<ZSet<int> option>(Some(v [ 9, 9L ]), FS.resolve "/c" t2) // unrelated, unchanged

[<Fact>]
let ``link is copy-on-write; unlink drops the path`` () =
    let t0 = tree ()
    let t1 = FS.link "/a" (v [ 1, 1L ]) t0
    Assert.Equal(0, FS.pathCount t0) // prior version unchanged (cheap branch)
    Assert.Equal(1, FS.pathCount t1)
    let t2 = FS.unlink "/a" t1
    Assert.Equal<ZSet<int> option>(None, FS.resolve "/a" t2)

[<Fact>]
let ``editLocal to content identical to an existing file converges — pointers move to the shared node (no duplicate)`` () =
    // Aaron 2026-06-07: if an edit lands on the same content address as an existing file, it just moves
    // pointers (content-addressing makes convergence automatic / single-instance).
    let c1 = v [ 1, 1L ]
    let c2 = v [ 2, 2L ]
    let t = tree () |> FS.link "/a" c1 |> FS.link "/b" c2
    Assert.NotEqual((FS.addressAt "/a" t).Value, (FS.addressAt "/b" t).Value)
    let t2 = FS.editLocal "/a" c2 t // edit /a to equal /b's content
    Assert.Equal((FS.addressAt "/a" t2).Value, (FS.addressAt "/b" t2).Value) // converged: same node
    Assert.Equal<ZSet<int> option>(Some c2, FS.resolve "/a" t2)
    Assert.Equal<string list>([ "/a"; "/b" ] |> List.sort, FS.pathsOf (FS.addressAt "/b" t2).Value t2 |> List.sort)

// ── merging two ZetaFS: content union is conflict-free; path collisions are the only conflict ──

[<Fact>]
let ``merge: identical content under different paths dedups to one node (content union is free)`` () =
    let shared = v [ 1, 1L ]
    let a = tree () |> FS.link "/a/photo" shared
    let b = tree () |> FS.link "/b/photo" shared
    let m = FS.merge (fun _ x _ -> x) a b
    Assert.Equal(1, FS.nodeCount m) // same content => one node across both filesystems
    Assert.Equal(2, FS.pathCount m)
    Assert.Equal((FS.addressAt "/a/photo" m).Value, (FS.addressAt "/b/photo" m).Value)

[<Fact>]
let ``merge: disjoint paths just unite; same path + same content = no conflict`` () =
    let a = tree () |> FS.link "/x" (v [ 1, 1L ]) |> FS.link "/shared" (v [ 9, 9L ])
    let b = tree () |> FS.link "/y" (v [ 2, 2L ]) |> FS.link "/shared" (v [ 9, 9L ]) // same path, same content
    let m = FS.merge (fun _ x _ -> failwith "should not conflict") a b
    Assert.Equal<ZSet<int> option>(Some(v [ 1, 1L ]), FS.resolve "/x" m)
    Assert.Equal<ZSet<int> option>(Some(v [ 2, 2L ]), FS.resolve "/y" m)
    Assert.Equal<ZSet<int> option>(Some(v [ 9, 9L ]), FS.resolve "/shared" m)

[<Fact>]
let ``merge EDGE CASE: same folder+filename, DIFFERENT content -> resolver fires (Aaron 2026-06-07)`` () =
    // both filesystems have "/docs/report" but with different content => the real conflict
    let a = tree () |> FS.link "/docs/report" (v [ 1, 1L ])
    let b = tree () |> FS.link "/docs/report" (v [ 2, 2L ])
    let mutable conflictedPath = ""
    let resolve path (x: ZSet<int>) (y: ZSet<int>) =
        conflictedPath <- path
        x + y // example policy: merge both (any deterministic resolver works)
    let m = FS.merge resolve a b
    Assert.Equal("/docs/report", conflictedPath) // resolver saw the colliding path
    Assert.Equal<ZSet<int> option>(Some(ZSet.ofSeq [ 1, 1L; 2, 2L ]), FS.resolve "/docs/report" m)

[<Fact>]
let ``merge is content-convergent: order of merge gives the same nodes (resolver must be commutative for path-convergence)`` () =
    let a = tree () |> FS.link "/k" (v [ 1, 1L ])
    let b = tree () |> FS.link "/k" (v [ 2, 2L ])
    // a commutative resolver (set-union via +) => path-convergent both merge directions
    let r _ (x: ZSet<int>) (y: ZSet<int>) = x + y
    let ab = FS.merge r a b
    let ba = FS.merge r b a
    Assert.Equal<ZSet<int> option>(FS.resolve "/k" ab, FS.resolve "/k" ba)
