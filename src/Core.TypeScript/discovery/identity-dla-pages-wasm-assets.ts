import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { GO_ORACLE_BRIDGE, GO_ORACLE_MODULE } from "./identity-dla-pages-go-build";

export type PagesWasmAsset = Readonly<{
  readonly name: string;
  readonly source: string;
  readonly published: string;
  readonly requiredExports: readonly string[];
  /**
   * True when the module both implements `src/wasm-dla/CANONICAL_SPEC.md` AND exposes it
   * through the bare `init` / `run` / `get_cluster_size` ABI, so a test can instantiate it
   * and compare its cluster size to `testdata/golden-seed-*.json` directly. This is an
   * ABI claim, not only a spec claim — the Go asset below implements the same canonical
   * algorithm but reaches it through the Go runtime bridge and `globalThis`, so it is not
   * directly instantiable and is `false` here. See `identity-dla-pages-wasm-behavior.test.ts`.
   */
  readonly canonicalAbi: boolean;
}>;

/** Repository-owned modules copied byte-for-byte into the Pages artifact. */
export const PAGES_WASM_ASSETS: readonly PagesWasmAsset[] = [
  { name: "WAT", source: "src/wasm-dla/bytelock/dla-canonical-wat.wasm", published: "wasm/dla-wat.wasm", requiredExports: ["init", "run", "get_cluster_size"], canonicalAbi: true },
  // Zig used to stage `src/wasm-dla/zig/dla.wasm` — a SECOND, divergent Zig DLA with its own
  // PRNG and its own spawn rule, outside the byte-lock roster and therefore judged by no golden
  // vector. It returned cluster size 1 at every seed (measured 2026-08-17): its LCG's low two
  // bits have period 4 (1664525 ≡ 1, 1013904223 ≡ 3, mod 4), so `prng % 4` cycled 3,2,1,0 and
  // every walker returned to its spawn point. It now stages the canonical Zig substrate.
  { name: "Zig", source: "src/wasm-dla/bytelock/dla-canonical-zig.wasm", published: "wasm/dla-zig.wasm", requiredExports: ["init", "run", "get_cluster_size", "get_max_r_bits", "get_trajectory_entry"], canonicalAbi: true },
  // C / LLVM / Rust were the last three panels on pre-byte-lock substrates of their own. Each
  // staged a SECOND implementation of the algorithm — its own grid size, spawn rule, kill radius
  // and walker budget — in no byte-lock roster and pinned by no golden vector. Measured at seed 4,
  // 800 walkers, against the canonical 345 (2026-08-17, reproduced before any change):
  //
  //   src/wasm-dla/c/dla-emcc.wasm      = 1     DEGENERATE at every seed tried (1, 4, 42, 100, 999)
  //   src/wasm-dla/c/dla-llvm-opt.wasm  = 1642  ran 3000 walkers — a compile-time constant the panel
  //                                             could not set; its `run_dla(seed)` takes no count
  //   src/wasm-dla/rust/dla-opt.wasm    = 462   128 -> 100 grid and `rem_euclid` indexing, i.e. a
  //                                             TORUS, so no walker can ever leave
  //
  // The C module's defect is the Zig one exactly (#11530): its LCG has a = 1664525 ≡ 1 and
  // c = 1013904223 ≡ 3 (mod 4), so the state advances by a constant 3 mod 4 and `prng % 4` cycles
  // 1,0,3,2,… — each four steps apply +x, -x, +y, -y once and cancel. MAX_STEPS = 10000 is divisible
  // by 4, so every walker ends on its spawn cell and the cluster stays the seed cell alone.
  //
  // All three now stage the canonical substrate that `run-bytelock-ci.mjs` already loads and
  // `testdata/golden-seed-*.json` already pins — the same move #11530 made for Zig and #11489 for
  // Go. Fixing the divergent modules instead would have produced three more plausible wrong numbers
  // that nothing in the tree could contradict.
  //
  // MEASURED AFTER THE CHANGE, by staging this artifact and driving each published module with the
  // panel's own import object and call sequence: C = 345, LLVM = 345, Rust = 345 — with WAT, Zig and
  // AssemblyScript also at 345. Every panel in this list now agrees with the byte-lock, and
  // `identity-dla-pages-wasm-behavior.test.ts` re-checks all six against the committed vectors at
  // seeds 1 and 42 on every run. NO panel in this list still disagrees.
  { name: "C", source: "src/wasm-dla/bytelock/dla-canonical-emcc.wasm", published: "wasm/dla-emcc.wasm", requiredExports: ["init", "run", "get_cluster_size", "get_max_r_bits", "get_trajectory_entry"], canonicalAbi: true },
  { name: "LLVM", source: "src/wasm-dla/bytelock/dla-canonical-llvm.wasm", published: "wasm/dla-llvm.wasm", requiredExports: ["init", "run", "get_cluster_size", "get_max_r_bits", "get_trajectory_entry"], canonicalAbi: true },
  { name: "Rust", source: "src/wasm-dla/bytelock/dla-canonical-rust.wasm", published: "wasm/dla-rust.wasm", requiredExports: ["init", "run", "get_cluster_size", "get_max_r_bits", "get_trajectory_entry"], canonicalAbi: true },
  { name: "AssemblyScript", source: "src/wasm-dla/bytelock/dla-canonical-asc.wasm", published: "wasm/dla-asc.wasm", requiredExports: ["init", "run", "getClusterSize"], canonicalAbi: true },
];

