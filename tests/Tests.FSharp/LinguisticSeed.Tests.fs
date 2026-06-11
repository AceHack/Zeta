module Zeta.Tests.LinguisticSeedTests

open global.Xunit
open Zeta.Core

module LS = LinguisticSeed

// Sample points + a battery of test vectors v; a PSD kernel must give vᵀKv ≥ 0 for ALL of them.
let private xs = [| 0; 1; 2; 3; 4 |]

let private vs =
    [| [| 1.0; 1.0; 1.0; 1.0; 1.0 |]
       [| 1.0; -1.0; 1.0; -1.0; 1.0 |]
       [| 2.0; -3.0; 0.5; 1.0; -2.0 |]
       [| -1.0; -1.0; 2.0; 0.0; 3.0 |]
       [| 0.0; 5.0; -5.0; 1.0; -1.0 |] |]

let private isPSD (k: LS.Kernel<int>) =
    vs |> Array.forall (fun v -> LS.quadForm k xs v >= -1e-9)

[<Fact>]
let ``base kernels are PSD (constant, feature, dot, indicator)`` () =
    Assert.True(isPSD (LS.constant 2.0))
    Assert.True(isPSD (LS.feature (fun i -> float i - 2.0)))
    Assert.True(isPSD (LS.dot (fun i -> [| float i; float (i * i) |])))
    Assert.True(isPSD LS.indicator)

[<Fact>]
let ``a negative constant is clamped to the PSD zero (closure refuses non-PSD)`` () =
    let k = LS.constant -5.0
    Assert.Equal(0.0, k 1 2, 12)
    Assert.True(isPSD k)

[<Fact>]
let ``Mercer-closure preserves PSD: sum, Schur product, nonneg scale, pullback`` () =
    let k1 = LS.feature (fun i -> float i - 2.0)
    let k2 = LS.dot (fun i -> [| float i; 1.0 |])
    Assert.True(isPSD (LS.sum k1 k2))
    Assert.True(isPSD (LS.product k1 k2)) // Schur product theorem
    Assert.True(isPSD (LS.scale 3.0 k1))
    Assert.True(isPSD (LS.pullback (fun (j: int) -> j % 3) k2))

[<Fact>]
let ``the kernel { } CE sums its yields (Mercer-closed) and stays PSD`` () =
    let k1 = LS.feature (fun i -> float i - 2.0)
    let k2 = LS.indicator
    let composed =
        LS.kernel {
            yield k1
            yield k2
        }
    // equals the manual sum, pointwise
    for a in xs do
        for b in xs do
            Assert.Equal(LS.sum k1 k2 a b, composed a b, 12)
    Assert.True(isPSD composed)

[<Fact>]
let ``extension packs compose by Mercer-closed sum (OCP) and stay PSD`` () =
    let p1 = LS.pack "lexical" [ "len", LS.feature (fun i -> float i); "eq", LS.indicator ]
    let p2 = LS.pack "structural" [ "quad", LS.feature (fun i -> float (i * i) - 4.0) ]
    let seed = LS.composePacks [ p1; p2 ]
    Assert.True(isPSD seed)
    // OCP: adding p2 only ADDS — the composed seed = p1-seed + p2-seed, existing untouched.
    let seed1 = LS.composePacks [ p1 ]
    let seed2 = LS.composePacks [ p2 ]
    for a in xs do
        for b in xs do
            Assert.Equal(LS.sum seed1 seed2 a b, seed a b, 12)
    // introspection: the seed exposes its pack.kernel names
    Assert.Equal<string list>([ "lexical.len"; "lexical.eq"; "structural.quad" ], LS.packNames [ p1; p2 ])

[<Fact>]
let ``empty seed (no packs) is the PSD zero kernel`` () =
    let seed = LS.composePacks ([]: LS.Pack<int> list)
    Assert.Equal(0.0, seed 1 2, 12)
    Assert.True(isPSD seed)
