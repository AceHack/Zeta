module Zeta.Tests.SalonPackTests

// The salon as a LinguisticSeed.Pack — room = seed + extensions + parameters, made literal.
// The soft tie's Jaccard similarity IS a PSD kernel (the min-max kernel), so the salon composes into
// the seed language under Mercer closure, and a salon room runs to sign-off on the harness.

open System.Text
open global.Xunit
open Zeta.Core

let private b (s: string) = Encoding.UTF8.GetBytes s

// byte-strand samples + test vectors for the PSD (Mercer) witness
let private xs =
    [| b "the quick brown fox jumps over the lazy dog"
       b "the quick brown fox JUMPED over the lazy dog"
       b "completely unrelated payload 99999 zzzz"
       b "the quick brown fox"
       b "" |]

let private vs =
    [| [| 1.0; 1.0; 1.0; 1.0; 1.0 |]
       [| 1.0; -1.0; 1.0; -1.0; 1.0 |]
       [| 2.0; -3.0; 0.5; 1.0; -2.0 |]
       [| -1.0; 2.0; 0.0; -2.0; 1.0 |] |]

let private isPSD (k: LinguisticSeed.Kernel<byte[]>) =
    vs |> Array.forall (fun v -> LinguisticSeed.quadForm k xs v >= -1e-9)

[<Fact>]
let ``the Jaccard (min-max) kernel is PSD over byte strands (the Mercer witness holds)`` () =
    Assert.True(isPSD Salon.jaccardKernel)

[<Fact>]
let ``the salon pack composes into the seed under Mercer closure and stays PSD`` () =
    let composed = LinguisticSeed.composePacks [ Salon.seedPack ]
    Assert.True(isPSD composed)
    Assert.Equal<string list>([ "salon.tie-jaccard"; "salon.exact" ], LinguisticSeed.packNames [ Salon.seedPack ])

[<Fact>]
let ``a salon ROOM = seed + extensions + parameters: near strands resolve, far strands hold`` () =
    task {
        let near = Salon.asRoom [] (b "the quick brown fox jumps over the lazy dog twelve times") (b "the quick brown fox JUMPED over the lazy dog twelve times") 5 0.5
        let! r1 = SimFramework.run near 1L
        Assert.True(r1.SignedOff) // jaccard(near) + exact(0) clears 0.5
        let far = Salon.asRoom [] (b "the quick brown fox") (b "zzzz unrelated 9999") 5 0.5
        let! r2 = SimFramework.run far 1L
        Assert.False(r2.SignedOff) // far strands: the room holds (unresolved, not exploded)
    }

[<Fact>]
let ``OCP: an extra pack EXTENDS the salon room without editing it (the composed kernel grows)`` () =
    task {
        // a constant-boost pack: adds 0.6 to every comparison (PSD: constant kernel)
        let boost = LinguisticSeed.pack "boost" [ "c", LinguisticSeed.constant 0.6 ]
        let a, c = b "the quick brown fox", b "zzzz unrelated 9999"
        let without = Salon.asRoom [] a c 5 0.5
        let withBoost = Salon.asRoom [ boost ] a c 5 0.5
        let! r1 = SimFramework.run without 1L
        let! r2 = SimFramework.run withBoost 1L
        Assert.False(r1.SignedOff)
        Assert.True(r2.SignedOff) // the added pack lifted the composed kernel over the threshold
    }
