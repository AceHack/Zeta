module Zeta.Tests.AdinkraCodeTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module AK = Zeta.Core.AdinkraCode

// ═══════════════════════════════════════════════════════════════════
// AdinkraCode — the concrete Adinkra generator (the [8,4] extended Hamming code).
// Adinkras ↔ doubly-even binary codes (Gates/Iga et al.): every codeword has weight ≡ 0 (mod 4). Proven
// exhaustively over all 16 codewords: doubly-even, linear, minimum distance 4, generator rows are
// weight-4 codewords. Identifies the concrete generator (published correspondence); the imaginary-stack
// mul-table → this-exact-generator derivation stays open (§B).
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``the code is doubly-even — every codeword has weight divisible by 4`` () =
    for c in AK.allCodewords do
        Assert.Equal(0, AK.weight c % 4)

[<Fact>]
let ``minimum distance is 4 — every nonzero codeword has weight >= 4`` () =
    let nonzeroWeights = AK.allCodewords |> List.map AK.weight |> List.filter (fun w -> w > 0)
    Assert.Equal(4, List.min nonzeroWeights)

[<Fact>]
let ``each generator row is a weight-4 codeword`` () =
    for row in AK.generator do
        Assert.Equal(4, AK.weight row)

[<Fact>]
let ``the code has 16 distinct codewords (dimension 4, injective encode)`` () =
    let distinct = AK.allCodewords |> List.map List.ofArray |> List.distinct
    Assert.Equal(16, List.length distinct)

// linearity: encode is GF(2)-linear (exhaustive over all 16×16 message pairs).
[<Fact>]
let ``encode is linear — encode (m1 xor m2) = encode m1 xor encode m2`` () =
    for m1 in AK.allMessages do
        for m2 in AK.allMessages do
            let lhs = AK.encode (AK.xor m1 m2)
            let rhs = AK.xor (AK.encode m1) (AK.encode m2)
            Assert.Equal<int[]>(lhs, rhs)

// doubly-even is closed under the code's XOR (a consequence, but worth pinning via FsCheck on indices).
[<Property>]
let ``xor of two codewords stays doubly-even`` (i: int) (j: int) =
    let n = List.length AK.allCodewords
    let a = AK.allCodewords.[((i % n) + n) % n]
    let b = AK.allCodewords.[((j % n) + n) % n]
    AK.weight (AK.xor a b) % 4 = 0

// ── Self-duality: the gen(gen)===gen fixed point at the code level (Face 1) ──
// The dual map C ↦ C⊥ is an involution; a self-dual code is its fixed point (dual C = C). Proven via
// the standard criterion: self-orthogonal (C ⊆ C⊥) AND dim C = n/2 ⇒ C = C⊥.

[<Fact>]
let ``code is self-orthogonal — every pair of codewords is GF(2)-orthogonal (C subset of C-perp)`` () =
    for a in AK.allCodewords do
        for b in AK.allCodewords do
            Assert.Equal(0, AK.dot a b)

[<Fact>]
let ``dimension is half the length — dim C = n/2 (forces C-perp subset of C)`` () =
    Assert.Equal(AK.length, 2 * AK.dimension)

[<Fact>]
let ``the code is self-dual — the gen(gen)=gen duality fixed point (C = C-perp)`` () =
    Assert.True(AK.isSelfDual)

// ── Codespace projector Π: the gen(gen)===gen idempotent endomorphism (Face 2) ──
// Π(v) = encode(v[0..k-1]) — re-encode the systematic part. Projector onto C along the parity complement.
// Exhaustive over all 2^8 = 256 words.

let private allWords8 : int[] list =
    [ for w in 0 .. 255 -> [| for i in 0 .. AK.length - 1 -> (w >>> i) &&& 1 |] ]

[<Fact>]
let ``projector is idempotent — Pi(Pi v) = Pi v for all 256 words (gen(gen)=gen)`` () =
    for v in allWords8 do
        Assert.Equal<int[]>(AK.project v, AK.project (AK.project v))

[<Fact>]
let ``projector image is the code — Pi v is always a codeword`` () =
    let codeSet = AK.allCodewords |> List.map List.ofArray |> Set.ofList
    for v in allWords8 do
        Assert.True(codeSet.Contains(List.ofArray (AK.project v)))

[<Fact>]
let ``projector fixes every codeword — Pi c = c for c in C`` () =
    for c in AK.allCodewords do
        Assert.Equal<int[]>(c, AK.project c)

[<Fact>]
let ``projector is GF(2)-linear — Pi(a xor b) = Pi a xor Pi b (exhaustive over 256x256 words)`` () =
    for a in allWords8 do
        for b in allWords8 do
            Assert.Equal<int[]>(AK.project (AK.xor a b), AK.xor (AK.project a) (AK.project b))

