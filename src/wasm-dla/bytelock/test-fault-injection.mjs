/**
 * src/wasm-dla/bytelock/test-fault-injection.mjs
 *
 * Negative-control test for the byte-lock runner.
 *
 * PURPOSE
 * -------
 * A byte-lock that cannot detect divergence is worse than no byte-lock — it
 * provides false confidence. This script deliberately injects faults into the
 * golden vector and verifies that the runner exits with the expected code.
 *
 * "Accidental non-determinism is the enemy." — Addison, 2026-08-01
 *
 * FAULTS TESTED
 * -------------
 * 1. Trajectory corruption    — flip one trajectory entry for one substrate
 * 2. Cluster-size corruption  — change cluster_size by ±1
 * 3. All-zeros trajectory     — every entry is 0x00000000 (silent wrong output)
 * 4. Liveness floor           — set BYTELOCK_MIN_SUBSTRATES=99 (nothing runs)
 * 5. Toolchain absent         — substrate command that does not exist
 *
 * Each fault must cause the runner to report DIVERGED or LIVENESS FAILURE.
 * A fault that goes undetected is a test failure.
 *
 * Usage:
 *   node test-fault-injection.mjs
 *
 * Exit code 0 = all faults detected (negative controls pass).
 * Exit code 1 = one or more faults were NOT detected (the byte-lock is broken).
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(env = {}) {
  try {
    const out = execSync("node run-bytelock-ci.mjs --json --seeds=42", {
      cwd: __dir,
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, ...env },
    });
    return { exit: 0, report: JSON.parse(out) };
  } catch (e) {
    let report = null;
    try { report = JSON.parse(e.stdout || "null"); } catch {}
    return { exit: e.status ?? 1, report };
  }
}

function pass(label) {
  console.log(`  PASS  ${label}`);
}
function fail(label, detail) {
  console.log(`  FAIL  ${label}  — ${detail}`);
}

// ── Baseline: confirm clean run exits 0 ──────────────────────────────────────
console.log("\nFault-Injection Negative-Control Test\n");
console.log("Phase 0: baseline (expect exit=0, all PASS)");
{
  const { exit, report } = run();
  if (exit !== 0) {
    fail("baseline", `exit=${exit} — clean run should exit 0`);
    process.exit(1);
  }
  if (report?.summary?.pass < 1) {
    fail("baseline", "no substrates passed in clean run");
    process.exit(1);
  }
  pass(`baseline — exit=0, ${report.summary.pass} PASS`);
}

let failures = 0;

// ── Fault 1: Trajectory corruption ───────────────────────────────────────────
console.log("\nPhase 1: trajectory corruption (flip one entry in WAT golden vector)");
{
  // Temporarily patch reference.mjs to corrupt one trajectory entry for seed=42
  const refPath = join(__dir, "reference.mjs");
  const refSrc = readFileSync(refPath, "utf8");
  const backupPath = join(__dir, "reference.mjs.bak");
  copyFileSync(refPath, backupPath);

  // Inject a corruption: wrap toGoldenVector to flip trajectory[0] for seed=42
  const patched = refSrc.replace(
    "export function toGoldenVector(seed, result) {",
    `export function toGoldenVector(seed, result) {
  // FAULT INJECTION: flip trajectory[0] for seed=42 to test detection
  if (seed === 42 && result.trajectory && result.trajectory.length > 0) {
    result = { ...result, trajectory: result.trajectory.map((v, i) => i === 0 ? (v === 0xFFFFFFFF ? 0xFFFFFFFE : 0xFFFFFFFF) : v) };
  }`,
  );

  if (patched === refSrc) {
    fail("trajectory corruption", "could not inject fault into reference.mjs — pattern not found");
    failures++;
  } else {
    writeFileSync(refPath, patched);
    try {
      const { exit, report } = run({ BYTELOCK_STRICT: "1" });
      if (exit === 1 && report?.summary?.fail > 0) {
        pass(`trajectory corruption detected — exit=1, ${report.summary.fail} FAIL`);
      } else {
        fail("trajectory corruption", `exit=${exit}, fail=${report?.summary?.fail ?? "?"} — fault NOT detected`);
        failures++;
      }
    } finally {
      copyFileSync(backupPath, refPath);
      unlinkSync(backupPath);
    }
  }
}

// ── Fault 2: Cluster-size corruption ─────────────────────────────────────────
console.log("\nPhase 2: cluster-size corruption (±1 in golden vector)");
{
  const refPath = join(__dir, "reference.mjs");
  const refSrc = readFileSync(refPath, "utf8");
  const backupPath = join(__dir, "reference.mjs.bak");
  copyFileSync(refPath, backupPath);

  const patched = refSrc.replace(
    "export function toGoldenVector(seed, result) {",
    `export function toGoldenVector(seed, result) {
  // FAULT INJECTION: corrupt cluster_size for seed=42
  if (seed === 42) {
    result = { ...result, clusterSize: (result.clusterSize ?? 0) + 1 };
  }`,
  );

  if (patched === refSrc) {
    fail("cluster-size corruption", "could not inject fault — pattern not found");
    failures++;
  } else {
    writeFileSync(refPath, patched);
    try {
      const { exit, report } = run({ BYTELOCK_STRICT: "1" });
      if (exit === 1 && report?.summary?.fail > 0) {
        pass(`cluster-size corruption detected — exit=1, ${report.summary.fail} FAIL`);
      } else {
        fail("cluster-size corruption", `exit=${exit}, fail=${report?.summary?.fail ?? "?"} — fault NOT detected`);
        failures++;
      }
    } finally {
      copyFileSync(backupPath, refPath);
      unlinkSync(backupPath);
    }
  }
}

// ── Fault 3: All-zeros trajectory (silent wrong output) ───────────────────────
console.log("\nPhase 3: all-zeros trajectory (silent wrong output)");
{
  const refPath = join(__dir, "reference.mjs");
  const refSrc = readFileSync(refPath, "utf8");
  const backupPath = join(__dir, "reference.mjs.bak");
  copyFileSync(refPath, backupPath);

  const patched = refSrc.replace(
    "export function toGoldenVector(seed, result) {",
    `export function toGoldenVector(seed, result) {
  // FAULT INJECTION: replace entire trajectory with zeros for seed=42
  if (seed === 42) {
    result = { ...result, trajectory: new Array(result.trajectory?.length ?? 800).fill(0) };
  }`,
  );

  if (patched === refSrc) {
    fail("all-zeros trajectory", "could not inject fault — pattern not found");
    failures++;
  } else {
    writeFileSync(refPath, patched);
    try {
      const { exit, report } = run({ BYTELOCK_STRICT: "1" });
      if (exit === 1 && report?.summary?.fail > 0) {
        pass(`all-zeros trajectory detected — exit=1, ${report.summary.fail} FAIL`);
      } else {
        fail("all-zeros trajectory", `exit=${exit}, fail=${report?.summary?.fail ?? "?"} — fault NOT detected`);
        failures++;
      }
    } finally {
      copyFileSync(backupPath, refPath);
      unlinkSync(backupPath);
    }
  }
}

// ── Fault 4: Liveness floor ───────────────────────────────────────────────────
console.log("\nPhase 4: liveness floor (BYTELOCK_MIN_SUBSTRATES=99, expect exit=2)");
{
  const { exit } = run({ BYTELOCK_MIN_SUBSTRATES: "99" });
  if (exit === 2) {
    pass("liveness floor fires — exit=2");
  } else {
    fail("liveness floor", `exit=${exit} — expected 2 (liveness failure)`);
    failures++;
  }
}

// ── Fault 5: Toolchain absent ─────────────────────────────────────────────────
console.log("\nPhase 5: toolchain absent (nonexistent command classified as TOOLING, not FAIL)");
{
  // Temporarily add a substrate with a nonexistent command
  const ciPath = join(__dir, "run-bytelock-ci.mjs");
  const ciSrc = readFileSync(ciPath, "utf8");
  const backupPath = join(__dir, "run-bytelock-ci.mjs.bak");
  copyFileSync(ciPath, backupPath);

  const patched = ciSrc.replace(
    "  { name: \"Go\",          cmd: \"node\",    args: [\"run-go-wasm.mjs\"],         type: \"script\" },",
    `  { name: \"Go\",          cmd: \"node\",    args: [\"run-go-wasm.mjs\"],         type: \"script\" },
  { name: \"FaultSubstrate\", cmd: \"nonexistent-tool-dla\", args: [\"dummy.lua\"], type: \"script\" },`,
  );

  if (patched === ciSrc) {
    fail("toolchain absent", "could not inject fault — pattern not found");
    failures++;
  } else {
    writeFileSync(ciPath, patched);
    try {
      const { exit, report } = run({ BYTELOCK_STRICT: "1" });
      const faultSub = report?.substrates?.find(s => s.name === "FaultSubstrate");
      if (faultSub?.status === "TOOLING" && exit === 0) {
        pass(`toolchain absent classified as TOOLING (not FAIL) — exit=0, status=${faultSub.status}`);
      } else {
        fail("toolchain absent", `exit=${exit}, FaultSubstrate.status=${faultSub?.status ?? "?"} — expected TOOLING + exit=0`);
        failures++;
      }
    } finally {
      copyFileSync(backupPath, ciPath);
      unlinkSync(backupPath);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("");
if (failures === 0) {
  console.log("All 5 fault-injection negative controls PASS.");
  console.log("The byte-lock correctly detects all injected faults.");
  process.exit(0);
} else {
  console.log(`${failures} fault(s) were NOT detected — the byte-lock has blind spots.`);
  process.exit(1);
}
