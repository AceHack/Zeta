namespace Zeta.Core

/// **`AmplitudeEmu` — the soft emulator with COMPLEX amplitudes, so it actually *interferes* (Aaron 2026-06-08, shadow*).**
///
/// Aaron caught the real sloppiness: *"we had complex amplitudes on our qubit — the rotations of the unit
/// circle. Why can't we construct a generator that hits this? Does merging make the wave phase cancel?"* —
/// **yes, it does, and this is where.** `SoftEmu` (#7095) used *real* weights (a classical probability
/// mixture: no phase ⇒ no interference). This module is the same ensemble with **complex-amplitude weights**
/// (the `QubitIso`/`ImaginaryStack.Complex` phasor — `e^{iθ}`, unit-circle rotations). The single change that
/// turns a classical mixture into a quantum-like amplitude is the **merge**:
///
///   - **`merge` sums the amplitudes of identical frames** — and complex amplitudes with opposite phase
///     *cancel* (destructive) while equal phase *reinforce* (constructive). **That is interference**, in code.
///     It is exactly the CAS-dedup-merge `SoftEmu` deliberately dropped: drop the merge *and* use real weights
///     ⇒ no interference; restore the merge *with* complex weights ⇒ the two-slit falls out.
///   - **`bornProb` measures by `|amplitude|²`** (the Born rule) — the only place amplitudes become
///     probabilities, normalized over the ensemble intensity.
///
/// **Honest scope (peel) — read before believing this "simulates qubits":**
///   - **Interference is real here; the entanglement exponential is NOT escaped.** This is cheap only while the
///     number of *distinct* frames stays small (low entanglement / few reconverging paths). General
///     high-entanglement state needs `4ⁿ` reals — the merge does not reduce that count; it only collapses paths
///     that *reconverge to the identical frame*. `support` growing un-merged IS the exponential, logged not hidden.
///   - **CHIP-8 opcodes introduce no phase.** Genuine interference needs a *phase source* (a quantum-gate
///     opcode, or driving amplitudes through the `QubitIso` layer); plain CHIP-8 steps keep amplitudes real, so
///     `softStep` here is the *substrate* for interference, demonstrated directly by `merge` (the two-path test),
///     not produced by the ROM. This is the bridge layer `SoftEmu` lacked, not a quantum CPU.
///   - **Bell still bounds the *correlations* at S=2 for a local generator** (`SoftEmu` doc / FeedbackThrottle):
///     complex amplitudes buy *interference*, not non-locality. 2√2 still needs the feedback/superdeterminism
///     channel. Amplitudes ≠ entanglement ≠ signalling — three separate resources.
///
/// So: this answers "does merging make the phase cancel?" with runnable code (yes), while holding that
/// interference, the 4ⁿ entanglement wall, and the Bell S=2 bound are three distinct things.
///
/// ## §Laws — what this fold IS, and what it is NOT (Lumen 2026-08-14, all CHECKED)
///
/// The carrier is the **free ℂ-module on frames**, `ℂ[Frame]`: a finite formal ℂ-linear combination.
/// The combine `a ⊞ b = merge (a @ b)` is **vector addition** — so the intended algebra is an
/// **abelian group** (commutative monoid + inverses), *not* a bounded join-semilattice.
///
/// **It is therefore NOT a `universal/evidence` join, and it never was.** A join is idempotent
/// (`x ⊔ x = x`); this SUMS (`a ⊞ a = 2a`, measured). That is correct for interference — distinct paths
/// to one outcome — and wrong for evidence. §12 idempotency is **declined by design at this layer**, not
/// violated by accident. The named split lives in `QuorumAlgebra` (`join` = evidence, `interfere` = this).
///
/// **On top of that naming defect there is a real arithmetic one: the `EPS = 1e-12` drop.** It deletes
/// any summed branch with `|z| ≤ 1e-6` — a *dimensionful* threshold on `|z|²` in a theory whose states
/// are **rays** (only `|z|²/Σ|z|²` is physical). Consequences, each measured in
/// `tests/Tests.FSharp/QuorumAlgebra.Tests.fs`:
///
///   - **Associativity FAILS structurally.** `((a⊞b)⊞c) = []` vs `(a⊞(b⊞c)) = 1.6e-6` for
///     `a=1, b=-1+8e-7, c=8e-7` — one path measures `None`, the other `Some frame`. With a large third
///     term the gap is `1.0e-7` on a value of `5.0` ≈ **1.1e8 ULPs**: structural, not float noise.
///   - **Scale-covariance FAILS.** `merge` is not ℂ-homogeneous: `support(a) = 2` but `support(0.5·a) = 1`
///     for `a = [f↦1, f↦-1+2e-6, g↦1]`, and the Born distribution changes with a rescaling that is
///     physically the identity. **Halving a state changes its measured probabilities.**
///   - **`merge` IS idempotent as a normalisation** (`merge ∘ merge = merge`) — that part holds.
///
/// So the layer as written **cannot be byte-locked** (four-oracle) and is **not DST-order-safe** under
/// re-association. `QuorumAlgebra.interfereQuorum` restores a canonical summation order; exactness
/// needs the cyclotomic carrier scoped in
/// `docs/research/2026-08-14-the-quorum-fold-is-not-a-join-interference-vs-evidence-and-the-cyclotomic-exit-lumen.md`.
///
/// **That carrier has now SHIPPED: `src/Core/CyclotomicAmplitude.fs` (`Cyc`, `Z[zeta_16][1/sqrt2]`).**
/// It is the fix, and this module is not deleted because (a) the continuous-phase interferometer
/// sweeps genuinely need floats and are permanently outside the byte-lock treaty, and (b) an exact
/// carrier is **blind to the Z-EPS defect by construction**, so the regression evidence for the
/// signalling channel can only live against THIS path. See
/// `tests/Tests.FSharp/Formal/AmplitudeEmuSignalling.Tests.fs` (the witness, unchanged) and
/// `tests/Tests.FSharp/CyclotomicAmplitude.Tests.fs` section C (the differential that holds both
/// carriers in one assertion, so deleting this one breaks the pair loudly).
[<RequireQualifiedAccess>]
module AmplitudeEmu =

    let private c = ImaginaryStack.complex

    /// The whole emulator as an *amplitude* ensemble: each joint frame carries a complex amplitude (not a real
    /// probability). The superposition is the list; the physics is in how amplitudes combine under `merge`.
    type Amp = (Chip8Cow.Frame * Complex) list

    let private EPS = 1e-12

    /// Born intensity of one amplitude: `|z|²`.
    let private magSq (z: Complex) : float = z.Real * z.Real + z.Imag * z.Imag

    /// A real amplitude (phase 0).
    let private real (r: float) : Complex = { Real = r; Imag = 0.0 }

    /// **The interference step, generic in the key** — identical arithmetic to `merge`, lifted off
    /// `Chip8Cow.Frame` so the quorum layer (`QuorumAlgebra`) can use the same fold on its own keys.
    /// `merge` and the tail of `step` are both this function; the duplication is removed, not the behaviour.
    ///
    /// **This is a SUM, and therefore NOT a `universal/evidence` join** — see the module header §Laws.
    let mergeOf (a: ('F * Complex) list) : ('F * Complex) list =
        a
        |> List.groupBy fst
        |> List.choose (fun (f, group) ->
            let summed = group |> List.fold (fun acc (_, z) -> c.Add(acc, z)) c.Zero
            if magSq summed <= EPS then None else Some(f, summed))

    /// **The interference step:** sum the amplitudes of *identical* frames. Opposite-phase amplitudes cancel
    /// (destructive), equal-phase reinforce (constructive) — this is where the wave phase cancels. Frames use
    /// structural equality (persistent `Map` + arrays). Drops amplitudes that cancel to ≈0 (a fully destroyed path).
    ///
    /// **NOT a join** (§Laws in the module header): this SUMS, so `merge (a @ a) = 2a`, never `a`. The
    /// quorum-layer operations that name the two algebras apart live in `QuorumAlgebra`.
    let merge (a: Amp) : Amp = mergeOf a

    /// A point mass — amplitude 1 at one frame.
    let pure1 (f: Chip8Cow.Frame) : Amp = [ f, c.One ]

    /// Lift a classical `SoftEmu.Soft` (real weights) into amplitudes (phase 0) — `√weight` so that
    /// `|amp|² = weight` (amplitude, not probability). The classical mixture as a phase-0 amplitude state.
    let ofSoft (s: SoftEmu.Soft) : Amp =
        s |> List.map (fun (f, w) -> f, real (sqrt (max 0.0 w)))

    /// Total Born intensity `Σ|z|²` (the norm² before normalization), generic in the key.
    let intensityOf (a: ('F * Complex) list) : float = a |> List.sumBy (fun (_, z) -> magSq z)

    /// Total Born intensity `Σ|z|²` (the norm² before normalization).
    let intensity (a: Amp) : float = intensityOf a

    /// Normalize so `Σ|z|² = 1` (divide every amplitude by the norm). Empty / zero ⇒ empty (no fabricated norm).
    let normalize (a: Amp) : Amp =
        let norm = sqrt (intensity a)
        if norm <= EPS then []
        else a |> List.map (fun (f, z) -> f, c.Mul(z, real (1.0 / norm)))

    /// **Born-rule measurement:** the probability distribution over frames = `|amp|² / Σ|amp|²`. The one place
    /// amplitudes become probabilities. (Always real, non-negative, sums to 1.)
    let bornProbOf (a: ('F * Complex) list) : ('F * float) list =
        let total = intensityOf a
        if total <= EPS then []
        else a |> List.map (fun (f, z) -> f, magSq z / total)

    /// **Born-rule measurement** at the CHIP-8 frame key — see `bornProbOf` for the generic form.
    let bornProb (a: Amp) : (Chip8Cow.Frame * float) list = bornProbOf a

    /// Number of distinct-after-merge branches (the ensemble width; un-merged growth = the entanglement cost).
    let support (a: Amp) : int = a |> merge |> List.length

    /// **Generic amplitude step:** advance every branch using an arbitrary fork function, then merge.
    /// The fork function takes a frame and returns a list of (newFrame, probability) pairs.
    /// This is the decoupled version — any domain (CHIP-8, arithmetic IR, custom ops) can plug in.
    /// Support grows only when the fork produces multiple outputs for one input.
    let step (fork: 'F -> ('F * float) list) (a: ('F * Complex) list) : ('F * Complex) list =
        a
        |> List.collect (fun (f, z) ->
            fork f
            |> List.map (fun (f', p) -> f', c.Mul(z, real (sqrt p))))
        |> mergeOf

    /// **Soft amplitude step (CHIP-8 specific):** advance every branch using `SoftChip8.forkOnInput`,
    /// then merge. This is the backward-compatible wrapper — new code should use `step` with a custom fork.
    let softStep (a: Amp) : Amp =
        step SoftChip8.forkOnInput a

    /// Collapse to the most-probable frame under the Born rule (the one legitimate definite choice). `None` if empty.
    let measure (a: Amp) : Chip8Cow.Frame option =
        match bornProb a with
        | [] -> None
        | ps -> ps |> List.maxBy snd |> fst |> Some
