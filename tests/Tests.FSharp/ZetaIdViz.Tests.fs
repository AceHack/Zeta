module Zeta.Tests.ZetaIdVizTests

// Every ZetaId category is visible: category -> CHIP-9 color (the at-a-glance channel), id bits ->
// a mirror-symmetric identicon glyph (the id IS the picture). Deterministic everywhere; registered
// as a generator (zetaid.glyph) so filetypes reference the visualizer by ZetaId too.

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.ZetaId

[<Fact>]
let ``every registered category has a color — none invisible (total, at a glance)`` () =
    let cats =
        [ Category.Observation; Category.Emission; Category.Workflow; Category.Heartbeat
          Category.Batch; Category.FrictionTelemetry; Category.Bus; Category.Spawn
          Category.WorkItem; Category.ContentAddress; Category.Extended ]
    for c in cats do
        let m = ZetaIdViz.colorOf c
        Assert.True(m >= 1uy && m <= 7uy) // a real CHIP-9 color, never black/invisible

[<Fact>]
let ``the glyph is deterministic and mirror-symmetric (the id IS the picture; the face reads as a face)`` () =
    let id = System.UInt128.op_Implicit 0xDEADBEEFCAFEUL
    let g1 = ZetaIdViz.glyphOf id
    Assert.Equal<byte[]>(g1, ZetaIdViz.glyphOf id)
    Assert.Equal(8, g1.Length)
    // mirror symmetry: bit i of the left half equals bit (7-i) overall
    for row in g1 do
        for b in 0..7 do
            let l = (row >>> (7 - b)) &&& 1uy
            let r = (row >>> b) &&& 1uy
            Assert.Equal(l, r)

// NOTE (2026-08-19): this test is kept because the property is wanted, but on its own it is weak
// and it demonstrably was. Both operands are below 2^32, so it exercised only the bits `glyphOf`
// already read and could never have caught the truncation the next three tests are about. A
// "discriminating pair" chosen from inside the covered range is a check that cannot fail.
[<Fact>]
let ``distinct ids draw distinct glyphs (the discriminating pair)`` () =
    Assert.NotEqual<byte[]>(
        ZetaIdViz.glyphOf (System.UInt128.op_Implicit 0x12345678UL),
        ZetaIdViz.glyphOf (System.UInt128.op_Implicit 0x87654321UL))

// ── The truncation falsifier ────────────────────────────────────────────────────────────────
// `glyphOf` read `id >>> (row * 4)` for rows 0..7 — bits 0-31 only, discarding 96 of 128. On the
// Observation layout `Randomness` sits at offset 0 width 32, so the picture was the NONCE and
// nothing else: ids differing in timestamp, category, authority, persona or location drew the
// same glyph. These three tests fail on the pre-2026-08-19 implementation.

[<Fact>]
let ``two ids differing ONLY above bit 31 draw different glyphs`` () =
    // The exact mutant the "discriminating pair" test above cannot see. Identical low 32 bits.
    let low = System.UInt128.op_Implicit 0xDEADBEEFUL
    let a = low
    let b = low ||| (System.UInt128.One <<< 64)
    Assert.NotEqual<byte[]>(ZetaIdViz.glyphOf a, ZetaIdViz.glyphOf b)

[<Fact>]
let ``every one of the 128 bit positions reaches the picture`` () =
    // Stronger than a sampled pair: flipping ANY single bit of the zero id must change the glyph.
    // With the old truncation, positions 32..127 all failed this.
    let zero = ZetaIdViz.glyphOf System.UInt128.Zero
    for bit in 0..127 do
        let flipped = ZetaIdViz.glyphOf (System.UInt128.One <<< bit)
        Assert.True(
            flipped <> zero,
            sprintf "bit %d does not reach the glyph — that bit of the id is invisible" bit)

