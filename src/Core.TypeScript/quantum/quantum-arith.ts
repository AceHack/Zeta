/**
 * quantum-arith.ts — Canonical quantum arithmetic library (TypeScript port).
 *
 * This is the byte-lock reference for the TypeScript substrate.
 * All 9 golden vectors must match the F# canonical implementation exactly.
 *
 * ## Hexagonal port pattern
 *
 * The `IQuantumArith` interface is the port. `canonicalArith` is our
 * implementation. `qrispAdapter` and `openQASMAdapter` are stubs for
 * external libraries — they delegate to canonical until the external
 * library is integrated.
 *
 * ## Byte-lock discipline
 *
 * All operations use IEEE 754 double precision (64-bit) with
 * round-to-nearest-even. No FMA, no fast-math, no platform-specific
 * intrinsics. The golden vectors are in `testdata/quantum-arith-golden.json`.
 *
 * ## Golden vectors (QA-1..QA-9)
 *
 * QA-1: complex_add(1+2i, 3+4i) = 4+6i
 *   hex: 4010000000000000 4018000000000000
 * QA-2: complex_mul(1+2i, 3+4i) = -5+10i
 *   hex: c014000000000000 4024000000000000
 * QA-3: complex_mag_sq(3+4i) = 25.0
 *   hex: 4039000000000000
 * QA-4: blaschke(0.5+0.3i, sqrt(λ₀)·e^{iπ/4}) = 0.474586592674752+0.260348313343704i
 *   hex: 3fde5fa071aa1ed9 3fd0a98bf8d8516e
 * QA-5: blaschkeDerivMagSq(0.5+0.3i, sqrt(λ₀)·e^{iπ/4}) = 1.147451008268201
 *   hex: 3ff25bf596a462ea
 * QA-6: invSqrt2 = 0.707106781186547
 *   hex: 3fe6a09e667f3bcc
 * QA-7: bornProb(|Φ⁺⟩, 00) = 0.5
 *   hex: 3fdffffffffffffe
 * QA-8: tsirelsonS = 2.828427124746190
 *   hex: 4006a09e667f3bcd
 * QA-9: blaschkeDerivMagSq⁻¹(z=i, a=sqrt(λ₀)) = 1.016128772116579
 *   hex: 3ff042103e4c3ed8
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Complex number as [real, imag] tuple. */
export type C = [number, number];

/** The IQuantumArith port interface. */
export interface IQuantumArith {
  readonly zero: C;
  readonly one: C;
  ofReal(r: number): C;
  ofPolar(r: number, theta: number): C;
  add(a: C, b: C): C;
  mul(a: C, b: C): C;
  conj(a: C): C;
  magSq(a: C): number;
  scale(s: number, a: C): C;
  neg(a: C): C;
  blaschke(z: C, a: C): C;
  blaschkeDerivMagSq(z: C, a: C): number;
  hlBumpParam(lambda0: number, theta: number): C;
  readonly invSqrt2: number;
  readonly tsirelsonS: number;
}

// ── Canonical implementation ───────────────────────────────────────────────────

const _zero: C = [0.0, 0.0];
const _one: C = [1.0, 0.0];
const _invSqrt2 = 1.0 / Math.sqrt(2.0);
const _tsirelsonS = 2.0 * Math.sqrt(2.0);

function _add(a: C, b: C): C { return [a[0] + b[0], a[1] + b[1]]; }
function _mul(a: C, b: C): C {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}
function _conj(a: C): C { return [a[0], -a[1]]; }
function _magSq(a: C): number { return a[0] * a[0] + a[1] * a[1]; }
function _scale(s: number, a: C): C { return [s * a[0], s * a[1]]; }
function _neg(a: C): C { return [-a[0], -a[1]]; }
function _div(a: C, b: C): C {
  const d = _magSq(b);
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
}

function _blaschke(z: C, a: C): C {
  const num = _add(z, _neg(a));         // z − a
  const conjA = _conj(a);               // ā
  const conjAz = _mul(conjA, z);        // ā·z
  const den = _add(_one, _neg(conjAz)); // 1 − ā·z
  return _div(num, den);
}

