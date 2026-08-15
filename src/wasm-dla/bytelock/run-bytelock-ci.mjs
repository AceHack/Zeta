/**
 * src/wasm-dla/bytelock/run-bytelock-ci.mjs
 *
 * N-Oracle Byte-Lock CI Gate — Byte-Lock v1
 * Spec: src/wasm-dla/CANONICAL_SPEC.md
 *
 * Runs all available substrates at all CI seeds and verifies
 * each against the golden vector from reference.mjs.
 *
 * Exit code 0 = every substrate that executed agreed (or diverged — divergence is a drift
 *               SIGNAL here, not a gate; set BYTELOCK_STRICT=1 to make it fatal).
 * Exit code 1 = diverged AND BYTELOCK_STRICT=1.
 * Exit code 2 = LIVENESS FAILURE — fewer than BYTELOCK_MIN_SUBSTRATES actually executed.
 * Exit code 3 = MALFORMED ARTEFACT — a substrate's binary is not loadable, so it verified
 *               nothing. Distinct from 1 (compared and disagreed) and from 2 (too few ran):
 *               here the instrument itself is broken.
 *
 * Usage:
 *   node run-bytelock-ci.mjs
 *   node run-bytelock-ci.mjs --seeds 1,42,100,999
 *   node run-bytelock-ci.mjs --json                              (print JSON report to stdout)
 *   node run-bytelock-ci.mjs --report-file=bytelock.json          (write JSON report to file)
 *   node run-bytelock-ci.mjs --seeds-file=testdata/seeds-100.json (large corpus)
 *
 * Substrates tested (9):
 *   WASM:     dla-canonical-wat.wasm, dla-canonical-llvm.wasm,
 *             dla-canonical-emcc.wasm, dla-canonical-rust.wasm,
 *             dla-canonical-asc.wasm, dla-canonical-zig.wasm
 *   Bytecode: dla-canonical-source.js (V8/QuickJS source),
 *             dla-canonical.lua (Lua 5.4)
 *   Go:       run-go-wasm.mjs (via wasm_exec.js bridge — dla-canonical-go.wasm)
 *
 * ROSTER ≠ COVERAGE, and the difference must always be printed. Until 2026-08-15 two of
 * these nine had never verified anything: `dla-canonical-go.wasm` was never built, and
 * `dla-canonical-zig.wasm` was an `ar` archive that could not load. The summary line
 * reports executed / total precisely so the gap between what is listed and what ran cannot
 * be read off as breadth.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
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
//   node run-bytelock-ci.mjs --report-file=bytelock.json  (write JSON to file, not stdout)

const args = process.argv.slice(2);
const reportFileArg = args.find((a) => a.startsWith("--report-file=") || a === "--report-file");
const reportFilePath = reportFileArg
  ? (reportFileArg.split("=")[1] || args[args.indexOf(reportFileArg) + 1] || null)
  : null;
// --json mode: either explicit --json flag, or --report-file (always produces JSON)
const jsonMode = args.includes("--json") || reportFilePath != null;

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
  // Zig: single-step `zig build-exe -fno-entry` (Zig links it itself — no wasm-ld, no `ar`).
  // The old two-step build-lib route left its `ar` intermediate here under the output's
  // name; see the MALFORMED-ARTEFACT GUARD below and build-substrates.mjs.
  { name: "Zig",            file: "dla-canonical-zig.wasm", type: "wasm" },
];

const SCRIPT_SUBSTRATES = [
  { name: "JS (V8)",     cmd: "node",    args: ["dla-canonical-source.js"], type: "script" },
  { name: "Lua 5.4",     cmd: "lua5.4",  args: ["dla-canonical.lua"],       type: "script" },
  // Go WASM uses the wasm_exec.js runtime bridge — run via dedicated harness.
  // Requires: go (GOOS=js GOARCH=wasm) + wasm_exec.js already copied to this dir.
  { name: "Go",          cmd: "node",    args: ["run-go-wasm.mjs"],         type: "script" },
];

// ── MALFORMED-ARTEFACT GUARD ──────────────────────────────────────────────────
//
// A `.wasm` that is not a WebAssembly module must fail LOUDLY and be counted as NOT
// EXECUTED. Before 2026-08-15 `dla-canonical-zig.wasm` was an `ar` archive (`!<arch>`) —
// the unlinked `zig build-lib` intermediate, committed by mistake. Every run since had
// printed `expected magic word 00 61 73 6d, found 21 3c 61 72`, and every run exited 0,
// because the load error arrived through the same channel as a byte divergence and
// divergence is deliberately non-fatal here. Worse, the failure still counted toward
// `executed`, so the summary line claimed a denominator of 8 when only 7 substrates had
// ever compared a vector.
//
// The distinction the runner was missing: a module that CANNOT BE LOADED never ran, so it
// is neither evidence of agreement nor evidence of drift. It is a broken instrument, and a
// broken instrument is an infrastructure failure that must stop the run — exit 3.
//
// Eight bytes are checked, not four: `00 61 73 6d` is the magic and `01 00 00 00` is the
// binary-format version, and a wrong version is equally unloadable.
const WASM_HEADER = Object.freeze([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

function checkWasmHeader(path) {
  const head = readFileSync(path).subarray(0, WASM_HEADER.length);
  const found = [...head].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const ok = head.length === WASM_HEADER.length && WASM_HEADER.every((b, i) => head[i] === b);
  return { ok, found };
}

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
      memcpy: (dst, src, len) => {
        const view = new Uint8Array(memoryRef.buffer);
        view.copyWithin(dst, src, src + len);
        return dst;
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
    // stderr MUST be captured, not inherited. `execSync`'s default lets the child's stderr
    // pass straight through to this process, which leaves `e.stderr` null — and the
    // classifier below has to decide "did the interpreter launch?" from the exit status and
    // the child's own words. Inheriting also dumped raw Node stack traces into the CI log
    // between substrate lines, which is how the Go substrate's absence stayed unread.
    stdio: ["ignore", "pipe", "pipe"],
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
    // The artefact exists — but is it a WebAssembly module at all? See WASM_HEADER above.
    const header = checkWasmHeader(wasmPath);
    if (!header.ok) {
      subReport.status = "MALFORMED";
      subReport.reason =
        `${sub.file} is not a WebAssembly module — expected header ` +
        `${WASM_HEADER.map((b) => b.toString(16).padStart(2, "0")).join(" ")}, found ${header.found}`;
      report.summary.malformed = (report.summary.malformed ?? 0) + 1;
      report.substrates.push(subReport);
      if (!jsonMode) console.log(`  BAD   ${sub.name.padEnd(20)} MALFORMED — ${subReport.reason}`);
      continue;
    }
  }

  let subPass = true;
  let subToolingMiss = false;
  for (const seed of CI_SEEDS) {
    const golden = toGoldenVector(seed, runDLA(seed));
    let candidate;
    let runError = null;
    let runErrorDetail = null;

    try {
      if (sub.type === "wasm") {
        candidate = await runWasmSubstrate(join(__dir, sub.file), seed);
      } else {
        candidate = runScriptSubstrate(sub.cmd, sub.args, seed);
      }
    } catch (e) {
      runError = e.message;
      runErrorDetail = e;
    }

    if (runError) {
      // A RUN ERROR IS NOT A BYTE DIVERGENCE. An absent toolchain means the substrate was
      // never exercised — that is INFRASTRUCTURE, and reporting it as "divergences found"
      // (as this runner did on 2026-08-01 for `lua5.4: command not found`) trains everyone
      // to ignore the signal that matters.
      //
      // BUT THE FIRST VERSION OF THIS CLASSIFIER OVER-CORRECTED, AND IT WAS VACUOUS.
      // It matched the literal string "Command failed" — which `execSync` prefixes onto
      // EVERY non-zero exit — so a script substrate that launched fine, ran, and crashed
      // was reported as "toolchain absent". Measured 2026-08-15: `dla-canonical-source.js`
      // replaced with `process.exit(7)` after writing "deliberate substrate crash" to
      // stderr produced `TOOL  JS (V8) (toolchain absent — NOT a divergence)` and the run
      // exited 0 claiming AGREED — with node plainly installed, since node was running the
      // runner. Every script substrate (JS, Lua, Go) could therefore fail silently.
      //
      // TOOLING now means one thing only: THE INTERPRETER COULD NOT BE LAUNCHED. That is
      // observable without guessing — `e.code === "ENOENT"` when the spawn itself failed,
      // shell exit 127 for a missing command, or the shell's own not-found text. A harness
      // may also DECLARE its own missing prerequisite by writing "TOOLING-ABSENT:" to
      // stderr, which is how `run-go-wasm.mjs` reports an unbuilt artefact. Everything
      // else ran and failed, and is reported as a failure.
      const stderrText = String(runErrorDetail?.stderr ?? "");
      const malformedArtefact = /MALFORMED ARTEFACT:/i.test(stderrText);
      const tooling =
        !malformedArtefact &&
        (runErrorDetail?.code === "ENOENT" ||
          runErrorDetail?.status === 127 ||
          /command not found|not recognized as an internal or external command/i.test(stderrText) ||
          /TOOLING-ABSENT:/i.test(stderrText));
      subReport.results.push({
        seed,
        pass: false,
        error: runError,
        kind: malformedArtefact ? "malformed" : tooling ? "tooling" : "run-error",
      });
      if (malformedArtefact) {
        // Same class as the WASM header check above: a broken instrument, not a divergence.
        subReport.status = "MALFORMED";
        subReport.reason = stderrText.split("\n").find((l) => /MALFORMED ARTEFACT:/i.test(l))?.trim() ?? runError;
        if (!jsonMode) console.log(`  BAD   ${sub.name.padEnd(20)} ${subReport.reason}`);
        // `break`, not `continue`: the artefact will not become loadable at the next seed,
        // and repeating the same message four times buries it.
        break;
      }
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

  // A MALFORMED artefact never ran, so it is neither a PASS, a FAIL, nor an absent
  // toolchain. It must not reach `executed` — padding that denominator is what let the
  // summary claim "1 of 8 executed" while only 7 substrates had compared a vector.
  if (subReport.status === "MALFORMED") {
    report.summary.malformed = (report.summary.malformed ?? 0) + 1;
    report.substrates.push(subReport);
    continue;
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
  const malformed = report.summary.malformed ?? 0;
  const executedN = report.summary.pass + report.summary.fail;
  const totalN = executedN + tooling + malformed + report.summary.skip;
  console.log(
    `Summary: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${tooling} TOOLING-ABSENT, ` +
      `${malformed} MALFORMED, ${report.summary.skip} SKIP`,
  );
  // State COVERAGE, never "all substrates". Saying "all" when one was never exercised is
  // the same overclaim that put unfalsifiable discharges into the frozen core.
  console.log(
    anyFail
      ? `\nByte-lock DIVERGED — ${report.summary.fail} of ${executedN} executed substrate(s) disagree (drift signal, not a gate).`
      : `\nByte-lock AGREED — ${executedN} of ${totalN} substrate(s) executed and produced identical trajectories` +
        (tooling ? `; ${tooling} NOT exercised (toolchain absent) and therefore NOT verified` : "") +
        (malformed ? `; ${malformed} MALFORMED artefact(s) — never loaded, never verified` : "") +
        ".",
  );
} else {
  const jsonOut = JSON.stringify(report, null, 2) + "\n";
  if (reportFilePath) {
    writeFileSync(reportFilePath, jsonOut, "utf8");
    // When --report-file is used, also print the human summary to stdout
    const tooling2 = report.summary.tooling ?? 0;
    const malformed2 = report.summary.malformed ?? 0;
    const executedN2 = report.summary.pass + report.summary.fail;
    const totalN2 = executedN2 + tooling2 + malformed2 + report.summary.skip;
    console.log(`\nReport written to: ${reportFilePath}`);
    console.log(
      `Summary: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${tooling2} TOOLING-ABSENT, ` +
        `${malformed2} MALFORMED, ${report.summary.skip} SKIP`,
    );
    console.log(
      anyFail
        ? `\nByte-lock DIVERGED \u2014 ${report.summary.fail} of ${executedN2} executed substrate(s) disagree (drift signal, not a gate).`
        : `\nByte-lock AGREED \u2014 ${executedN2} of ${totalN2} substrate(s) executed and produced identical trajectories` +
          (tooling2 ? `; ${tooling2} NOT exercised (toolchain absent) and therefore NOT verified` : "") +
          (malformed2 ? `; ${malformed2} MALFORMED artefact(s) \u2014 never loaded, never verified` : "") +
          ".",
    );
  } else {
    process.stdout.write(jsonOut);
  }
}

// ── MALFORMED-ARTEFACT FAILURE — a broken instrument stops the run (exit 3) ─────
// Checked BEFORE the liveness floor because it names the actual cause. A malformed
// artefact is not a divergence (nothing was compared), not an absent toolchain (the file
// is right there), and not a skip (we did not choose to omit it) — it is an instrument
// that cannot measure, and reporting anything else about the run would be reporting on a
// measurement that did not happen.
//
// This is deliberately HARD while divergence is soft. The asymmetry is the whole point of
// this runner's design: a divergence is a finding you want delivered, a broken instrument
// is a finding you want STOPPED, because everything downstream of it is unearned.
const malformedSubs = report.substrates.filter((s) => s.status === "MALFORMED");
if (malformedSubs.length > 0) {
  console.error(
    `\nMALFORMED ARTEFACT — ${malformedSubs.length} substrate(s) could not be loaded and therefore\n` +
      `verified NOTHING. This is an infrastructure failure, not a byte divergence:\n` +
      malformedSubs.map((s) => `  ${s.name} — ${s.reason}`).join("\n") +
      `\nRebuild the artefact (node build-substrates.mjs --only=<name>) or remove the substrate\n` +
      `from the roster. A substrate that cannot load must never sit in the roster contributing\n` +
      `nothing while the run reports success.`,
  );
  process.exit(3); // 3 = malformed artefact, distinct from 2 = did not run, 1 = diverged
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
