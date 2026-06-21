/**
 * isa-v2.test.ts — golden-vector tests for the v2 ISA ops (branch/emit/retract/join).
 *
 * Verifies the ring-generic soft-mix interpreter handles all v2 ops correctly
 * on small (4-bit) registers with hand-verified expected outputs.
 */

import { describe, expect, test } from "bun:test";
import { softMixGeneric } from "../../../src/Core.TypeScript/algebra/soft-mix";
import { complexRing, realRing, type Complex, type StarRing, type WEntry } from "../../../src/Core.TypeScript/algebra/star-ring";

const WIDTH = 4;
const EPS = 1e-12;
const isZeroC = (w: Complex) => w.re * w.re + w.im * w.im < EPS;
const isZeroR = (w: number) => Math.abs(w) < EPS;

// Minimal IR shape for tests
interface TestIr {
  schema: string;
  generator: string;
  version: number;
  width: number;
  ops: any[];
}

function makeIr(ops: any[]): TestIr {
  return { schema: "zeta-ir-v2", generator: "test", version: 1, width: WIDTH, ops };
}

function runComplex(ops: any[], input: bigint): WEntry<bigint, Complex>[] {
  return softMixGeneric(makeIr(ops), complexRing, isZeroC, [{ key: input, weight: complexRing.one }]);
}

function runReal(ops: any[], input: bigint): WEntry<bigint, number>[] {
  return softMixGeneric(makeIr(ops), realRing, isZeroR, [{ key: input, weight: 1.0 }]);
}

function states(result: WEntry<bigint, any>[]): bigint[] {
  return result.map(e => e.key).sort((a, b) => Number(a - b));
}

describe("zeta-ir-v2 ISA ops — golden vectors (4-bit register)", () => {
  // --- Arithmetic (v1 compat) ---
  test("mul-simple: 5 * 3 = 15", () => {
    const r = runComplex([{ op: "mul", k: 3n }], 5n);
    expect(r.length).toBe(1);
    expect(r[0]!.key).toBe(15n);
  });

  test("mul-wrap: 7 * 5 mod 16 = 3", () => {
    const r = runComplex([{ op: "mul", k: 5n }], 7n);
    expect(r.length).toBe(1);
    expect(r[0]!.key).toBe(3n);
  });

  test("xorshr-simple: 12 ^ (12 >> 2) = 15", () => {
    const r = runComplex([{ op: "xorshr", s: 2 }], 12n);
    expect(r.length).toBe(1);
    expect(r[0]!.key).toBe(15n);
  });

  // --- Branch (fork) ---
  test("branch-bit0: 6 → [6, 7] (support=2)", () => {
    const r = runComplex([{ op: "branch", bit: 0 }], 6n);
    expect(r.length).toBe(2);
    expect(states(r)).toEqual([6n, 7n]);
  });

  test("branch-bit2: 3 → [3, 7] (support=2)", () => {
    const r = runComplex([{ op: "branch", bit: 2 }], 3n);
    expect(r.length).toBe(2);
    expect(states(r)).toEqual([3n, 7n]);
  });

  // --- Join (CNOT) ---
  test("join-control-set: 5 (bit0=1) → flip bit1 → 7", () => {
    const r = runComplex([{ op: "join", control: 0, target: 1 }], 5n);
    expect(r.length).toBe(1);
    expect(r[0]!.key).toBe(7n);
  });

  test("join-control-clear: 4 (bit0=0) → no flip → 4", () => {
    const r = runComplex([{ op: "join", control: 0, target: 1 }], 4n);
    expect(r.length).toBe(1);
    expect(r[0]!.key).toBe(4n);
  });

  // --- Compound: branch then join ---
  test("branch-then-join: 4 → branch bit0 → [4,5] → join(0,1) → [4, 7]", () => {
    const r = runComplex([
      { op: "branch", bit: 0 },
      { op: "join", control: 0, target: 1 },
    ], 4n);
    expect(r.length).toBe(2);
    expect(states(r)).toEqual([4n, 7n]);
  });

  // --- Compound: branch then mul ---
  test("branch-then-mul: 2 → branch bit0 → [2,3] → mul 3 → [6, 9]", () => {
    const r = runComplex([
      { op: "branch", bit: 0 },
      { op: "mul", k: 3n },
    ], 2n);
    expect(r.length).toBe(2);
    expect(states(r)).toEqual([6n, 9n]);
  });

  // --- Support doesn't grow on deterministic ops ---
  test("support=1 after mul chain (no branching = no growth)", () => {
    const r = runComplex([
      { op: "mul", k: 3n },
      { op: "xorshr", s: 1 },
      { op: "mul", k: 7n },
    ], 1n);
    expect(r.length).toBe(1);
  });

  // --- Interference: branch then reconverge ---
  test("branch on bit0 of 0 → [0, 1] → mul by 2 → [0, 2] (no reconvergence, support=2)", () => {
    const r = runComplex([
      { op: "branch", bit: 0 },
      { op: "mul", k: 2n },
    ], 0n);
    // 0*2=0, 1*2=2 → distinct, no merge
    expect(r.length).toBe(2);
    expect(states(r)).toEqual([0n, 2n]);
  });

  // --- Real vs Complex agreement on deterministic inputs ---
  test("real and complex lanes agree on all deterministic ops", () => {
    const ops = [{ op: "mul", k: 5n }, { op: "xorshr", s: 1 }, { op: "mul", k: 3n }];
    for (let x = 0n; x < 16n; x++) {
      const rc = runComplex(ops, x);
      const rr = runReal(ops, x);
      expect(rc.length).toBe(1);
      expect(rr.length).toBe(1);
      expect(rc[0]!.key).toBe(rr[0]!.key);
    }
  });
});
