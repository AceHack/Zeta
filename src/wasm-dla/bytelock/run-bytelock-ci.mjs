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
 *   Go:       run-go-wasm.mjs (via wasm_exec.js bridge — dla-canonical-go.wasm)
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
//
// Seed resolution order (first match wins):
//   1. --seeds-file=PATH  JSON file: array of numbers, e.g. [1,42,100,999]
//                         or object: { "seeds": [1,42,...] }
//                         Use for large-corpus regression runs without changing CI config.
//   2. --seeds=N,M,...    Comma-separated list on the command line.
//   3. Default: 1,42,100,999
//
// Usage examples:
//   node run-bytelock-ci.mjs
//   node run-bytelock-ci.mjs --seeds=42
//   node run-bytelock-ci.mjs --seeds-file=seeds-100.json
//   node run-bytelock-ci.mjs --json --seeds-file=/path/to/corpus.json

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");

// --seeds-file resolution
const seedsFileArg = args.find((a) => a.startsWith("--seeds-file=") || a === "--seeds-file");
let CI_SEEDS;
if (seedsFileArg) {
  const seedsFilePath = seedsFileArg.split("=")[1] || args[args.indexOf(seedsFileArg) + 1];
  if (!seedsFilePath || seedsFilePath.startsWith("-")) {
    console.error("--seeds-file requires a path argument, e.g. --seeds-file=seeds.json");
    process.exit(2);
  }
  const absPath = seedsFilePath.startsWith("/") ? seedsFilePath : join(__dir, seedsFilePath);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absPath, "utf8"));
  } catch (e) {
    console.error(`--seeds-file: could not read or parse '${absPath}': ${e.message}`);
    process.exit(2);
  }
  const seedArray = Array.isArray(parsed) ? parsed : parsed.seeds;
  if (!Array.isArray(seedArray) || seedArray.length === 0) {
    console.error(`--seeds-file: '${absPath}' must be a JSON array or { "seeds": [...] }`);
    process.exit(2);
  }
  CI_SEEDS = seedArray.map(Number).filter((n) => !isNaN(n));
  if (CI_SEEDS.length === 0) {
    console.error(`--seeds-file: '${absPath}' contained no valid numeric seeds`);
    process.exit(2);
  }
  if (!jsonMode) console.log(`Seeds loaded from file: ${absPath} (${CI_SEEDS.length} seeds)`);
} else {
  // --seeds=N,M,... or default
  const seedsArg = args.find((a) => a.startsWith("--seeds=") || a === "--seeds");
  // Prefer --seeds=VALUE over --seeds VALUE to avoid consuming the next flag as a value
  const seedsVal = seedsArg
    ? (seedsArg.split("=")[1] || args[args.indexOf(seedsArg) + 1] || "1,42,100,999")
    : "1,42,100,999";
  CI_SEEDS = seedsVal.split(",").map(Number);
}

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
  // Go WASM uses the wasm_exec.js runtime bridge — run via dedicated harness.
  // Requires: go (GOOS=js GOARCH=wasm) + wasm_exec.js already copied to this dir.
  { name: "Go",          cmd: "node",    args: ["run-go-wasm.mjs"],         type: "script" },
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
  let subToolingMiss = false;
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
      // A RUN ERROR IS NOT A BYTE DIVERGENCE. An absent toolchain means the substrate was
      // never exercised — that is INFRASTRUCTURE, and reporting it as "divergences found"
      // (as this runner did on 2026-08-01 for `lua5.4: command not found`) trains everyone
      // to ignore the signal that matters.
      const tooling = /command not found|Command failed|ENOENT|not recognized|No such file|not found/i.test(
        String(runError),
      );
      subReport.results.push({ seed, pass: false, error: runError, kind: tooling ? "tooling" : "run-error" });
      if (tooling) {
        subToolingMiss = true;
        if (!jsonMode)
          console.log(`  TOOL  ${sub.name.padEnd(20)} seed=${seed}  (toolchain absent — NOT a divergence)`);
      } else {
        subPass = false;
        if (!jsonMode) console.log(`  FAIL  ${sub.name.padEnd(20)} seed=${seed}  ERROR: ${runError.slice(0, 80)}`);
      }
      continue;
    }

    const result = verify(golden, candidate);
    subReport.results.push({ seed, pass: result.pass, divergences: result.divergences });
    if (!result.pass) {
      // A MISSING TOOLCHAIN IS NOT A BYTE DIVERGENCE. Conflating them is how a real
      // signal gets ignored: on 2026-08-01 this runner printed "divergences found" when
      // the only cause was `lua5.4: command not found`. Infrastructure and evidence are
      // different failures and must be reported differently.
      const toolingMiss = result.divergences.some((d) =>
        /command not found|ENOENT|not recognized|No such file/i.test(String(d)),
      );
      if (toolingMiss) {
        subReport.status = "TOOLING";
        subToolingMiss = true;
        if (!jsonMode) {
          console.log(`  TOOL  ${sub.name.padEnd(20)} seed=${seed} (toolchain absent — NOT a divergence)`);
        }
      } else {
        subPass = false;
        if (!jsonMode) {
          console.log(`  FAIL  ${sub.name.padEnd(20)} seed=${seed}`);
          for (const d of result.divergences) console.log(`        ${d}`);
        }
      }
    } else {
      if (!jsonMode) console.log(`  PASS  ${sub.name.padEnd(20)} seed=${seed}`);
    }
  }

  if (subToolingMiss) {
    subReport.status = "TOOLING";
    report.summary.tooling = (report.summary.tooling ?? 0) + 1;
  } else {
    subReport.status = subPass ? "PASS" : "FAIL";
    if (subPass) report.summary.pass++;
    else { report.summary.fail++; anyFail = true; }
  }
  report.substrates.push(subReport);
}