/**
 * The Go substrate is the one asset that is BUILT, never committed (~1.9 MB), so unlike
 * the six above its presence is a fact about a particular build rather than about the
 * source tree. It is therefore staged CONDITIONALLY and reported, never assumed.
 *
 * Its `requiredExports` are the Go runtime ABI (`run` / `resume` / `mem`), not the DLA
 * functions — a Go module exposes its own API through `globalThis`, which the runtime
 * bridge wires up at `go.run()`. Checking the ABI is what distinguishes "a Go WASM
 * module" from "some other 1.9 MB file with the right magic".
 *
 * The bridge travels with it as a PAIR. Staging one without the other produces an
 * artifact that looks complete and fails at instantiation, which is precisely the
 * class of defect this change exists to remove.
 */
export const GO_PAGES_ASSET: PagesWasmAsset = {
  name: "Go",
  source: GO_ORACLE_MODULE,
  published: "wasm/dla-go.wasm",
  requiredExports: ["run", "resume", "mem"],
  // Canonical ALGORITHM (it is built from `bytelock/dla-canonical.go`, which the byte-lock
  // runner pins), but NOT the canonical ABI: the DLA functions live on `globalThis` after
  // `go.run()`, so it cannot be instantiated and read the way the six above can. The
  // byte-lock runner already covers it via `run-go-wasm.mjs`.
  canonicalAbi: false,
};

export const GO_PAGES_BRIDGE = { source: GO_ORACLE_BRIDGE, published: "wasm/wasm_exec.js" } as const;

export type PagesWasmStaging = Readonly<{
  readonly staged: readonly string[];
  /** Named, not silent: an optional asset that did not ship says which and why. */
  readonly absent: readonly string[];
}>;

function assertWasmContract(source: string, asset: PagesWasmAsset): void {
  if (!existsSync(source)) throw new Error(`teaching error: Pages WASM source for ${asset.name} is missing: ${source}`);
  const bytes = readFileSync(source);
  if (bytes.length < 8 || bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error(`teaching error: Pages WASM source for ${asset.name} is not a WebAssembly binary: ${source}`);
  }
  const exports = new Set(WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map((entry) => entry.name));
  const missing = asset.requiredExports.filter((name) => !exports.has(name));
  if (missing.length > 0) throw new Error(`teaching error: Pages WASM ${asset.name} lacks required exports: ${missing.join(", ")}`);
}

function publish(repoRoot: string, artifactRoot: string, source: string, published: string): void {
  const target = join(artifactRoot, published);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(repoRoot, source), target);
}

export function stagePagesWasmAssets(repoRoot: string, artifactRoot: string): PagesWasmStaging {
  const staged: string[] = [];
  for (const asset of PAGES_WASM_ASSETS) {
    assertWasmContract(join(repoRoot, asset.source), asset);
    publish(repoRoot, artifactRoot, asset.source, asset.published);
    staged.push(asset.published);
  }

  // ── The conditional pair ───────────────────────────────────────────────────
  // Missing is a REPORT, not a throw: a laptop without Go still builds the site, and
  // the page then discovers the absence for itself. What is NOT tolerated is a
  // half-published pair or a module that is not a Go module — those are asserted,
  // because both would fail at run time in a way the page could only describe as
  // "something went wrong".
  const moduleExists = existsSync(join(repoRoot, GO_PAGES_ASSET.source));
  const bridgeExists = existsSync(join(repoRoot, GO_PAGES_BRIDGE.source));
  if (moduleExists && bridgeExists) {
    assertWasmContract(join(repoRoot, GO_PAGES_ASSET.source), GO_PAGES_ASSET);
    publish(repoRoot, artifactRoot, GO_PAGES_ASSET.source, GO_PAGES_ASSET.published);
    publish(repoRoot, artifactRoot, GO_PAGES_BRIDGE.source, GO_PAGES_BRIDGE.published);
    staged.push(GO_PAGES_ASSET.published, GO_PAGES_BRIDGE.published);
    return { staged, absent: [] };
  }

  const why = moduleExists
    ? `${GO_PAGES_BRIDGE.source} is missing (the Go runtime bridge is emitted beside the module by the Pages Go build)`
    : `${GO_PAGES_ASSET.source} is missing (the Pages Go build did not run)`;
  return { staged, absent: [`${GO_PAGES_ASSET.published}: ${why}`] };
}
