module Zeta.Tests.BitAdinkraTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``identity bits generate doubly-even adinkra codewords (Gates SUSY code property)`` () =
    let bits = [ 1; 0; 1; 1; 0; 0; 1; 0; 1; 1; 1; 0 ] // 12 identity bits → 3 nibbles
    let codewords = BitAdinkra.encodeIdentity bits
    Assert.Equal(3, List.length codewords)
    Assert.True(BitAdinkra.allDoublyEven codewords) // every codeword weight ≡ 0 mod 4
    Assert.True(codewords |> List.forall (fun c -> Array.length c = AdinkraCode.length)) // 8-bit codewords

[<Fact>]
let ``encodeNibble matches AdinkraCode.encode and is weight-4-multiple`` () =
    let cw = BitAdinkra.encodeNibble 1 0 1 0
    Assert.Equal<int[]>(AdinkraCode.encode [| 1; 0; 1; 0 |], cw)
    Assert.Equal(0, AdinkraCode.weight cw % 4)

[<Fact>]
let ``short final group is zero-padded so partial identity still encodes`` () =
    let bits = [ 1; 1 ] // only 2 bits → one padded nibble [1;1;0;0]
    let msgs = BitAdinkra.toMessages bits
    Assert.Equal(1, List.length msgs)
    Assert.Equal<int[]>([| 1; 1; 0; 0 |], msgs.[0])
    Assert.True(BitAdinkra.allDoublyEven (BitAdinkra.encodeIdentity bits))

[<Fact>]
let ``non-0/1 bit inputs are normalised to 0/1`` () =
    let msgs = BitAdinkra.toMessages [ 5; 0; -3; 0 ] // 5,-3 → 1; 0 → 0
    Assert.Equal<int[]>([| 1; 0; 1; 0 |], msgs.[0])

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    let bits = [ 1; 0; 0; 1; 1; 1; 0; 1 ]
    Assert.Equal<int[] list>(BitAdinkra.encodeIdentity bits, BitAdinkra.encodeIdentity bits)
