#!/usr/bin/env node
/**
 * app-verify.cjs — the INDEPENDENT verdict on whether the work actually worked.
 *
 * Deliberately a DIFFERENT command from the worker. `agentWorkExecutor` splits proposing from
 * judging precisely so the thing under test is never the thing that grades it, and pointing both
 * flags at one script would quietly undo that.
 *
 * It ignores whatever trailing id it is handed and asks the only question that matters: does the
 * tree in this checkout pass its own tests? THE EXIT CODE IS THE VERDICT — a run that prints
 * failures and exits 0 has passed, so nothing here interprets the output.
 */
"use strict";
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const cwd = process.cwd();
const suite = join(cwd, "test", "app.test.js");

// A trace of every invocation, because the run's own summary reports a verdict and not the tree the
// verdict was reached in — and "the tests failed" and "the tests ran somewhere the code is not" look
// identical from the outside.
const trace = process.env.VERIFY_LOG;
const record = (line) => { if (trace) { try { require("node:fs").appendFileSync(trace, line + "\n"); } catch {} } };
const headOf = (d) => {
  const r = spawnSync("git", ["log", "--oneline", "-1"], { cwd: d, encoding: "utf-8", shell: false });
  return (r.stdout || "").trim() || "?";
};
record("invoked cwd=" + cwd + " suiteExists=" + String(existsSync(suite)) + " head=" + headOf(cwd) + " argv=" + JSON.stringify(process.argv.slice(2)));

if (!existsSync(suite)) {
  // NO TESTS IS NOT A PASS. An empty tree trivially fails nothing, and treating that as success is
  // how work that was never done gets a green gate — the vacuity class, at the one place where it
  // would be most expensive.
  process.stderr.write("[verify] no test/app.test.js in " + cwd + ": nothing here proves anything\n");
  process.exit(1);
}

const run = spawnSync(process.execPath, ["--test", "test/app.test.js"], {
  cwd,
  encoding: "utf-8",
  shell: false,
  timeout: 120_000,
});
process.stdout.write(run.stdout || "");
process.stderr.write(run.stderr || "");
process.stderr.write("[verify] node --test exited " + String(run.status) + " in " + cwd + "\n");
record("  -> node --test exited " + String(run.status));
process.exit(run.status === 0 ? 0 : 1);
