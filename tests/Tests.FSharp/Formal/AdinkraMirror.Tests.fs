module Zeta.Tests.Formal.AdinkraMirrorTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// AdinkraMirror (`src/Core/AdinkraMirror.fs`) — layer one of the adinkra
// unfold: the [8,4,4] doubly-even self-dual code. The MIRROR (C = C⊥),
// doubly-even, and the generator IS the ECC (generation = correction).
// Anchors: Gates adinkras / doubly-even self-dual codes; ext. Hamming.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``the code has 16 distinct codewords, including zero`` () =
    AdinkraMirror.codewords.Length |> should equal 16
    (AdinkraMirror.codewords |> Array.distinct |> Array.length) |> should equal 16
    AdinkraMirror.codewords |> Array.contains 0 |> should equal true

[<Fact>]
let ``doubly-even — every codeword weight is a multiple of 4`` () =
    AdinkraMirror.isDoublyEven |> should equal true
    AdinkraMirror.codewords
    |> Array.iter (fun c -> (AdinkraMirror.weight c % 4) |> should equal 0)

[<Fact>]
let ``self-dual — the MIRROR: the code is its own dual (C = C⊥)`` () =
    AdinkraMirror.isSelfOrthogonal |> should equal true
    AdinkraMirror.isSelfDual |> should equal true

[<Fact>]
let ``minimum distance is 4`` () =
    AdinkraMirror.minDistance |> should equal 4

[<Fact>]
let ``the generator IS the ECC: codewords have zero syndrome; a single-bit error does not`` () =
    AdinkraMirror.codewords |> Array.iter (fun c -> AdinkraMirror.isCodeword c |> should equal true)
    // flip one bit of a codeword ⇒ no longer a codeword (the generator detects it)
    let c = AdinkraMirror.codewords.[5]
    AdinkraMirror.isCodeword (c ^^^ 0b1) |> should equal false

[<Fact>]
let ``single-error correction recovers every codeword (generation = correction)`` () =
    for c in AdinkraMirror.codewords do
        for p in 0 .. AdinkraMirror.n - 1 do
            AdinkraMirror.correct (c ^^^ (1 <<< p)) |> should equal (Some c)
    // a clean codeword corrects to itself
    let c3 = AdinkraMirror.codewords.[3]
    AdinkraMirror.correct c3 |> should equal (Some c3)
