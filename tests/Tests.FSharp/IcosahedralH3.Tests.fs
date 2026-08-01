module Zeta.Tests.IcosahedralH3Tests

// Increment 1 of the icosahedron→E8 visual-geometry layer (081KYXE4W7D08QG0R00256B56A):
// the 30-root H3 icosahedral system in Cl(3,0). The 3D-native seed (hardware-targeting the visual
// cortex, not numerology). Steps 2–4 (spinors→H4→E8 set-equals) are follow-ups; this proves step 1.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``H3: the reflection closure is exactly 30 roots (the icosahedral invariant)`` () =
    Assert.Equal(30, IcosahedralH3.rootCount)

[<Fact>]
let ``H3: every root has norm² = 2 (the normalized root length)`` () =
    for r in IcosahedralH3.roots do
        Assert.True(abs (Cl3.normSq r - 2.0) < 1e-9, sprintf "normSq = %f, expected 2" (Cl3.normSq r))

[<Fact>]
let ``H3: the root set is closed under negation`` () =
    let q (x: float) = int (System.Math.Round(x * 1.0e6))
    let keys =
        IcosahedralH3.roots |> List.map (fun v -> (q v.E1, q v.E2, q v.E3)) |> Set.ofList
    for r in IcosahedralH3.roots do
        let neg = (q -r.E1, q -r.E2, q -r.E3)
        Assert.True(keys.Contains neg, "every root's negation must also be a root")

[<Fact>]
let ``H3: the root set is closed under its own reflections (a genuine root system)`` () =
    let q (x: float) = int (System.Math.Round(x * 1.0e6))
    let keys =
        IcosahedralH3.roots |> List.map (fun v -> (q v.E1, q v.E2, q v.E3)) |> Set.ofList
    // reflecting any root in any other root must land back in the set
    for a in IcosahedralH3.roots do
        for b in IcosahedralH3.roots do
            let r = IcosahedralH3.reflect a b
            Assert.True(keys.Contains (q r.E1, q r.E2, q r.E3), "root system not closed under reflection")

[<Fact>]
let ``H3: the simple roots realize the Cartan matrix (5-fold and 3-fold angles)`` () =
    match IcosahedralH3.simpleRoots with
    | [ a1; a2; a3 ] ->
        Assert.True(abs (Cl3.normSq a1 - 2.0) < 1e-9)
        Assert.True(abs (Cl3.normSq a2 - 2.0) < 1e-9)
        Assert.True(abs (Cl3.normSq a3 - 2.0) < 1e-9)
        Assert.True(abs (Cl3.dot a1 a2 + IcosahedralH3.phi) < 1e-9, "⟨α₁,α₂⟩ must be −φ (the 5-fold angle)")
        Assert.True(abs (Cl3.dot a2 a3 + 1.0) < 1e-9, "⟨α₂,α₃⟩ must be −1 (the 3-fold angle)")
        Assert.True(abs (Cl3.dot a1 a3) < 1e-9, "⟨α₁,α₃⟩ must be 0 (orthogonal)")
    | _ -> Assert.True(false, "expected exactly 3 simple roots")
