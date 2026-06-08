namespace Zeta.Core

/// **`QubitIso` — the two-stream/two-clock join ↔ qubit isomorphism, *coded as an executable proof*
/// (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"let's move forward with proofs and see what pops out — can we code any of the proofs in F#?"*
/// Yes. The candidate-novelty iso (`docs/research/2026-06-08-CANDIDATE-NOVELTY-...`) is finite linear
/// algebra, so it is **checkable in F# directly** (executable proof; the FsCheck/deterministic-sweep half of
/// Soraya's TLC×Z3×property portfolio). This module *constructs* the iso and exposes the operations so the
/// tests can verify the **Pauli / SU(2) algebra closes** — the one open leg (operations) of the iso.
///
/// **The object.** A `JoinState` is the two stream amplitudes `(A, B)` — stream A = the `|0⟩` amplitude,
/// stream B = the `|1⟩` amplitude, each a phasor on the imaginary stack (`CayleyDickson.Complex`), the two
/// clocks supplying the phases. That *is* a qubit `α|0⟩ + β|1⟩` (`α = A`, `β = B`). So the state bijection is
/// the identity on `ℂ²` (round-trip trivial); the content is whether the **stream operations** correspond to
/// the qubit gates and whether **measurement** is Born.
///
/// **The dictionary under test (what must hold for the operations leg):**
///   - **Z** (phase-flip `|1⟩`) = `retract` the B stream (`e^{iπ}`, already shown an involution);
///   - **X** (bit-flip) = **swap the two streams** (A ↔ B);
///   - **Y** = `iXZ` = `A ↦ -i·B`, `B ↦ i·A`;
///   - **measurement** `P(|1⟩) = |B|² / (|A|²+|B|²)` = Born;
///   - **normalisation** `|A|²+|B|²` is the conserved quantity.
/// The tests verify the Pauli group: `X²=Y²=Z²=I`, anticommutation, and `XY=iZ, YZ=iX, ZX=iY`. **What pops
/// out:** if these all hold, the *operations leg* of the iso is established executably (a faithful `SU(2)`
/// representation by stream ops); if any fails, it's a partial representation — stated honestly by the failing
/// test, not hidden.
///
/// **Honest scope (peel):** an executable check over `ℂ²`, not a Lean machine-proof — it establishes the
/// algebra on the concrete construction (cross-checks the eventual Z3/Lean per BP-16). A passing suite is
/// strong evidence the operations leg holds; the *universal* statement + novelty of the construction still go
/// to Tariq/Soraya + a quantum-info reviewer (Mirror-register until then). Deterministic (DST §7).
[<RequireQualifiedAccess>]
module QubitIso =

    let private c = ImaginaryStack.complex
    let private i: Complex = { Real = 0.0; Imag = 1.0 }
    let private negI: Complex = { Real = 0.0; Imag = -1.0 }

    /// A two-stream join state = a qubit. `A` = stream-A / `|0⟩` amplitude, `B` = stream-B / `|1⟩` amplitude.
    type JoinState = { A: Complex; B: Complex }

    /// Qubit `α|0⟩ + β|1⟩` ↔ join `(A,B)` — the state bijection is the identity on `ℂ²`.
    let ofQubit (alpha: Complex) (beta: Complex) : JoinState = { A = alpha; B = beta }
    let toQubit (j: JoinState) : Complex * Complex = j.A, j.B

    /// `|z|²`.
    let private magSq (z: Complex) : float = z.Real * z.Real + z.Imag * z.Imag

    /// The conserved normalisation `|A|² + |B|²` (= 1 for a unit qubit).
    let normSq (j: JoinState) : float = magSq j.A + magSq j.B

    /// Born measurement: `P(|1⟩) = |B|² / (|A|²+|B|²)`.
    let measureOne (j: JoinState) : float =
        let n = normSq j
        if n = 0.0 then 0.0 else magSq j.B / n

    // ── Pauli gates as stream operations ──────────────────────────────────────────────────────────────────
    /// X (bit-flip) = swap the two streams.
    let pauliX (j: JoinState) : JoinState = { A = j.B; B = j.A }
    /// Z (phase-flip |1⟩) = retract stream B (`e^{iπ}` = ring Negate).
    let pauliZ (j: JoinState) : JoinState = { A = j.A; B = c.Negate j.B }
    /// Y = iXZ: `A ↦ -i·B`, `B ↦ i·A`.
    let pauliY (j: JoinState) : JoinState = { A = c.Mul(negI, j.B); B = c.Mul(i, j.A) }
    /// Multiply the whole state by a global phase/scalar `s`.
    let scale (s: Complex) (j: JoinState) : JoinState = { A = c.Mul(s, j.A); B = c.Mul(s, j.B) }

    /// Identity gate.
    let id (j: JoinState) : JoinState = j

    /// Approximate state equality (per-component, within `eps`).
    let equalish (eps: float) (x: JoinState) (y: JoinState) : bool =
        abs (x.A.Real - y.A.Real) < eps
        && abs (x.A.Imag - y.A.Imag) < eps
        && abs (x.B.Real - y.B.Real) < eps
        && abs (x.B.Imag - y.B.Imag) < eps

    /// The imaginary unit as a scalar (so tests can write `scale imagUnit`).
    let imagUnit: Complex = i
