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
 *
 * FAULTS 1-3 ARE INJECTED INTO THE SUBSTRATE, NOT THE REFERENCE (changed 2026-08-16).
 * They used to patch `toGoldenVector` in reference.mjs, i.e. they moved the EXPECTATION and
 * called the resulting mismatch a substrate divergence. That was a proxy, and once the runner
 * gained its golden-vector pin (fault 8) the proxy became wrong as well as loose: perturbing
 * the reference now trips the pin and exits 4 before a single substrate runs, so all three
 * would have been testing the pin and NOTHING would have been testing divergence detection.
 * They now corrupt the value a substrate RETURNS, which is the thing they always claimed to
 * be about, and each asserts the blast radius — exactly one substrate FAILs, by name.
 * 4. Liveness floor           — set BYTELOCK_MIN_SUBSTRATES=99 (nothing runs)
 * 5. Toolchain absent         — substrate command that does not exist
 * 6. Malformed artefact       — an `ar` archive planted where a .wasm is expected
 * 7. Script substrate crash   — a substrate that RAN and failed (must not read as absent)
 * 8. Reference drift          — reference.mjs no longer reproduces a COMMITTED golden vector
 *
 * Each fault must cause the runner to report DIVERGED, LIVENESS FAILURE, MALFORMED or
 * REFERENCE DRIFT — and faults 5, 6, 7 and 8 must be told APART from each other, because the
 * whole point is that "never ran", "cannot load", "ran and was wrong" and "the measuring stick
 * moved" are four different findings. A fault that goes undetected is a test failure.
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

