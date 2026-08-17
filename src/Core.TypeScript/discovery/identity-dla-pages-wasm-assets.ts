import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { GO_ORACLE_BRIDGE, GO_ORACLE_MODULE } from "./identity-dla-pages-go-build";

export type PagesWasmAsset = Readonly<{
  readonly name: string;
  readonly source: string;
  readonly published: string;
  readonly requiredExports: readonly string[];
}>;

/** Repository-owned modules copied byte-for-byte into the Pages artifact. */
export const PAGES_WASM_ASSETS: readonly PagesWasmAsset[] = [
  { name: "WAT", source: "src/wasm-dla/bytelock/dla-canonical-wat.wasm", published: "wasm/dla-wat.wasm", requiredExports: ["init", "run", "get_cluster_size"] },
  { name: "Zig", source: "src/wasm-dla/zig/dla.wasm", published: "wasm/dla-zig.wasm", requiredExports: ["init", "step", "get_cluster_size", "get_cell_export"] },
  { name: "C", source: "src/wasm-dla/c/dla-emcc.wasm", published: "wasm/dla-emcc.wasm", requiredExports: ["init", "step", "get_cluster_size", "get_cell"] },
  { name: "LLVM", source: "src/wasm-dla/c/dla-llvm-opt.wasm", published: "wasm/dla-llvm.wasm", requiredExports: ["init_dla", "run_dla"] },
  { name: "Rust", source: "src/wasm-dla/rust/dla-opt.wasm", published: "wasm/dla-rust.wasm", requiredExports: ["init", "step", "get_cluster_size", "get_cell"] },
  { name: "AssemblyScript", source: "src/wasm-dla/bytelock/dla-canonical-asc.wasm", published: "wasm/dla-asc.wasm", requiredExports: ["init", "run", "getClusterSize"] },
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
