/**
 * quantum-arith.test.ts — Byte-lock conformance tests for the TypeScript
 * canonical QuantumArith implementation.
 *
 * All 9 golden vectors must match exactly (or within 1 ULP for transcendentals).
 * These tests are the §A conformance gate for the TypeScript substrate.
 */

import { describe, it, expect } from "bun:test";
import {
  canonicalArith,
  bornProb,
  hadamardAmplitude,
  openQASMAdapter,
  qrispAdapter,
  emitBlaschkeCircuit,
  GOLDEN_VECTORS,
  type C,
} from "./quantum-arith";

const LAMBDA0 = 0.004;
const THETA = Math.PI / 4;
const EPSILON = 1e-12;

describe("QuantumArith byte-lock conformance (QA-1..QA-9)", () => {
  it("QA-1: complex_add(1+2i, 3+4i) = 4+6i", () => {
    const a: C = [1.0, 2.0];
    const b: C = [3.0, 4.0];
    const result = canonicalArith.add(a, b);
    expect(result[0]).toBe(GOLDEN_VECTORS.QA1_ADD_REAL);
    expect(result[1]).toBe(GOLDEN_VECTORS.QA1_ADD_IMAG);
  });

  it("QA-2: complex_mul(1+2i, 3+4i) = -5+10i", () => {
    const a: C = [1.0, 2.0];
    const b: C = [3.0, 4.0];
    const result = canonicalArith.mul(a, b);
    expect(result[0]).toBe(GOLDEN_VECTORS.QA2_MUL_REAL);
    expect(result[1]).toBe(GOLDEN_VECTORS.QA2_MUL_IMAG);
  });

  it("QA-3: complex_mag_sq(3+4i) = 25.0", () => {
    const a: C = [3.0, 4.0];
    expect(canonicalArith.magSq(a)).toBe(GOLDEN_VECTORS.QA3_MAG_SQ);
  });

  it("QA-4: blaschke(0.5+0.3i, sqrt(λ₀)·e^{iπ/4}) matches golden vector", () => {
    const a = canonicalArith.hlBumpParam(LAMBDA0, THETA);
    const z: C = [0.5, 0.3];
    const result = canonicalArith.blaschke(z, a);
    expect(Math.abs(result[0] - GOLDEN_VECTORS.QA4_BLASCHKE_REAL)).toBeLessThan(EPSILON);
    expect(Math.abs(result[1] - GOLDEN_VECTORS.QA4_BLASCHKE_IMAG)).toBeLessThan(EPSILON);
  });

  it("QA-5: blaschkeDerivMagSq matches golden vector", () => {
    const a = canonicalArith.hlBumpParam(LAMBDA0, THETA);
    const z: C = [0.5, 0.3];
    const result = canonicalArith.blaschkeDerivMagSq(z, a);
    expect(Math.abs(result - GOLDEN_VECTORS.QA5_BLASCHKE_DERIV_MAG_SQ)).toBeLessThan(EPSILON);
  });

  it("QA-6: invSqrt2 = 0.707106781186547", () => {
    expect(Math.abs(canonicalArith.invSqrt2 - GOLDEN_VECTORS.QA6_INV_SQRT2)).toBeLessThan(1e-15);
  });

  it("QA-7: bornProb(1/√2 + 0i) = 0.5", () => {
    const amp: C = [canonicalArith.invSqrt2, 0.0];
    expect(Math.abs(bornProb(amp) - GOLDEN_VECTORS.QA7_BORN_PROB_BELL)).toBeLessThan(1e-14);
  });

  it("QA-8: tsirelsonS = 2*sqrt(2) = 2.828427...", () => {
    expect(Math.abs(canonicalArith.tsirelsonS - GOLDEN_VECTORS.QA8_TSIRELSON_S)).toBeLessThan(1e-15);
  });

  it("QA-9: 1/blaschkeDerivMagSq(z=i, a=sqrt(λ₀)) matches golden vector", () => {
    const a = canonicalArith.hlBumpParam(LAMBDA0, 0.0);  // theta=0
    const z: C = [0.0, 1.0];  // z = i
    const derivSq = canonicalArith.blaschkeDerivMagSq(z, a);
    const invDerivSq = derivSq > 0 ? 1.0 / derivSq : 0.0;
    expect(Math.abs(invDerivSq - GOLDEN_VECTORS.QA9_BLASCHKE_DERIV_INV)).toBeLessThan(EPSILON);
  });
});

