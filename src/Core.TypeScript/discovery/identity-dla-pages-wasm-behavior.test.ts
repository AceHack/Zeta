// identity-dla-pages-wasm-behavior.test.ts
//
// WHY THIS FILE EXISTS
// --------------------
// `identity-dla-pages-wasm-assets.test.ts` checks that every module the identity-DLA site
// stages has the WebAssembly magic bytes and the export names the panel calls. That is a
// STRUCTURAL contract, and a structural contract cannot see a wrong answer.
//
// It did not see one. `src/wasm-dla/zig/dla.wasm` — the module the site's Zig oracle panel
// loaded — had every declared export and returned cluster size 1 at every seed, because its
// LCG's low two bits have period 4 (multiplier 1664525 ≡ 1, increment 1013904223 ≡ 3, mod 4),
// so `prng % 4` produced the cycle 3,2,1,0 and every walker returned to its spawn point after
// each four steps. The panel rendered "1" beside WAT's and AssemblyScript's 345 under a header
// claiming "same algorithm, same D_f, zero variance". A wrong oracle that looks like it works
// is worse than a missing one: an operator can cite the number.
//
// So this test asserts the thing the structural one cannot — that a staged module, when RUN,
// produces the trajectory the byte-lock already pins. The expectation is not written here; it
// is read out of `src/wasm-dla/bytelock/testdata/golden-seed-*.json`, the same hex-in-JSON
// vectors `run-bytelock-ci.mjs` compares against, so this test and the byte-lock cannot drift
// apart without the diff being visible.
//
// SCOPE, stated rather than implied: only assets marked `canonicalAbi` are held to the golden
// cluster size, because only they implement `src/wasm-dla/CANONICAL_SPEC.md`. C / LLVM / Rust
// run their own algorithms and are excluded — with their measured seed-4 values recorded in
// `identity-dla-pages-wasm-assets.ts`, including that C is still degenerate. An exclusion that
// is named and measured is a boundary; an unnamed one is the vacuity class.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES_WASM_ASSETS } from "./identity-dla-pages-wasm-assets";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const bytelockDir = join(repoRoot, "src", "wasm-dla", "bytelock");

/** Byte-lock seeds with a committed golden vector. Kept small: the Zig substrate runs ~3s/seed. */
const SEEDS = [1, 42] as const;

/** The canonical spec's host trig, f32-rounded — identical to `run-wasm.mjs`'s harness. */
const trig = {
  cos_f32: (x: number): number => Math.fround(Math.cos(x)),
  sin_f32: (x: number): number => Math.fround(Math.sin(x)),
};
const importObject = {
  math: { ...trig },
  // AssemblyScript imports under its module filename.
  "dla-canonical": { ...trig },
  env: { ...trig, abort: (): never => { throw new Error("ASC abort"); } },
};

function goldenClusterSize(seed: number): number {
  const golden: unknown = JSON.parse(readFileSync(join(bytelockDir, "testdata", `golden-seed-${seed}.json`), "utf8"));
  const value = (golden as Record<string, unknown>).cluster_size;
  if (typeof value !== "number") throw new Error(`golden-seed-${seed}.json has no numeric cluster_size`);
  return value;
}

function runCanonical(source: string, seed: number): number {
  const bytes = readFileSync(join(repoRoot, source));
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), importObject);
  const exports = instance.exports as Record<string, CallableFunction>;
  const init = exports.init;
  const run = exports.run;
  const clusterSize = exports.get_cluster_size ?? exports.getClusterSize;
  if (typeof init !== "function" || typeof run !== "function" || typeof clusterSize !== "function") {
    throw new Error(`${source} does not expose the canonical init/run/get_cluster_size ABI`);
  }
  init(seed);
  run();
  return Number(clusterSize());
}

const canonicalAssets = PAGES_WASM_ASSETS.filter((asset) => asset.canonicalAbi);

describe("staged Pages WASM modules reproduce the byte-locked trajectory", () => {
  // Liveness: an empty filter would make every assertion below vacuously true, and "0 checked"
  // must never read as "0 problems" — the same floor `audit-proof-lineage-binaries.ts` applies.
  test("there is at least one canonical-ABI asset to check", () => {
    expect(canonicalAssets.length).toBeGreaterThan(0);
  });

  for (const asset of canonicalAssets) {
    for (const seed of SEEDS) {
      test(`${asset.name} at seed ${seed} matches the committed golden cluster size`, () => {
        expect(runCanonical(asset.source, seed)).toBe(goldenClusterSize(seed));
      });
    }
  }

  // The specific shape of the defect this file was written for: a module that runs, exports
  // everything it promises, and never diffuses. Stated separately from the equality above so
  // the failure message says WHICH thing broke.
  for (const asset of canonicalAssets) {
    test(`${asset.name} diffuses — cluster size is not the degenerate seed cell alone`, () => {
      expect(runCanonical(asset.source, SEEDS[0])).toBeGreaterThan(1);
    });
  }
});
