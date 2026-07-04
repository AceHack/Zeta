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
