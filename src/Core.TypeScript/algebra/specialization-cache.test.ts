import { describe, test, expect } from "bun:test";
import { specialize, createSpecializationCache, createSpecializationRegistry, type CacheableIr } from "./specialization-cache";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load splitmix64 IR
const goldenFile = JSON.parse(readFileSync(
  join(import.meta.dir, "../../../tests/cross-verification/zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8"
));
const irRaw = goldenFile["rng.splitmix64"] as string;
const irSafe = irRaw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
const sm64: CacheableIr = JSON.parse(irSafe);

// Known golden vectors
const GOLDEN: [bigint, bigint][] = [
  [0n, 0n],
  [1n, 16294208416658607535n],
  [2n, 7960286522194355700n],
];

describe("specialize — 1st Futamura projection", () => {
  test("produces correct output for golden vectors", () => {
    const mix = specialize(sm64);
    for (const [input, expected] of GOLDEN) {
      expect(mix(input)).toBe(expected);
    }
  });

  test("specialized function is deterministic", () => {
    const mix = specialize(sm64);
    expect(mix(42n)).toBe(mix(42n));
  });

  test("two independent specializations produce same results", () => {
    const mix1 = specialize(sm64);
    const mix2 = specialize(sm64);
    for (let i = 0n; i < 100n; i++) {
      expect(mix1(i)).toBe(mix2(i));
    }
  });
});

describe("createSpecializationCache — WeakRef pattern", () => {
  test("first call is a miss, subsequent calls are hits", () => {
    const cache = createSpecializationCache(sm64);
    expect(cache.stats.misses).toBe(0);
    expect(cache.stats.hits).toBe(0);

    cache.run(1n); // first call = miss
    expect(cache.stats.misses).toBe(1);
    expect(cache.stats.hits).toBe(0);

    cache.run(2n); // second call = hit
    expect(cache.stats.misses).toBe(1);
    expect(cache.stats.hits).toBe(1);
  });

  test("produces correct output (same as direct specialize)", () => {
    const cache = createSpecializationCache(sm64);
    const direct = specialize(sm64);
    for (const [input, expected] of GOLDEN) {
      expect(cache.run(input)).toBe(expected);
      expect(cache.run(input)).toBe(direct(input));
    }
  });

  test("invalidate forces regeneration on next call", () => {
    const cache = createSpecializationCache(sm64);
    cache.run(1n); // miss → specialize
    cache.run(2n); // hit
    expect(cache.stats.misses).toBe(1);

    cache.invalidate(); // drop the cached ref
    cache.run(3n); // miss → re-specialize
    expect(cache.stats.misses).toBe(2);
    // But still correct!
    expect(cache.run(1n)).toBe(16294208416658607535n);
  });

  test("totalCalls tracks all invocations", () => {
    const cache = createSpecializationCache(sm64);
    cache.run(1n);
    cache.run(2n);
    cache.run(3n);
    expect(cache.stats.totalCalls).toBe(3);
  });

  test("custom specializer is honored", () => {
    let called = false;
    const customSpecialize = (ir: CacheableIr) => {
      called = true;
      return specialize(ir);
    };
    const cache = createSpecializationCache(sm64, customSpecialize);
    cache.run(1n);
    expect(called).toBe(true);
  });
});

describe("createSpecializationRegistry — multi-IR cache", () => {
  const fmix32Raw = goldenFile["hash.fmix32"] as string;
  const fmix32Safe = fmix32Raw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
  const fmix32: CacheableIr = JSON.parse(fmix32Safe);

  test("caches multiple generators independently", () => {
    const reg = createSpecializationRegistry();
    const sm64Mix = reg.get(sm64);
    const fmix32Mix = reg.get(fmix32);

    expect(sm64Mix(1n)).toBe(16294208416658607535n);
    // fmix32 is 32-bit — different output
    expect(fmix32Mix(1n)).not.toBe(sm64Mix(1n));
  });

  test("stats() returns per-generator stats", () => {
    const reg = createSpecializationRegistry();
    reg.get(sm64)(1n);
    reg.get(sm64)(2n);
    reg.get(fmix32)(1n);

    const stats = reg.stats();
    expect(stats.get("rng.splitmix64")!.totalCalls).toBe(2);
    expect(stats.get("hash.fmix32")!.totalCalls).toBe(1);
  });

  test("invalidateAll forces all caches to regenerate", () => {
    const reg = createSpecializationRegistry();
    reg.get(sm64)(1n);
    reg.get(fmix32)(1n);

    reg.invalidateAll();

    // Next calls will be misses (regeneration)
    reg.get(sm64)(2n);
    const stats = reg.stats();
    expect(stats.get("rng.splitmix64")!.misses).toBe(2); // initial + after invalidate
  });
});
