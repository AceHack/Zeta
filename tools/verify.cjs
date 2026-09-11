#!/usr/bin/env node
/**
 * verify.cjs — run this project's own verification, whatever it is, in the change's checkout.
 *
 * ── WHY THIS IS ONE SCRIPT AND NOT ONE PER ECOSYSTEM ─────────────────────────
 * `--test-cmd` hands its command a trailing test-case id and runs it in the change's worktree. Most
 * real verification commands (`mvn test`, `npm test`, `pytest`) reject an unknown trailing argument,
 * so each needs a shim. Writing one shim per ecosystem would put "how a Java project is tested" into
 * this repository, which is the organization deciding something that belongs to the project.
 *
 * So the command is CONFIGURATION: `VERIFY_CMD` and `VERIFY_ARGS`. An operator says how their
 * project verifies itself; this runs it where the change is and reports the exit code.
 *
 * ── THE EXIT CODE IS THE VERDICT ─────────────────────────────────────────────
 * Nothing here reads the output. A run that prints failures and exits 0 has passed, and a run that
 * prints nothing and exits 1 has not. Interpreting the text would make this script the judge, and it
 * is not qualified to be — the project's own test runner already decided.
 *
 * ── AND A MISSING COMMAND IS A REFUSAL, NEVER A PASS ─────────────────────────
 * Unconfigured means unverified. Exiting 0 because nothing was configured is the vacuity class at
 * the one gate where it costs the most: it would mark work validated that nothing looked at.
 */
"use strict";
const { spawnSync } = require("node:child_process");

const cmd = process.env.VERIFY_CMD;
// NEWLINE-SEPARATED, so an argument may itself contain spaces. Splitting on spaces would break
// a path with one, and this platform is full of them.
const args = (process.env.VERIFY_ARGS || "")
  .split(String.fromCharCode(10))
  .map((a) => a.trim())
  .filter((a) => a !== "");
const cwd = process.env.VERIFY_CWD || process.cwd();
const timeoutMs = Number(process.env.VERIFY_TIMEOUT_MS || "900000");
const trace = process.env.VERIFY_LOG;

function record(line) {
  if (!trace) return;
  try {
    require("node:fs").appendFileSync(trace, line + "\n");
  } catch {
    /* a trace that cannot be written is not a reason to fail the verification */
  }
}