describe("QuantumArith anti-self-certifying tests", () => {
  it("QA-ANTI-1: blaschke with a ON unit disk gives zero derivative (negative control)", () => {
    const aOnDisk: C = [Math.cos(THETA), Math.sin(THETA)];  // |a| = 1
    const z: C = [0.5, 0.3];
    const derivSq = canonicalArith.blaschkeDerivMagSq(z, aOnDisk);
    // Should be 0 (degenerate case), not QA-5
    expect(derivSq).toBe(0.0);
  });

  it("QA-ANTI-2: OpenQASM adapter delegates to canonical (stub verification)", () => {
    const a = canonicalArith.hlBumpParam(LAMBDA0, THETA);
    const z: C = [0.5, 0.3];
    const canonical = canonicalArith.blaschke(z, a);
    const adapted = openQASMAdapter.blaschke(z, a);
    expect(adapted[0]).toBe(canonical[0]);
    expect(adapted[1]).toBe(canonical[1]);
  });

  it("QA-ANTI-3: Qrisp adapter delegates to canonical (stub verification)", () => {
    const a = canonicalArith.hlBumpParam(LAMBDA0, THETA);
    const z: C = [0.5, 0.3];
    const canonical = canonicalArith.blaschke(z, a);
    const adapted = qrispAdapter.blaschke(z, a);
    expect(adapted[0]).toBe(canonical[0]);
    expect(adapted[1]).toBe(canonical[1]);
  });
});

describe("QuantumArith additional operations", () => {
  it("conj(3+4i) = 3-4i", () => {
    const a: C = [3.0, 4.0];
    const result = canonicalArith.conj(a);
    expect(result[0]).toBe(3.0);
    expect(result[1]).toBe(-4.0);
  });

  it("scale(2, 3+4i) = 6+8i", () => {
    const a: C = [3.0, 4.0];
    const result = canonicalArith.scale(2.0, a);
    expect(result[0]).toBe(6.0);
    expect(result[1]).toBe(8.0);
  });

  it("neg(3+4i) = -3-4i", () => {
    const a: C = [3.0, 4.0];
    const result = canonicalArith.neg(a);
    expect(result[0]).toBe(-3.0);
    expect(result[1]).toBe(-4.0);
  });

  it("hadamardAmplitude(0, 0) = 1/√2", () => {
    const amp = hadamardAmplitude(0, 0);
    expect(Math.abs(amp[0] - canonicalArith.invSqrt2)).toBeLessThan(1e-15);
    expect(amp[1]).toBe(0.0);
  });

  it("hadamardAmplitude(1, 1) = -1/√2", () => {
    const amp = hadamardAmplitude(1, 1);
    expect(Math.abs(amp[0] + canonicalArith.invSqrt2)).toBeLessThan(1e-15);
    expect(amp[1]).toBe(0.0);
  });

  it("emitBlaschkeCircuit returns OPENQASM 3.0 string", () => {
    const circuit = emitBlaschkeCircuit(LAMBDA0, THETA, 64);
    expect(circuit).toContain("OPENQASM 3.0");
    expect(circuit).toContain("stdgates.inc");
    expect(circuit).toContain("qubit[64]");
  });

  it("ofPolar(1, pi/2) = 0+1i", () => {
    const result = canonicalArith.ofPolar(1.0, Math.PI / 2);
    expect(Math.abs(result[0])).toBeLessThan(1e-15);
    expect(Math.abs(result[1] - 1.0)).toBeLessThan(1e-15);
  });

  it("hlBumpParam places a inside unit disk", () => {
    const a = canonicalArith.hlBumpParam(LAMBDA0, THETA);
    const magSq = canonicalArith.magSq(a);
    expect(magSq).toBeCloseTo(LAMBDA0, 10);
    expect(magSq).toBeLessThan(1.0);  // MUST be inside unit disk
  });
});
