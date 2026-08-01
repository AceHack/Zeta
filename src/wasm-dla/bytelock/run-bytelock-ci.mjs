/**
 * src/wasm-dla/bytelock/run-bytelock-ci.mjs
 *
 * N-Oracle Byte-Lock CI Gate — Byte-Lock v1
 * Spec: src/wasm-dla/CANONICAL_SPEC.md
 *
 * Runs all available substrates at all CI seeds and verifies
 * each against the golden vector from reference.mjs.
 *
 * Exit code 0 = all substrates PASS.
 * Exit code 1 = one or more substrates FAIL (divergence found).
 *
 * Usage:
 *   node run-bytelock-ci.mjs
 *   node run-bytelock-ci.mjs --seeds 1,42,100,999
 *   node run-bytelock-ci.mjs --json   (output JSON report)
 *
 * Substrates tested:
 *   WASM:     dla-canonical-wat.wasm, dla-canonical-llvm.wasm,
 *             dla-canonical-emcc.wasm, dla-canonical-rust.wasm,
 *             dla-canonical-asc.wasm
 *   Bytecode: dla-canonical-source.js (V8/QuickJS source),
 *             dla-canonical.lua (Lua 5.4)
 *   (Go substrate requires wasm_exec.js runtime — tested separately)
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const seedsArg = args.find((a) => a.startsWith("--seeds=") || a === "--seeds");
const seedsVal = seedsArg
  ? (args[args.indexOf(seedsArg) + 1] || seedsArg.split("=")[1] || "1,42,100,999")
  : "1,42,100,999";
const CI_SEEDS = seedsVal.split(",").map(Number);

// ── Import reference ──────────────────────────────────────────────────────────
const { runDLA, toGoldenVector, verify } = await import(join(__dir, "reference.mjs"));

// ── Substrate definitions ─────────────────────────────────────────────────────
const WASM_SUBSTRATES = [
  { name: "WAT",         file: "dla-canonical-wat.wasm",  type: "wasm" },
  { name: "LLVM/C",      file: "dla-canonical-llvm.wasm", type: "wasm" },
  { name: "Emscripten",  file: "dla-canonical-emcc.wasm", type: "wasm" },
  { name: "Rust",        file: "dla-canonical-rust.wasm", type: "wasm" },
  { name: "AssemblyScript", file: "dla-canonical-asc.wasm", type: "wasm" },
];

const SCRIPT_SUBSTRATES = [
  { name: "JS (V8)",     cmd: "node",    args: ["dla-canonical-source.js"], type: "script" },
  { name: "Lua 5.4",     cmd: "lua5.4",  args: ["dla-canonical.lua"],       type: "script" },
];

// ── WASM runner ───────────────────────────────────────────────────────────────
const N_WALKERS = 800;

// Lazy memory ref for WASM substrates that need memset
let memoryRef = null;

async function runWasmSubstrate(wasmPath, seed) {
  const wasmBytes = readFileSync(wasmPath);
  const trig = {
    cos_f32: (x) => Math.fround(Math.cos(x)),
    sin_f32: (x) => Math.fround(Math.sin(x)),
  };
  const importObject = {
    math: { ...trig },
    "dla-canonical": { ...trig },
    env: {
      ...trig,
      abort: () => { throw new Error("ASC abort"); },
      memset: (ptr, val, len) => {
        const view = new Uint8Array(memoryRef.buffer);
        view.fill(val & 0xff, ptr, ptr + len);
        return ptr;
      },
    },
  };
  const { instance } = await WebAssembly.instantiate(wasmBytes, importObject);
  memoryRef = instance.exports.memory;
  const exp = instance.exports;
  const init = exp.init;
  const run  = exp.run;
  const get_cluster_size     = exp.get_cluster_size     || exp.getClusterSize;
  const get_max_r_bits       = exp.get_max_r_bits       || exp.getMaxRBits;
  const get_trajectory_entry = exp.get_trajectory_entry || exp.getTrajectoryEntry;

  init(seed);
  run();

  const clusterSize = get_cluster_size();
  const maxRBits = get_max_r_bits() >>> 0;
  const trajectory = [];
  for (let i = 0; i < N_WALKERS; i++) {
    trajectory.push("0x" + (get_trajectory_entry(i) >>> 0).toString(16).padStart(8, "0"));
  }
  return {
    spec_version: "1", seed,
    grid_size: 128, n_walkers: N_WALKERS, prng: "xorshift32",
    substrate: wasmPath.replace(/.*\//, "").replace(".wasm", ""),
    cluster_size: clusterSize, max_r_bits: maxRBits, trajectory,
  };
}

function runScriptSubstrate(cmd, scriptArgs, seed) {
  const fullArgs = [...scriptArgs, String(seed)];
  const output = execSync(`${cmd} ${fullArgs.join(" ")}`, {
    cwd: __dir,
    encoding: "utf8",
    timeout: 30000,
  });
  return JSON.parse(output);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const report = { seeds: CI_SEEDS, substrates: [], summary: { pass: 0, fail: 0, skip: 0 } };
let anyFail = false;

if (!jsonMode) {
  console.log(`\nN-Oracle Byte-Lock CI — ${CI_SEEDS.length} seeds × ${WASM_SUBSTRATES.length + SCRIPT_SUBSTRATES.length} substrates\n`);
  console.log("Seed(s):", CI_SEEDS.join(", "));
  console.log("");
}

for (const sub of [...WASM_SUBSTRATES, ...SCRIPT_SUBSTRATES]) {
  const subReport = { name: sub.name, type: sub.type, results: [] };

  // Check if substrate file exists
  if (sub.type === "wasm") {
    const wasmPath = join(__dir, sub.file);
    if (!existsSync(wasmPath)) {
      subReport.status = "SKIP";
      subReport.reason = `${sub.file} not found — run build first`;
      report.summary.skip++;
      report.substrates.push(subReport);
      if (!jsonMode) console.log(`  SKIP  ${sub.name.padEnd(20)} (${sub.reason})`);
      continue;
    }
  }

  let subPass = true;
  for (const seed of CI_SEEDS) {
    const golden = toGoldenVector(seed, runDLA(seed));
    let candidate;
    let runError = null;

    try {
      if (sub.type === "wasm") {
        candidate = await runWasmSubstrate(join(__dir, sub.file), seed);
      } else {
        candidate = runScriptSubstrate(sub.cmd, sub.args, seed);
      }
    } catch (e) {
      runError = e.message;
    }

    if (runError) {
      subReport.results.push({ seed, pass: false, error: runError });
      subPass = false;
      if (!jsonMode) console.log(`  FAIL  ${sub.name.padEnd(20)} seed=${seed}  ERROR: ${runError.slice(0, 80)}`);
      continue;
    }

    const result = verify(golden, candidate);
    subReport.results.push({ seed, pass: result.pass, divergences: result.divergences });
    if (!result.pass) {
      subPass = false;
      if (!jsonMode) {
        console.log(`  FAIL  ${sub.name.padEnd(20)} seed=${seed}`);
        for (const d of result.divergences) console.log(`        ${d}`);
      }
    } else {
      if (!jsonMode) console.log(`  PASS  ${sub.name.padEnd(20)} seed=${seed}`);
    }
  }

  subReport.status = subPass ? "PASS" : "FAIL";
  if (subPass) report.summary.pass++;
  else { report.summary.fail++; anyFail = true; }
  report.substrates.push(subReport);
}

if (!jsonMode) {
  console.log("");
  console.log(`Summary: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.skip} SKIP`);
  console.log(anyFail ? "\nByte-lock FAILED — divergences found." : "\nByte-lock PASSED — all substrates produce identical trajectories.");
} else {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

process.exit(anyFail ? 1 : 0);
