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

    /// **The interference step:** sum the amplitudes of *identical* frames. Opposite-phase amplitudes cancel
    /// (destructive), equal-phase reinforce (constructive) — this is where the wave phase cancels. Frames use
    /// structural equality (persistent `Map` + arrays). Drops amplitudes that cancel to ≈0 (a fully destroyed path).
    let merge (a: Amp) : Amp =
        a
        |> List.groupBy fst
        |> List.choose (fun (f, group) ->
            let summed = group |> List.fold (fun acc (_, z) -> c.Add(acc, z)) c.Zero
            if magSq summed <= EPS then None else Some(f, summed))

    /// A point mass — amplitude 1 at one frame.
    let pure1 (f: Chip8Cow.Frame) : Amp = [ f, c.One ]

    /// Lift a classical `SoftEmu.Soft` (real weights) into amplitudes (phase 0) — `√weight` so that
    /// `|amp|² = weight` (amplitude, not probability). The classical mixture as a phase-0 amplitude state.
    let ofSoft (s: SoftEmu.Soft) : Amp =
        s |> List.map (fun (f, w) -> f, real (sqrt (max 0.0 w)))

    /// Total Born intensity `Σ|z|²` (the norm² before normalization).
    let intensity (a: Amp) : float = a |> List.sumBy (fun (_, z) -> magSq z)

    /// Normalize so `Σ|z|² = 1` (divide every amplitude by the norm). Empty / zero ⇒ empty (no fabricated norm).
    let normalize (a: Amp) : Amp =
        let norm = sqrt (intensity a)
        if norm <= EPS then []
        else a |> List.map (fun (f, z) -> f, c.Mul(z, real (1.0 / norm)))

    /// **Born-rule measurement:** the probability distribution over frames = `|amp|² / Σ|amp|²`. The one place
    /// amplitudes become probabilities. (Always real, non-negative, sums to 1.)
    let bornProb (a: Amp) : (Chip8Cow.Frame * float) list =
        let total = intensity a
        if total <= EPS then []
        else a |> List.map (fun (f, z) -> f, magSq z / total)

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
        |> List.groupBy fst
        |> List.choose (fun (f, group) ->
            let summed = group |> List.fold (fun acc (_, z) -> c.Add(acc, z)) c.Zero
            if magSq summed <= EPS then None else Some(f, summed))

    /// **Soft amplitude step (CHIP-8 specific):** advance every branch using `SoftChip8.forkOnInput`,
    /// then merge. This is the backward-compatible wrapper — new code should use `step` with a custom fork.
    let softStep (a: Amp) : Amp =
        step SoftChip8.forkOnInput a

    /// Collapse to the most-probable frame under the Born rule (the one legitimate definite choice). `None` if empty.
    let measure (a: Amp) : Chip8Cow.Frame option =
        match bornProb a with
        | [] -> None
        | ps -> ps |> List.maxBy snd |> fst |> Some
