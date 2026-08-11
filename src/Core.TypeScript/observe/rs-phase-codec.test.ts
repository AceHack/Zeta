/**
 * rs-phase-codec.test.ts — verify the RS [16,12] phase codec.
 *
 * Proves:
 * 1. Encode/decode round-trip (zero erasures)
 * 2. Recovery from exactly 4 erasures (the maximum)
 * 3. Recovery from 1, 2, 3 erasures (below maximum)
 * 4. Failure when > 4 symbols erased (5 erasures = unrecoverable)
 * 5. Field arithmetic correctness (GF(17))
 * 6. Connection to phase-clock: real derived values round-trip
 * 7. Sabotage control: corrupted symbol detected
 */

import { describe, test, expect } from "bun:test";
import {
  mod, add, sub, mul, inv, div,
  polyEval, lagrangeInterpolate,
  encode, decode, extractInfo,
  encodePhaseBlock, recoverPhaseBlock,
  K, N, PARITY, EVAL_POINTS,
} from "./rs-phase-codec";

// ─── GF(17) Arithmetic ───────────────────────────────────────────────────────

describe("GF(17) field arithmetic", () => {
  test("mod reduces to [0,16]", () => {
    expect(mod(0)).toBe(0);
    expect(mod(17)).toBe(0);
    expect(mod(-1)).toBe(16);
    expect(mod(34)).toBe(0);
    expect(mod(20)).toBe(3);
  });

  test("addition is commutative and closed", () => {
    expect(add(7, 12)).toBe(add(12, 7));
    expect(add(15, 4)).toBe(2); // 19 mod 17 = 2
  });

  test("subtraction is inverse of addition", () => {
    for (let a = 0; a < 17; a++) {
      for (let b = 0; b < 17; b++) {
        expect(add(sub(a, b), b)).toBe(mod(a));
      }
    }
  });

  test("multiplication is commutative", () => {
    expect(mul(3, 5)).toBe(mul(5, 3));
    expect(mul(3, 5)).toBe(15);
    expect(mul(3, 6)).toBe(1); // 18 mod 17 = 1
  });

  test("every non-zero element has a multiplicative inverse", () => {
    for (let a = 1; a < 17; a++) {
      expect(mul(a, inv(a))).toBe(1);
    }
  });

  test("division undoes multiplication", () => {
    for (let a = 0; a < 17; a++) {
      for (let b = 1; b < 17; b++) {
        expect(div(mul(a, b), b)).toBe(mod(a));
      }
    }
  });

  test("inv(0) throws", () => {
    expect(() => inv(0)).toThrow();
  });
});

// ─── Polynomial Evaluation ───────────────────────────────────────────────────

describe("polynomial operations", () => {
  test("polyEval: constant polynomial", () => {
    expect(polyEval([5], 0)).toBe(5);
    expect(polyEval([5], 7)).toBe(5);
  });

  test("polyEval: linear polynomial p(x) = 2 + 3x", () => {
    // p(0) = 2, p(1) = 5, p(2) = 8, p(3) = 11
    expect(polyEval([2, 3], 0)).toBe(2);
    expect(polyEval([2, 3], 1)).toBe(5);
    expect(polyEval([2, 3], 2)).toBe(8);
    expect(polyEval([2, 3], 3)).toBe(11);
  });

  test("polyEval: wraps mod 17", () => {
    // p(x) = 16 + 16x at x=2: 16 + 32 = 48 mod 17 = 14
    expect(polyEval([16, 16], 2)).toBe(14);
  });

  test("lagrangeInterpolate: recovers a linear polynomial from 2 points", () => {
    // p(x) = 2 + 3x → p(0)=2, p(1)=5
    const coeffs = lagrangeInterpolate([{ x: 0, y: 2 }, { x: 1, y: 5 }]);
    expect(coeffs[0]).toBe(2);
    expect(coeffs[1]).toBe(3);
  });

  test("lagrangeInterpolate: recovers a quadratic from 3 points", () => {
    // p(x) = 1 + 2x + 3x^2
    // p(0)=1, p(1)=6, p(2)=1+4+12=17 mod 17=0
    const coeffs = lagrangeInterpolate([
      { x: 0, y: 1 }, { x: 1, y: 6 }, { x: 2, y: 0 },
    ]);
    expect(coeffs[0]).toBe(1);
    expect(coeffs[1]).toBe(2);
    expect(coeffs[2]).toBe(3);
  });
});

// ─── Encode/Decode Round-Trip ────────────────────────────────────────────────

