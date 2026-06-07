module Zeta.Tests.Blake3HasherTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Blake3

module CH = Zeta.Core.ContentHasher

[<Fact>]
let ``blake3 adapter conforms to the port: named, deterministic, distinct from xxhash128`` () =
    let h = Blake3Hasher.hasher
    Assert.Equal("blake3", h.Name)
    let bytes = [| 1uy; 2uy; 3uy; 4uy |]
    Assert.Equal(h.Hash bytes, h.Hash bytes) // deterministic
    Assert.NotEqual(CH.defaultHasher.Hash bytes, h.Hash bytes) // really BLAKE3, not the xxhash default

[<Fact>]
let ``blake3 known-answer: empty input → first 16 bytes of the BLAKE3-256 digest (cross-language byte-lock)`` () =
    // BLAKE3("") = af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262
    // MerkleHash = hi(LE bytes[8..16)) ++ lo(LE bytes[0..8)) via ToHex → locks the truncation for all oracles.
    let mh = Blake3Hasher.hasher.Hash([||])
    Assert.Equal("49c9dc36ea4d40a0a6a1f9f5b94913af", mh.ToHex())
