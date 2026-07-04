// shamir-golden.test.ts — lock the shared golden seed for BP-16 cross-check
// (F# Shamir.fs + FsCheck + Z3). Vectors live in shamir-golden-vectors.json.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shamirCombine, shamirSplit } from "./shamir.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

interface GoldenVector {
  readonly name: string;
  readonly threshold: number;
  readonly shares: number;
  readonly seed: number;
  readonly secret: readonly number[];
  readonly subset: readonly number[];
}

interface GoldenFile {
  readonly schema: string;
  readonly prime: number;
  readonly vectors: readonly GoldenVector[];
}

const path = join(import.meta.dir, "shamir-golden-vectors.json");
const golden = JSON.parse(readFileSync(path, "utf8")) as GoldenFile;

describe("shamir golden vectors (BP-16 seed)", () => {
  test("schema and prime", () => {
    expect(golden.schema).toBe("zeta-shamir-golden-v1");
    expect(golden.prime).toBe(257);
    expect(golden.vectors.length).toBeGreaterThanOrEqual(3);
  });

  for (const v of golden.vectors) {
    test(`${v.name}: subset reconstructs secret`, () => {
      const secret = Uint8Array.from(v.secret);
      const shares = shamirSplit(secret, {
        threshold: v.threshold,
        shares: v.shares,
        random: lcg(v.seed),
      });
      expect(shares.length).toBe(v.shares);
      const subset = v.subset.map((i) => shares[i]!);
      const got = shamirCombine(subset, v.threshold);
      expect([...got]).toEqual([...v.secret]);
    });
  }
});
