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
