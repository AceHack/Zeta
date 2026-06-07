module Zeta.Tests.ConfluenceTests

open System
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// CONFLUENCE (081KTH8RSXS): out-of-order events end up with the same result — IFF the merge resolver is a
// JOIN-SEMILATTICE op (commutative + associative + IDEMPOTENT). Finding (this test): a Z-set SUM resolver is
// commutative+associative but NOT idempotent, and combined with content-addressed dedup-skip it is
// ORDER-SENSITIVE ([v1,v1,v2] != [v1,v2,v1]) — i.e. an accumulating resolver is SerializedSaga semantics, not
// CommutativeView. A proper join (here LWW-by-content-hash: pick the value with the larger hash) IS confluent.

module FS = Zeta.Core.DagFs
module CS = Zeta.Core.ContentStore

let private encI (i: int) : byte[] =
    let b = Array.zeroCreate<byte> 4
    System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(Span<byte> b, i)
    b

let private addr = ZSetMerkle.root encI

/// LWW-by-content-hash: a deterministic join-semilattice op — commutative (max), associative, idempotent.
let private lww _ (a: ZSet<int>) (b: ZSet<int>) : ZSet<int> =
    if (addr a).ToHex() >= (addr b).ToHex() then a else b

let private treeFrom (events: (int * int) list) : FS.Tree<ZSet<int>> =
    events
    |> List.fold
        (fun t (pathKey, v) ->
            let leaf = FS.link (string (((pathKey % 5) + 5) % 5)) (ZSet.singleton v 1L) (FS.create addr)
            FS.merge lww t leaf)
        (FS.create addr)

let private observe (t: FS.Tree<ZSet<int>>) =
    [ 0..4 ] |> List.map (fun p -> FS.resolve (string p) t)

[<Property>]
let ``CONFLUENT (join resolver): any order of link-events yields the same resolved branch`` (events: (int * int) list) =
    let inOrder = observe (treeFrom events)
    inOrder = observe (treeFrom (List.rev events))
    && inOrder = observe (treeFrom (List.sortBy snd events))

[<Property>]
let ``IDEMPOTENT (join resolver): duplicating every event changes nothing`` (events: (int * int) list) =
    observe (treeFrom events) = observe (treeFrom (events @ events))

[<Property>]
let ``ContentStore put-set is ORDER-INDEPENDENT: same node count regardless of insertion order`` (vals: int list) =
    let putAll (vs: int list) =
        vs |> List.fold (fun s v -> snd (CS.put (ZSet.singleton v 1L) s)) (CS.create addr)
    CS.count (putAll vals) = CS.count (putAll (List.rev vals))
    && CS.count (putAll vals) = CS.count (putAll (List.sort vals))

[<Fact>]
let ``a SUM (non-idempotent) resolver is order-SENSITIVE — confluence needs a join (the honest boundary)`` () =
    let sum _ (a: ZSet<int>) (b: ZSet<int>) = a + b
    let build order =
        order
        |> List.fold (fun t v -> FS.merge sum t (FS.link "p" (ZSet.singleton v 1L) (FS.create addr))) (FS.create addr)
        |> FS.resolve "p"
    // same multiset {1,1,2}, two orders -> DIFFERENT results under sum (proves sum is not confluent here)
    Assert.NotEqual<ZSet<int> option>(build [ 1; 1; 2 ], build [ 1; 2; 1 ])