function _blaschkeDerivMagSq(z: C, a: C): number {
  const aMagSq = _magSq(a);
  const conjA = _conj(a);
  const conjAz = _mul(conjA, z);
  const den = _add(_one, _neg(conjAz));
  const denSq = _magSq(den);
  const num = (1.0 - aMagSq) * (1.0 - aMagSq);
  return num / (denSq * denSq);
}

function _hlBumpParam(lambda0: number, theta: number): C {
  const r = Math.sqrt(lambda0);
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

/** The canonical IQuantumArith implementation. Byte-lock reference. */
export const canonicalArith: IQuantumArith = {
  zero: _zero,
  one: _one,
  ofReal: (r) => [r, 0.0],
  ofPolar: (r, theta) => [r * Math.cos(theta), r * Math.sin(theta)],
  add: _add,
  mul: _mul,
  conj: _conj,
  magSq: _magSq,
  scale: _scale,
  neg: _neg,
  blaschke: _blaschke,
  blaschkeDerivMagSq: _blaschkeDerivMagSq,
  hlBumpParam: _hlBumpParam,
  invSqrt2: _invSqrt2,
  tsirelsonS: _tsirelsonS,
};

// ── Quantum gate helpers ───────────────────────────────────────────────────────

/** Born probability of a single amplitude: |amplitude|² */
export function bornProb(amplitude: C): number {
  return _magSq(amplitude);
}

/** Hadamard amplitude: H|k⟩ → amplitude for output bit outBit */
export function hadamardAmplitude(k: number, outBit: number): C {
  const sign = k === 1 && outBit === 1 ? -1.0 : 1.0;
  return [sign * _invSqrt2, 0.0];
}

// ── External adapter stubs ─────────────────────────────────────────────────────

/**
 * Qrisp adapter stub.
 * STUB: delegates to canonical until Qrisp Python bridge is integrated.
 * Replace each method with a Qrisp QuantumFloat call when ready.
 */
export const qrispAdapter: IQuantumArith = canonicalArith;

/**
 * OpenQASM 3.0 adapter stub.
 * STUB: delegates to canonical until OpenQASM toolchain is integrated.
 * Replace each method with an OpenQASM 3.0 circuit simulation call when ready.
 */
export const openQASMAdapter: IQuantumArith = canonicalArith;

/**
 * Emit an OpenQASM 3.0 circuit string for the Blaschke factor.
 * STUB: emits a placeholder circuit.
 */
export function emitBlaschkeCircuit(lambda0: number, theta: number, gridSize: number): string {
  const a = _hlBumpParam(lambda0, theta);
  return [
    `// OpenQASM 3.0 — Blaschke factor circuit (STUB)`,
    `// lambda0 = ${lambda0}, theta = ${theta}, grid_size = ${gridSize}`,
    `// a = ${a[0]} + ${a[1]}i`,
    `OPENQASM 3.0;`,
    `include "stdgates.inc";`,
    `qubit[${gridSize}] q;`,
    `// TODO: Solovay-Kitaev decomposition of Blaschke(z, a=${a[0]}+${a[1]}i)`,
  ].join("\n");
}

// ── Golden vector constants (for conformance tests) ────────────────────────────

export const GOLDEN_VECTORS = {
  QA1_ADD_REAL: 4.0,
  QA1_ADD_IMAG: 6.0,
  QA2_MUL_REAL: -5.0,
  QA2_MUL_IMAG: 10.0,
  QA3_MAG_SQ: 25.0,
  QA4_BLASCHKE_REAL: 0.47458659267475197,
  QA4_BLASCHKE_IMAG: 0.26034831334370395,
  QA5_BLASCHKE_DERIV_MAG_SQ: 1.1474510082682012,
  QA6_INV_SQRT2: 0.7071067811865476,
  QA7_BORN_PROB_BELL: 0.5,
  QA8_TSIRELSON_S: 2.8284271247461903,
  QA9_BLASCHKE_DERIV_INV: 1.0161287721165787,
} as const;