// ── Error-correction: the generator IS the ECC (the decoding side; generation = correction) ──
// Self-dual ⇒ H = G, so the generator that emits the code also checks/repairs it (the code-level backstop
// for Kestrel's homoiconicity proof / the Futamura gen(gen)=gen self-hosting fixpoint).

[<Fact>]
let ``codewords have zero syndrome; a single-bit error is detected (generator IS the parity check)`` () =
    for c in AK.allCodewords do
        Assert.True(AK.isCodeword c)
    let e = Array.copy AK.allCodewords.[5]
    e.[0] <- e.[0] ^^^ 1
    Assert.False(AK.isCodeword e)

[<Fact>]
let ``single-error correction recovers every codeword (generation = correction)`` () =
    for c in AK.allCodewords do
        for p in 0 .. AK.length - 1 do
            let e = Array.copy c
            e.[p] <- e.[p] ^^^ 1
            Assert.Equal<int[]>(c, (AK.correct e).Value)
    // a clean codeword corrects to itself
    Assert.Equal<int[]>(AK.allCodewords.[3], (AK.correct AK.allCodewords.[3]).Value)

// ── Erasure identifiability: independent oracle for the UDP durable-evidence seam ─────────────

[<Fact>]
let ``all 256 erasure masks have the independent 844 identifiability census`` () =
    Assert.Equal<(int * int * int) list>(
        [ 0, 1, 1
          1, 8, 8
          2, 28, 28
          3, 56, 56
          4, 56, 70
          5, 0, 56
          6, 0, 28
          7, 0, 8
          8, 0, 1 ],
        AK.erasureCensus)

[<Fact>]
let ``the fourteen ambiguous four-erasure masks are exactly nonzero weight-four codeword supports`` () =
    let weightFourSupports =
        AK.allCodewords
        |> List.filter (fun word -> AK.weight word = 4)
        |> List.map (fun word ->
            word
            |> Array.mapi (fun index bit -> if bit = 0 then 0 else 1 <<< index)
            |> Array.fold (|||) 0)
        |> Set.ofList

    let classifiedAmbiguous =
        [ 0 .. 255 ]
        |> List.filter (fun mask ->
            let result = AK.classifyErasureMask mask
            result.Status = AK.AmbiguousCodewordSupport)
        |> Set.ofList

    Assert.Equal(14, weightFourSupports.Count)
    Assert.Equal<Set<int>>(weightFourSupports, classifiedAmbiguous)

[<Fact>]
let ``ambiguity witness: two distinct codewords agree on every survivor of a codeword-support erasure`` () =
    let zero = AK.allCodewords |> List.find (fun word -> AK.weight word = 0)
    let alternative = AK.allCodewords |> List.find (fun word -> AK.weight word = 4)
    let erasedMask =
        alternative
        |> Array.mapi (fun index bit -> if bit = 0 then 0 else 1 <<< index)
        |> Array.fold (|||) 0

    let result = AK.classifyErasureMask erasedMask
    Assert.Equal(AK.AmbiguousCodewordSupport, result.Status)
    Assert.NotEqual<int[]>(zero, alternative)
    for position in 0 .. AK.length - 1 do
        if (erasedMask &&& (1 <<< position)) = 0 then
            Assert.Equal(zero.[position], alternative.[position])

[<Fact>]
let ``erasure classifier refuses masks outside the eight-coordinate domain`` () =
    Assert.Throws<System.ArgumentException>(fun () -> AK.classifyErasureMask -1 |> ignore)
    |> ignore
    Assert.Throws<System.ArgumentException>(fun () -> AK.classifyErasureMask 256 |> ignore)
    |> ignore

// ── Independent representation-defect spectrum oracle ─────────────────────────────────────────

[<Fact>]
let ``full coded colour algebra has defect sixteen from independent code dimensions`` () =
    Assert.Equal(256, AK.fullOperatorDimension)
    Assert.Equal(16, AK.adinkraNodes)
    Assert.Equal(16, AK.homoiconicityDefect)
    Assert.Equal(AK.allCodewords.Length, AK.homoiconicityDefect)

[<Fact>]
let ``four-colour residue has fifty-six working subsets and no canonical colour`` () =
    let candidates, working, failing = AK.colourResidueCensus
    Assert.Equal(70, candidates)
    Assert.Equal(56, working)
    Assert.Equal(14, failing)
    Assert.Equal<int list>([ 28; 28; 28; 28; 28; 28; 28; 28 ], AK.colourResidueInclusionCounts)

