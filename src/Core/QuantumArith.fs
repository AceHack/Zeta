namespace Zeta.Core

/// **QuantumArith — Canonical quantum arithmetic library (hexagonal port).**
///
/// This module defines the `IQuantumArith<'C>` port interface and provides
/// the canonical implementation using `Doubled<float>` (= Complex).
///
/// ## Hexagonal port pattern
///
/// The port interface `IQuantumArith<'C>` is the only thing the application
/// layer (WSet, HlAmplitudeEmu, ZSetISA) should depend on. External adapters
/// (OpenQASM, Qrisp) implement the same interface. The canonical implementation
/// is the byte-lock reference — all substrates (F#, TypeScript, Q#) must
/// produce the golden vectors in `testdata/quantum-arith-golden.json`.
///
/// ## Byte-lock discipline
///
/// All operations use IEEE 754 double precision (64-bit) with
/// round-to-nearest-even. No FMA, no fast-math, no platform-specific
/// intrinsics. The golden vectors are computed by the Python reference
/// in `docs/research/2026-08-09-quantum-arith-hexagonal-port-spec-lumen.md`.
///
/// ## Second quantum language
///
/// OpenQASM 3.0 is the recommended second quantum language (see spec doc).
/// The `OpenQASMAdapter` stub at the bottom of this file is the hexagonal
/// adapter that wraps OpenQASM 3.0 circuit output behind `IQuantumArith`.

open System

// ── Port interface ─────────────────────────────────────────────────────────────

/// The canonical quantum arithmetic port interface.
/// Parameterised over a complex number type 'C.
/// The canonical implementation uses Doubled<float> (= Complex).
type IQuantumArith<'C> =
    // Core complex arithmetic
    abstract Zero : 'C
    abstract One : 'C
    abstract OfReal : float -> 'C
    abstract OfPolar : r: float -> theta: float -> 'C
    abstract Add : 'C -> 'C -> 'C
    abstract Mul : 'C -> 'C -> 'C
    abstract Conj : 'C -> 'C
    abstract MagSq : 'C -> float
    abstract Scale : float -> 'C -> 'C
    abstract Neg : 'C -> 'C
    // Blaschke factor (canonical conformal map primitive)
    abstract Blaschke : z: 'C -> a: 'C -> 'C
    abstract BlascheDerivMagSq : z: 'C -> a: 'C -> float
    abstract HlBumpParam : lambda0: float -> theta: float -> 'C
    // Quantum gate layer (Born-probability)
    abstract InvSqrt2 : float
    abstract TsirelsonS : float

// ── Canonical implementation (Doubled<float> = Complex) ───────────────────────

