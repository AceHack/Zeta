/**
 * src/wasm-dla/bytelock/run-go-wasm.mjs
 *
 * Node.js harness for the canonical Go WASM substrate.
 * Go WASM requires the wasm_exec.js runtime bridge — it cannot be loaded
 * with a plain WebAssembly.instantiate() call like the other substrates.
 *
 * The key subtlety: Go.run() checks `instance instanceof WebAssembly.Instance`
 * using the vm context's WebAssembly constructor, not the main context's.
 * Both instantiation AND Go.run() must happen inside the same vm context.
 *
 * Usage:
 *   node run-go-wasm.mjs [seed]
 *
 * Outputs a golden vector JSON to stdout.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createContext, Script } from "vm";

const __dir = dirname(fileURLToPath(import.meta.url));
const seed = process.argv[2] ? parseInt(process.argv[2], 10) : 42;
const N_WALKERS = 800;

// ── Build a minimal global shim for wasm_exec.js ─────────────────────────────
const wasmExecSrc = readFileSync(join(__dir, "wasm_exec.js"), "utf8");
const wasmBytes = readFileSync(join(__dir, "dla-canonical-go.wasm"));

const globalShim = {
  performance: { now: () => Date.now() },
  fs: {
    constants: { O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_TRUNC: 512, O_APPEND: 1024, O_EXCL: 128 },
    write: (fd, buf, offset, length, position, callback) => { callback(null, length); },
    open:  (path, flags, mode, callback) => callback(new Error("open not supported")),
    read:  (fd, buf, offset, length, position, callback) => callback(new Error("read not supported")),
    fsync: (fd, callback) => callback(null),
    close: (fd, callback) => callback(null),
  },
  process: {
    getuid: () => -1, getgid: () => -1, geteuid: () => -1, getegid: () => -1,
    getgroups: () => [], pid: 1, ppid: 0, umask: () => 0, cwd: () => "/",
    chdir: () => {}, env: {}, argv: ["js"],
    exit: () => { /* Go calls this when main() returns via select{} — ignore */ },
  },
  crypto: {
    getRandomValues: (b) => { for (let i = 0; i < b.length; i++) b[i] = 0; return b; },
  },
  TextEncoder: globalThis.TextEncoder,
  TextDecoder: globalThis.TextDecoder,
  // Provide the real WebAssembly so the vm context's instanceof checks work
  WebAssembly: globalThis.WebAssembly,
  // Timer functions required by wasm_exec.js and our boot polling
  setTimeout: globalThis.setTimeout,
  setInterval: globalThis.setInterval,
  clearTimeout: globalThis.clearTimeout,
  clearInterval: globalThis.clearInterval,
  // Placeholders — Go will overwrite these via js.Global().Set(...)
  dla_init: undefined,
  dla_run: undefined,
  dla_get_cluster_size: undefined,
  dla_get_max_r_bits: undefined,
  dla_get_trajectory_entry: undefined,
};

const ctx = createContext(globalShim);
ctx.global = ctx;
ctx.self = ctx;
ctx.window = ctx;

// Load wasm_exec.js into the vm context — this defines ctx.Go
new Script(wasmExecSrc).runInContext(ctx);

// ── Instantiate and run — all inside the vm context ──────────────────────────
// Both steps must happen in the same context so instanceof checks pass.
ctx._wasmBytes = wasmBytes;

const bootScript = new Script(`
  (async function boot() {
    const go = new Go();
    const result = await WebAssembly.instantiate(_wasmBytes, go.importObject);
    // go.run() checks instance instanceof WebAssembly.Instance using this context's
    // WebAssembly — must be called here, not from the outer module.
    go.run(result.instance).catch(() => {});
    // Wait for Go's main() to register the DLA functions
    await new Promise((resolve) => {
      const check = () => {
        if (typeof dla_init === "function") resolve();
        else setTimeout(check, 10);
      };
      setTimeout(check, 10);
    });
    _goReady = true;
  })()
`);

ctx._goReady = false;
await bootScript.runInContext(ctx);

// Wait for the boot async to complete
await new Promise((resolve, reject) => {
  const deadline = Date.now() + 10000;
  const check = () => {
    if (ctx._goReady) return resolve();
    if (Date.now() > deadline) return reject(new Error("Go WASM boot timeout — dla_init never registered"));
    setTimeout(check, 20);
  };
  check();
});

// ── Run the DLA ───────────────────────────────────────────────────────────────
ctx._seed = seed;
ctx._nWalkers = N_WALKERS;

const runScript = new Script(`
  dla_init(_seed);
  dla_run();
  _clusterSize = dla_get_cluster_size();
  _maxRBits = dla_get_max_r_bits() >>> 0;
  _trajectory = [];
  for (let i = 0; i < _nWalkers; i++) {
    _trajectory.push("0x" + (dla_get_trajectory_entry(i) >>> 0).toString(16).padStart(8, "0"));
  }
`);

ctx._clusterSize = 0;
ctx._maxRBits = 0;
ctx._trajectory = [];

runScript.runInContext(ctx);

const gv = {
  spec_version: "1",
  seed,
  grid_size: 128,
  n_walkers: N_WALKERS,
  prng: "xorshift32",
  substrate: "dla-canonical-go",
  cluster_size: ctx._clusterSize,
  max_r_bits: ctx._maxRBits,
  trajectory: ctx._trajectory,
};

process.stdout.write(JSON.stringify(gv, null, 2) + "\n");
process.exit(0);
