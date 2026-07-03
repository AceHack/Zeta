import { describe, expect, it } from "bun:test";
import { shamirCombine, shamirRoundTrip, shamirSplit } from "./shamir.ts";

/** Deterministic LCG for reproducible coefficient draws in tests. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

describe("shamir k-of-n", () => {
  it("2-of-3 round-trips a short secret", () => {
    const secret = new Uint8Array([42, 255, 0, 17]);
    expect(shamirRoundTrip(secret, 2, 3, lcg(1))).toBe(true);
  });

  it("3-of-5 round-trips arbitrary bytes", () => {
    const secret = new Uint8Array(32);
    for (let i = 0; i < secret.length; i++) secret[i] = i * 7 + 3;
    expect(shamirRoundTrip(secret, 3, 5, lcg(99))).toBe(true);
  });

  it("any k-subset of n shares reconstructs the same secret", () => {
    const secret = new Uint8Array([1, 2, 3, 4, 5]);
    const shares = shamirSplit(secret, { threshold: 2, shares: 4, random: lcg(7) });
    const a = shamirCombine([shares[0]!, shares[2]!], 2);
    const b = shamirCombine([shares[1]!, shares[3]!], 2);
    expect(a).toEqual(secret);
    expect(b).toEqual(secret);
  });

  it("fewer than k shares throws", () => {
    const secret = new Uint8Array([9]);
    const shares = shamirSplit(secret, { threshold: 3, shares: 5, random: lcg(2) });
    expect(() => shamirCombine(shares.slice(0, 2), 3)).toThrow(/need at least 3 shares/);
  });

  it("property: random secrets round-trip for several k/n pairs", () => {
    const random = lcg(12345);
    for (let trial = 0; trial < 20; trial++) {
      const len = 1 + Math.floor(random() * 16);
      const secret = new Uint8Array(len);
      for (let i = 0; i < len; i++) secret[i] = Math.floor(random() * 256);
      const k = 2 + Math.floor(random() * 2);
      const n = k + Math.floor(random() * 3);
      expect(shamirRoundTrip(secret, k, n, random)).toBe(true);
    }
  });
});