[<Fact>]
let ``weight-four codeword supports are exactly the failing residue subsets`` () =
    let failingMasks =
        AK.colourResidueClassifications
        |> List.filter (fun row -> not row.FreeRankOne)
        |> List.map (fun row -> row.ColourMask)
        |> Set.ofList

    let weightFourSupports =
        AK.allCodewords
        |> List.filter (fun word -> AK.weight word = 4)
        |> List.map (fun word ->
            word
            |> Array.mapi (fun index bit -> if bit = 0 then 0 else 1 <<< index)
            |> Array.fold (|||) 0)
        |> Set.ofList

    Assert.Equal<Set<int>>(weightFourSupports, failingMasks)

[<Fact>]
let ``spinor lane refuses a numerical defect without an operator carrier map`` () =
    match AK.bivectorSpinorRegularity with
    | AK.Unmeasured witnesses ->
        Assert.Equal(4, witnesses.Length)
        Assert.Contains("declared carrier module", witnesses)
    | AK.Measured _ -> failwith "spinor lane must remain unmeasured without a carrier map"

// ── MacWilliams fixed-point: gen(gen)=gen at the weight-enumerator level ─────────────────────────
// The MacWilliams transform maps W_C to W_{C⊥}. For a self-dual code (C = C⊥), the transform is
// a fixed point: W_C = MacWilliams(W_C). This is the algebraic statement of gen(gen)=gen at the
// weight-enumerator level — the code's self-duality guarantees the Hadamard/Krawtchouk transform
// of the weight distribution is the weight distribution itself.

[<Fact>]
let ``weight enumerator has the correct distribution: 1 at weight 0, 14 at weight 4, 1 at weight 8`` () =
    let we = AK.weightEnumerator
    Assert.Equal(3, we.Length)  // only three non-zero weight classes
    let weMap = we |> Map.ofList
    Assert.Equal(1,  weMap.[0])   // 1 codeword of weight 0 (the zero codeword)
    Assert.Equal(14, weMap.[4])   // 14 codewords of weight 4
    Assert.Equal(1,  weMap.[8])   // 1 codeword of weight 8 (the all-ones codeword)

[<Fact>]
let ``MacWilliams transform is a fixed point for the self-dual code (gen(gen)=gen at weight-enumerator level)`` () =
    Assert.True(AK.isMacWilliamsFixedPoint,
        "MacWilliams(W_C) should equal W_C for a self-dual code — the weight enumerator is its own dual")

[<Fact>]
let ``MacWilliams transform of weight enumerator matches the known formula x^8 + 14x^4y^4 + y^8`` () =
    // The [8,4] doubly-even self-dual code has the unique weight enumerator:
    // W(x,y) = x^8 + 14·x^4·y^4 + y^8 (the Hamming/Golay weight enumerator at n=8).
    // Applying MacWilliams should return the same polynomial.
    let transformed = AK.macWilliamsTransform AK.weightEnumerator |> Map.ofList
    // Coefficient of y^0 (weight 0) = 1.0
    Assert.InRange(transformed |> Map.tryFind 0 |> Option.defaultValue 0.0, 0.9999, 1.0001)
    // Coefficient of y^4 (weight 4) = 14.0
    Assert.InRange(transformed |> Map.tryFind 4 |> Option.defaultValue 0.0, 13.9999, 14.0001)
    // Coefficient of y^8 (weight 8) = 1.0
    Assert.InRange(transformed |> Map.tryFind 8 |> Option.defaultValue 0.0, 0.9999, 1.0001)
    // All other weight classes should be zero (or absent)
    for w in [1;2;3;5;6;7] do
        let c = transformed |> Map.tryFind w |> Option.defaultValue 0.0
        Assert.InRange(c, -1e-6, 1e-6)

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// N IS THE CODE LENGTH, NOT THE DIMENSION (2026-08-15).
//
// `AdinkraCode.fs` and `BitAdinkra.fs` labelled this code "N=4" for its whole life. That 4 is `k`,
// the dimension, read as `N`. Nothing checked the label, which is why it survived — so these tests
// pin it, and they pin it STRUCTURALLY rather than by restating the constant: the quotient graph is
// built from the codewords and MEASURED. Mutating `supercharges`, `adinkraNodes`, `adinkraValence`
// or `anticommutingPairs` fails at least one of them.
//
// The coincidence that hid the error is named explicitly below: this adinkra and the plain 4-cube
// adinkra of `AdinkraViz.fs` BOTH have 16 nodes. Node count does not discriminate. Valence does.
//
// Existence (the other invariant) is already pinned in `AdinkraIdentity.Tests.fs`
// ("WHY N=8: the minimal length of a doubly-even self-dual code") — lengths 2/4/6 exhaustively
// yield nothing, length 8 yields this code. It is not duplicated here.
//
// Anchor: Doran, Faux, Gates, Hübsch, Iga, Landweber, *Relating doubly-even error-correcting codes,
// graphs, and irreducible representations of N-extended supersymmetry* (J. Phys. A 41, 2008;
// arXiv:0806.0051) — N colours, N-cube quotient, code length = N. Gleason / Mallows–Sloane —
// doubly-even self-dual ⇒ length ≡ 0 (mod 8).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/// Codewords as bitmasks over GF(2)^n (bit i = coordinate i).
let private codeMasks : int list =
    AK.allCodewords |> List.map (fun c -> Array.foldBack (fun b acc -> (acc <<< 1) ||| (b &&& 1)) c 0)

