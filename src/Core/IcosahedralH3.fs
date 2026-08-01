namespace Zeta.Core

/// **`IcosahedralH3` — the 3D-visual, non-numerological geometry seed (shadow*, Aaron 2026-08-01,
/// work-item 081KYXE4W7D08QG0R00256B56A). Increment 1: the 30-root H3 icosahedral system in Cl(3,0).**
///
/// Why 3D at all — **hardware-targeting, not numerology.** The human visual cortex is the most universal,
/// most heavily-optimized hardware a person has; evolution spent millions of years optimizing it for 3D
/// geometric algorithms. Seeding the E8 geometry in a 3D-visual object (the icosahedron / buckyball)
/// *compiles the abstract structure onto the human's best-optimized ISA* — the same discipline as
/// targeting SIMD or a GPU. Numerology says "3 is fundamental"; hardware-targeting says "3D is what
/// perception hardware runs fastest." This module is the latter.
///
/// **The chain (Dechant's icosahedron→E8 program), honestly staged:**
///   1. **H3 — 30 roots in Cl(3,0)** (THIS increment): the icosahedral Coxeter root system, native 3D.
///   2. spinors = even products = 120 = the binary icosahedral group 2I = the 600-cell  (increment 2).
///   3. H3 spinors *induce* H4 (120 roots) — Dechant's clean spinor induction  (increment 2).
///   4. H4 → E8 (240) via the **icosian golden doubling** 2I ∪ φ·2I (ℚ(√5); Conway–Sloane SPLAG §8.2) —
///      a DIFFERENT theorem than step 3, NOT a third spinor induction  (increment 3; the set-equals gate
///      against `CliffordE8Roots.roots` / `E8Lattice.roots` lands there — the 3rd independent road to E8).
///
/// **This increment proves only step 1.** It is the 3D seed; steps 2–4 are follow-ups on the same
/// work-item. No E8 claim is made here.
///
/// **Construction (reflection closure, no hardcoded coordinates).** The three simple roots are embedded
/// in ℝ³ (as Cl3 grade-1 vectors) from the H3 Cartan matrix — |αᵢ|²=2, ⟨α₁,α₂⟩=−φ (the 5-fold angle:
/// 2cos(π/5)=φ), ⟨α₂,α₃⟩=−1 (the 3-fold: 2cos(π/3)=1), ⟨α₁,α₃⟩=0 — then closed under reflection
/// `r_α(β) = β − ⟨α,β⟩·α` (⟨α,α⟩=2 so 2⟨α,β⟩/⟨α,α⟩ = ⟨α,β⟩). The closure is exactly 30.
///
/// **Honest scope:** floats + an ε-canonical key for the finite set (φ is irrational). The roots are a
/// conjugacy/isometry-invariant set; exact coordinates depend on the embedding, the COUNT and the
/// reflection-closure are the invariants tested. Anchor: Dechant, *Clifford algebra is the natural
/// framework for root systems and Coxeter groups*, AACA 27 (2017) 17–31.
[<RequireQualifiedAccess>]
module IcosahedralH3 =

    /// The golden ratio φ = (1+√5)/2 = 2cos(π/5) — the 5-fold angle that makes H3 non-crystallographic.
    let phi = (1.0 + sqrt 5.0) / 2.0

    /// The three H3 simple roots, embedded in ℝ³ from the Cartan matrix (each |αᵢ|² = 2).
    /// Diagram: α₁ --5-- α₂ --3-- α₃  (⟨α₁,α₂⟩=−φ, ⟨α₂,α₃⟩=−1, ⟨α₁,α₃⟩=0).
    let simpleRoots : Cl3.Mv list =
        let r2 = sqrt 2.0
        let a1 = Cl3.vector r2 0.0 0.0
        let a2y = sqrt (2.0 - phi * phi / 2.0)
        let a2 = Cl3.vector (-phi / r2) a2y 0.0
        let a3y = -1.0 / a2y
        let a3 = Cl3.vector 0.0 a3y (sqrt (2.0 - a3y * a3y))
        [ a1; a2; a3 ]

    /// Reflect vector β in the hyperplane ⊥ root α: r_α(β) = β − (2⟨α,β⟩/⟨α,α⟩)·α. With |α|²=2 this is
    /// β − ⟨α,β⟩·α — the versor sandwich −αβα⁻¹ restricted to grade-1 (see `CliffordReflectionE8.lean`).
    let reflect (alpha: Cl3.Mv) (beta: Cl3.Mv) : Cl3.Mv =
        Cl3.sub beta (Cl3.smul (2.0 * Cl3.dot alpha beta / Cl3.normSq alpha) alpha)

    // ε-canonical key: round each coordinate so the irrational-φ set dedups cleanly.
    let private key (v: Cl3.Mv) : struct (int * int * int) =
        let q (x: float) = int (System.Math.Round(x * 1.0e6))
        struct (q v.E1, q v.E2, q v.E3)

    /// The full H3 root system: the reflection closure of the simple roots. Exactly 30 roots.
    let roots : Cl3.Mv list =
        let seen = System.Collections.Generic.Dictionary<struct (int * int * int), Cl3.Mv>()
        let add (v: Cl3.Mv) = let k = key v in if not (seen.ContainsKey k) then seen.[k] <- v
        // seed with ±simple roots
        for a in simpleRoots do
            add a
            add (Cl3.smul -1.0 a)
        // BFS: reflect every seen root in every simple-root direction until nothing new appears
        let mutable changed = true
        while changed do
            changed <- false
            let current = [ for kv in seen -> kv.Value ]
            for b in current do
                for a in simpleRoots do
                    let r = reflect a b
                    let k = key r
                    if not (seen.ContainsKey k) then
                        seen.[k] <- r
                        changed <- true
        [ for kv in seen -> kv.Value ]

    /// The number of H3 roots — the icosahedral invariant (30 = the 30 edges of the icosahedron / the
    /// 15 reflection hyperplanes × 2).
    let rootCount = List.length roots

    // --- Increment 2: the spinors — even products of H3 roots = the binary icosahedral group 2I ---
    // The even subalgebra Cl⁺(3,0) = {scalar + bivectors} ≅ ℍ (quaternions). The geometric product of
    // two unit root vectors is a ROTOR (unit even multivector); the group these rotors generate is the
    // **binary icosahedral group 2I** (order 120) — the double cover of the icosahedral rotation group,
    // and (as unit quaternions in ℝ⁴) the vertices of the **600-cell** = the root system of H4. This is
    // Dechant's spinor induction 3→4. (The 4→8 step to E8 is the SEPARATE icosian doubling — increment 3.)

    /// A rotor from two roots a,b: R = (a/√|a|²)(b/√|b|²) — the unit even multivector. Since our roots
    /// have |·|²=2, R = gp a b / 2, re-normalized against float drift.
    let private rotorOf (a: Cl3.Mv) (b: Cl3.Mv) : Cl3.Mv =
        let r = Cl3.gp a b
        Cl3.smul (1.0 / sqrt (Cl3.normSq r)) r

    // ε-canonical key on the four EVEN components (S, E12, E13, E23) — the quaternion coordinates.
    let private spinorKey (v: Cl3.Mv) : struct (int * int * int * int) =
        let q (x: float) = int (System.Math.Round(x * 1.0e6))
        struct (q v.S, q v.E12, q v.E13, q v.E23)

    /// The spinor group: the closure under the geometric product of the rotors built from pairs of
    /// simple roots. Exactly 120 = the binary icosahedral group 2I (the 600-cell / H4 root system).
    let spinors : Cl3.Mv list =
        let seen = System.Collections.Generic.Dictionary<struct (int * int * int * int), Cl3.Mv>()
        let add (v: Cl3.Mv) = let k = spinorKey v in if not (seen.ContainsKey k) then seen.[k] <- v
        // generators: rotors from every ordered pair of distinct simple roots (+ identity as the unit)
        add Cl3.one
        for a in simpleRoots do
            for b in simpleRoots do
                if not (System.Object.ReferenceEquals(a, b)) then add (rotorOf a b)
        // BFS group closure: multiply every seen spinor by every generator until stable
        let generators () = [ for kv in seen -> kv.Value ]
        let mutable changed = true
        let mutable guard = 0
        while changed && guard < 10000 do
            changed <- false
            guard <- guard + 1
            let current = generators ()
            for g in current do
                for h in current do
                    let p = Cl3.gp g h
                    let p = Cl3.smul (1.0 / sqrt (Cl3.normSq p)) p // keep unit against drift
                    let k = spinorKey p
                    if not (seen.ContainsKey k) then
                        seen.[k] <- p
                        changed <- true
        [ for kv in seen -> kv.Value ]

    /// The number of spinors — the order of the binary icosahedral group 2I (120 = the 600-cell vertices
    /// = the H4 root count, Dechant's rank-3→rank-4 spinor induction).
    let spinorCount = List.length spinors