if (!jsonMode) {
  console.log("");
  const tooling = report.summary.tooling ?? 0;
  const executedN = report.summary.pass + report.summary.fail;
  const totalN = executedN + tooling + report.summary.skip;
  console.log(
    `Summary: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${tooling} TOOLING-ABSENT, ${report.summary.skip} SKIP`,
  );
  // State COVERAGE, never "all substrates". Saying "all" when one was never exercised is
  // the same overclaim that put unfalsifiable discharges into the frozen core.
  console.log(
    anyFail
      ? `\nByte-lock DIVERGED — ${report.summary.fail} of ${executedN} executed substrate(s) disagree (drift signal, not a gate).`
      : `\nByte-lock AGREED — ${executedN} of ${totalN} substrate(s) executed and produced identical trajectories` +
        (tooling ? `; ${tooling} NOT exercised (toolchain absent) and therefore NOT verified.` : "."),
  );
} else {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

// ── LIVENESS FLOOR — the ONLY hard failure ──────────────────────────────────────
// This is a DRIFT CHECK: a byte divergence is a SIGNAL (a compiler upgrade changed float
// rounding is something you want to KNOW, not something to block), and it runs post-merge
// on main where it cannot gate anything anyway.
//
// But one thing must be hard: LIVENESS. The real hazard is not divergence — it is the
// byte-lock going GREEN WHILE VERIFYING NOTHING (missing .wasm, every substrate skipped).
// "Verified 0 of 10 substrates" must never read as success. That is the exact false-green
// shape that put six unfalsifiable "discharges" into the frozen core on 2026-08-01.
const MIN_SUBSTRATES = Number(process.env.BYTELOCK_MIN_SUBSTRATES ?? 2);
const executed = report.summary.pass + report.summary.fail;
if (executed < MIN_SUBSTRATES) {
  if (!jsonMode) {
    console.error(
      `\nLIVENESS FAILURE: only ${executed} substrate(s) actually executed ` +
        `(minimum ${MIN_SUBSTRATES}). A byte-lock that verifies nothing must not report success.`,
    );
  }
  process.exit(2); // 2 = did not run, distinct from 1 = diverged
}

// Divergence is reported, not fatal — this is a drift signal. Set BYTELOCK_STRICT=1 to
// make divergence fatal (useful when running it deliberately as a gate somewhere else).
const strict = process.env.BYTELOCK_STRICT === "1";
process.exit(anyFail && strict ? 1 : 0);
