/**
 * rs-syndrome.test.ts — syndrome computation for error detection.
 */

import { describe, test, expect } from "bun:test";
import { syndrome, isValidCodeword, verifyBlockIntegrity } from "./rs-syndrome";
import { encode, mod, N, K } from "./rs-phase-codec";

describe("syndrome", () => {
  test("valid codeword has all-zero syndrome", () => {
    const info = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const codeword = encode(info);
    const s = syndrome(codeword);
    expect(s).toEqual([0, 0, 0, 0]);
  });

  test("all-zeros codeword has zero syndrome", () => {
    const codeword = encode(new Array(K).fill(0));
    expect(syndrome(codeword)).toEqual([0, 0, 0, 0]);
  });

  test("single corruption produces non-zero syndrome", () => {
    const codeword = encode([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Corrupt position 5
    const corrupted = [...codeword];
    corrupted[5] = mod(corrupted[5]! + 1);
    const s = syndrome(corrupted);
    expect(s.some((v) => v !== 0)).toBe(true);
  });

  test("corruption in parity position detected", () => {
    const codeword = encode([3, 7, 11, 0, 5, 9, 13, 2, 6, 10, 14, 1]);
    // Corrupt position 14 (a parity position)
    const corrupted = [...codeword];
    corrupted[14] = mod(corrupted[14]! + 3);
    const s = syndrome(corrupted);
    expect(s.some((v) => v !== 0)).toBe(true);
  });

  test("2 corruptions detected", () => {
    const codeword = encode([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    const corrupted = [...codeword];
    corrupted[0] = mod(corrupted[0]! + 2);
    corrupted[7] = mod(corrupted[7]! + 5);
    expect(syndrome(corrupted).some((v) => v !== 0)).toBe(true);
  });

  test("3 corruptions detected", () => {
    const codeword = encode([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const corrupted = [...codeword];
    corrupted[2] = mod(corrupted[2]! + 1);
    corrupted[8] = mod(corrupted[8]! + 7);
    corrupted[11] = mod(corrupted[11]! + 3);
    expect(syndrome(corrupted).some((v) => v !== 0)).toBe(true);
  });

  test("4 corruptions detected", () => {
    const codeword = encode([7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
    const corrupted = [...codeword];
    corrupted[0] = mod(corrupted[0]! + 1);
    corrupted[3] = mod(corrupted[3]! + 2);
    corrupted[9] = mod(corrupted[9]! + 4);
    corrupted[15] = mod(corrupted[15]! + 8);
    expect(syndrome(corrupted).some((v) => v !== 0)).toBe(true);
  });

  test("corruption detection is position-independent", () => {
    const codeword = encode([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // Corrupt each position independently — all should be detected
    for (let pos = 0; pos < N; pos++) {
      const corrupted = [...codeword];
      corrupted[pos] = mod(corrupted[pos]! + 1);
      const s = syndrome(corrupted);
      expect(s.some((v) => v !== 0)).toBe(true);
    }
  });
});

describe("isValidCodeword", () => {
  test("true for a valid codeword", () => {
    expect(isValidCodeword(encode([5, 10, 15, 3, 7, 11, 0, 4, 8, 12, 16, 1]))).toBe(true);
  });

  test("false for a corrupted codeword", () => {
    const cw = encode([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const bad = [...cw];
    bad[0] = mod(bad[0]! + 1);
    expect(isValidCodeword(bad)).toBe(false);
  });

  test("false for random garbage", () => {
    // 16 random values almost certainly don't form a valid codeword
    const garbage = [3, 14, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2];
    expect(isValidCodeword(garbage)).toBe(false);
  });
});

describe("verifyBlockIntegrity", () => {
  test("valid block returns valid: true", () => {
    const coded = encode([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const result = verifyBlockIntegrity(coded);
    expect(result.valid).toBe(true);
    expect(result.syndrome).toEqual([0, 0, 0, 0]);
    expect(result.summary).toContain("valid");
  });

  test("corrupted block returns valid: false with non-zero syndrome", () => {
    const coded = encode([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const bad = [...coded];
    bad[3] = mod(bad[3]! + 5);
    const result = verifyBlockIntegrity(bad);
    expect(result.valid).toBe(false);
    expect(result.syndrome.some((v) => v !== 0)).toBe(true);
    expect(result.summary).toContain("CORRUPTED");
  });

  test("wrong length returns invalid", () => {
    const result = verifyBlockIntegrity([1, 2, 3]);
    expect(result.valid).toBe(false);
    expect(result.summary).toContain("wrong length");
  });

  test("out-of-range values caught", () => {
    const coded = encode([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const bad = [...coded];
    bad[0] = 99; // outside GF(17)
    const result = verifyBlockIntegrity(bad);
    expect(result.valid).toBe(false);
    expect(result.summary).toContain("outside GF(17)");
  });
});