/// Canonical representative of the coset v + C — the quotient GF(2)^n / C is the adinkra's nodes.
let private coset (v: int) : int = codeMasks |> List.map (fun c -> v ^^^ c) |> List.min

[<Fact>]
let ``N is the code LENGTH: the quotient GF(2)^N / C is N-regular, so valence = 8 = length, not 4 = dimension`` () =
    // The adinkra is the N-cube quotiented by C; its edge colours ARE the N coordinates. The
    // quotient is N-regular exactly when the N weight-1 vectors fall in N distinct cosets, which
    // holds because d = 4 >= 3. Valence is therefore N, measured rather than asserted.
    let nodes = [ 0 .. (1 <<< AK.length) - 1 ] |> List.map coset |> List.distinct
    let valences =
        nodes
        |> List.map (fun u -> [ 0 .. AK.length - 1 ] |> List.map (fun i -> coset (u ^^^ (1 <<< i))) |> List.distinct |> List.length)
        |> List.distinct
    Assert.Equal<int list>([ AK.length ], valences)              // every node: exactly 8 distinct neighbours
    Assert.Equal(AK.supercharges, List.exactlyOne valences)      // N = measured valence
    Assert.Equal(AK.adinkraValence, List.exactlyOne valences)
    Assert.Equal(8, AK.supercharges)
    Assert.NotEqual(AK.dimension, AK.supercharges)               // the conflation this test exists to block

[<Fact>]
let ``node count 2^(N-k) = 16 does NOT identify the adinkra — the 4-cube has 16 nodes too; valence separates them`` () =
    // numerology-vs-number-theory, in place: 16 is a count both objects share, which is exactly why
    // "N=4" survived. The 4-cube (AdinkraViz.fs) is 4-regular with 32 edges; this one is 8-regular
    // with 64. Same cardinality, different structure.
    let nodes = [ 0 .. (1 <<< AK.length) - 1 ] |> List.map coset |> List.distinct
    Assert.Equal(AK.adinkraNodes, List.length nodes)
    Assert.Equal(16, AK.adinkraNodes)
    Assert.Equal(16, 1 <<< 4)                                    // the 4-cube's node count — the same number
    let edges = List.length nodes * AK.adinkraValence / 2
    Assert.Equal(64, edges)                                      // the 4-cube has 32; this is the discriminator
    Assert.NotEqual(4 * (1 <<< 4) / 2, edges)

[<Fact>]
let ``anticommuting supercharge pairs are C(N,2) = C(8,2) = 28 — the retired N=4 label would have given 6`` () =
    // {Q_I, Q_J} for I < J, one pair per unordered pair of edge colours.
    let pairsFromColours =
        [ for i in 0 .. AK.supercharges - 1 do for j in i + 1 .. AK.supercharges - 1 -> (i, j) ]
    Assert.Equal(AK.anticommutingPairs, List.length pairsFromColours)
    Assert.Equal(28, AK.anticommutingPairs)
    Assert.NotEqual(4 * 3 / 2, AK.anticommutingPairs)            // 6 — the value the "N=4" label implied

[<Fact>]
let ``boson/fermion bipartition is well-defined on the quotient and splits 8/8 — a 16-node N=8 adinkra`` () =
    // Coordinate-weight parity descends to the quotient iff every codeword has EVEN weight, which
    // doubly-even gives for free. So the 16 nodes are 8 bosons + 8 fermions.
    let parity = System.Collections.Generic.Dictionary<int, int>()
    let mutable wellDefined = true
    for v in 0 .. (1 <<< AK.length) - 1 do
        let c = coset v
        let p = (System.Numerics.BitOperations.PopCount(uint32 v)) % 2
        match parity.TryGetValue c with
        | true, q -> if q <> p then wellDefined <- false
        | _ -> parity.[c] <- p
    Assert.True(wellDefined, "weight parity must descend to GF(2)^8 / C (every codeword has even weight)")
    let bosons = parity.Values |> Seq.filter (fun p -> p = 0) |> Seq.length
    let fermions = parity.Values |> Seq.filter (fun p -> p = 1) |> Seq.length
    Assert.Equal(AK.adinkraNodes / 2, bosons)
    Assert.Equal(AK.adinkraNodes / 2, fermions)
    Assert.Equal(8, bosons)
