namespace Zeta.Core

/// **`PhasorEndurance` — the endurance/interference model re-solved on the imaginary-number stack instead of
/// Bayesian (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"can you solve this same problem with some part of the imaginary-number stack instead of Bayesian?
/// It seems like we just hit the unit circle."* We did. The phase model (`SymmetricEndurance.phaseOverlap`,
/// `cos²(Δφ/2)`) is exactly **phasor interference on the unit circle**, so the native formalism is the
/// complex floor of the Cayley–Dickson stack (`CayleyDickson.Complex = Doubled<float>`), not real-valued
/// Bayesian probabilities.
///
/// **The two unifications this buys:**
///   1. **The Z-set delta lives on the unit circle.** A genuine claim `+1 = e^{i0} = (1,0)`; a retraction
///      `-1 = e^{iπ} = (-1,0)` — i.e. **a `-1` retraction IS a 180° rotation** = `ImaginaryStack.complex`'s
///      `Negate`. The `+1`-then-`-1` round trip is the involution `Negate∘Negate = id` (correction, #6).
///      Partial / uncertain claims are other points on the circle (phase ≠ 0, π) — the phase Bayesian discards.
///   2. **Bayesian is the `|·|²` shadow (Born rule).** A real probability is the squared magnitude of a
///      complex amplitude: `bornProbability z = |z|²`. So the SoftValue/`observe` treatment is recoverable
///      from the phasor model by dropping the phase — the complex version is strictly more information
///      (it keeps the interference phase that makes constructive/destructive distinguishable).
///
/// **What falls out:** `overlap φ₁ φ₂ = |e^{iφ₁} + e^{iφ₂}|² / 4 = cos²(Δφ/2)` — the same overlap
/// `SymmetricEndurance` derived, now as a one-line phasor sum. Constructive (in-phase) ⇒ `|sum|=2 ⇒ overlap
/// 1`; destructive (anti-phase) ⇒ `|sum|=0 ⇒ overlap 0`; 90° ⇒ `½`.
///
/// **Honest scope (peel):** a re-expression, not a new result — it computes the *same* interference the
/// Bayesian/phase model did, on the repo's existing `CayleyDickson` stack (`ImaginaryStack.complex`). Its
/// value is (a) the native algebra (`-1` = `Negate` = π-rotation, addition = superposition) and (b) making
/// explicit that Bayesian = Born-rule shadow. Deterministic (DST §7). Floats: ordinal/culture-invariant math.
module PhasorEndurance =

    // Complex / Doubled / ImaginaryStack live directly in Zeta.Core (CayleyDickson.fs has no module wrapper).
    /// A phasor `r·e^{iφ}` as a stack `Complex` (`Doubled<float>` = `{ Real; Imag }`). `r` = claim magnitude,
    /// `φ` = heartbeat phase (radians).
    let phasor (r: float) (phi: float) : Complex = { Real = r * cos phi; Imag = r * sin phi }

    /// A unit heartbeat phasor at phase `φ` (magnitude 1).
    let heartbeat (phi: float) : Complex = phasor 1.0 phi

    /// The genuine `+1` delta = `e^{i0} = (1,0)` = the ring's `One`.
    let genuineDelta: Complex = ImaginaryStack.complex.One

    /// The retraction `-1` delta = `e^{iπ} = (-1,0)` = `Negate One`. **A `-1` is a 180° rotation.**
    let retractionDelta: Complex = ImaginaryStack.complex.Negate ImaginaryStack.complex.One

    /// Superpose two claims (interference) = complex addition on the stack.
    let combine (a: Complex) (b: Complex) : Complex = ImaginaryStack.complex.Add(a, b)

    /// Retract a claim = rotate it by π (multiply by `-1`) = the ring `Negate`. Involution: `retract∘retract =
    /// id` (the `+1`/`-1` Z-set round trip is a correction, not a duplicate, #6).
    let retract (z: Complex) : Complex = ImaginaryStack.complex.Negate z

    /// Magnitude `|z| = √(Real² + Imag²)` — the claim strength.
    let magnitude (z: Complex) : float = sqrt (z.Real * z.Real + z.Imag * z.Imag)

    /// **Born rule:** the Bayesian (real) probability is the squared magnitude of the complex amplitude.
    /// Dropping the phase here recovers the SoftValue treatment from the phasor one.
    let bornProbability (z: Complex) : float = z.Real * z.Real + z.Imag * z.Imag

    /// Interference overlap of two unit heartbeats at phases `φ₁,φ₂`, on the unit circle:
    /// `|e^{iφ₁} + e^{iφ₂}|² / 4`. Equals `cos²(Δφ/2)` (= `SymmetricEndurance.phaseOverlap`) — derived here by
    /// a single phasor sum instead of a trig identity. `1` in-phase, `0` anti-phase, `½` at 90°.
    let overlap (phi1: float) (phi2: float) : float =
        bornProbability (combine (heartbeat phi1) (heartbeat phi2)) / 4.0
