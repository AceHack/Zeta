module Zeta.Tests.ContentHasherTests

open System
open global.Xunit
open Zeta.Core

module CH = Zeta.Core.ContentHasher

[<Fact>]
let ``default hasher is xxhash128, deterministic, and matches MerkleHash.ofBytes`` () =
    let h = CH.defaultHasher
    Assert.Equal("xxhash128", h.Name)
    let bytes = [| 1uy; 2uy; 3uy; 4uy |]
    Assert.Equal(h.Hash bytes, h.Hash bytes) // deterministic
    Assert.Equal(MerkleHash.ofBytes(ReadOnlySpan<byte> bytes), h.Hash bytes) // same as the default digest

[<Fact>]
let ``hashOf adapts a port to the byte[] -> MerkleHash function the store/Merkle consume`` () =
    let f = CH.hashOf CH.defaultHasher
    let bytes = [| 9uy; 9uy |]
    Assert.Equal(CH.defaultHasher.Hash bytes, f bytes)

[<Fact>]
let ``a custom adapter conforms to the same port (generic over algorithms, not just blake)`` () =
    // a trivial alternate adapter proves the port is algorithm-agnostic (BLAKE3 will be one such adapter)
    let alt =
        { new IContentHasher with
            member _.Name = "swap-hi-lo"
            member _.Hash(b: byte[]) =
                let m = MerkleHash.ofBytes(ReadOnlySpan<byte> b)
                MerkleHash(m.Lo, m.Hi) }
    let bytes = [| 5uy; 6uy; 7uy |]
    Assert.Equal("swap-hi-lo", alt.Name)
    Assert.NotEqual(CH.defaultHasher.Hash bytes, alt.Hash bytes)
