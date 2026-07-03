import { expect, test } from "bun:test";
import { analyze } from "./residual";
import { mix, GOLDEN_RATIO } from "../splitmix64/splitmix64";

const MASK = (1n << 64n) - 1n;

test("deterministic (periodic) trace is fully reducible — residual ~0", () => {
  const trace = Array.from({ length: 600 }, (_, i) => i % 3); // 0,1,2,0,1,2,...
  const r = analyze(trace);
  expect(r.residualBitsPerSymbol).toBeLessThan(0.15);
  expect(r.reducibility).toBeGreaterThan(0.9); // a tiny generator reproduces it: p-zombie candidate
});

test("true-random trace is irreducible — residual near raw entropy", () => {
  // entropy source OUTSIDE any generator the analyzer can see (seed withheld).
  const trace = Array.from({ length: 600 }, () => Math.floor(Math.random() * 4));
  const r = analyze(trace);
  expect(r.residualBitsPerSymbol).toBeGreaterThan(1.4); // ~2 bits raw; resists compression
  expect(r.reducibility).toBeLessThan(0.35);
});

test("OBSERVER-RELATIVE: a seeded-PRNG trace looks irreducible WITHOUT the seed, reducible WITH it", () => {
  let s = 0xE66n;
  const raw = Array.from({ length: 600 }, () => {
    s = (s + GOLDEN_RATIO) & MASK;
    return Number(mix(s) & 3n);
  });
  // observer WITHOUT the seed: sees only the symbols -> high residual (looks random)
  const seedless = analyze(raw);
  expect(seedless.reducibility).toBeLessThan(0.4);
  // observer WITH the seed: the generator IS the seed -> replays exactly -> residual collapses.
  // model the "with-seed" view as the trace of (predicted==actual) agreement = all 1s (perfectly reducible).
  let s2 = 0xE66n;
  const withSeed = raw.map((sym) => {
    s2 = (s2 + GOLDEN_RATIO) & MASK;
    return Number(mix(s2) & 3n) === sym ? 1 : 0; // 1 = seed reproduced it
  });
  const withSeedReport = analyze(withSeed);
  expect(withSeedReport.reducibility).toBeGreaterThan(0.9); // collapses to ~0 residual
  expect(withSeed.every((x) => x === 1)).toBe(true); // the seed reproduces every symbol
});
