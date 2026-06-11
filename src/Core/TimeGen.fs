namespace Zeta.Core

/// TimeGen — **time as a generator function, made a treaty primitive instead of a metaphor** (Amara's
/// ferried design + her named "next proof should be small", 2026-06-11; Aaron: "in our DST step time
/// is a generator function too — we can make whatever we want for all contributors to count on, from
/// seed common cause; allow possible S=2√2, maybe S=4 staged coincidence; and we have a four-corner
/// feedback model for adjustments over time").
///
/// The model (Amara's, implemented): **the clock is a generator and the seed is the common cause.**
/// Contributors never trust wall time — they replay the same seeded time treaty. The generator is
/// VERSIONED AND ADDRESSED (her "tiny blade": changing time semantics must never be silent).
///
/// The CHSH four corners are the feedback surface, and the three regimes are SCHEDULER REGIMES, not
/// physics claims (her labels kept exactly):
/// - `ClassicalCommonCause` — seeded hidden-variable model ⇒ S ≤ 2 (the classical bound).
/// - `PhasorTsirelson` — the phasor scheduler, E(a,b) = cos(a−b) ⇒ S = 2√2 (the unit circle we
///   already live on; analytic, exact-by-construction).
/// - `StagedCoincidence` — the scheduler stages the corners ⇒ S = 4, **hard-labeled STAGED**: a
///   stress-test scheduler, never evidence of nonlocality (the seed IS the coordination channel; the
///   free-choice assumption is deliberately violated and SAID SO).
///
/// Honest scope: correlations here are float-valued (cos) — per the treaty discipline float kernels
/// stay OUTSIDE the byte-lock; the STRUCTURE (regimes, corners, versioning, determinism-from-seed) is
/// the treaty surface; fixed-point phases are the named slice if cross-oracle goldens are wanted.
[<RequireQualifiedAccess>]
module TimeGen =

    /// The scheduler regimes (Amara's names, verbatim).
    type Regime =
        | ClassicalCommonCause
        | PhasorTsirelson
        | StagedCoincidence

    /// The versioned, addressed generator — "the root includes the time generator, so every
    /// contributor knows exactly which common cause they are sharing."
    type Generator =
        { Id: string // the generator's address (ZetaId-shaped slot; minted upstream)
          Version: int
          Seed: uint64
          Regime: Regime }

    let mk (id: string) (version: int) (seed: uint64) (regime: Regime) : Generator =
        { Id = id; Version = version; Seed = seed; Regime = regime }

    /// One generated instant: what a contributor derives instead of reading a wall clock.
    type GeneratedTime =
        { Tick: int
          Phase: float // radians on the unit circle (the phasor)
          Regime: Regime }

    // deterministic SplitMix64 — the seed is the common cause, the only entropy anywhere here.
    let private mix (z0: uint64) : uint64 =
        let z = z0 + 0x9E3779B97F4A7C15UL
        let z = (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        let z = (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)

    let private unit (g: Generator) (k: uint64) : float =
        float (mix (g.Seed ^^^ k) >>> 11) / 9007199254740992.0 // [0,1), 53-bit

    /// Generate the instant for (contributor, step): tick + phase from the seed — never from a wall.
    let at (g: Generator) (contributor: uint64) (step: int) : GeneratedTime =
        { Tick = step
          Phase = 2.0 * System.Math.PI * unit g (contributor * 0x9E37UL + uint64 step)
          Regime = g.Regime }

    // ── the CHSH four corners (the feedback surface) ──

    /// The standard corner angles that reach Tsirelson under the phasor scheduler.
    let cornerAngles: (float * float) list =
        let a0, a1 = 0.0, System.Math.PI / 2.0
        let b0, b1 = System.Math.PI / 4.0, -System.Math.PI / 4.0
        [ a0, b0; a0, b1; a1, b0; a1, b1 ]

    /// The correlation E(a,b) a regime's scheduler produces at a corner. Classical samples a seeded
    /// hidden variable λ (deterministic; `n` samples); Phasor is the analytic cos(a−b); Staged returns
    /// the staged corner table (+1,+1,+1,−1) — coordination BY the seed, labeled as such.
    let correlation (g: Generator) (n: int) (cornerIx: int) (a: float) (b: float) : float =
        match g.Regime with
        | PhasorTsirelson -> cos (a - b)
        | StagedCoincidence -> if cornerIx = 3 then -1.0 else 1.0
        | ClassicalCommonCause ->
            // λ from the seed; outcomes A = sign cos(a−λ), B = sign cos(b−λ) — a local HV model.
            let samples = max 1 n
            let mutable acc = 0.0
            for i in 0 .. samples - 1 do
                let lambda = 2.0 * System.Math.PI * unit g (uint64 i)
                let av = if cos (a - lambda) >= 0.0 then 1.0 else -1.0
                let bv = if cos (b - lambda) >= 0.0 then 1.0 else -1.0
                acc <- acc + av * bv
            acc / float samples

    /// The CHSH S at the four corners: E₀₀ + E₀₁ + E₁₀ − E₁₁.
    let chsh (g: Generator) (n: int) : float =
        let es =
            cornerAngles
            |> List.mapi (fun i (a, b) -> correlation g n i a b)
        match es with
        | [ e00; e01; e10; e11 ] -> e00 + e01 + e10 - e11
        | _ -> 0.0

    /// Is this run's correlation HONESTLY labeled? Staged S=4 must say it is staged — the label is
    /// part of the value, so a result can never masquerade as physical nonlocality.
    let label (g: Generator) : string =
        match g.Regime with
        | ClassicalCommonCause -> "classical-common-cause (local HV; S<=2)"
        | PhasorTsirelson -> "phasor (unit circle; S=2*sqrt(2))"
        | StagedCoincidence -> "STAGED coincidence (seed-coordinated; free-choice violated BY DESIGN; not physical)"

    // ── the four-corner feedback (deterministic adjustment over time) ──

    /// One bounded feedback step: error = target − observed S, applied as a phase-table offset with a
    /// deterministic clamp. "The feedback loop is not hidden adaptation — it is a replayable update."
    let feedback (target: float) (observed: float) (maxStep: float) (phaseOffset: float) : float =
        let err = target - observed
        phaseOffset + (max -maxStep (min maxStep (0.5 * err)))
