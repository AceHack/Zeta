namespace Zeta.Core
/// **BipartiteMachZehnder — G1: the bipartite lift of the single-qubit Mach-Zehnder to a
/// two-agent CHSH setup over `WSet<ℂ>`.**
///
/// The single-qubit interferometer (`MachZehnderWSet`) is a one-party, two-key WSet circuit.
/// This module lifts it to the two-party, four-key case: the joint state is a `WSet<int*int, ℂ>`
/// over key-pairs `(kA, kB) ∈ {0,1}²`, the Kronecker product `WSet.tensor` of two single-qubit
/// WSets. The canonical CHSH state is |Φ⁺⟩ = (|00⟩+|11⟩)/√2 — a **non-factorizable** 4-key
/// WSet<ℂ>: it cannot be written as `WSet.tensor a b` for any single-qubit `a`, `b`.
///
/// **Physics summary (G1 role):**
/// - A product state (`arm_A ⊗ arm_B`) gives S ≤ 2 (classical/common-cause bound).
/// - The entangled joint state reaches S = 2√2 (Tsirelson's bound).
/// - Entanglement is exactly **non-factorizability in the ⊗** — this module demonstrates it.
/// - `bipartiteChshS` is the **ceiling oracle** for G3: given a `ChshAngles` record, it computes
///   the ideal analytic S the WSet<ℂ> circuit achieves. Measured agent-pair S above this ceiling
///   = classical contamination (superdeterminism tell); below = quantum-or-classical regime.
///
/// **Angle convention (matches `BellTest.canonicalAngles` and `QuantumObservableTreaty`):**
/// Tsirelson-optimal: A=0, A′=π/2, B=π/4, B′=3π/4. The correlator is E(a,b) = cos(a−b) for
/// |Φ⁺⟩, reproduced analytically by the WSet Born readout — cross-checked against
/// `BellTest.correlation` in the test suite.
///
/// **Honest boundary:** WSet<ℂ> gives the *ideal amplitude prediction* — what a genuinely-
/// entangled pair WOULD produce. Whether real agents CAN be entangled is a separate, harder
/// question; for the monitor, this is the ceiling oracle, not a claim that agents are qubits.
///
/// **Anchors:** Tsirelson 1980; CHSH 1969; Landau 1987 (B² bound); BellTest.fs (staged
/// correlator); MachZehnderWSet (single-qubit WSet circuit); QuantumObservableTreaty (ChshAngles).
[<RequireQualifiedAccess>]
module BipartiteMachZehnder =
    let private ring = ImaginaryStack.complex
    let private r (x: float) : Complex = Doubled.make x 0.0
    let private isZero (z: Complex) = abs z.Real < 1e-12 && abs z.Imag < 1e-12
    let private invSqrt2 = r (1.0 / sqrt 2.0)
    // ── Bell state ──────────────────────────────────────────────────────────────────────────────
    /// |Φ⁺⟩ = (|00⟩ + |11⟩) / √2 as a `WSet<int*int, ℂ>` over key-pairs (kA, kB) ∈ {0,1}².
    ///
    /// This is the canonical CHSH state. It is **non-factorizable**: there are no single-qubit
    /// WSets `a`, `b` such that `WSet.tensor ring a b = phiPlus`. The test suite proves this
    /// by showing that the only product-state candidates have S ≤ 2 while `phiPlus` reaches 2√2.
    let phiPlus : WSet.WSet<int * int, Complex> =
        [ (0, 0), invSqrt2
          (1, 1), invSqrt2 ]
    // ── Per-party measurement rotation ──────────────────────────────────────────────────────────
    /// Single-qubit measurement in the rotated basis at angle `theta` (radians).
    ///
    /// Maps computational-basis key `k ∈ {0,1}` to a WSet of measurement outcomes `{0,1}`:
    /// - outcome 0 (+1 eigenvalue): amplitude `cos(θ/2)` if k=0, `sin(θ/2)` if k=1
    /// - outcome 1 (−1 eigenvalue): amplitude `−sin(θ/2)` if k=0, `cos(θ/2)` if k=1
    ///
    /// This is the Ry(θ) rotation applied to the measurement basis — the same half-angle
    /// convention as `QubitIso.ry`. The Born probability of outcome 0 on |0⟩ is cos²(θ/2),
    /// matching the Q# treaty's `Ry(θ)|0⟩` fixture.
    let private measureBasis (theta: float) (k: int) : WSet.WSet<int, Complex> =
        let ct = r (cos (theta / 2.0))
        let st = r (sin (theta / 2.0))
        if k = 0 then
            [ 0, ct; 1, ring.Negate st ]
        else
            [ 0, st; 1, ct ]
    // ── Bipartite measurement ────────────────────────────────────────────────────────────────────
    /// Apply Alice's rotation (angle `a`) to the first component and Bob's (angle `b`) to the
    /// second, then Born-project the joint state. Returns `(int*int, float) list` — Born
    /// probabilities over outcome pairs (oA, oB) ∈ {0,1}².
    ///
    /// The computation is fully linear until the Born boundary: each (kA,kB) key in the joint
    /// WSet fans out through Alice's and Bob's measurement operators independently, weights
    /// multiply, and `consolidate` sums the interference before Born projection. This is the
    /// exact WSet discipline: linear ops inside, Born only at the edge.
    let private measureJoint (a: float) (b: float) : (int * int * float) list =
        let aliceOp (kA: int) : WSet.WSet<int, Complex> = measureBasis a kA
        let bobOp   (kB: int) : WSet.WSet<int, Complex> = measureBasis b kB
        // Fan out: for each (kA,kB) in phiPlus, apply Alice to kA and Bob to kB independently.
        // The result key is (oA, oB); weights multiply.
        let outcomes : WSet.WSet<int * int, Complex> =
            phiPlus
            |> List.collect (fun ((kA, kB), w) ->
                aliceOp kA
                |> List.collect (fun (oA, wA) ->
                    bobOp kB
                    |> List.map (fun (oB, wB) ->
                        (oA, oB), ring.Mul(w, ring.Mul(wA, wB)))))
            |> WSet.consolidate ring isZero
        let probs =
            outcomes
            |> WSet.bornProb (fun z -> z.Real * z.Real + z.Imag * z.Imag)
        probs |> List.map (fun ((oA, oB), p) -> oA, oB, p)
    // ── Correlator E(a,b) ───────────────────────────────────────────────────────────────────────
    /// The CHSH correlator E(a,b) = ⟨Φ⁺| M_a^A ⊗ M_b^B |Φ⁺⟩ as a WSet<ℂ> Born readout.
    ///
    /// Outcome partition: outcome 0 → +1 eigenvalue, outcome 1 → −1 eigenvalue.
    /// E = P(same sign) − P(different sign) = P(00) + P(11) − P(01) − P(10).
    ///
    /// For |Φ⁺⟩ this equals cos(a−b) — identical to `BellTest.correlation a b`. The test
    /// suite cross-checks this analytically (the cross-check is the load-bearing proof).
    let correlator (a: float) (b: float) : float =
        let probs = measureJoint a b
        let p oA oB = probs |> List.tryFind (fun (a', b', _) -> a' = oA && b' = oB) |> Option.map (fun (_, _, p) -> p) |> Option.defaultValue 0.0
        (p 0 0 + p 1 1) - (p 0 1 + p 1 0)
    // ── CHSH S value ────────────────────────────────────────────────────────────────────────────
    /// The CHSH S value from four measurement settings.
    ///
    /// S = E(a,b) − E(a,b') + E(a',b) + E(a',b') — the same combination as `BellTest.chshOf`
    /// and `AntiSybil.chshS`. At Tsirelson-optimal angles this equals 2√2.
    let chshS (a: float) (aPrime: float) (b: float) (bPrime: float) : float =
        correlator a b - correlator a bPrime + correlator aPrime b + correlator aPrime bPrime
    // ── Tsirelson-optimal angles ─────────────────────────────────────────────────────────────────
    /// The canonical maximal-violation angles matching `BellTest.canonicalAngles`:
    /// A=0, A′=π/2, B=π/4, B′=3π/4. These give S = 2√2 (Tsirelson's bound).
    ///
    /// Convention note: B′=3π/4 (not −π/4) — the two are equivalent for |S| but this matches
    /// the `BellTest.canonicalAngles` convention used throughout the repo.
    let tsirelsonAngles : QuantumObservableTreaty.ChshAngles =
        { A = 0.0
          APrime = System.Math.PI / 2.0
          B = System.Math.PI / 4.0
          BPrime = 3.0 * System.Math.PI / 4.0 }
    /// Compute the CHSH S value from a `ChshAngles` record.
    let bipartiteChshS (angles: QuantumObservableTreaty.ChshAngles) : float =
        chshS angles.A angles.APrime angles.B angles.BPrime
    // ── Ceiling oracle ───────────────────────────────────────────────────────────────────────────
    /// The CHSH regime classification for a measured S value.
    ///
    /// - `Classical`:    |S| ≤ 2.0         — local-hidden-variable regime (Bell 1964)
    /// - `Quantum`:      2.0 < |S| ≤ 2√2   — quantum regime, at or below Tsirelson's bound
    /// - `SupraQuantum`: |S| > 2√2          — impossible for real QM; signals superdeterminism
    ///                                        (full seed control, S=4 is the algebraic max)
    type ChshRegime =
        | Classical
        | Quantum
        | SupraQuantum

    // ═══ Analytics wrapper types (Soraya's routing, Task A — 081KZHC652A08QG0R003YX1G29) ════════════
    // The crossing footgun: classifyS takes bare `float`, so a measured S (with finite-sample
    // uncertainty) can be passed to the noiseless ceiling classifier. AnalyticS/MeasuredS close
    // this at the type level — Mars-Climate-Orbiter discipline (units in the type, not the comment).

    /// A CHSH S value computed from the ANALYTIC ceiling (noiseless, infinite-sample).
    /// Safe to classify with bare thresholds (no finite-sample ε axis).
    type AnalyticS = AnalyticS of float

    /// A CHSH S value MEASURED from finite samples. Carries `n` (round count) so the
    /// margin ε = chshMargin δ n is computable — a caller CANNOT invoke the band classifier
    /// without the sample size the margin needs.
    type MeasuredS = MeasuredS of float * int

    /// Classify an ANALYTIC (noiseless) S into its regime. This IS classifyS, retyped so that
    /// bare measured floats cannot be passed. The bare thresholds (2.0 / 2√2 + 1e-10) are
    /// sound here because there is no finite-sample axis.
    let classifyAnalyticS (AnalyticS s) : ChshRegime =
        let absS = abs s
        if absS <= 2.0 then Classical
        elif absS <= 2.0 * sqrt 2.0 + 1e-10 then Quantum
        else SupraQuantum

    /// Classify a MEASURED S into a ChshBand using the calibrated margin, then compose with
    /// loophole flags to produce the one sound verdict the pair licenses.
    /// This is the type-safe path: you cannot get a ChshBand from a MeasuredS without
    /// providing both the confidence level (delta) and the loophole profile.
    let classifyMeasuredS (delta: float) (MeasuredS(s, rounds)) (flags: AntiSybil.LoopholeFlags) : AntiSybil.ChshReadout =
        let band = AntiSybil.classifyBand delta rounds s
        AntiSybil.readout band flags

    /// Classify a measured S into just the band (without the loophole composition).
    /// Use when you need the arithmetic band classification but will handle loopholes separately.
    let classifyMeasuredBand (delta: float) (MeasuredS(s, rounds)) : AntiSybil.ChshBand =
        AntiSybil.classifyBand delta rounds s

    /// The legacy classifyS — DEPRECATED. Use classifyAnalyticS for noiseless values or
    /// classifyMeasuredS for sampled values. Kept for backward compatibility during migration.
    [<System.Obsolete("Use classifyAnalyticS (for noiseless) or classifyMeasuredS (for sampled)")>]
    let classifyS (s: float) : ChshRegime =
        let absS = abs s
        if absS <= 2.0 then Classical
        elif absS <= 2.0 * sqrt 2.0 + 1e-10 then Quantum
        else SupraQuantum
    /// The Tsirelson-optimal S value computed analytically from the WSet<ℂ> circuit.
    /// Equals 2√2 ≈ 2.8284 — the maximum achievable by real quantum mechanics.
    let tsirelsonS : float = bipartiteChshS tsirelsonAngles
    // ── Non-factorizability witness ──────────────────────────────────────────────────────────────
    /// Verify that `phiPlus` is NOT a product state: no pair of single-qubit WSets `(a, b)`
    /// satisfies `WSet.tensor ring a b = phiPlus`.
    ///
    /// The witness is the CHSH S value itself: a product state gives S ≤ 2 (classical bound),
    /// while `phiPlus` gives S = 2√2 > 2. This is the operational definition of entanglement
    /// in the WSet<ℂ> framework — entanglement IS non-factorizability in the ⊗.
    ///
    /// Returns `true` if `phiPlus` is confirmed non-factorizable (S > 2).
    let isNonFactorizable : bool =
        tsirelsonS > 2.0 + 1e-10
