module Zeta.Tests.BinaryCodeTests

open global.Xunit
open Zeta.Core

module BC = Zeta.Core.BinaryCode

// ═══════════════════════════════════════════════════════════════════
// BinaryCode — the Adinkra graph object built from the [8,4,4] extended Hamming code.
// Where AdinkraCode identifies the concrete generator, BinaryCode constructs the full
// H_8 / C quotient: 16 coset vertices, colored signed edges, and the GF(2)-solved
// well-dashing (every 2-colored 4-cycle has edge-sign product -1 — the Gates odd-face
// condition). This is the computational form of the hand-drawn 2015 Tree-of-Life diagram.
// ═══════════════════════════════════════════════════════════════════

let private code = BC.extendedHamming ()

// ── BinaryVector F_2^8 algebra ──────────────────────────────────────

[<Fact>]
let ``addition is XOR and multiplication is AND (F_2^8)`` () =
    let a = BinaryVector(0b10110uy)
    let b = BinaryVector(0b01100uy)
    Assert.Equal((a + b).Value, a.Value ^^^ b.Value)
    Assert.Equal((a * b).Value, a.Value &&& b.Value)

[<Fact>]
let ``weight counts set bits and dot is mod-2 intersection parity`` () =
    Assert.Equal(4, BinaryVector(0b11110000uy).Weight)
    // overlapping in 2 bits -> even -> 0
    Assert.Equal(0, BinaryVector.Dot(BinaryVector(0b0111uy), BinaryVector(0b1110uy)))
    // overlapping in 1 bit -> odd -> 1
    Assert.Equal(1, BinaryVector.Dot(BinaryVector(0b0011uy), BinaryVector(0b0110uy)))

[<Fact>]
let ``FromBits round-trips through GetBit`` () =
    let bits = [| true; false; true; true; false; false; false; true |]
    let v = BinaryVector.FromBits(bits)
    for i in 0 .. 7 do
        Assert.Equal(bits.[i], v.GetBit(i))

// ── The [8,4,4] extended Hamming code ───────────────────────────────

[<Fact>]
let ``code has exactly 16 codewords`` () =
    Assert.Equal(16, code.Codewords.Count)

[<Fact>]
let ``code is doubly-even — every codeword weight divisible by 4`` () =
    Assert.True(code.IsDoublyEven)

[<Fact>]
let ``code is self-dual — C = C perp`` () =
    Assert.True(code.IsSelfDual)

// ── Decoding / erasure recovery ─────────────────────────────────────

[<Fact>]
let ``every codeword decodes to itself`` () =
    for cw in code.Codewords do
        Assert.Equal(cw, code.Decode(cw))

[<Fact>]
let ``a single-bit error decodes back to the original codeword`` () =
    // min distance 4 -> corrects any single-bit error
    for cw in code.Codewords do
        for bit in 0 .. 7 do
            let corrupted = cw + BinaryVector(1uy <<< bit)
            Assert.Equal(cw, code.Decode(corrupted))

[<Fact>]
let ``RecoverState returns the unique codeword matching enough observed bits`` () =
    let target = code.Codewords |> Set.toArray |> Array.item 5
    // observe all 8 bits -> unique
    let full = [ for i in 0 .. 7 -> i, target.GetBit(i) ] |> Map.ofList
    match code.RecoverState(full) with
    | Some rec' -> Assert.Equal(target, rec')
    | None -> Assert.True(false, "expected a unique recovery from full observation")

[<Fact>]
let ``DerivePrivateKey is deterministic and seed-sensitive`` () =
    let k1 = code.DerivePrivateKey([| 1uy; 2uy; 3uy |])
    let k2 = code.DerivePrivateKey([| 1uy; 2uy; 3uy |])
    let k3 = code.DerivePrivateKey([| 9uy; 9uy; 9uy |])
    Assert.Equal<byte[]>(k1, k2)
    Assert.NotEqual<byte[]>(k1, k3)

// ── The Adinkra graph quotient H_8 / C ──────────────────────────────

[<Fact>]
let ``constructAdinkra yields the 16-vertex quotient`` () =
    let g = BC.constructAdinkra code
    Assert.Equal(16, g.Vertices.Count)

[<Fact>]
let ``well-dashing holds — every 2-colored 4-cycle has edge-sign product -1`` () =
    // The GF(2) solve for signs must satisfy the Gates odd-face condition.
    let g = BC.constructAdinkra code
    Assert.True(g.VerifyLoopCondition())
