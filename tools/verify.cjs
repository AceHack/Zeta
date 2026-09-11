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
// `VERIFY_STEPS` is a JSON array of argv arrays, run in order in `cwd`; the FIRST that fails decides.
// A monorepo verifies its server and its client separately, and chaining them through a shell would
// put a shell back on a path that deliberately has none.
if (process.env.VERIFY_STEPS) {
  let steps;
  try {
    steps = JSON.parse(process.env.VERIFY_STEPS);
  } catch {
    process.stderr.write("[verify] VERIFY_STEPS is not JSON\n");
    process.exit(1);
  }
  if (!Array.isArray(steps) || steps.length === 0 || !steps.every((s) => Array.isArray(s) && s.length > 0)) {
    process.stderr.write("[verify] VERIFY_STEPS must be a non-empty array of non-empty argv arrays\n");
    process.exit(1);
  }
  for (const [stepCmd, ...stepArgs] of steps) {
    const began = Date.now();
    const r = spawnSync(stepCmd, stepArgs, { cwd, encoding: "utf-8", shell: false, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    const secs = Math.round((Date.now() - began) / 1000);
    record("ran cwd=" + cwd + " cmd=" + stepCmd + " " + stepArgs.join(" ") + " -> " + (r.error ? "ERROR " + r.error.message : "exit " + String(r.status)) + " in " + String(secs) + "s");
    if (r.error !== undefined || r.status !== 0) {
      process.stderr.write("[verify] step failed: " + stepCmd + " " + stepArgs.join(" ") + "\n");
      process.exit(1);
    }
  }
  process.stderr.write("[verify] " + String(steps.length) + " step(s) passed\n");
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
