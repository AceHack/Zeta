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

import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createContext, Script } from "vm";

const __dir = dirname(fileURLToPath(import.meta.url));
const seed = process.argv[2] ? parseInt(process.argv[2], 10) : 42;
const N_WALKERS = 800;

// ── Prerequisite checks — SAY WHICH KIND OF FAILURE THIS IS ──────────────────
//
// This harness is launched by `run-bytelock-ci.mjs` through `execSync`, which cannot see
// inside the child and prefixes every non-zero exit with "Command failed". Until
// 2026-08-15 the parent matched that prefix and called the result "toolchain absent", so a
// Go substrate that ran and crashed was indistinguishable from one that was never built.
// The fix has two halves: the parent no longer guesses (it classifies on exit status and
// spawn errno), and THIS harness declares its own condition in words the parent keys on.
//
// Two prefixes, two meanings, both exact:
//   TOOLING-ABSENT:   the prerequisite was never produced — nothing was verified, and that
//                     is infrastructure, not evidence.
//   MALFORMED ARTEFACT: the file exists but is not a WebAssembly module. This is the exact
//                     shape that hid in `dla-canonical-zig.wasm` (an `ar` archive) for two
//                     weeks while counting as an executed substrate.
const goWasmPath = join(__dir, "dla-canonical-go.wasm");
if (!existsSync(goWasmPath)) {
  process.stderr.write(
    `TOOLING-ABSENT: dla-canonical-go.wasm was not built. ` +
      `Build it with: GOOS=js GOARCH=wasm go build -o dla-canonical-go.wasm .\n`,
  );
  process.exit(2);
}

// Header check: `00 61 73 6d` magic + `01 00 00 00` binary-format version.
const WASM_HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
const wasmBytes = readFileSync(goWasmPath);
if (!WASM_HEADER.every((b, i) => wasmBytes[i] === b)) {
  const found = [...wasmBytes.subarray(0, WASM_HEADER.length)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  process.stderr.write(
    `MALFORMED ARTEFACT: dla-canonical-go.wasm is not a WebAssembly module — ` +
      `expected header ${WASM_HEADER.map((b) => b.toString(16).padStart(2, "0")).join(" ")}, found ${found}\n`,
  );
  process.exit(3);
}

// ── Build a minimal global shim for wasm_exec.js ─────────────────────────────
const wasmExecSrc = readFileSync(join(__dir, "wasm_exec.js"), "utf8");

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
