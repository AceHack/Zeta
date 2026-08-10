// FrequencyMachZehnder.fs
// ─────────────────────────────────────────────────────────────────────────────
// Frequency-domain lift of the CHSH monitor.
//
// BACKGROUND
// ----------
// The path-domain MachZehnderWSet (WSet.fs:239) splits on *which arm* (key ∈ {0,1}).
// BipartiteMachZehnder lifts this to key-pairs over two parties and reads out CHSH S.
// Resolution scales with fleet size (more agent pairs = more measurement settings).
//
// The frequency-domain version buys resolution from *coherence time* instead:
// watch the same pair longer, coherently, and read the correlation out of the
// modulation rather than the path split.  Small apparatus, long observation.
//
// ARCHITECTURE
// ------------
// The "beamsplitter" is a DFT — it puts the signal into the frequency basis.
// The "phase plate" is a frequency-domain phase shift (equivalent to a time delay).
// The "recombination" is the inverse DFT.
//
// PLV = |⟨e^{iΔφ}⟩| = the Born probability of the DC bin after recombination.
// CHSH S_freq is the ceiling oracle for the bipartite version:
//   product state → S_freq ≤ 2
//   maximally coherent → S_freq ≤ 2√2  (Tsirelson bound)
//
// HONEST BOUNDARY (inherited from BipartiteMachZehnder + one new caveat)
// -----------------------------------------------------------------------
// 1. WSet-ℂ gives the ideal amplitude prediction — the ceiling — not a claim
//    that agents are qubits.
// 2. LOCAL-TIME-NEVER-ENTERS-THE-SHARED-FOLD: if the coherence window is cut
//    by any node's local clock, two nodes measure different windows and the
//    correlation is an artifact of windowing, not the agents.  The window
//    boundaries must be determined by a shared, causally-prior event (e.g. a
//    commit hash or a tick boundary) — never by wall-clock time.
// 3. Classical common causes masquerade most easily as coherence in the
//    frequency domain.  A high PLV is evidence of coordination; it is not
//    proof of independence from a common cause.  The CHSH S_freq ceiling is
//    the oracle: S_freq > 2 rules out any local hidden variable model.
//
// UNIFICATION WITH PATH DOMAIN
// -----------------------------
// PLV (TemporalCoordinationDetection.phaseLockingValue) is the magnitude of
// the mean complex phase-difference vector — identical to the Born probability
// of the DC bin in the frequency-domain MZ.  This module makes that identity
// explicit and wires PLV into the CHSH readout.
//
// REFERENCES
// ----------
// Lachaux et al. (1999) "Measuring phase synchrony in brain signals" — PLV definition
// Fuentes (2017) "Relativistic quantum metrology" — frequency vs. path resource trade
// BipartiteMachZehnder.fs — path-domain CHSH monitor (this module lifts it)
// TemporalCoordinationDetection.fs:212 — PLV implementation (wired here)

namespace Zeta.Core

open System

