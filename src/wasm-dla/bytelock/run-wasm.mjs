/**
 * src/wasm-dla/bytelock/run-wasm.mjs
 *
 * Node.js harness for running any canonical WASM substrate and
 * outputting a golden vector JSON for byte-lock verification.
 *
 * Usage:
 *   node run-wasm.mjs <wasm-file> [seed]
 */

import { readFileSync } from "fs";

const wasmPath = process.argv[2];
const seed = process.argv[3] ? parseInt(process.argv[3], 10) : 42;
const N_WALKERS = 800;

if (!wasmPath) {
  console.error("Usage: node run-wasm.mjs <wasm-file> [seed]");
  process.exit(1);
}

const wasmBytes = readFileSync(wasmPath);

// Lazy memory reference — filled in after instantiation
let memoryRef = null;

// Host imports — support both "math" (WAT) and "env" (clang/LLVM) namespaces
const trig = {
  cos_f32: (x) => Math.fround(Math.cos(x)),
  sin_f32: (x) => Math.fround(Math.sin(x)),
};

const importObject = {
  math: { ...trig },
  // AssemblyScript uses the module filename as the import namespace
  "dla-canonical": { ...trig },
  env: {
    ...trig,
    // abort handler for AssemblyScript
    abort: () => { throw new Error("ASC abort"); },
    // memset polyfill for clang-compiled WASM (used for grid/trajectory init)
    memset: (ptr, val, len) => {
      const view = new Uint8Array(memoryRef.buffer);
      view.fill(val & 0xff, ptr, ptr + len);
      return ptr;
    },
  },
};

const { instance } = await WebAssembly.instantiate(wasmBytes, importObject);
memoryRef = instance.exports.memory;

// Support both snake_case (WAT/C/Rust) and camelCase (AssemblyScript) export names
const exp = instance.exports;
const init = exp.init;
const run = exp.run;
const get_cluster_size = exp.get_cluster_size || exp.getClusterSize;
const get_max_r_bits   = exp.get_max_r_bits   || exp.getMaxRBits;
const get_trajectory_entry = exp.get_trajectory_entry || exp.getTrajectoryEntry;

// Run
init(seed);
run();

// Collect results
const clusterSize = get_cluster_size();
const maxRBits = get_max_r_bits() >>> 0;
const trajectory = [];
for (let i = 0; i < N_WALKERS; i++) {
  trajectory.push("0x" + (get_trajectory_entry(i) >>> 0).toString(16).padStart(8, "0"));
}

// Determine substrate name from filename
const substrateName = wasmPath.replace(/.*\//, "").replace(".wasm", "");

const gv = {
  spec_version: "1",
  seed,
  grid_size: 128,
  n_walkers: N_WALKERS,
  prng: "xorshift32",
  substrate: substrateName,
  cluster_size: clusterSize,
  max_r_bits: maxRBits,
  trajectory,
};

process.stdout.write(JSON.stringify(gv, null, 2) + "\n");