// ── SEVERAL COMMANDS, WHEN THE PROJECT VERIFIES WITH SEVERAL ───────────────────
// `VERIFY_STEPS` is a JSON array of steps run in order; the FIRST that fails decides. A monorepo
// verifies its server and its client separately, and chaining them through a shell would put a shell
// back on a path that deliberately has none. A step is either an argv array, or
//   { "argv": [...], "cwd": "server", "env": { "NODE_OPTIONS": "..." }, "report": "jest" | "vitest" }
// where `cwd` is relative to the change's checkout.
//
// ── A RED TRUNK DOES NOT MAKE EVERY CHANGE RED ───────────────────────────────
// MEASURED on the Agentic Team's repositories: on this machine trunk itself fails 3, 22 and 6+
// tests. A verifier that demands all-green rejects every change for failures that are not the
// change's — and hand-excluding files hides any new failure inside them. So a step with a `report`
// format emits its runner's JSON, and when `VERIFY_BASELINE_CWD` names the trunk checkout the same
// step is run there once (cached per trunk commit in `VERIFY_BASELINE_CACHE`). The verdict is the SET
// DIFFERENCE over test identities — file and full test name — so a new failure inside an
// already-red file still fails the change. Every tolerated pre-existing failure is PRINTED, on every
// verdict: tolerance that nobody can see is how a red trunk becomes normal.
if (process.env.VERIFY_STEPS) {
  const fs = require("node:fs");
  const path = require("node:path");
  const os = require("node:os");
  let steps;
  try {
    steps = JSON.parse(process.env.VERIFY_STEPS);
  } catch {
    process.stderr.write("[verify] VERIFY_STEPS is not JSON\n");
    process.exit(1);
  }
  const norm = (st) => (Array.isArray(st) ? { argv: st } : st);
  if (!Array.isArray(steps) || steps.length === 0 || !steps.map(norm).every((s) => s && Array.isArray(s.argv) && s.argv.length > 0)) {
    process.stderr.write("[verify] VERIFY_STEPS must be a non-empty array of argv arrays or {argv, cwd, env, report} objects\n");
    process.exit(1);
  }
  const baselineCwd = process.env.VERIFY_BASELINE_CWD;
  const cacheDir = process.env.VERIFY_BASELINE_CACHE || path.join(os.tmpdir(), "verify-baseline");

  /** Run one step at `root`; return { ok, failing: Set<string> | undefined, secs }. */
  function runStep(step, root) {
    const at = step.cwd ? path.resolve(root, step.cwd) : root;
    let argv = step.argv.slice();
    let out;
    if (step.report === "jest" || step.report === "vitest") {
      out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "verify-")), "report.json");
      argv = step.report === "jest" ? [...argv, "--json", "--outputFile=" + out] : [...argv, "--reporter=default", "--reporter=json", "--outputFile.json=" + out];
    }
    const began = Date.now();
    const r = spawnSync(argv[0], argv.slice(1), {
      cwd: at,
      env: { ...process.env, ...(step.env || {}) },
      encoding: "utf-8",
      shell: false,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    const secs = Math.round((Date.now() - began) / 1000);
    process.stdout.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    record("ran cwd=" + at + " cmd=" + argv.join(" ") + " -> " + (r.error ? "ERROR " + r.error.message : "exit " + String(r.status)) + " in " + String(secs) + "s");
    if (r.error !== undefined) return { ok: false, failing: undefined, secs, error: r.error.message };
    let failing;
    if (out && fs.existsSync(out)) {
      try {
        const rep = JSON.parse(fs.readFileSync(out, "utf-8"));
        failing = new Set();
        for (const file of rep.testResults || []) {
          const rel = path.relative(at, file.name || file.testFilePath || "").split(path.sep).join("/");
          const asserts = file.assertionResults || file.testResults || [];
          const bad = asserts.filter((t) => t.status === "failed");
          if (bad.length === 0 && file.status === "failed") failing.add(rel + " :: (the file itself failed to run)");
          for (const t of bad) failing.add(rel + " :: " + (t.fullName || t.title || "?"));
        }
      } catch {
        failing = undefined;
      }
    }
    return { ok: r.status === 0, failing, secs };
  }

  function baselineFor(index, step) {
    if (!baselineCwd) return undefined;
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: baselineCwd, encoding: "utf-8" });
    const sha = String(head.stdout || "").trim();
    if (!sha) return undefined;
    fs.mkdirSync(cacheDir, { recursive: true });
    const key = path.join(cacheDir, sha + "-" + String(index) + "-" + Buffer.from(JSON.stringify(step)).toString("base64url").slice(0, 40) + ".json");
    // READ, THEN INTERPRET (js/file-system-race, CWE-367). `existsSync` then
    // `readFileSync` leaves a window, and in a world-writable temp dir that
    // window is the whole attack. A cache miss and an unreadable entry want the
    // same handling anyway — measure the baseline — so one try/catch covers
    // both and needs no prior question.
    try {
      return new Set(JSON.parse(fs.readFileSync(key, "utf-8")));
    } catch {
      // absent, unreadable, or corrupt: all mean "no usable cache entry"
    }
    process.stderr.write("[verify] measuring the trunk baseline for step " + String(index + 1) + " at " + sha.slice(0, 9) + "\n");
    const b = runStep(step, baselineCwd);
    if (b.failing === undefined) return undefined;
    // 0o600: this lands in `os.tmpdir()` by default (line 79), which is
    // world-writable, and a cache another user can rewrite is a cache that can
    // hand this tool a fabricated baseline — `js/insecure-temporary-file`
    // (CWE-377). Owner-only is also simply what a private cache should be.
    fs.writeFileSync(key, JSON.stringify([...b.failing]), { mode: 0o600 });
    return b.failing;
  }

  const stepsN = steps.map(norm);
  for (let i = 0; i < stepsN.length; i++) {
    const step = stepsN[i];
    const r = runStep(step, cwd);
    if (r.ok) continue;
    if (r.error) {
      process.stderr.write("[verify] step " + String(i + 1) + " could not run: " + r.error + "\n");
      process.exit(1);
    }
    if (r.failing === undefined || !step.report) {
      process.stderr.write("[verify] step failed: " + step.argv.join(" ") + "\n");
      process.exit(1);
    }
    const base = baselineFor(i, step);
    if (base === undefined) {
      process.stderr.write("[verify] step " + String(i + 1) + " failed " + String(r.failing.size) + " test(s) and no trunk baseline is configured (VERIFY_BASELINE_CWD) to tell which are the change's\n");
      process.exit(1);
    }
    let added = [...r.failing].filter((t) => !base.has(t));
    const tolerated = [...r.failing].filter((t) => base.has(t));
    // ── ONE SAMPLE IS NOT AN ATTRIBUTION ──────────────────────────────────────
    // MEASURED on AIAGENT-1658: a client-only change was refused four times for "new" failures in a
    // server script test it never touched - a different test each time, on a machine running three
    // organizations at once. One run of the change against one cached run of trunk blames the change
    // for every intermittent test. So a NEW failure is measured again before it is believed: the
    // failing files are re-run on the change AND on trunk, now, under the same load.
    //   fails again on the change, passes on trunk  -> the change's (refused)
    //   fails on trunk too                          -> pre-existing (tolerated, printed)
    //   passes when the change is re-run            -> did not reproduce (tolerated, printed as FLAKY)
    // Anything the re-run cannot measure stays the change's: an unmeasured retry never acquits.
    // MEASURED again on AIAGENT-1658: ONE re-run per side was not enough either. portalEntrypointScript
    // flips on BOTH trunk and the change under load, so each attempt one of its tests happened to fail
    // on the change's re-run and pass on trunk's - by chance - and a client-only change was refused for
    // a server script test. So the re-run is repeated (VERIFY_RERUNS, default 3), and a failure is the
    // change's only if it fails on EVERY re-run of the change and on NO re-run of trunk. A test that is
    // merely intermittent passes one of those by chance with probability 1 - (fail rate)^N x (pass rate)^N.
    if (added.length > 0) {
      const esc = (f) => (step.report === "jest" ? f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : f);
      const files = [...new Set(added.map((t) => t.split(" :: ")[0]))].map(esc);
      const narrowed = { ...step, argv: [...step.argv, ...files] };
      const reruns = Math.max(1, Number.parseInt(process.env.VERIFY_RERUNS || "3", 10) || 3);
      process.stderr.write("[verify] re-running " + String(added.length) + " new failure(s) on the change and on trunk (up to " + String(reruns) + "x) before attributing them\n");
      let reproducedSet = new Set(added);
      const trunkToo = new Set();
      for (let k = 0; k < reruns; k++) {
        // Stop as soon as nothing is left that could still be the change's.
        if ([...reproducedSet].every((t) => trunkToo.has(t))) break;
        const again = runStep(narrowed, cwd);
        // An unmeasurable re-run acquits nothing: it keeps every candidate.
        if (again.failing !== undefined) reproducedSet = new Set([...reproducedSet].filter((t) => again.failing.has(t)));
        if ([...reproducedSet].every((t) => trunkToo.has(t))) break;
        const onTrunk = runStep(narrowed, baselineCwd);
        if (onTrunk.failing !== undefined) for (const t of added) if (onTrunk.failing.has(t)) trunkToo.add(t);
      }
      const reproduced = added.filter((t) => reproducedSet.has(t));
      for (const t of trunkToo) {
        process.stderr.write("[verify] FAILS ON TRUNK TOO when re-run (pre-existing, intermittent there): " + t + "\n");
        record("  fails on trunk too: " + t);
      }
      for (const t of added.filter((x) => !reproduced.includes(x) && !trunkToo.has(x))) {
        process.stderr.write("[verify] DID NOT REPRODUCE when re-run (FLAKY - not attributed to this change): " + t + "\n");
        record("  flaky, did not reproduce: " + t);
      }
      added = reproduced.filter((t) => !trunkToo.has(t));
    }
    for (const t of tolerated) process.stderr.write("[verify] PRE-EXISTING on trunk (tolerated): " + t + "\n");
    if (added.length > 0 || r.failing.size === 0) {
      for (const t of added) process.stderr.write("[verify] NEW FAILURE introduced by this change: " + t + "\n");
      if (r.failing.size === 0) process.stderr.write("[verify] the step failed but reported no failing test — refused, not tolerated\n");
      record("step " + String(i + 1) + " NEW failures: " + String(added.length) + ", tolerated: " + String(tolerated.length));
      // WHICH ONES, not only how many: a count in a log is a number nobody can act on.
      for (const t of added.slice(0, 30)) record("  new failure: " + t);
      if (added.length > 30) record("  ... and " + String(added.length - 30) + " more");
      process.exit(1);
    }
    record("step " + String(i + 1) + " failed only on trunk-red tests (" + String(tolerated.length) + " tolerated, 0 new)");
  }
  process.stderr.write("[verify] " + String(stepsN.length) + " step(s) passed (relative to trunk where a baseline applied)\n");
  process.exit(0);
}

if (!cmd) {
  process.stderr.write("[verify] VERIFY_CMD is not set: nothing was configured to verify this\n");
  record("REFUSED cwd=" + cwd + " reason=no VERIFY_CMD");
  process.exit(1);
}

const started = Date.now();
const run = spawnSync(cmd, args, {
  cwd,
  encoding: "utf-8",
  shell: false,
  timeout: timeoutMs,
  maxBuffer: 64 * 1024 * 1024,
});
const took = Date.now() - started;

process.stdout.write(run.stdout || "");
process.stderr.write(run.stderr || "");

if (run.error !== undefined) {
  process.stderr.write("[verify] " + cmd + " could not run: " + run.error.message + "\n");
  record("ERROR cwd=" + cwd + " cmd=" + cmd + " " + run.error.message);
  process.exit(1);
}

record(
  "ran cwd=" + cwd + " cmd=" + cmd + " " + args.join(" ") + " -> exit " + String(run.status) +
    " in " + String(Math.round(took / 1000)) + "s",
);
process.stderr.write("[verify] " + cmd + " exited " + String(run.status) + " in " + String(Math.round(took / 1000)) + "s\n");
process.exit(run.status === 0 ? 0 : 1);
