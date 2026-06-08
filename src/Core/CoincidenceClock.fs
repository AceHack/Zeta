namespace Zeta.Core

/// **`CoincidenceClock` — controlling time stages "immaculate coincidence" (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"no spatial entanglement, no physical superposition — but when you control time you can cause
/// immaculate coincidence. You can make this happen, with the right time generator."* He's right, and it has
/// a precise foundations name: **superdeterminism / the measurement-independence ("free-choice") loophole.**
/// Bell's theorem forbids classically reproducing quantum correlations *only* when the measurement settings
/// are independent of the system. A controller of the DST time generator **is the shared common cause** that
/// correlates both agents' events — so it can **stage** any correlation that would otherwise need entanglement.
/// This is exactly **'t Hooft's Cellular-Automaton Interpretation of QM** (deterministic substrate +
/// superdeterminism ⇒ quantum statistics); here the substrate is DST and the "right time generator" is the seed.
///
/// **What it does:** invert the interference law. `PhasorEndurance.overlap φ₁ φ₂ = cos²(Δφ/2)`. To *manufacture*
/// a target overlap `t`, solve for the phase difference: `Δφ = 2·acos(√t)`. `stageCoincidence` assigns the two
/// agents that relative phase off one baseline — the baseline being the generator (the shared cause). Any
/// `t ∈ [0,1]` is reachable: perfect coincidence (`t=1 ⇒ Δφ=0`) through perfect anti-coincidence
/// (`t=0 ⇒ Δφ=π`) — with **no entanglement**, because the same generator sets both phases.
///
/// **Honest scope (peel):** this reproduces the **observable correlation** by **shared cause**, NOT spatial
/// entanglement of physical states — but for a simulation the correlation *is* the whole observable, so it is
/// genuinely achievable (quantum-LIKE, staged). The price is superdeterminism's: the agents' "free choice" is
/// not free — time arranges it.
///
/// **The DST | production boundary resolves the feature/threat question (Aaron 2026-06-08).** *"Once things
/// are stageable we have a roadmap — the two real deployed agents can agree to it, and they can assume time is
/// who it says it is in the system; it's not faked outside of DST."* Staging is a **DST-only power**: in the
/// simulator we *are* the time-controller, so we can stage every correlation — which gives the **roadmap**
/// (exhaustive, deterministic scenario testing: drive consensus through every coincidence/Byzantine-timing
/// case). In **production** no one controls the seed — time is the real, non-fungible physical clocks — so the
/// superdeterminism capability **does not transfer to a deployed attacker**: real agents may **assume time is
/// genuine** and the anti-Sybil non-fungibility holds. So `CoincidenceClock` is a **test instrument** (stage
/// any scenario), not a deployed surface; the "malicious time-controller faking agreement" only exists inside
/// DST. (Aminata/Nadia: confirm the boundary — that nothing ships a production path where an agent's seed is
/// externally controllable.)
/// Deterministic (DST §7); pure phasor math on the imaginary stack.
module CoincidenceClock =

    let private clamp01 (x: float) : float = max 0.0 (min 1.0 x)

    /// The phase difference (radians) that yields interference overlap `target ∈ [0,1]`: `Δφ = 2·acos(√t)`,
    /// the inverse of `PhasorEndurance.overlap`'s `cos²(Δφ/2)`. `t=1 ⇒ 0` (coincidence); `t=0 ⇒ π`
    /// (anti-coincidence); `t=½ ⇒ π/2`.
    let phaseForOverlap (target: float) : float = 2.0 * acos (sqrt (clamp01 target))

    /// Stage two agents to a target overlap by assigning the second's phase relative to `baseline` (the shared
    /// cause = the time generator). Returns `(φ₁, φ₂)` such that `PhasorEndurance.overlap φ₁ φ₂ ≈ target`.
    let stageCoincidence (baseline: float) (target: float) : float * float =
        baseline, baseline + phaseForOverlap target

    /// Any correlation in `[0,1]` is stage-able — because time is the shared hidden cause (superdeterminism).
    let canStage (target: float) : bool = target >= 0.0 && target <= 1.0

    /// Verify a staged pair actually realises the target overlap (within `eps`) — the round-trip through
    /// `PhasorEndurance.overlap`. The proof that the time-controller manufactured the coincidence.
    let realises (eps: float) (target: float) : bool =
        let phi1, phi2 = stageCoincidence 0.0 target
        abs (PhasorEndurance.overlap phi1 phi2 - clamp01 target) < eps
