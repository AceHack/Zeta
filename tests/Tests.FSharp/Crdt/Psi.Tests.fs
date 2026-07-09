module Zeta.Tests.Crdt.PsiTests

open System
open System.Numerics
open global.Xunit
open Zeta.Core

[<Fact>]
let ``Psi: Diffie-Hellman exponentiation is commutative`` () =
    let key = "some-key-value"
    let g = Psi.hashToGroup key
    
    let a = BigInteger(123456789L)
    let b = BigInteger(987654321L)
    
    let ga = BigInteger.ModPow(g, a, Psi.Modulus)
    let gab = BigInteger.ModPow(ga, b, Psi.Modulus)
    
    let gb = BigInteger.ModPow(g, b, Psi.Modulus)
    let gba = BigInteger.ModPow(gb, a, Psi.Modulus)
    
    Assert.Equal(gab, gba)

[<Fact>]
let ``Psi: Z-set Private Set Intersection computes correct intersection and weights`` () =
    // ZSet A: {"alice": 2, "shared": 3}
    let zsetA = ZSet.ofSeq [ "alice", 2L; "shared", 3L ]
    // ZSet B: {"bob": 5, "shared": 7}
    let zsetB = ZSet.ofSeq [ "bob", 5L; "shared", 7L ]
    
    let secretA = 12345I
    let secretB = 67890I
    
    // 1. Stage 1 masking
    let maskedA, mapA = Psi.maskZSet secretA zsetA
    let maskedB, mapB = Psi.maskZSet secretB zsetB
    
    Assert.Equal(2, maskedA.Count)
    Assert.Equal(2, maskedB.Count)
    
    // Check that we can retrieve "shared" from both first-stage sets
    let sharedHashA = mapA |> Map.findKey (fun _ v -> v = "shared")
    let sharedHashB = mapB |> Map.findKey (fun _ v -> v = "shared")
    
    Assert.Equal(3L, maskedA.[sharedHashA])
    Assert.Equal(7L, maskedB.[sharedHashB])
    
    // 2. Stage 2 re-masking
    let remaskedA = Psi.remaskZSet secretB maskedA
    let remaskedB = Psi.remaskZSet secretA maskedB
    
    Assert.Equal(2, remaskedA.Count)
    Assert.Equal(2, remaskedB.Count)
    
    // Get doubly-masked values
    let doublyA = BigInteger.ModPow(sharedHashA, secretB, Psi.Modulus)
    let doublyB = BigInteger.ModPow(sharedHashB, secretA, Psi.Modulus)
    
    Assert.Equal(doublyA, doublyB)
    
    // Verify doubly-masked value exists in remaskedA and remaskedB keys
    let keysA = remaskedA.AsSpan().ToArray() |> Array.map (fun e -> e.Key)
    let keysB = remaskedB.AsSpan().ToArray() |> Array.map (fun e -> e.Key)
    
    let hasA = keysA |> Array.exists (fun struct (f, d) -> f = sharedHashA && d = doublyA)
    let hasB = keysB |> Array.exists (fun struct (f, d) -> f = sharedHashB && d = doublyB)
    
    Assert.True(hasA)
    Assert.True(hasB)
    
    // 3. Perform PSI intersection
    let intersected = Psi.intersect remaskedA remaskedB
    
    Assert.Equal(1, intersected.Count)
    
    // 4. Reconstruct original keys
    let reconstructedA = Psi.reconstruct mapA (fun struct (a, _, _) -> a) intersected
    let reconstructedB = Psi.reconstruct mapB (fun struct (_, b, _) -> b) intersected
    
    // Verify the intersection is exactly {"shared": 21} (weight product 3 * 7 = 21)
    let expected = ZSet.ofSeq [ "shared", 21L ]
    
    Assert.Equal<ZSet<string>>(expected, reconstructedA)
    Assert.Equal<ZSet<string>>(expected, reconstructedB)
