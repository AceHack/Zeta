namespace Zeta.Core

open System
open System.Security.Cryptography
open System.Text
open System.Numerics

[<RequireQualifiedAccess>]
module Psi =

    /// 512-bit safe prime modulus for Diffie-Hellman exponentiation
    let Modulus = BigInteger.Parse("1340780792994259709957402499820592393377723561443721764030073546976801874298166903427690031858186486050898533426470085810119266100859373153")

    /// Hash a key to a BigInteger in [1, Modulus-1]
    let hashToGroup (key: 'K) : BigInteger =
        let bytes = Encoding.UTF8.GetBytes(key.ToString())
        use sha = SHA256.Create()
        let h1 = sha.ComputeHash(bytes)
        // Pad to ensure positive BigInteger
        let padded = Array.zeroCreate<byte> (h1.Length + 1)
        Array.blit h1 0 padded 0 h1.Length
        let bi = BigInteger(padded)
        let biMod = bi % (Modulus - 1I)
        if biMod <= 0I then biMod + Modulus - 1I else biMod

    /// First-stage masking: computes H(k)^secret mod Modulus.
    /// Returns the masked Z-set and a map of maskedKey -> originalKey.
    let maskZSet (secret: BigInteger) (zset: ZSet<'K>) : ZSet<BigInteger> * Map<BigInteger, 'K> =
        let mutable mappedKeys = Map.empty
        let entries =
            zset.AsSpan().ToArray()
            |> Array.map (fun entry ->
                let g = hashToGroup entry.Key
                let masked = BigInteger.ModPow(g, secret, Modulus)
                mappedKeys <- Map.add masked entry.Key mappedKeys
                masked, entry.Weight
            )
        ZSet.ofSeq entries, mappedKeys

    /// Second-stage masking: Bob re-masks Alice's masked keys.
    /// Alice sends AliceMasked = ZSet<bigint>. Bob computes (AliceMasked)^secret mod Modulus.
    /// Returns a Z-set of (firstStage, doublyMasked) pairs.
    let remaskZSet (secret: BigInteger) (zset: ZSet<BigInteger>) : ZSet<struct (BigInteger * BigInteger)> =
        let entries =
            zset.AsSpan().ToArray()
            |> Array.map (fun entry ->
                let doubly = BigInteger.ModPow(entry.Key, secret, Modulus)
                struct (entry.Key, doubly), entry.Weight
            )
        ZSet.ofSeq entries

    /// Intersect two remasked Z-sets (Alice's and Bob's).
    /// Both inputs have keys of type `struct (firstStage * doublyMasked)`.
    /// We match on `doublyMasked` and compute the intersection weight as the product of weights.
    /// Returns a Z-set of `struct (firstStageA * firstStageB * doublyMasked)` elements.
    let intersect (remaskedA: ZSet<struct (BigInteger * BigInteger)>) (remaskedB: ZSet<struct (BigInteger * BigInteger)>) : ZSet<struct (BigInteger * BigInteger * BigInteger)> =
        let spanA = remaskedA.AsSpan()
        let spanB = remaskedB.AsSpan()
        
        let mutable bMap = Map.empty
        for i in 0 .. spanB.Length - 1 do
            let struct (firstB, doublyB) = spanB.[i].Key
            bMap <- Map.add doublyB (struct (firstB, spanB.[i].Weight)) bMap

        let mutable intersected = List.empty
        for i in 0 .. spanA.Length - 1 do
            let struct (firstA, doublyA) = spanA.[i].Key
            match Map.tryFind doublyA bMap with
            | Some (struct (firstB, wB)) ->
                let wA = spanA.[i].Weight
                let wIntersect = wA * wB
                intersected <- (struct (firstA, firstB, doublyA), wIntersect) :: intersected
            | None -> ()
            
        ZSet.ofSeq intersected

    /// Reconstruct the intersected Z-set back to the original keys using the local mapping
    /// and a key selector function (to pick firstStageA or firstStageB from the intersection).
    let reconstruct (mapping: Map<BigInteger, 'K>) (selector: struct (BigInteger * BigInteger * BigInteger) -> BigInteger) (intersected: ZSet<struct (BigInteger * BigInteger * BigInteger)>) : ZSet<'K> =
        let entries =
            intersected.AsSpan().ToArray()
            |> Array.choose (fun entry ->
                let firstStage = selector entry.Key
                match Map.tryFind firstStage mapping with
                | Some originalKey -> Some (originalKey, entry.Weight)
                | None -> None
            )
        ZSet.ofSeq entries
