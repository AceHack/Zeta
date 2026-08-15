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
 * 6. Malformed artefact       — an `ar` archive planted where a .wasm is expected
 * 7. Script substrate crash   — a substrate that RAN and failed (must not read as absent)
 *
 * Each fault must cause the runner to report DIVERGED, LIVENESS FAILURE, or MALFORMED —
 * and faults 5, 6 and 7 must be told APART from each other, because the whole point is
 * that "never ran", "cannot load" and "ran and was wrong" are three different findings.
 * A fault that goes undetected is a test failure.
 *
 * Faults 6 and 7 are regressions, not hypotheticals: both were live on main until
 * 2026-08-15, and both presented as a green run. This file was itself unexecuted by any
 * workflow until the same change wired it into `bytelock.yml` — a negative-control suite
 * that never runs proves nothing, which is the identical defect one level up.
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

// ── Fault 6: Malformed artefact ───────────────────────────────────────────────
// THIS ONE IS NOT HYPOTHETICAL. `dla-canonical-zig.wasm` sat on main as an `ar` archive
// (`!<arch>` = 21 3c 61 72), the unlinked `zig build-lib` intermediate. It could not load
// in any run, yet it counted toward `executed` and its load error was classified as a byte
// divergence — which this runner deliberately does not fail on. So the job went green over
// a substrate that verified nothing, for two weeks, while printing the error every time.
//
// A malformed artefact must be its OWN failure class: exit 3, status MALFORMED, and not
// counted as executed. Both directions are checked — planted and restored — because a
// guard that only ever sees the broken case is not shown to permit the good one.
console.log("\nPhase 6: malformed artefact (ar archive planted where a .wasm is expected)");
{
  const wasmPath = join(__dir, "dla-canonical-zig.wasm");
  const backupPath = join(__dir, "dla-canonical-zig.wasm.bak");
  // Attempt the copy rather than existsSync-then-copy: the check/use pair is a
  // TOCTOU gap (CodeQL js/file-system-race, high) because the file can change
  // between the two calls. Letting copyFileSync be the check closes the gap —
  // there is only one filesystem operation — and an absent file lands in the
  // same failure branch with the same message it had before.
  let copied = false;
  try {
    copyFileSync(wasmPath, backupPath);
    copied = true;
  } catch (e) {
    fail("malformed artefact", `${wasmPath} is absent or unreadable — cannot run this negative control: ${e.message}`);
    failures++;
  }
  if (copied) {
    try {
      // Direction 1: plant an `ar` archive — the exact bytes that were on main.
      writeFileSync(wasmPath, Buffer.from("!<arch>\n", "ascii"));
      const bad = run({ BYTELOCK_STRICT: "1" });
      const badZig = bad.report?.substrates?.find((s) => s.name === "Zig");
      const notCounted =
        (bad.report?.summary?.malformed ?? 0) === 1 &&
        !bad.report?.substrates?.some((s) => s.name === "Zig" && (s.status === "PASS" || s.status === "FAIL"));
      if (bad.exit === 3 && badZig?.status === "MALFORMED" && notCounted) {
        pass(`malformed artefact detected — exit=3, status=MALFORMED, excluded from executed`);
      } else {
        fail(
          "malformed artefact",
          `exit=${bad.exit}, Zig.status=${badZig?.status ?? "?"}, malformed=${bad.report?.summary?.malformed ?? "?"} — expected exit=3 + MALFORMED`,
        );
        failures++;
      }

      // Direction 2: restore the real module — the guard must PERMIT a valid one.
      copyFileSync(backupPath, wasmPath);
      const good = run();
      const goodZig = good.report?.substrates?.find((s) => s.name === "Zig");
      if (good.exit === 0 && goodZig?.status === "PASS") {
        pass("real module restored — exit=0, Zig=PASS (the guard is not a blanket refusal)");
      } else {
        fail(
          "malformed artefact (restore)",
          `exit=${good.exit}, Zig.status=${goodZig?.status ?? "?"} — a valid module must still pass`,
        );
        failures++;
      }
    } finally {
      copyFileSync(backupPath, wasmPath);
      unlinkSync(backupPath);
    }
  }
}

// ── Fault 7: A script substrate that RAN and CRASHED is a FAILURE, not absent tooling ──
// Phase 5 above proves a missing interpreter is classified TOOLING. This proves the
// converse, which was broken: the classifier matched the literal string "Command failed",
// which `execSync` prefixes onto EVERY non-zero exit, so a substrate that launched, ran and
// crashed was reported "toolchain absent — NOT a divergence" and the run exited 0 claiming
// AGREED. Every script substrate (JS, Lua, Go) could fail in complete silence.
console.log("\nPhase 7: script substrate runs and crashes (must be FAIL, not TOOLING)");
{
  const ciPath = join(__dir, "run-bytelock-ci.mjs");
  const ciSrc = readFileSync(ciPath, "utf8");
  const backupPath = join(__dir, "run-bytelock-ci.mjs.bak");
  const crasherPath = join(__dir, "fault-crasher.mjs");
  copyFileSync(ciPath, backupPath);

  const anchor = '  { name: "Go",          cmd: "node",    args: ["run-go-wasm.mjs"],         type: "script" },';
  const patched = ciSrc.replace(
    anchor,
    anchor +
      '\n  { name: "CrashSubstrate", cmd: "node", args: ["fault-crasher.mjs"], type: "script" },',
  );

  if (patched === ciSrc) {
    fail("script crash", "could not inject fault — anchor line not found");
    failures++;
  } else {
    // The interpreter (node) plainly EXISTS — it is running this file. Only the substrate
    // is broken, which is exactly the case the old classifier could not distinguish.
    writeFileSync(crasherPath, 'process.stderr.write("deliberate substrate crash\\n");\nprocess.exit(7);\n');
    writeFileSync(ciPath, patched);
    try {
      const { exit, report } = run();
      const crashSub = report?.substrates?.find((s) => s.name === "CrashSubstrate");
      if (crashSub?.status === "FAIL" && exit === 0) {
        pass("crashing substrate classified as FAIL (not TOOLING) — status=FAIL");
      } else {
        fail(
          "script crash",
          `exit=${exit}, CrashSubstrate.status=${crashSub?.status ?? "?"} — expected FAIL; TOOLING would mean a real failure is invisible`,
        );
        failures++;
      }
    } finally {
      copyFileSync(backupPath, ciPath);
      unlinkSync(backupPath);
      if (existsSync(crasherPath)) unlinkSync(crasherPath);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("");
if (failures === 0) {
  console.log("All 7 fault-injection negative controls PASS.");
  console.log("The byte-lock correctly detects all injected faults.");
  process.exit(0);
} else {
  console.log(`${failures} fault(s) were NOT detected — the byte-lock has blind spots.`);
  process.exit(1);
}
