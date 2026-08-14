import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

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

export function stagePagesWasmAssets(repoRoot: string, artifactRoot: string): void {
  for (const asset of PAGES_WASM_ASSETS) {
    const source = join(repoRoot, asset.source);
    assertWasmContract(source, asset);
    const target = join(artifactRoot, asset.published);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}