describe("RS encode/decode", () => {
  const testInfo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  test("encode produces 16 symbols from 12 info symbols", () => {
    const codeword = encode(testInfo);
    expect(codeword.length).toBe(N);
    // All values in [0,16]
    expect(codeword.every((v) => v >= 0 && v <= 16)).toBe(true);
  });

  test("round-trip: decode(encode(info)) recovers all 16 symbols", () => {
    const codeword = encode(testInfo);
    const received = codeword.map((v) => ({ value: v }));
    const decoded = decode(received);
    expect(decoded).toEqual(codeword);
  });

  test("extractInfo recovers original information symbols", () => {
    const codeword = encode(testInfo);
    const recovered = extractInfo(codeword);
    expect(recovered.map(mod)).toEqual(testInfo.map(mod));
  });

  test("recovery from 4 erasures (maximum)", () => {
    const codeword = encode(testInfo);
    // Erase positions 3, 7, 11, 15 (4 erasures)
    const received = codeword.map((v, i) =>
      [3, 7, 11, 15].includes(i) ? null : { value: v },
    );
    const decoded = decode(received);
    expect(decoded).toEqual(codeword);
  });

  test("recovery from 3 erasures", () => {
    const codeword = encode(testInfo);
    const received = codeword.map((v, i) =>
      [0, 5, 10].includes(i) ? null : { value: v },
    );
    const decoded = decode(received);
    expect(decoded).toEqual(codeword);
  });

  test("recovery from 2 erasures", () => {
    const codeword = encode(testInfo);
    const received = codeword.map((v, i) =>
      [4, 12].includes(i) ? null : { value: v },
    );
    const decoded = decode(received);
    expect(decoded).toEqual(codeword);
  });

  test("recovery from 1 erasure", () => {
    const codeword = encode(testInfo);
    const received = codeword.map((v, i) =>
      i === 8 ? null : { value: v },
    );
    const decoded = decode(received);
    expect(decoded).toEqual(codeword);
  });

  test("failure with 5 erasures (exceeds capability)", () => {
    const codeword = encode(testInfo);
    const received = codeword.map((v, i) =>
      [0, 1, 2, 3, 4].includes(i) ? null : { value: v },
    );
    // Still has 11 symbols (< 12 needed) — returns null
    const decoded = decode(received);
    expect(decoded).toBeNull();
  });

  test("all-zeros information encodes and decodes", () => {
    const zeros = new Array(K).fill(0);
    const codeword = encode(zeros);
    expect(codeword.every((v) => v === 0)).toBe(true); // p(x)=0 → all evaluations = 0
    const decoded = decode(codeword.map((v) => ({ value: v })));
    expect(decoded).toEqual(codeword);
  });

  test("encode is deterministic", () => {
    const a = encode(testInfo);
    const b = encode(testInfo);
    expect(a).toEqual(b);
  });
});

// ─── Phase Clock Integration ─────────────────────────────────────────────────

describe("phase clock integration", () => {
  test("encodePhaseBlock accepts 12 derived values and produces 16 coded symbols", () => {
    // Simulate 12 consecutive derived values from the phase clock (mod 17)
    const derived = [4, 11, 7, 0, 2, 2, 15, 2, 14, 14, 13, 13];
    const block = encodePhaseBlock(derived);
    expect(block.length).toBe(16);
    expect(block.every((v) => v >= 0 && v <= 16)).toBe(true);
  });

  test("recoverPhaseBlock: full observation", () => {
    const derived = [4, 11, 7, 0, 2, 2, 15, 2, 14, 14, 13, 13];
    const block = encodePhaseBlock(derived);
    const observation = block.map((v) => ({ value: v }));
    const result = recoverPhaseBlock(observation);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.block).toEqual(block);
      expect(result.recovered).toEqual([]);
    }
  });

  test("recoverPhaseBlock: 4 missed phases recovered", () => {
    const derived = [4, 11, 7, 0, 2, 2, 15, 2, 14, 14, 13, 13];
    const block = encodePhaseBlock(derived);
    // Miss positions 2, 5, 9, 14
    const observation = block.map((v, i) =>
      [2, 5, 9, 14].includes(i) ? null : { value: v },
    );
    const result = recoverPhaseBlock(observation);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.block).toEqual(block);
      expect(result.recovered).toEqual([2, 5, 9, 14]);
    }
  });

  test("recoverPhaseBlock: too many erasures", () => {
    const derived = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const block = encodePhaseBlock(derived);
    const observation = block.map((v, i) =>
      i < 5 ? null : { value: v },
    );
    const result = recoverPhaseBlock(observation);
    expect(result.ok).toBe(false);
  });

  test("large derived values are reduced mod 17", () => {
    // xorshift produces large numbers — they must be reduced
    const derived = [1048580, 524290, 262148, 131072, 65537, 32768,
      16384, 8192, 4096, 2048, 1024, 512];
    const block = encodePhaseBlock(derived);
    expect(block.every((v) => v >= 0 && v <= 16)).toBe(true);
    // Round-trip
    const result = recoverPhaseBlock(block.map((v) => ({ value: v })));
    expect(result.ok).toBe(true);
  });
});

// ─── Sabotage Controls ───────────────────────────────────────────────────────

describe("sabotage controls", () => {
  test("corrupted symbol changes the decoded polynomial (detection)", () => {
    const info = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const codeword = encode(info);
    // Corrupt one symbol (change position 5 by +1 mod 17)
    const corrupted = [...codeword];
    corrupted[5] = mod(corrupted[5]! + 1);
    // Decoding with the corrupted value gives a DIFFERENT polynomial
    const decoded = decode(corrupted.map((v) => ({ value: v })));
    // The decoded word won't match the original (error, not erasure)
    expect(decoded).not.toEqual(codeword);
  });

  test("the codec does NOT claim to detect errors (only erasures)", () => {
    // RS erasure-only decoding: we TRUST the symbols we have.
    // A corrupted symbol looks like a valid different codeword.
    // This is intentional — error DETECTION needs syndrome computation,
    // which is slice 2 of this codec if needed.
    const info = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const codeword = encode(info);
    // With all 16 symbols "received" but one wrong, decode still returns something
    const corrupted = [...codeword];
    corrupted[0] = mod(corrupted[0]! + 3);
    const decoded = decode(corrupted.map((v) => ({ value: v })));
    // It decodes but to a WRONG answer — this is the limitation we document
    expect(decoded).not.toBeNull();
    expect(decoded).not.toEqual(codeword);
  });
});
