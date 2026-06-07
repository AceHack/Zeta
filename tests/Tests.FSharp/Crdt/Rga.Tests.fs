module Zeta.Tests.Crdt.RgaTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// RGA sequence CRDT (081KTH4Q782): collaborative ordered list/text. Convergence is the must-have —
// concurrent inserts must yield the SAME sequence on every replica (deterministic sibling ordering).

let private id (lamport: int64) (replica: string) : RgaId = struct (lamport, replica)

[<Fact>]
let ``RGA: sequential inserts produce in-order sequence; tombstone removes`` () =
    let a = id 1L "r1"
    let b = id 2L "r1"
    let c = id 3L "r1"
    let rga =
        Rga<string>.Empty.Insert(a, "a", None).Insert(b, "b", Some a).Insert(c, "c", Some b)
    rga.ToList() |> should equal [ "a"; "b"; "c" ]
    (rga.Remove b).ToList() |> should equal [ "a"; "c" ] // b tombstoned, still anchors c

[<Fact>]
let ``RGA: concurrent inserts at the same anchor CONVERGE (same sequence both merge orders)`` () =
    // two replicas each insert at head concurrently
    let r1 = Rga<string>.Empty.Insert(id 1L "r1", "x", None)
    let r2 = Rga<string>.Empty.Insert(id 2L "r2", "y", None)
    let ab = (Rga.Merge r1 r2).ToList()
    let ba = (Rga.Merge r2 r1).ToList()
    ab |> should equal ba // convergence: order-independent of merge direction
    // sibling rule: higher id (2,"r2") comes before (1,"r1")
    ab |> should equal [ "y"; "x" ]

[<Fact>]
let ``RGA: merge is idempotent and associative (CRDT convergence)`` () =
    let a = Rga<int>.Empty.Insert(id 1L "r1", 1, None)
    let b = Rga<int>.Empty.Insert(id 2L "r2", 2, Some(id 1L "r1"))
    let c = Rga<int>.Empty.Insert(id 3L "r3", 3, Some(id 1L "r1"))
    let ab = Rga.Merge a b
    // idempotent
    (Rga.Merge ab ab).ToList() |> should equal (ab.ToList())
    // associative
    let left = (Rga.Merge (Rga.Merge a b) c).ToList()
    let right = (Rga.Merge a (Rga.Merge b c)).ToList()
    left |> should equal right
    // both concurrent inserts after r1's "1" appear, higher-id first: 1, then 3 (r3) before 2 (r2)
    left |> should equal [ 1; 3; 2 ]

[<Fact>]
let ``RGA: a replica's run stays contiguous (chain anchoring)`` () =
    // r1 types "ab" (a head, b after a); r2 concurrently inserts "Z" at head
    let r1 = Rga<string>.Empty.Insert(id 1L "r1", "a", None).Insert(id 2L "r1", "b", Some(id 1L "r1"))
    let r2 = Rga<string>.Empty.Insert(id 5L "r2", "Z", None)
    let merged = (Rga.Merge r1 r2).ToList()
    merged |> should equal [ "Z"; "a"; "b" ] // r1's a->b chain stays together; Z (higher head id) leads