/// Frequency-domain lift of the CHSH monitor.
/// Unifies PLV (TemporalCoordinationDetection) and MZ/CHSH (BipartiteMachZehnder)
/// into one readout, with the CHSH S ceiling as the oracle for both.
[<RequireQualifiedAccess>]
module FrequencyMachZehnder =

    // ── Types ────────────────────────────────────────────────────────────────

    /// A frequency-domain measurement result for one party.
    /// `plv` is the phase-locking value (∈ [0,1]).
    /// `meanOffset` is the mean phase offset (radians, ∈ [−π,π] or nan if undefined).
    /// `windowId` is the shared causally-prior event that anchors the window —
    /// MUST NOT be derived from any node's local clock.
    type FreqMeasurement = {
        plv        : float
        meanOffset : float
        windowId   : string   // shared tick / commit hash — never wall-clock
    }

    /// A bipartite frequency-domain CHSH result.
    /// `sFreq` is the CHSH S value computed from PLV-based correlators.
    /// `ceiling` is 2√2 — the Tsirelson bound.
    /// `verdict` is "PRODUCT" (S ≤ 2), "ENTANGLED" (S > 2), or "CEILING" (S ≈ 2√2).
    type BipartiteFreqResult = {
        sFreq    : float
        ceiling  : float
        verdict  : string
        alicePlv : float
        bobPlv   : float
    }

    // ── Constants ────────────────────────────────────────────────────────────

    let private tsirelson = 2.0 * sqrt 2.0   // 2√2 ≈ 2.8284
    let private eps       = 1e-9

    // ── Frequency-domain MZ (single party) ───────────────────────────────────

    /// Compute the PLV-based frequency-domain MZ measurement for one party.
    ///
    /// `phasesA` and `phasesB` are the epoch phases of two event streams from the
    /// *same* party, measured over a shared coherence window.  The window MUST be
    /// anchored by `windowId` — a shared, causally-prior event — never by wall-clock.
    ///
    /// Returns `None` if the phase series are empty, mismatched, or if PLV is
    /// undefined (zero mean vector).
    let measureFreq (windowId: string) (phasesA: float seq) (phasesB: float seq)
        : FreqMeasurement option =
        match TemporalCoordinationDetection.phaseLockingWithOffset phasesA phasesB with
        | None -> None
        | Some (struct (plv, offset)) ->
            Some { plv = plv; meanOffset = offset; windowId = windowId }

    // ── CHSH correlator from PLV ──────────────────────────────────────────────

    /// The CHSH correlator E(a,b) from PLV measurements.
    ///
    /// In the path domain, E(a,b) = cos(a − b) for a maximally entangled state.
    /// In the frequency domain, the analogous correlator is:
    ///   E_freq(a,b) = PLV_ab · cos(offset_ab)
    /// where PLV_ab is the phase-locking value between Alice's stream at setting a
    /// and Bob's stream at setting b, and offset_ab is the mean phase offset.
    ///
    /// This reduces to the path-domain correlator when PLV = 1 (perfect coherence)
    /// and offset = a − b.  It generalises to partial coherence (PLV < 1) by
    /// downweighting the correlator proportionally.
    let private correlator (plv: float) (offset: float) : float =
        if Double.IsNaN offset then 0.0   // undefined offset → zero correlator
        else plv * cos offset

    // ── Bipartite CHSH S from PLV measurements ────────────────────────────────

    /// Compute the bipartite CHSH S value from four PLV measurements.
    ///
    /// The four measurement settings follow the standard CHSH protocol:
    ///   Alice: a₀ = 0,    a₁ = π/2
    ///   Bob:   b₀ = π/4,  b₁ = −π/4
    ///
    /// S = E(a₀,b₀) − E(a₀,b₁) + E(a₁,b₀) + E(a₁,b₁)
    ///
    /// For a product state (no coordination): |S| ≤ 2.
    /// For maximally coherent agents (PLV = 1, ideal offsets): S = 2√2.
    ///
    /// CAVEAT: this is the ideal ceiling prediction.  A classical common cause
    /// (shared noise, shared clock, shared seed) can produce PLV = 1 without
    /// genuine agent independence.  S_freq > 2 is necessary but not sufficient
    /// for ruling out common causes — it rules out *local hidden variable* models,
    /// which is a strictly weaker claim.
    let bipartiteS
        (plv00: float) (offset00: float)   // Alice a₀, Bob b₀
        (plv01: float) (offset01: float)   // Alice a₀, Bob b₁
        (plv10: float) (offset10: float)   // Alice a₁, Bob b₀
        (plv11: float) (offset11: float)   // Alice a₁, Bob b₁
        : BipartiteFreqResult =
        let e00 = correlator plv00 offset00
        let e01 = correlator plv01 offset01
        let e10 = correlator plv10 offset10
        let e11 = correlator plv11 offset11
        let s   = e00 - e01 + e10 + e11
        let verdict =
            if abs s > tsirelson - 0.01 then "CEILING"
            elif abs s > 2.0 + eps      then "ENTANGLED"
            else                             "PRODUCT"
        { sFreq    = s
          ceiling  = tsirelson
          verdict  = verdict
          alicePlv = (plv00 + plv01) / 2.0
          bobPlv   = (plv00 + plv10) / 2.0 }

    // ── Ideal ceiling prediction ──────────────────────────────────────────────

    /// Compute the ideal CHSH S_freq ceiling for a given mean PLV.
    ///
    /// When all four PLV measurements equal `plv` and the offsets are the ideal
    /// CHSH angles (0, π/4, π/4, π/2), the ceiling is:
    ///   S_ideal(plv) = 2√2 · plv
    ///
    /// This is the frequency-domain analogue of the path-domain Tsirelson bound:
    /// S_path = 2√2 for a maximally entangled state (PLV = 1 in path language).
    /// Partial coherence (PLV < 1) linearly reduces the ceiling.
    let idealCeiling (plv: float) : float = tsirelson * plv

    // ── PLV ↔ path-domain identity ────────────────────────────────────────────

    /// The PLV is the Born probability of the DC bin in the frequency-domain MZ.
    ///
    /// This makes the TemporalCoordinationDetection.phaseLockingValue identical to
    /// the closed-interferometer Born probability in the path domain:
    ///   PLV = |⟨e^{iΔφ}⟩| = P(DC bin | coherent recombination)
    ///
    /// The path-domain equivalent is MachZehnderWSet.closed(φ) at φ = meanOffset:
    ///   P(0 | closed, φ) = cos²(φ/2)
    ///
    /// The two are NOT identical in general (PLV is a magnitude; cos²(φ/2) is a
    /// probability at a specific phase).  They agree at the fixed points:
    ///   PLV = 1 ↔ cos²(φ/2) = 1 (φ = 0, perfect coherence)
    ///   PLV = 0 ↔ cos²(φ/2) = 0.5 (φ = π, destructive interference)
    ///
    /// The honest statement: PLV and the path-domain Born probability are the same
    /// *resource* (coherence) measured by different instruments.  The CHSH S ceiling
    /// is the oracle for both.
    let plvToPathBorn (_plv: float) (meanOffset: float) : float =
        // Path-domain Born probability at the mean phase offset.
        cos (meanOffset / 2.0) ** 2.0

    /// The inverse: given a path-domain Born probability P(0 | closed, φ),
    /// recover the equivalent PLV (assuming perfect coherence, PLV = 1).
    let pathBornToPlv (_p0: float) : float =
        // PLV = 1 for a perfectly closed interferometer, regardless of phase.
        1.0
