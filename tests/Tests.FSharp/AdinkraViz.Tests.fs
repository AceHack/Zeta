module Zeta.Tests.AdinkraVizTests

// Seeing the adinkra: the gray-code 4x4 is a perfect boson/fermion checkerboard; every edge carries
// exactly one generator's color (four colors = our four channels); the SHINE selects one generator
// out of the superposition (bright in its channel, the rest dimmed) — the prism, working.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``the gray layout is lawful: grid-adjacent nodes differ in exactly one bit (every edge has ONE color)`` () =
    for row in 0..3 do
        for col in 0..2 do
            let d = AdinkraViz.nodeAt col row ^^^ AdinkraViz.nodeAt (col + 1) row
            Assert.Equal(1, System.Numerics.BitOperations.PopCount(uint d))
    for row in 0..2 do
        for col in 0..3 do
            let d = AdinkraViz.nodeAt col row ^^^ AdinkraViz.nodeAt col (row + 1)
            Assert.Equal(1, System.Numerics.BitOperations.PopCount(uint d))

[<Fact>]
let ``the boson/fermion CHECKERBOARD is visible: parity alternates at every step (filled/open)`` () =
    let lines = AdinkraViz.render None
    Assert.Equal(7, List.length lines) // 4 node rows + 3 edge rows
    let parity c r = System.Numerics.BitOperations.PopCount(uint (AdinkraViz.nodeAt c r)) % 2
    for r in 0..3 do
        for c in 0..2 do
            Assert.NotEqual(parity c r, parity (c + 1) r) // one bit flip = parity flip: checkerboard

[<Fact>]
let ``all FOUR generator colors appear (R, G, B, cyan — the N=4 chromotopology on our channels)`` () =
    let all = AdinkraViz.render None |> String.concat "\n"
    for c in [ 1; 2; 4; 6 ] do
        Assert.Contains(sprintf "[3%dm" c, all)

[<Fact>]
let ``THE SHINE: selecting a generator brightens its edges and DIMS the other three (the prism)`` () =
    let shone = AdinkraViz.render (Some 2) |> String.concat "\n"
    Assert.Contains("[34m", shone) // bit 2's color (blue, 4) still bright
    Assert.Contains("[2m", shone) // and dimming exists — the unselected generators recede
    // the unselected generator colors are NOT bright (they are dimmed, so their bright color codes do not appear)
    Assert.DoesNotContain("[31m", shone)
    Assert.DoesNotContain("[32m", shone)
    Assert.DoesNotContain("[36m", shone)
    let unshone = AdinkraViz.render None |> String.concat "\n"
    Assert.DoesNotContain("[2m", unshone) // no shine: nothing dimmed, all four live together

[<Fact>]
let ``deterministic + registered + cost-declared (the budget lint holds)`` () =
    Assert.Equal<string list>(AdinkraViz.render (Some 1), AdinkraViz.render (Some 1))
    Assert.True(GeneratorRegistry.byName "viz.adinkra" |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())

[<Fact>]
let ``THE GATES CONDITION: the standard dashing puts an ODD number of dashes on every 2-colored 4-cycle (anticommutation, drawn)`` () =
    Assert.True(AdinkraViz.allFacesOdd AdinkraViz.standardDashing)
    Assert.Equal(32, List.length AdinkraViz.allEdges)
    // and it is a real dashing, not all-solid (all-solid would make every face EVEN — count 0)
    Assert.False(Set.isEmpty AdinkraViz.standardDashing)

