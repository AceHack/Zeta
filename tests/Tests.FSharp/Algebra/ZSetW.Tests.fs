module Zeta.Tests.Algebra.ZSetWTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// ZSetW<'K,'W> — the sorted-array polymorphic Z-set core (081KWFXTHJY, step 2).
// Storage byte-identical to ZSet<'K> (sorted ImmutableArray), weight polymorphic
// over ISemiring<'W>. This increment is the instance-passing baseline; the
// struct-ring / SRTP zero-overhead int64 specialisation and the ZSet reframe are
// later increments (see the design note 2026-07-01). Tests prove the algebra flows
// correctly across TWO rings (integer, interval) and that int64 matches ZSet.
// ═══════════════════════════════════════════════════════════════════

let private iring = IntegerRing.Instance
let private vring = IntervalRing.Instance

// ── IntegerRing: the polymorphic core must reproduce ZSet behaviour ──

[<Fact>]
let ``IntegerRing: empty has count 0 and isEmpty`` () =
    let z = ZSetW.empty<int, int64>
    Assert.Equal(0, ZSetW.count z)
    Assert.True(ZSetW.isEmpty z)

[<Fact>]
let ``IntegerRing: singleton with zero weight is empty`` () =
    Assert.True(ZSetW.isEmpty (ZSetW.singleton iring "a" 0L))

[<Fact>]
let ``IntegerRing: singleton non-zero survives and looks up`` () =
    let z = ZSetW.singleton iring "a" 3L
    Assert.Equal(1, ZSetW.count z)
    Assert.Equal(3L, ZSetW.lookup iring "a" z)
    Assert.Equal(0L, ZSetW.lookup iring "absent" z)

[<Fact>]
let ``IntegerRing: ofSeq consolidates duplicate keys via ring.Add`` () =
    let z = ZSetW.ofSeq iring [ "a", 1L; "b", 2L; "a", 4L ]
    Assert.Equal(2, ZSetW.count z)
    Assert.Equal(5L, ZSetW.lookup iring "a" z)   // 1 + 4
    Assert.Equal(2L, ZSetW.lookup iring "b" z)

[<Fact>]
let ``IntegerRing: ofSeq drops entries that consolidate to zero`` () =
    let z = ZSetW.ofSeq iring [ "a", 3L; "a", -3L; "b", 1L ]
    Assert.Equal(1, ZSetW.count z)               // a dropped (3 + -3 = 0)
    Assert.Equal(1L, ZSetW.lookup iring "b" z)

[<Fact>]
let ``IntegerRing: sum matches keywise addition, drops zeros`` () =
    let a = ZSetW.ofSeq iring [ "x", 2L; "y", 1L ]
    let b = ZSetW.ofSeq iring [ "y", -1L; "z", 5L ]
    let s = ZSetW.sum iring a b
    Assert.Equal(2L, ZSetW.lookup iring "x" s)
    Assert.Equal(0L, ZSetW.lookup iring "y" s)   // 1 + -1 dropped
    Assert.Equal(5L, ZSetW.lookup iring "z" s)
    Assert.Equal(2, ZSetW.count s)

[<Fact>]
let ``IntegerRing: retraction via difference cancels exactly (the ring axiom)`` () =
    let a = ZSetW.ofSeq iring [ "a", 3L; "b", 7L ]
    Assert.True(ZSetW.isEmpty (ZSetW.difference iring a a))

[<Fact>]
let ``IntegerRing: scale multiplies every weight, zero scalar empties`` () =
    let a = ZSetW.ofSeq iring [ "a", 2L; "b", 3L ]
    Assert.Equal(6L, ZSetW.lookup iring "b" (ZSetW.scale iring 2L a))
    Assert.True(ZSetW.isEmpty (ZSetW.scale iring 0L a))

// ── The bridge: int64 ZSetW <-> the existing ZSet<'K> hot path ──────

[<Fact>]
let ``bridge: ofZSetIntegerRing then toZSetIntegerRing round-trips`` () =
    let zset = ZSet.ofSeq [ "a", 1L; "b", -2L; "c", 3L ]
    let back = zset |> ZSetW.ofZSetIntegerRing |> ZSetW.toZSetIntegerRing
    Assert.True((zset = back), "int64 ZSetW bridge must round-trip the ZSet")