// stderr is CAPTURED, not inherited. The runner's hard failures (exit 3 malformed, exit 4
// reference drift) exit before any JSON report is written, so the exit code is all a caller
// would otherwise have — and an exit code alone cannot tell "the check fired for the reason I
// injected" from "the process died for some other reason". Reading the message closes that.
function run(env = {}) {
  try {
    const out = execSync("node run-bytelock-ci.mjs --json --seeds=42", {
      cwd: __dir,
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exit: 0, report: JSON.parse(out), stderr: "" };
  } catch (e) {
    let report = null;
    try { report = JSON.parse(e.stdout || "null"); } catch {}
    return { exit: e.status ?? 1, report, stderr: String(e.stderr ?? "") };
  }
}

function pass(label) {
  console.log(`  PASS  ${label}`);
}
function fail(label, detail) {
  console.log(`  FAIL  ${label}  — ${detail}`);
}

// Corrupt what ONE substrate returns, immediately after it is read out of the WASM instance and
// before it reaches `verify`. This is the substrate-side injection point for faults 1-3: the
// module is real, it loaded, it ran, and its answer is wrong — which is the only shape a byte
// divergence actually has. `victim` is named so each phase can assert the blast radius rather
// than settling for "something failed".
const RUNNER_ANCHOR = "        candidate = await runWasmSubstrate(join(__dir, sub.file), seed);";

function withCorruptedSubstrate(label, victim, mutation, assertResult) {
  const ciPath = join(__dir, "run-bytelock-ci.mjs");
  const ciSrc = readFileSync(ciPath, "utf8");
  const backupPath = join(__dir, "run-bytelock-ci.mjs.bak");
  copyFileSync(ciPath, backupPath);

  const patched = ciSrc.replace(
    RUNNER_ANCHOR,
    `${RUNNER_ANCHOR}\n        if (sub.name === ${JSON.stringify(victim)}) { ${mutation} }`,
  );

  // A `.replace()` that silently no-ops is how a mutation test becomes vacuous: the run goes
  // green because nothing was injected, and the suite reports the fault as "detected".
  if (patched === ciSrc) {
    fail(label, `could not inject fault — anchor line not found in run-bytelock-ci.mjs`);
    unlinkSync(backupPath);
    return 1;
  }

  writeFileSync(ciPath, patched);
  try {
    return assertResult(run({ BYTELOCK_STRICT: "1" }));
  } finally {
    copyFileSync(backupPath, ciPath);
    unlinkSync(backupPath);
  }
}

/** Shared assertion for faults 1-3: exit 1, exactly one FAIL, and it is the named victim. */
function expectSoleDivergence(label, victim) {
  return ({ exit, report }) => {
    const sub = report?.substrates?.find((s) => s.name === victim);
    if (exit === 1 && report?.summary?.fail === 1 && sub?.status === "FAIL") {
      pass(`${label} detected — exit=1, exactly 1 FAIL, and it is ${victim}`);
      return 0;
    }
    fail(
      label,
      `exit=${exit}, fail=${report?.summary?.fail ?? "?"}, ${victim}.status=${sub?.status ?? "?"} ` +
        `— expected exit=1 with exactly one FAIL on ${victim}`,
    );
    return 1;
  };
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
console.log("\nPhase 1: trajectory corruption (flip one entry in what the WAT substrate returns)");
failures += withCorruptedSubstrate(
  "trajectory corruption",
  "WAT",
  `candidate.trajectory[0] = candidate.trajectory[0] === "0xffffffff" ? "0xfffffffe" : "0xffffffff";`,
  expectSoleDivergence("trajectory corruption", "WAT"),
);

// ── Fault 2: Cluster-size corruption ─────────────────────────────────────────
console.log("\nPhase 2: cluster-size corruption (+1 in what the WAT substrate returns)");
failures += withCorruptedSubstrate(
  "cluster-size corruption",
  "WAT",
  `candidate.cluster_size += 1;`,
  expectSoleDivergence("cluster-size corruption", "WAT"),
);

// ── Fault 3: All-zeros trajectory (silent wrong output) ───────────────────────
// The nastiest shape: a substrate that loads, runs, exits cleanly and returns a uniform
// nothing. No error anywhere — only the comparison can catch it.
console.log("\nPhase 3: all-zeros trajectory (silent wrong output from the WAT substrate)");
failures += withCorruptedSubstrate(
  "all-zeros trajectory",
  "WAT",
  `candidate.trajectory = candidate.trajectory.map(() => "0x00000000");`,
  expectSoleDivergence("all-zeros trajectory", "WAT"),
);

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

// ── Fault 8: Reference drift — the MEASURING STICK moved ──────────────────────
// Faults 1-3 prove the runner catches a substrate that disagrees with the reference. This
// proves the other direction, which had no control at all and no detection: the reference
// itself drifting away from the COMMITTED golden vectors in testdata/.
//
// Until 2026-08-16 nothing read those four files. `grep -rn golden-seed src .github` found no
// consumer, so the runner recomputed its expectation from `reference.mjs` every run and graded
// itself. Edit the reference and rebuild the substrates and every one of them agrees with the
// new answer: "Byte-lock AGREED — 9 of 9", green, with the locked trajectory silently moved and
// the four hex-in-JSON vectors that would have shown it in a readable diff never opened. That
// is `.claude/rules/no-binary-in-proof-lineage.md` defeated by an unread text file rather than
// by a binary one.
//
// Both directions again — perturbed must exit 4, restored must exit 0 — because a guard only
// ever seen firing is not shown to permit the good case.
console.log("\nPhase 8: reference drift (reference.mjs vs the committed golden vectors, expect exit=4)");
{
  const refPath = join(__dir, "reference.mjs");
  const refSrc = readFileSync(refPath, "utf8");
  const backupPath = join(__dir, "reference.mjs.bak");
  copyFileSync(refPath, backupPath);

  // Move the reference's own answer for seed 42 by one trajectory entry. The substrates are
  // untouched, so this is unambiguously "the expectation changed", not "a compiler changed".
  const anchor = "export function toGoldenVector(seed, result) {";
  const patched = refSrc.replace(
    anchor,
    `${anchor}
  // FAULT INJECTION: drift the reference away from the committed golden vector for seed=42
  if (seed === 42 && result.trajectory && result.trajectory.length > 0) {
    result = { ...result, trajectory: result.trajectory.map((v, i) => (i === 0 ? (v >>> 0) ^ 1 : v)) };
  }`,
  );

  if (patched === refSrc) {
    fail("reference drift", "could not inject fault into reference.mjs — anchor not found");
    failures++;
  } else {
    writeFileSync(refPath, patched);
    try {
      // Direction 1: drifted reference must be its OWN failure class, and must stop the run
      // BEFORE any substrate is credited — nothing measured against a moved stick is earned.
      const bad = run();
      const named = /REFERENCE DRIFT/.test(bad.stderr);
      const creditedNothing = bad.report === null; // no report at all — it never got that far
      if (bad.exit === 4 && named && creditedNothing) {
        pass("reference drift detected — exit=4, named REFERENCE DRIFT, no substrate credited");
      } else {
        fail(
          "reference drift",
          `exit=${bad.exit}, named=${named}, report=${bad.report === null ? "none" : "emitted"} — ` +
            `expected exit=4 naming REFERENCE DRIFT before any substrate ran; anything else means ` +
            `a moved reference can be reported as agreement`,
        );
        failures++;
      }

      // Direction 2: restore — the pin must PERMIT a reference that matches its vectors.
      copyFileSync(backupPath, refPath);
      const good = run();
      if (good.exit === 0 && good.report?.golden_pin?.checked >= 1) {
        pass(
          `reference restored — exit=0, pin checked ${good.report.golden_pin.checked} committed ` +
            `vector(s) (the pin is not a blanket refusal, and it is not checking nothing)`,
        );
      } else {
        fail(
          "reference drift (restore)",
          `exit=${good.exit}, golden_pin.checked=${good.report?.golden_pin?.checked ?? "?"} — a ` +
            `matching reference must pass, and must pass having actually read a vector`,
        );
        failures++;
      }
    } finally {
      copyFileSync(backupPath, refPath);
      unlinkSync(backupPath);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("");
if (failures === 0) {
  console.log("All 8 fault-injection negative controls PASS.");
  console.log("The byte-lock correctly detects all injected faults.");
  process.exit(0);
} else {
  console.log(`${failures} fault(s) were NOT detected — the byte-lock has blind spots.`);
  process.exit(1);
}