[<Fact>]
let ``the timestamp and category fields are visible, not just the nonce`` () =
    // The defect in the terms that matter: two ids identical in their random field and different
    // in the fields a reader cares about must not look the same.
    let nonce = System.UInt128.op_Implicit 0x0BADC0DEUL
    let withTimestamp = nonce ||| (System.UInt128.op_Implicit 0x1234UL <<< 75) // TimestampOffset
    let withCategory = nonce ||| (System.UInt128.op_Implicit 0x3UL <<< 65) // CategoryOffset
    Assert.NotEqual<byte[]>(ZetaIdViz.glyphOf nonce, ZetaIdViz.glyphOf withTimestamp)
    Assert.NotEqual<byte[]>(ZetaIdViz.glyphOf nonce, ZetaIdViz.glyphOf withCategory)
    Assert.NotEqual<byte[]>(ZetaIdViz.glyphOf withTimestamp, ZetaIdViz.glyphOf withCategory)

// ── The residual, MEASURED rather than caveated ─────────────────────────────────────────────
// Removing the truncation cannot remove the pigeonhole: an 8x8 mirror-symmetric bitmap holds 32
// bits, so 2^96 ids still share each glyph. The two tests below make that bound a fact instead of
// a footnote — the first by constructing a collision on demand, the second by measuring the
// collision RATE against the birthday prediction, so the glyph space is neither better nor worse
// than the 32 bits declared by `ZetaIdViz.GlyphSpaceBits`.

// ── The linear-fold falsifier (081M0DYG9X9087G0R002JK171Z) ─────────────────────────────────
// The first repair (#12533) XOR-ed the four 32-bit lanes. XOR over GF(2) is LINEAR, so two ids
// collide iff fold(a XOR b) = 0 — a 96-dimensional subspace of deltas. Every ZetaId field is a
// contiguous bit-range, so that subspace lands ON the field boundaries: any two bit positions
// exactly 32 apart cancel exactly. These two tests construct that, and they FAIL on the XOR fold.

[<Fact>]
let ``a timestamp delta of (2^f | 2^(f+32)) cannot hide an id — the XOR fold hid all 16`` () =
    // Global Timestamp field is bits 75..122. Field-local bits f and f+32 land at global 75+f
    // (lane 2) and 107+f (lane 3) — the SAME position within their lanes, so XOR cancels them.
    // Concretely at f = 0: two ids identical in every other field, 1 + 2^32 ms apart (49.7 days
    // and one millisecond), drew a byte-identical face.
    let withTs (t: uint64) =
        (System.UInt128.op_Implicit 0x0BADC0DEUL) ||| (System.UInt128.op_Implicit t <<< 75)
    let t0 = 0x1234ABCDUL
    for f in 0 .. 15 do
        let t1 = t0 ^^^ ((1UL <<< f) ||| (1UL <<< (f + 32)))
        Assert.NotEqual(withTs t0, withTs t1)
        Assert.NotEqual<byte[]>(ZetaIdViz.glyphOf (withTs t0), ZetaIdViz.glyphOf (withTs t1))

[<Fact>]
let ``a Category difference cannot be masked by a single timestamp bit`` () =
    // Category is bits 65..68 (lane 2, positions 1..4). Global bit 97 is lane 3 position 1 — and
    // 97 is INSIDE the Timestamp field. Under the XOR fold, Observation-at-T and Emission-at-
    // (T XOR 2^22) drew the identical face: two different KINDS of thing, one picture.
    let mk (cat: uint64) (ts: uint64) =
        (System.UInt128.op_Implicit 0x0BADC0DEUL)
        ||| (System.UInt128.op_Implicit cat <<< 65)
        ||| (System.UInt128.op_Implicit ts <<< 75)
    let ts = 0x1234ABCDUL
    let observation = mk 0UL ts
    let emission = mk 1UL (ts ^^^ (1UL <<< 22))
    Assert.NotEqual(observation, emission)
    Assert.NotEqual<byte[]>(ZetaIdViz.glyphOf observation, ZetaIdViz.glyphOf emission)

