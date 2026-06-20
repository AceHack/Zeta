module Zeta.Tests.Formal.CliffordE8BridgeTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// CliffordE8Bridge (`src/Core/CliffordE8Bridge.fs`) — the middle of the
// adinkra → Clifford → E8 unfold. The map E8-coordinate ↔ Cl(3,0) blade
// (both 3-bit-mask indexed) is a LINEAR ISOMETRY: it preserves addition
// and norm², carries the 240 roots to 240 distinct multivectors of norm²
// = 4, and grades the 8 coordinates into 1+3+3+1. (It does NOT claim the
// geometric product generates the root system — that stays open.)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``root↔multivector round-trips for all 240 E8 roots`` () =
    for r in E8Lattice.roots do
        Assert.Equal<int[]>(r, CliffordE8Bridge.mvToRoot (CliffordE8Bridge.rootToMv r))

[<Fact>]
let ``the bridge is an ISOMETRY — Cl(3,0) norm² equals the E8 integer norm² (both 4) for every root`` () =
    for r in E8Lattice.roots do
        let lhs = Cl3.normSq (CliffordE8Bridge.rootToMv r)
        Assert.True(abs (lhs - float (E8Lattice.normSq r)) < 1e-9)
        Assert.True(abs (lhs - 4.0) < 1e-9) // every E8 root has norm² 4

[<Fact>]
let ``the 240 roots map to 240 distinct multivectors`` () =
    let distinct = CliffordE8Bridge.rootMvs |> List.distinct
    Assert.Equal(240, List.length CliffordE8Bridge.rootMvs)
    Assert.Equal(240, List.length distinct)

[<Fact>]
let ``the bridge is LINEAR — rootToMv(a+b) = rootToMv a + rootToMv b`` () =
    // exhaustive over a representative cross-section: every root against the first 8 roots
    let roots = List.toArray E8Lattice.roots
    for a in roots do
        for b in Array.truncate 8 roots do
            let sum = Array.map2 (+) a b
            let viaSum = CliffordE8Bridge.rootToMv sum
            let viaParts = Cl3.add (CliffordE8Bridge.rootToMv a) (CliffordE8Bridge.rootToMv b)
            Assert.True(Cl3.normSq (Cl3.sub viaSum viaParts) < 1e-9)

[<Fact>]
let ``the grade labeling partitions the 8 coordinates into 1 + 3 + 3 + 1 (scalar·vectors·bivectors·pseudoscalar)`` () =
    let counts =
        [ 0 .. 7 ]
        |> List.countBy CliffordE8Bridge.gradeOfCoord
        |> List.sortBy fst
    Assert.Equal<(int * int) list>([ (0, 1); (1, 3); (2, 3); (3, 1) ], counts)
