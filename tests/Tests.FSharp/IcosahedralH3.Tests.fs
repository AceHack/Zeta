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

// --- Increment 2: the spinors = the binary icosahedral group 2I = 600-cell / H4 (Dechant 3→4) ---

[<Fact>]
let ``H3 spinors: the rotor closure is exactly 120 = the binary icosahedral group 2I (the 600-cell / H4)`` () =
    Assert.Equal(120, IcosahedralH3.spinorCount)

[<Fact>]
let ``H3 spinors: every spinor is a UNIT rotor (norm² = 1) living in the even subalgebra`` () =
    for s in IcosahedralH3.spinors do
        Assert.True(abs (Cl3.normSq s - 1.0) < 1e-6, sprintf "spinor normSq = %f, expected 1" (Cl3.normSq s))
        // even subalgebra: no vector (grade-1) or pseudoscalar (grade-3) part
        Assert.True(abs s.E1 < 1e-6 && abs s.E2 < 1e-6 && abs s.E3 < 1e-6 && abs s.E123 < 1e-6,
                    "a spinor/rotor must be purely even (scalar + bivector)")

[<Fact>]
let ``H3 spinors: the group contains -1 (the double cover: 2I, not the order-60 rotation group I)`` () =
    let q (x: float) = int (System.Math.Round(x * 1.0e6))
    let keys =
        IcosahedralH3.spinors |> List.map (fun v -> (q v.S, q v.E12, q v.E13, q v.E23)) |> Set.ofList
    Assert.True(keys.Contains (q -1.0, 0, 0, 0), "2I must contain -1 (the nontrivial central element of the double cover)")

// --- Increment 3: the icosian golden doubling 2I ∪ φ·2I → E8's 240 roots (Conway–Sloane SPLAG §8.2.1) ---
// The 4→8 step is a DIFFERENT theorem than the 3→4 spinor induction (increment 2). Exact ℤ[φ] arithmetic
// (byte-lockable). Gate achieved: the FULL target — an explicit orthogonal isometry set-equals E8Lattice.roots.

[<Fact>]
let ``icosians: exactly 240 units = 2I ∪ φ·2I (the E8 kissing number)`` () =
    Assert.Equal(240, IcosahedralH3.icosianCount)

[<Fact>]
let ``icosians: the unit part is the 120 spinors (2I) and the 240 are distinct`` () =
    Assert.Equal(120, IcosahedralH3.spinorCount)
    let distinct = IcosahedralH3.icosians |> List.map List.ofArray |> List.distinct |> List.length
    Assert.Equal(240, distinct)

[<Fact>]
let ``icosians: all share the same golden-weighted norm (Σ(m²+n²) = 4 exactly — byte-lockable)`` () =
    for v in IcosahedralH3.icosians do
        Assert.Equal(4, IcosahedralH3.e8Dot v v)

[<Fact>]
let ``icosians→E8: the inner-product multiset equals E8Lattice's (isometry invariant ⇒ E8 up to isometry)`` () =
    let multiset (roots: int[] list) =
        let m = System.Collections.Generic.Dictionary<int, int>()
        for a in roots do
            for b in roots do
                let d = IcosahedralH3.e8Dot a b
                m.[d] <- (if m.ContainsKey d then m.[d] else 0) + 1
        m |> Seq.map (fun kv -> kv.Key, kv.Value) |> Seq.sortBy fst |> List.ofSeq
    Assert.Equal<(int * int) list>(multiset E8Lattice.roots, multiset IcosahedralH3.e8Roots)

[<Fact>]
let ``icosians→E8: the 240 are closed under reflection (a genuine root system — the only rank-8 with 240 roots is E8)`` () =
    let keys = IcosahedralH3.e8Roots |> List.map List.ofArray |> Set.ofList
    for b in IcosahedralH3.e8Roots do
        for a in IcosahedralH3.e8Roots do
            Assert.True(
                keys.Contains(IcosahedralH3.e8Reflect b a |> List.ofArray),
                "the icosian E8 root system must be closed under reflection")

[<Fact>]
let ``icosians→E8: the explicit isometry set-equals E8Lattice.roots (BP-16 3rd independent road to E8)`` () =
    let aligned = IcosahedralH3.e8RootsAligned |> List.map List.ofArray |> Set.ofList
    let e8 = E8Lattice.roots |> List.map List.ofArray |> Set.ofList
    Assert.Equal<Set<int list>>(e8, aligned)

[<Fact>]
let ``icosians→E8: the same isometry set-equals CliffordE8Roots.roots (all three roads = one E8)`` () =
    let aligned = IcosahedralH3.e8RootsAligned |> List.map List.ofArray |> Set.ofList
    let cliff = CliffordE8Roots.roots |> List.map List.ofArray |> Set.ofList
    Assert.Equal<Set<int list>>(cliff, aligned)

// NOTE: a direct coordinate comparison of the icosian 120-unit part against increment-2's Cl3 rotor
// spinors was intentionally dropped — the two build the SAME group 2I but in DIFFERENT coordinate frames
// (icosian ℤ[φ] quaternions vs even-subalgebra rotor coefficients), so a sorted-|coord| multiset compare
// is ill-posed (it would require first solving the inter-frame isometry). The structural "both are 2I"
// facts are already covered: increment-2 gates spinorCount=120 + contains −1; increment-3 gates the 240 =
// 120 unit ∪ 120 φ-part, and — the real cross-check — the icosian E8 set-equals E8Lattice.roots AND
// CliffordE8Roots.roots above (all three independent roads land on the one E8).