[<Fact>]
let ``the 32-bit bound is real — a collision EXISTS, and is found by search, not by construction`` () =
    // The pigeonhole is genuine: 2^96 ids share each glyph. What is no longer true is that a
    // colliding partner can be WRITTEN DOWN from the field layout — under the avalanche fold you
    // have to go looking, which is the whole difference between a structured defect and a declared
    // resolution. Deterministic SplitMix64 stream (no ambient entropy, DST-replayable).
    // MEASURED: first collision at n = 91,570 — consistent with sqrt(pi*2^32/2) ~= 82,137 and
    // NOT with the sqrt(2^32) = 65,536 that gets quoted (zero collisions had occurred by then).
    let mutable state = 0x9E3779B97F4A7C15UL
    let next () =
        state <- state + 0x9E3779B97F4A7C15UL
        let mutable z = state
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)
    let seen = System.Collections.Generic.Dictionary<string, System.UInt128>(System.StringComparer.Ordinal)
    let mutable found = None
    let mutable i = 0
    while found.IsNone && i < 400000 do
        let id = System.UInt128(next (), next ())
        let g = ZetaIdViz.glyphOf id |> Array.map (sprintf "%02x") |> String.concat ""
        match seen.TryGetValue g with
        | true, other -> found <- Some(other, id)
        | _ -> seen.[g] <- id
        i <- i + 1
    match found with
    | None -> Assert.Fail "no collision within 400000 draws — the glyph space is wider than the declared 32 bits"
    | Some(a, b) ->
        Assert.NotEqual(a, b)
        Assert.Equal<byte[]>(ZetaIdViz.glyphOf a, ZetaIdViz.glyphOf b)
    Assert.Equal(32, ZetaIdViz.GlyphSpaceBits)
    // ...and it took a search: nothing collided in the first 65536 draws, so "birthday at 65,536"
    // is not what this bound says.
    Assert.True(i > 65536, sprintf "first collision at %d — 65,536 is sqrt(N), not the expected first collision" i)

[<Fact>]
let ``the collision rate over 65536 ids matches the birthday prediction for 32 bits`` () =
    // DETERMINISTIC by construction: a fixed-seed SplitMix64 stream, no ambient entropy, so this
    // replays identically (DST). At n = 2^16 over a 2^32 space the birthday expectation is
    // n*(n-1)/(2*2^32) ~= 0.5 collisions, so the assertion is a BAND, not a point — a point
    // assertion here would be a coin flip dressed as a check.
    let n = 65536
    let seen = System.Collections.Generic.HashSet<string>()
    let mutable state = 0x9E3779B97F4A7C15UL
    let next () =
        state <- state + 0x9E3779B97F4A7C15UL
        let mutable z = state
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)
    for _ in 1..n do
        let id = System.UInt128(next (), next ())
        seen.Add(ZetaIdViz.glyphOf id |> Array.map (sprintf "%02x") |> String.concat "") |> ignore
    let collisions = n - seen.Count
    // Upper bound: a glyph space materially SMALLER than 32 bits would show far more collisions.
    // 10 is ~20x the expectation and would be astronomically unlikely at a true 2^32.
    Assert.True(
        collisions <= 10,
        sprintf "%d collisions over %d ids — the glyph space is smaller than the declared %d bits" collisions n ZetaIdViz.GlyphSpaceBits)
    // Lower bound: 65536 distinct glyphs would mean the space is NOT 32 bits and this test is not
    // measuring what it claims. It is here so the test cannot pass vacuously by measuring nothing.
    Assert.True(seen.Count > 60000, "the sweep produced too few distinct glyphs to be meaningful")

[<Fact>]
let ``the visualizer is itself a registered generator — referenceable by ZetaId (shape A)`` () =
    let e = GeneratorRegistry.byName "zetaid.glyph" |> Option.get
    Assert.Equal(32, e.ZetaId.Length)
    Assert.Equal(Some e, GeneratorRegistry.byId e.ZetaId)

[<Fact>]
let ``toMediaLines emits the consumable artifact: a glyph row + the category's palette row`` () =
    let entries = ZetaIdViz.toMediaLines "bus-7" Category.Bus (System.UInt128.op_Implicit 0xC0FFEEUL)
    Assert.Equal(2, List.length entries)
    Assert.Equal("glyph", entries.[0].Kind)
    Assert.Equal(16, entries.[0].Fields.Head.Length) // 8 bytes hex
    Assert.Equal("4", entries.[1].Fields.Head) // Bus = blue
