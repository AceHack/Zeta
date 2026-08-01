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

    // ============================================================================================
    // Increment 3 — the icosian golden doubling: the 120 spinors (2I) and their φ-partners → E8's 240.
    //
    // A DIFFERENT theorem from the 3→4 spinor induction (increment 2): here the jump is 4→8 because
    // ℚ(√5) is 2-dimensional over ℚ, NOT a further even-subalgebra step. The **icosian ring**
    // (Conway–Sloane, SPLAG §8.2.1; Elser–Sloane 1987; recast in Dechant, Proc. R. Soc. A 472 (2016)
    // 20150504) is the quaternions with coordinates in ℚ(√5); its **240 units = 2I ∪ φ·2I** (the 120
    // spinors and their golden-ratio partners), and under the golden-weighted norm the icosian ring is
    // ISOMETRIC to the E8 lattice.
    //
    // EXACT arithmetic (byte-lockable, no float ε): each quaternion coordinate a ∈ ℚ(√5) is stored as a
    // pair (m, n) ∈ ℤ² meaning a = (m + nφ)/2. ℤ[φ] is closed under ×φ (φ² = φ + 1), so the φ-doubling is
    // denominator-free: φ·(m + nφ)/2 = (n + (m+n)φ)/2. An icosian is int[8] = [ma;na;mb;nb;mc;nc;md;nd].
    //
    // The 4→8 doubling (icosian → 8 rational coordinates) is, in this coordinatization, exactly the
    // reinterpretation of the 4 ℚ(√5) coordinates (aᵢ = aᵢ₀ + aᵢ₁φ) as the 8 rationals
    // (a₀,a₁,b₀,b₁,c₀,c₁,d₀,d₁) — the content of "ℚ(√5) is 2-dim over ℚ". Scaled by 2, these are the
    // integer 8-vectors [ma;na;…] of Euclidean norm² = 4, the E8 root length (E8Lattice's convention).
    //
    // Golden norm collapses to a global scale: the golden-weighted inner product equals (2+φ)·(rational
    // part of the quaternion inner product) = (2+φ)/4 · (standard integer dot on the 8-vectors). So the
    // standard integer dot on `e8Roots` reproduces the E8 angles exactly, up to the global factor (2+φ)/4.
    //
    // Anchors: Conway–Sloane, *Sphere Packings, Lattices and Groups* §8.2.1 (icosian ring ≅ E8); V. Elser
    // & N. J. A. Sloane, J. Phys. A 20 (1987) (E8 → H4); P.-P. Dechant, Proc. R. Soc. A 472 (2016)
    // 20150504 (Clifford recast). Uniqueness of the E8 root system ⇒ this road, the Cl(8,0)-versor road
    // (`CliffordE8Roots`) and Construction A (`E8Lattice`) all reach the identical 240 (a BP-16 cross-check).
    // ============================================================================================

    /// EXACT φ-scaling in ℤ[φ] (denominator-free): φ·(m + nφ)/2 = (n + (m+n)φ)/2, since φ² = φ + 1.
    /// Carries a unit icosian (2I) to its golden partner (φ·2I) — the generator of the 4→8 doubling.
    let private goldenScale (q: int[]) : int[] =
        Array.init 8 (fun i -> if i % 2 = 0 then q.[i + 1] else q.[i - 1] + q.[i])

    // The 120 UNIT icosians = 2I (the 600-cell vertices), listed EXACTLY by their three coordinate
    // families (Conway–Sloane): 8 of shape (±1,0,0,0); 16 of shape (±½,±½,±½,±½); 96 = even permutations
    // of (0, ±½, ±φ⁻¹/2, ±φ/2). Coordinate values in (m,n) = (m + nφ)/2 form:
    //   0 = (0,0);  ½ = (1,0);  1 = (2,0);  φ/2 = (0,1);  φ⁻¹/2 = (φ−1)/2 = (−1,1).
    let private twoI : int list list =
        let coord (m, n) = [ m; n ]
        let neg (m, n) = (-m, -n)
        let eight =
            [ for p in 0 .. 3 do
                for s in [ 2; -2 ] do
                    yield [ for i in 0 .. 3 -> if i = p then coord (s, 0) else coord (0, 0) ] |> List.concat ]
        let sixteen =
            [ for signs in 0 .. 15 do
                yield [ for i in 0 .. 3 -> coord ((if (signs >>> i) &&& 1 = 1 then -1 else 1), 0) ] |> List.concat ]
        let baseVals = [| (0, 0); (1, 0); (-1, 1); (0, 1) |] // 0, ½, φ⁻¹/2, φ/2
        let rec permute l =
            match l with
            | [] -> [ [] ]
            | _ -> [ for x in l do for r in permute (List.filter ((<>) x) l) -> x :: r ]
        let inversions (p: int list) =
            let a = List.toArray p
            let mutable c = 0
            for i in 0 .. 3 do
                for j in i + 1 .. 3 do
                    if a.[i] > a.[j] then c <- c + 1
            c
        let ninetySix =
            [ for p in permute [ 0; 1; 2; 3 ] do
                if inversions p % 2 = 0 then // even permutations only (the alternating group A4)
                    for signs in 0 .. 7 do
                        let parr = List.toArray p
                        let coords = Array.create 4 (0, 0)
                        for k in 0 .. 3 do
                            let v =
                                if k = 0 then baseVals.[k]
                                elif (signs >>> (k - 1)) &&& 1 = 1 then neg baseVals.[k]
                                else baseVals.[k]
                            coords.[parr.[k]] <- v
                        yield [ for i in 0 .. 3 -> coord coords.[i] ] |> List.concat ]
        (eight @ sixteen @ ninetySix) |> List.distinct

    /// **The 240 icosians = 2I ∪ φ·2I** — the units of the icosian ring, EXACT in ℤ[φ]. Each is an
    /// int[8] = [ma;na;mb;nb;mc;nc;md;nd] with quaternion coordinate aᵢ = (m + nφ)/2. The first 120 are
    /// the unit icosians (2I = increment-2's spinors, realized exactly); the next 120 are their φ-partners.
    let icosians : int[] list =
        let unit = twoI |> List.map List.toArray
        let golden = unit |> List.map goldenScale
        (unit @ golden) |> List.map List.ofArray |> List.distinct |> List.map List.toArray

    /// The number of icosians — must be 240 (120 = 2I, 120 = φ·2I); the kissing number of E8.
    let icosianCount = List.length icosians

    /// **The icosian doubling into 8D** — the 240 icosians as integer 8-vectors of Euclidean norm² = 4
    /// (E8Lattice's root-length convention). Coordinate value aᵢ = (m + nφ)/2, so [ma;na;…] = 2·(a₀,a₁,…),
    /// the 8 rationals (a₀,a₁,b₀,b₁,c₀,c₁,d₀,d₁) scaled by 2. This IS an E8 root system (invariant gate);
    /// aligned onto `E8Lattice.roots` by the explicit isometry `e8Isometry` below (target gate).
    let e8Roots : int[] list = icosians

    /// Standard integer inner product on ℝ⁸. On `e8Roots` (all norm² = 4) it equals the golden-weighted
    /// E8 inner product up to the global factor (2+φ)/4 (the golden weighting collapses to a global scale),
    /// so it reproduces the E8 angles exactly.
    let e8Dot (a: int[]) (b: int[]) : int = Array.fold2 (fun s x y -> s + x * y) 0 a b

    /// The reflection of root α in the hyperplane ⟂ β: α − 2(α·β)/(β·β)·β. With β·β = 4 and α·β even for
    /// roots, this is α − (α·β)/2·β — exact integer arithmetic, and the root system is closed under it.
    let e8Reflect (beta: int[]) (alpha: int[]) : int[] =
        let coeff = e8Dot alpha beta / 2
        Array.init 8 (fun i -> alpha.[i] - coeff * beta.[i])

    /// **The explicit isometry (BP-16 3rd-road cross-check).** An orthogonal map — the coordinate
    /// permutation new[i] = old[e8Isometry.[i]] (here the transposition of coordinates 5 and 7) — that
    /// carries `e8Roots` onto `E8Lattice.roots` as SETS. Both are Construction A over the (unique) [8,4]
    /// extended Hamming code, hence permutation-equivalent; this is the concrete permutation aligning the
    /// icosian frame to the in-tree adinkra frame. So the icosian road, the Cl(8,0)-versor road
    /// (`CliffordE8Roots`) and Construction A (`E8Lattice`) all land on the identical 240 E8 roots.
    let e8Isometry : int[] = [| 0; 1; 2; 3; 4; 7; 6; 5 |]

    /// `e8Roots` carried through `e8Isometry` — set-equal to `E8Lattice.roots` (and `CliffordE8Roots.roots`).
    let e8RootsAligned : int[] list =
        e8Roots |> List.map (fun v -> Array.init 8 (fun i -> v.[e8Isometry.[i]]))
