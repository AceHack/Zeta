module Zeta.Tests.BagSpineEquivalenceTests

// Proves the "one atom, many faces" claim is REAL, not just asserted in doc comments:
// the dedicated, perf-tuned `ZSet` (the ℤ face) and the generic `WeightedSet<_,int64>` over
// `IntegerRing` (the spine instantiated at the same ring) compute the SAME results. This is the BP-16
// cross-check / native-vs-interpreted differential applied to the weight-algebra spine: if the two
// faces ever diverge, this test catches it. (Spine = WeightedSet<'K,'W> over ISemiring<'W>, Aaron
// 2026-06-07; ZSet = the IntegerRing instance per WeightedSet.fs's own header.)

open global.Xunit
open Zeta.Core

module WS = WeightedSet

let private sr = IntegerRing.Instance

let private zmap (z: ZSet<string>) : Map<string, int64> =
    z |> Seq.map (fun e -> e.Key, e.Weight) |> Map.ofSeq

let private wmap (w: WS.WeightedSet<string, int64>) : Map<string, int64> =
    WS.toSeq w |> Map.ofSeq

// negate a ZSet on confirmed surface (build from negated weights) — avoids relying on the operator.
let private znegate (z: ZSet<string>) : ZSet<string> =
    z |> Seq.map (fun e -> e.Key, -e.Weight) |> ZSet.ofSeq

let private a = [ "a", 3L; "b", -2L; "a", 1L; "c", 5L; "d", 0L ] // dup "a", a Zero "d" to prune
let private b = [ "b", 2L; "c", -5L; "e", 7L ]

[<Fact>]
let ``ofSeq agrees: ZSet == WeightedSet<IntegerRing> (dup-combine + Zero-prune)`` () =
    Assert.Equal<Map<string, int64>>(zmap (ZSet.ofSeq a), wmap (WS.ofSeq sr a))

[<Fact>]
let ``add agrees across the two faces`` () =
    let z = ZSet.add (ZSet.ofSeq a) (ZSet.ofSeq b)
    let w = WS.add sr (WS.ofSeq sr a) (WS.ofSeq sr b)
    Assert.Equal<Map<string, int64>>(zmap z, wmap w)

[<Fact>]
let ``negate agrees; retraction empties BOTH faces (a + (-a) = empty)`` () =
    let z = ZSet.ofSeq a
    let zEmpty = ZSet.add z (znegate z)
    let w = WS.ofSeq sr a
    let wEmpty = WS.add sr w (WS.negate sr w)
    Assert.Equal<Map<string, int64>>(zmap zEmpty, wmap wEmpty) // agree...
    Assert.True(Map.isEmpty (zmap zEmpty)) // ...and both are actually empty
    Assert.True(WS.isEmpty wEmpty)

[<Fact>]
let ``subtract agrees: a - b on both faces`` () =
    let z = ZSet.add (ZSet.ofSeq a) (znegate (ZSet.ofSeq b))
    let w = WS.subtract sr (WS.ofSeq sr a) (WS.ofSeq sr b)
    Assert.Equal<Map<string, int64>>(zmap z, wmap w)

[<Fact>]
let ``per-key lookup agrees (ZSet indexer vs WeightedSet.weight)`` () =
    let z = ZSet.ofSeq a
    let w = WS.ofSeq sr a
    for k in [ "a"; "b"; "c"; "d"; "missing" ] do
        Assert.Equal(z.[k], WS.weight sr k w)
