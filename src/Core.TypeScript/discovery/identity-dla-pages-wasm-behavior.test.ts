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
// cluster size, because only they implement `src/wasm-dla/CANONICAL_SPEC.md`.
//
// That exclusion used to carry C, LLVM and Rust, each on a divergent algorithm of its own — C
// degenerate at cluster 1 (the identical LCG defect as Zig), LLVM at 1642 because its walker count
// was a compile-time 3000 the panel could not set, Rust at 462 on a 100-wide torus. All three now
// stage the canonical substrate and are covered here. Go remains the one excluded asset, and for a
// reason that is about ABI rather than algorithm: it implements the canonical spec but reaches it
// through the Go runtime and `globalThis`, so it cannot be instantiated and read this way. The
// byte-lock runner covers it via `run-go-wasm.mjs`.
//
// An exclusion that is named and measured is a boundary; an unnamed one is the vacuity class.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES_WASM_ASSETS } from "./identity-dla-pages-wasm-assets";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const bytelockDir = join(repoRoot, "src", "wasm-dla", "bytelock");

/** Byte-lock seeds with a committed golden vector. Kept small — see PER_RUN_BUDGET_MS. */
const SEEDS = [1, 42] as const;

/**
 * PER-TEST TIME BUDGET — attributed, because a bare number deciding a byte-lock verdict is
 * the hidden-oracle defect `src/Core.TypeScript/hygiene/audit-hidden-oracles.ts` (#11534)
 * exists to find.
 *
 * WHAT WAS MEASURED (2026-08-17, bun 1.3.14, and again on CI runners in #11530 / #11546).
 * All six substrates compute the identical trajectory, so all execute the same walker-step
 * count; only the per-step cost differs:
 *
 *     WAT 22.7 ns/step · LLVM/C 11.5 · Emscripten 11.7 · Rust 15.5 · ASC 25.2 · Zig 20,279
 *
 * In wall-clock, one `run()`: WAT ~3 ms, Zig 2.5–3.1 s locally and 3.5–6.8 s on a CI runner.
 * Compile is 0.25 ms and instantiate 0.08 ms, so this is execution, not startup. The Zig
 * outlier is a real, unexplained performance defect tracked as 081M089HKQ7087G0R003H2G8JF —
 * it is NOT a correctness problem (Zig agrees with the golden vectors at every seed).
 *
 * WHY THIS VALUE. Before it existed these tests inherited bun's 5,000 ms default, which sat
 * *inside* the Zig range: #11546 recorded `Zig at seed 42 ... [5138.05ms] timed out after
 * 5000ms` on a green tree. That is not a loosened ratchet being restored — an inherited
 * default nobody chose was deciding a byte-lock verdict by runner load. So the budget is set
 * FAR from the boundary (≈9x the worst run yet observed, 6.8 s) precisely so that the clock
 * never decides: the assertion does.
 *
 * WHY IT IS NOT TIGHTER. It must not double as a performance assertion. A degenerate
 * substrate is also a slow one — no walker sticks, so every one burns the full 50,000-step
 * budget, and the mutation run of this file took 13.6 minutes to reach its assertion. A tight
 * timeout would report that as "too slow" when the fact worth reporting is "returned 1".
 * Regressions in speed belong to the work-item above, not to this clock.
 */
const PER_RUN_BUDGET_MS = 60_000;

/** The canonical spec's host trig, f32-rounded — identical to `run-wasm.mjs`'s harness. */
const trig = {
  cos_f32: (x: number): number => Math.fround(Math.cos(x)),
  sin_f32: (x: number): number => Math.fround(Math.sin(x)),
};

/**
 * Built per instantiation because `memset` needs the module's OWN memory. The freestanding LLVM
 * link leaves `memset` undefined and clang emits a call to it for the grid clear in `init`, so
 * this import is load-bearing rather than defensive — omitting it is a `LinkError`, which is how
 * this function came to exist: the shared object below had no `memset` and the LLVM asset could
 * not instantiate at all the moment it was brought into scope.
 */
function canonicalImports(memory: () => WebAssembly.Memory): WebAssembly.Imports {
  return {
    math: { ...trig },
    // AssemblyScript imports under its module filename.
    "dla-canonical": { ...trig },
    env: {
      ...trig,
      abort: (): never => { throw new Error("ASC abort"); },
      memset: (ptr: number, value: number, len: number): number => {
        new Uint8Array(memory().buffer).fill(value & 0xff, ptr, ptr + len);
        return ptr;
      },
    },
  };
}

function goldenClusterSize(seed: number): number {
  const golden: unknown = JSON.parse(readFileSync(join(bytelockDir, "testdata", `golden-seed-${seed}.json`), "utf8"));
  const value = (golden as Record<string, unknown>).cluster_size;
  if (typeof value !== "number") throw new Error(`golden-seed-${seed}.json has no numeric cluster_size`);
  return value;
}

function runCanonical(source: string, seed: number): number {
  const bytes = readFileSync(join(repoRoot, source));
  // Lazy, exactly as `run-wasm.mjs` does it: `memset` needs the memory the instantiation is
  // about to produce, so the import closes over a holder that is filled immediately after.
  // Safe because the substrates call `memset` from `init`, never from a start section.
  const memoryRef: { current: WebAssembly.Memory | undefined } = { current: undefined };
  const instance = new WebAssembly.Instance(
    new WebAssembly.Module(bytes),
    canonicalImports(() => {
      if (!memoryRef.current) throw new Error(`${source} called memset before its memory was bound`);
      return memoryRef.current;
    }),
  );
  memoryRef.current = instance.exports.memory as WebAssembly.Memory;
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

  // ONE run per (asset, seed), two assertions off it. Running the module a third time just to
  // ask "did it diffuse" would have cost another ~7 s of CI per asset to learn nothing the
  // first run did not already know.
  for (const asset of canonicalAssets) {
    for (const seed of SEEDS) {
      test(
        `${asset.name} at seed ${seed} matches the committed golden cluster size`,
        () => {
          const measured = runCanonical(asset.source, seed);
          // Checked first so the DEGENERATE case — the defect this file exists for — reports
          // itself as "never diffused" rather than as an ordinary numeric disagreement.
          expect(measured, `${asset.name} did not diffuse: cluster is the seed cell alone`).toBeGreaterThan(1);
          expect(measured, `${asset.name} disagrees with golden-seed-${seed}.json`).toBe(goldenClusterSize(seed));
        },
        PER_RUN_BUDGET_MS,
      );
    }
  }
});