/// Canonical QuantumArith implementation using Doubled<float> (= Complex).
/// This is the byte-lock reference. All golden vectors must match exactly.
[<RequireQualifiedAccess>]
module QuantumArith =

    // ── Internal helpers ────────────────────────────────────────────────────────

    /// Complex number as a pair of floats (real, imag).
    /// We use a plain tuple internally to avoid any boxing overhead.
    type C = float * float

    let re (z: C) = fst z
    let im (z: C) = snd z
    let mk r i : C = (r, i)

    // ── Core operations ─────────────────────────────────────────────────────────

    let zero : C = mk 0.0 0.0
    let one  : C = mk 1.0 0.0

    let ofReal (r: float) : C = mk r 0.0

    /// r·cos(θ) + r·sin(θ)·i
    let ofPolar (r: float) (theta: float) : C =
        mk (r * Math.Cos theta) (r * Math.Sin theta)

    /// (ar+br) + (ai+bi)i
    let add (a: C) (b: C) : C =
        mk (re a + re b) (im a + im b)

    /// (ar·br−ai·bi) + (ar·bi+ai·br)i
    let mul (a: C) (b: C) : C =
        mk (re a * re b - im a * im b) (re a * im b + im a * re b)

    /// ar − ai·i
    let conj (a: C) : C = mk (re a) (-(im a))

    /// ar² + ai²
    let magSq (a: C) : float = re a * re a + im a * im a

    /// (s·ar) + (s·ai)i
    let scale (s: float) (a: C) : C = mk (s * re a) (s * im a)

    /// (−ar) + (−ai)i
    let neg (a: C) : C = mk (-(re a)) (-(im a))

    /// Complex division: a / b
    let div (a: C) (b: C) : C =
        let d = magSq b
        mk ((re a * re b + im a * im b) / d) ((im a * re b - re a * im b) / d)

    // ── Blaschke factor ─────────────────────────────────────────────────────────

    /// Blaschke factor: (z − a) / (1 − ā·z)
    /// Requires |a| < 1 for the map to be well-defined on the unit disk.
    let blaschke (z: C) (a: C) : C =
        let num = add z (neg a)                   // z − a
        let conjA = conj a                         // ā
        let conjAz = mul conjA z                   // ā·z
        let den = add one (neg conjAz)             // 1 − ā·z
        div num den

    /// |(d/dz) blaschke(z, a)|² = (1 − |a|²)² / |1 − ā·z|⁴
    let blaschkeDerivMagSq (z: C) (a: C) : float =
        let aMagSq = magSq a
        let conjA = conj a
        let conjAz = mul conjA z
        let den = add one (neg conjAz)             // 1 − ā·z
        let denSq = magSq den
        let num = (1.0 - aMagSq) * (1.0 - aMagSq)
        num / (denSq * denSq)

    /// HL bump parameter: a = √λ₀ · e^{iθ}
    /// Places a INSIDE the unit disk (|a| = √λ₀ < 1 for λ₀ < 1).
    let hlBumpParam (lambda0: float) (theta: float) : C =
        ofPolar (Math.Sqrt lambda0) theta

    // ── Quantum constants ───────────────────────────────────────────────────────

    /// 1/√2 — the Hadamard amplitude.
    /// Golden vector QA-6: hex 3fe6a09e667f3bcc
    let invSqrt2 : float = 1.0 / Math.Sqrt 2.0

    /// 2√2 — the Tsirelson bound.
    /// Golden vector QA-8: hex 4006a09e667f3bcd
    let tsirelsonS : float = 2.0 * Math.Sqrt 2.0

    // ── Hadamard gate on a 2-state WSet ─────────────────────────────────────────

    /// H|0⟩ = (1/√2)|0⟩ + (1/√2)|1⟩
    /// H|1⟩ = (1/√2)|0⟩ − (1/√2)|1⟩
    let hadamardAmplitude (k: int) (outBit: int) : C =
        let sign = if k = 1 && outBit = 1 then -1.0 else 1.0
        ofReal (sign * invSqrt2)

    // ── Born probability ─────────────────────────────────────────────────────────

    /// Born probability of a single amplitude: |amplitude|²
    let bornProb (amplitude: C) : float = magSq amplitude

    // ── IQuantumArith instance ───────────────────────────────────────────────────

    /// The canonical IQuantumArith instance.
    let canonical : IQuantumArith<C> =
        { new IQuantumArith<C> with
            member _.Zero = zero
            member _.One = one
            member _.OfReal r = ofReal r
            member _.OfPolar r theta = ofPolar r theta
            member _.Add a b = add a b
            member _.Mul a b = mul a b
            member _.Conj a = conj a
            member _.MagSq a = magSq a
            member _.Scale s a = scale s a
            member _.Neg a = neg a
            member _.Blaschke z a = blaschke z a
            member _.BlascheDerivMagSq z a = blaschkeDerivMagSq z a
            member _.HlBumpParam lambda0 theta = hlBumpParam lambda0 theta
            member _.InvSqrt2 = invSqrt2
            member _.TsirelsonS = tsirelsonS }

    // ── Conversion to/from Doubled<float> (IStarRing<Complex>) ─────────────────

    /// Convert QuantumArith.C to Doubled<float> (the WSet weight type).
    let toDoubled (c: C) : Doubled<float> = Doubled.make (re c) (im c)

    /// Convert Doubled<float> to QuantumArith.C.
    let ofDoubled (d: Doubled<float>) : C = mk d.Real d.Imag

// ── OpenQASM 3.0 adapter stub ─────────────────────────────────────────────────

/// Hexagonal adapter stub for OpenQASM 3.0 circuit output.
/// This adapter wraps OpenQASM 3.0 circuit simulation behind IQuantumArith.
/// The canonical implementation is the byte-lock reference; this adapter
/// is for hardware execution and cross-validation only.
///
/// ## Replacement protocol
///
/// When OpenQASM 3.0 toolchain support matures:
/// 1. Implement each method by calling the OpenQASM 3.0 simulator
/// 2. Add the golden vector for each new operation
/// 3. Run the byte-lock CI gate — it must pass within 1 ULP
/// 4. The canonical implementation remains the byte-lock reference
///
/// ## Current status: STUB — all methods delegate to canonical
[<RequireQualifiedAccess>]
module OpenQASMAdapter =

    /// The OpenQASM 3.0 adapter. Currently delegates to canonical.
    /// Replace each method body with an OpenQASM 3.0 circuit call when ready.
    let adapter : IQuantumArith<QuantumArith.C> =
        // STUB: delegates to canonical until OpenQASM toolchain is integrated
        QuantumArith.canonical

    /// Emit an OpenQASM 3.0 circuit string for the Blaschke factor.
    /// This is the first step toward hardware execution.
    let emitBlaschkeCircuit (lambda0: float) (theta: float) (gridSize: int) : string =
        let a = QuantumArith.hlBumpParam lambda0 theta
        let ar = QuantumArith.toDoubled a |> fun d -> d.Real
        let ai = QuantumArith.toDoubled a |> fun d -> d.Imag
        // STUB: emit a placeholder OpenQASM 3.0 circuit
        // The real implementation would compile the Blaschke factor into
        // a sequence of Ry, Rz, CNOT gates using the Solovay-Kitaev algorithm.
        System.String.Format(
            "// OpenQASM 3.0 — Blaschke factor circuit (STUB)\n" +
            "// lambda0 = {0}, theta = {1}, grid_size = {2}\n" +
            "// a = {3} + {4}i\n" +
            "OPENQASM 3.0;\n" +
            "include \"stdgates.inc\";\n" +
            "qubit[{2}] q;\n" +
            "// TODO: Solovay-Kitaev decomposition of Blaschke(z, a={3}+{4}i)\n",
            lambda0, theta, gridSize, ar, ai)
