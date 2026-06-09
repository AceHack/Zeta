module Zeta.Tests.IdentityCapacityTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``capacity = 2^bits; bitsNeeded = ceil(log2 n) (identities <-> bits of uncertainty)`` () =
    Assert.Equal(1, IdentityCapacity.capacity 0)
    Assert.Equal(8, IdentityCapacity.capacity 3)
    Assert.Equal(0, IdentityCapacity.bitsNeeded 1)
    Assert.Equal(3, IdentityCapacity.bitsNeeded 8) // 8 fits in 3 bits
    Assert.Equal(4, IdentityCapacity.bitsNeeded 9) // 9 needs 4
    Assert.Equal(3, IdentityCapacity.bitsNeeded 5)

[<Fact>]
let ``run-out-of-qubits signal: when needed identities exceed 2^availableBits, need more`` () =
    Assert.True(IdentityCapacity.outOfQubits 2 8) // 8 > 2^2=4 -> out
    Assert.False(IdentityCapacity.outOfQubits 3 8) // 8 <= 2^3=8 -> ok
    Assert.Equal(1, IdentityCapacity.qubitsShort 2 8) // need 3 bits, have 2 -> 1 short
    Assert.Equal(0, IdentityCapacity.qubitsShort 3 8)

[<Fact>]
let ``COMPLEXITY SELF-BOUND: distinct identities <= capacity(identityBits) for any population`` () =
    for n in 1..100 do
        let identities = [ for i in 0 .. n - 1 -> i ] // n distinct identities
        let bits = IdentityCapacity.identityBits identities
        Assert.True(IdentityCapacity.distinctIdentities identities <= IdentityCapacity.capacity bits)
        Assert.Equal(IdentityCapacity.bitsNeeded n, bits)

[<Fact>]
let ``identity is ENTROPY-bounded, not flags-enum: private state lifts identities beyond 2^numHats`` () =
    let numHats = 1 // flags enum gives only 2^1 = 2 identities without private state
    Assert.Equal(2, IdentityCapacity.flagsEnumBound numHats)
    // identities = (hatFlags, private); same flags, 5 distinct privates -> 5 distinct identities > 2
    let identities = [ for p in 0..4 -> (0, p) ]
    Assert.Equal(5, IdentityCapacity.distinctIdentities identities)
    Assert.True(IdentityCapacity.distinctIdentities identities > IdentityCapacity.flagsEnumBound numHats)
    // ...and that takes 3 bits of uncertainty (qubits), not the 1 the hat enum offers
    Assert.Equal(3, IdentityCapacity.identityBits identities)

[<Fact>]
let ``identity qubits decompose into hat bits + private (emergent) bits`` () =
    Assert.Equal(3, IdentityCapacity.hatBits 3)
    Assert.Equal(5, IdentityCapacity.privateBits 5)
    Assert.Equal(8, IdentityCapacity.totalBits 3 5) // hats + private
    Assert.Equal(256, IdentityCapacity.capacity (IdentityCapacity.totalBits 3 5)) // 2^8 identities
    // private state (emergent) dominates the constructed/emergent hat floor
    Assert.True(IdentityCapacity.totalBits 3 5 > IdentityCapacity.hatBits 3)