[<Fact>]
let ``THE GAUGE LEMMA: no local move removes the twist — vertex flips change the dashing but every face stays ODD (the adinkra's stuck law)`` () =
    // flip a handful of vertices in sequence (deterministic walk); the parity law must survive all of them
    let walked =
        [ 0; 5; 10; 15; 3; 12 ]
        |> List.fold (fun d v -> AdinkraViz.flipVertex v d) AdinkraViz.standardDashing
    Assert.NotEqual<Set<int * int>>(AdinkraViz.standardDashing, walked) // the dashing genuinely changed
    Assert.True(AdinkraViz.allFacesOdd walked) // the twist did not — same sentence as THE STUCK LAW
    // THE FALSIFIER (Kira P2: a gate never seen rejecting proves nothing): the all-solid dashing
    // makes every face EVEN (count 0) and must FAIL the Gates condition
    Assert.False(AdinkraViz.allFacesOdd Set.empty)

// ── QUOTIENT CODE ≠ DASHING TORSOR ────────────────────────────────────────────────────────────
//
// `AdinkraViz.fs`'s header used to call dashings "the actual Hamming-code content of AdinkraCode".
// That is false, and these tests are the falsifier for it. An adinkra carries TWO independent GF(2)
// data on two layers (Doran–Faux–Gates–Hübsch–Iga–Landweber, *Codes and supersymmetry in one
// dimension*, ATMP 15 (2011) 1909):
//
//   CODE     C ⊆ F₂^N — a LINEAR SUBSPACE, fixes the chromotopology (the quotient F₂^N / C).
//   DASHING  an odd 1-cochain on that graph — a TORSOR over the vertex-flip gauge group.
//
// They are linked by an EXISTENCE theorem (doubly-evenness of C is what lets a dashing exist on the
// quotient), never by identity. The trap that let the mislabel survive: BOTH graphs have 16 nodes.
// Node count cannot discriminate them; VALENCE can (4 vs 8).

module private TwoLayers =
    /// Edges of a vertex-flip, as a bitmask over the `allEdges` index — `flipVertex v` is XOR by this.
    let edgeIndex = AdinkraViz.allEdges |> List.mapi (fun i e -> e, i) |> Map.ofList

    let maskOf (d: AdinkraViz.Dashing) : int =
        d |> Set.fold (fun acc e -> acc ||| (1 <<< edgeIndex.[e])) 0

    /// The 16 gauge generators g_v, read out of `flipVertex` itself (no re-derivation).
    let gaugeGenerators : int list =
        [ for v in 0..15 -> maskOf (AdinkraViz.flipVertex v Set.empty) ]

    /// GF(2) rank of a set of 32-bit masks (index-based elimination — duplicate rows are safe).
    let rank (rows: int list) : int =
        let rs = List.toArray rows
        let mutable r = 0
        for b in 0..31 do
            let mutable p = -1
            for k in r .. rs.Length - 1 do
                if p < 0 && ((rs.[k] >>> b) &&& 1) = 1 then p <- k
            if p >= 0 then
                let t = rs.[r] in rs.[r] <- rs.[p]
                rs.[p] <- t
                for k in 0 .. rs.Length - 1 do
                    if k <> r && ((rs.[k] >>> b) &&& 1) = 1 then rs.[k] <- rs.[k] ^^^ rs.[r]
                r <- r + 1
        r

[<Fact>]
let ``QUOTIENT CODE ≠ DASHING TORSOR: 16 codewords vs 32768 dashings — a code contains 0, a torsor has no zero`` () =
    // ── the CODE layer: a linear subspace, so it CONTAINS the zero word ──
    Assert.Equal(16, List.length AdinkraCode.allCodewords)
    Assert.True(
        AdinkraCode.allCodewords |> List.exists (fun c -> AdinkraCode.weight c = 0),
        "a linear code contains the all-zero word"
    )

    // ── the DASHING layer: a torsor, so it has NO zero — all-solid is not a dashing ──
    // `flipVertex v` is XOR by a fixed 4-edge mask, so the gauge orbit is an affine space; its
    // dimension is the GF(2) rank of the 16 generators. Rank 15, not 16: the one relation is that
    // flipping ALL 16 vertices toggles every edge twice = identity.
    for v in 0..15 do
        let expected = TwoLayers.maskOf AdinkraViz.standardDashing ^^^ List.item v TwoLayers.gaugeGenerators
        Assert.Equal(expected, TwoLayers.maskOf (AdinkraViz.flipVertex v AdinkraViz.standardDashing))

    Assert.Equal(15, TwoLayers.rank TwoLayers.gaugeGenerators)
    Assert.Equal(32768, pown 2 (TwoLayers.rank TwoLayers.gaugeGenerators))
    Assert.False(AdinkraViz.allFacesOdd Set.empty) // the torsor's missing zero, stated as a refusal

    // the two cardinalities are not the same number — the first thing the old sentence required
    Assert.NotEqual<int>(List.length AdinkraCode.allCodewords, pown 2 (TwoLayers.rank TwoLayers.gaugeGenerators))

[<Fact>]
let ``NODE COUNT CANNOT DISCRIMINATE, VALENCE CAN: both graphs have 16 nodes; AdinkraViz is 4-regular/32 edges, the [8,4,4] quotient is 8-regular/64 edges`` () =
    // ── AdinkraViz's graph: the bare 4-cube (N = 4, trivial code C = {0}) ──
    let vizNodes = 16
    let vizEdges = List.length AdinkraViz.allEdges
    let vizValence =
        [ 0..15 ]
        |> List.map (fun v ->
            AdinkraViz.allEdges
            |> List.filter (fun (a, b) -> a = v || (a ^^^ (1 <<< b)) = v)
            |> List.length)
    Assert.Equal(32, vizEdges)
    Assert.Equal<int list>(List.replicate 16 4, vizValence) // 4-regular
    Assert.Equal(vizEdges, vizNodes * 4 / 2)

    // ── AdinkraCode's graph: F₂⁸ quotiented by the [8,4,4] code (N = 8) ──
    let codeMasks =
        AdinkraCode.allCodewords
        |> List.map (fun cw -> Array.fold (fun acc b -> (acc <<< 1) ||| (b &&& 1)) 0 cw)
    let cosets = [ 0..255 ] |> List.map (fun v -> codeMasks |> List.map ((^^^) v) |> List.min) |> List.distinct
    let quotientNodes = List.length cosets
    // one edge colour per SUSY generator: 8 colours at N = 8, so the quotient graph is 8-regular
    let quotientValence = 8
    let quotientEdges = quotientNodes * quotientValence / 2
    Assert.Equal(16, quotientNodes)
    Assert.Equal(64, quotientEdges)

    // ── THE DISCRIMINATOR (numerology-vs-number-theory): 16 = 16 identifies nothing; 4 ≠ 8 does ──
    Assert.Equal(vizNodes, quotientNodes) // node count: NOT a discriminator
    Assert.NotEqual<int>(List.head vizValence, quotientValence) // valence: IS one
    Assert.NotEqual<int>(vizEdges, quotientEdges)
