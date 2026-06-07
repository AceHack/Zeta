module Zeta.Tests.ContentStoreTests

open System
open global.Xunit
open Zeta.Core

module CS = Zeta.Core.ContentStore

// Content-addressed single-instance store (081KTGTJC1Q). Keyed by the ZSetMerkle root, so identical Z-set
// content dedups to one node; put is idempotent; each put is a COW version (old versions persist).

let private encI (i: int) : byte[] =
    let b = Array.zeroCreate<byte> 4
    System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(Span<byte> b, i)
    b

let private store () : CS.Store<ZSet<int>> = CS.create (ZSetMerkle.root encI)

[<Fact>]
let ``put returns the content address; get round-trips`` () =
    let z = ZSet.ofSeq [ 1, 1L; 2, 1L ]
    let h, s = CS.put z (store ())
    Assert.Equal(h, CS.addressOf z s)
    Assert.Equal<ZSet<int> option>(Some z, CS.get h s)

[<Fact>]
let ``identical content dedups to one node (single-instance); put is idempotent`` () =
    let z = ZSet.ofSeq [ 1, 2L; 3, 4L ]
    let h1, s1 = CS.put z (store ())
    let h2, s2 = CS.put z s1 // put the SAME content again
    Assert.Equal(h1, h2)
    Assert.Equal(1, CS.count s2) // still one node — dedup
    Assert.Equal(CS.count s1, CS.count s2) // apply-twice == apply-once (effect)

[<Fact>]
let ``distinct content yields distinct addresses and two nodes`` () =
    let a = ZSet.ofSeq [ 1, 1L ]
    let b = ZSet.ofSeq [ 1, 2L ] // same key, different weight => different content
    let ha, s1 = CS.put a (store ())
    let hb, s2 = CS.put b s1
    Assert.NotEqual(ha, hb)
    Assert.Equal(2, CS.count s2)
    Assert.Equal<ZSet<int> option>(Some a, CS.get ha s2)
    Assert.Equal<ZSet<int> option>(Some b, CS.get hb s2)

[<Fact>]
let ``put is copy-on-write — the prior store version is unchanged (cheap branches)`` () =
    let empty = store ()
    let z = ZSet.ofSeq [ 7, 1L ]
    let h, s1 = CS.put z empty
    // the original version never saw the node — old roots persist as branches
    Assert.Equal(0, CS.count empty)
    Assert.False(CS.contains h empty)
    Assert.Equal(1, CS.count s1)
    Assert.True(CS.contains h s1)
