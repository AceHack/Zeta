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
///
/// **Anchor — a qubit IS a "lightlike object" (Beacon; Aaron 2026-06-08).** `IQbservable<'T>` can target any
/// type; the natural family our phase substrate produces is the **spinor / null** family — and that is real
/// geometry, not metaphor: a **2-spinor (= a qubit) ↔ a null (lightlike) direction** on **Penrose's celestial
/// sphere** (Penrose–Rindler, *Spinors and Space-Time* — a spinor is a "null flag": a null direction + a
/// phase), with the **Bloch sphere ≅ the celestial sphere** of null directions; cf. **conformal geometric
/// algebra** (Euclidean points → null vectors on a cone). So "IQbservable → any lightlike object" is anchored:
/// the query produces spinor/null-family objects (qubit canonical, phasors/rays alongside). **Peel:** what's
/// real is the *geometric* correspondence (Bloch ≅ celestial sphere; qubit = null flag); literal photon
/// *dynamics* / relativistic propagation stays Mirror-register — we have the null *geometry*, not light's
/// physics.
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

    /// H (Hadamard): basis change between Z and X measurement axes.
    let hadamard (j: JoinState) : JoinState =
        let invSqrt2 = 1.0 / sqrt 2.0
        let s = { Real = invSqrt2; Imag = 0.0 }
        { A = c.Mul(s, c.Add(j.A, j.B))
          B = c.Mul(s, c.Add(j.A, c.Negate j.B)) }

    /// Ry(θ): real Y-axis Bloch rotation, matching Q#'s half-angle matrix convention.
    let ry (theta: float) (j: JoinState) : JoinState =
        let ct = cos (theta / 2.0)
        let st = sin (theta / 2.0)
        { A = c.Add(c.Mul({ Real = ct; Imag = 0.0 }, j.A), c.Mul({ Real = -st; Imag = 0.0 }, j.B))
          B = c.Add(c.Mul({ Real = st; Imag = 0.0 }, j.A), c.Mul({ Real = ct; Imag = 0.0 }, j.B)) }

    /// Rz(θ): phase rotation with `|0>` carrying `e^{-iθ/2}` and `|1>` carrying `e^{+iθ/2}`.
    let rz (theta: float) (j: JoinState) : JoinState =
        let half = theta / 2.0
        let phase0 = { Real = cos half; Imag = -sin half }
        let phase1 = { Real = cos half; Imag = sin half }
        { A = c.Mul(phase0, j.A)
          B = c.Mul(phase1, j.B) }

    /// Approximate state equality (per-component, within `eps`).
    let equalish (eps: float) (x: JoinState) (y: JoinState) : bool =
        abs (x.A.Real - y.A.Real) < eps
        && abs (x.A.Imag - y.A.Imag) < eps
        && abs (x.B.Real - y.B.Real) < eps
        && abs (x.B.Imag - y.B.Imag) < eps

    /// The imaginary unit as a scalar (so tests can write `scale imagUnit`).
    let imagUnit: Complex = i

    /// **The additive group of qubit states as an `IGroup<JoinState>`** — the numeric-interface citizen
    /// (Aaron 2026-06-08: "implement the numeric interfaces like we liked"). Matches the
    /// `ImaginaryStack.complex : IStarRing<Complex>` *value* pattern (dictionary, not type-implements-iface).
    /// Qubit states form a group under componentwise addition on ℂ² (the vector-space additive structure);
    /// scalar multiplication is `scale`, the Pauli gates are the operators on this group. (States are NOT a
    /// ring — there is no natural state×state product — so `IGroup`, not `IStarRing`, is the right floor.)
    let group: IGroup<JoinState> =
        { new IGroup<JoinState> with
            member _.Inverse(x) = { A = c.Negate x.A; B = c.Negate x.B }
          interface IMonoid<JoinState> with
              member _.Identity = { A = c.Zero; B = c.Zero }
              member _.Combine(x, y) = { A = c.Add(x.A, y.A); B = c.Add(x.B, y.B) } }