[<Fact>]
let ``bridge: ZSetW sum agrees with ZSet + on int64`` () =
    let a = ZSet.ofSeq [ "x", 2L; "y", 1L ]
    let b = ZSet.ofSeq [ "y", -1L; "z", 5L ]
    let viaZSet = a + b
    let viaW =
        ZSetW.sum iring (ZSetW.ofZSetIntegerRing a) (ZSetW.ofZSetIntegerRing b)
        |> ZSetW.toZSetIntegerRing
    Assert.True((viaZSet = viaW), "ZSetW sum must agree with ZSet + on int64")

// ── Polymorphism actually bites: a SECOND ring (interval arithmetic) ─

[<Fact>]
let ``IntervalRing: the same core computes interval-arithmetic sums`` () =
    // [1,2] over key a, [0,1] over key b; add another [1,1] on a.
    let z =
        ZSetW.ofSeq vring
            [ "a", IntervalWeight(1.0, 2.0)
              "b", IntervalWeight(0.0, 1.0)
              "a", IntervalWeight(1.0, 1.0) ]
    // a consolidates via interval Add: [1,2] + [1,1] = [2,3]
    let a = ZSetW.lookup vring "a" z
    Assert.Equal(2.0, a.Lo)
    Assert.Equal(3.0, a.Hi)
    Assert.Equal(2, ZSetW.count z)

[<Fact>]
let ``IntervalRing: width carries epistemic uncertainty through sum`` () =
    let a = ZSetW.singleton vring "k" (IntervalWeight(0.0, 4.0))
    let b = ZSetW.singleton vring "k" (IntervalWeight(1.0, 1.0))
    let s = ZSetW.sum vring a b
    let w = ZSetW.lookup vring "k" s
    Assert.Equal(1.0, w.Lo)    // 0 + 1
    Assert.Equal(5.0, w.Hi)    // 4 + 1
    Assert.Equal(4.0, w.Width) // uncertainty preserved

// ── Step 2b: the zero-overhead `*By` ops must EQUAL the instance ops ─
// (struct IntegerRing passed by value; same results, different dispatch)

[<Fact>]
let ``sumBy (struct ring) equals instance sum`` () =
    let a = ZSetW.ofSeq iring [ "x", 2L; "y", 1L; "w", 9L ]
    let b = ZSetW.ofSeq iring [ "y", -1L; "z", 5L; "w", -9L ]
    let viaInstance = ZSetW.sum iring a b
    let viaStruct = ZSetW.sumBy (IntegerRing()) a b
    Assert.True((viaInstance = viaStruct), "sumBy must equal instance sum")

[<Fact>]
let ``ofSeqBy / scaleBy / negateBy / differenceBy (struct ring) equal instance ops`` () =
    let pairs = [ "a", 3L; "b", 2L; "a", 4L; "c", -2L ]
    Assert.True((ZSetW.ofSeqBy (IntegerRing()) pairs = ZSetW.ofSeq iring pairs))
    let z = ZSetW.ofSeq iring pairs
    Assert.True((ZSetW.scaleBy (IntegerRing()) 3L z = ZSetW.scale iring 3L z))
    Assert.True((ZSetW.negateBy (IntegerRing()) z = ZSetW.negate iring z))
    Assert.True((ZSetW.differenceBy (IntegerRing()) z z |> ZSetW.isEmpty),
                "differenceBy z z must retract to empty")

[<Fact>]
let ``sumBy on int64 agrees with the ZSet hot path`` () =
    let a = ZSet.ofSeq [ "x", 2L; "y", 1L ]
    let b = ZSet.ofSeq [ "y", -1L; "z", 5L ]
    let viaZSet = a + b
    let viaStruct =
        ZSetW.sumBy (IntegerRing()) (ZSetW.ofZSetIntegerRing a) (ZSetW.ofZSetIntegerRing b)
        |> ZSetW.toZSetIntegerRing
    Assert.True((viaZSet = viaStruct), "struct-ring sumBy must match ZSet +")
