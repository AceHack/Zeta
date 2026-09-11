/**
 * verify-baseline.test.ts — a red trunk does not make every change red, and does not hide a new failure.
 *
 * Driven with a stand-in test runner that writes a jest-shaped JSON report naming whichever tests the
 * directory it runs in says are failing. The trunk checkout and the change's checkout disagree only in
 * that file, which is exactly the comparison `tools/verify.cjs` makes.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const VERIFY = resolve(import.meta.dir, "..", "..", "..", "tools", "verify.cjs");

/**
 * A stand-in runner: reads `failing.json` in its cwd, writes a jest report, exits 1 if anything fails.
 * `failing.json` is either one list of failures, or `{ "runs": [list, list, ...] }` - a different list
 * per invocation in that directory, which is what an intermittent test looks like. File arguments
 * narrow the report to those files, as jest's positional path patterns do.
 */
const RUNNER = `
const fs = require("fs"), path = require("path");
const out = process.argv.find((a) => a.startsWith("--outputFile=")).slice("--outputFile=".length);
const only = process.argv.slice(3).filter((a) => !a.startsWith("--")).map((a) => a.replace(/\\\\/g, ""));
const spec = JSON.parse(fs.readFileSync("failing.json", "utf-8"));
let failing = spec;
if (!Array.isArray(spec)) {
  let n = 0;
  try { n = Number(fs.readFileSync("count.txt", "utf-8")); } catch {}
  fs.writeFileSync("count.txt", String(n + 1));
  failing = spec.runs[Math.min(n, spec.runs.length - 1)];
}
if (only.length > 0) failing = failing.filter(([f]) => only.includes(f));
const byFile = {};
for (const [file, name] of failing) (byFile[file] = byFile[file] || []).push(name);
fs.writeFileSync(out, JSON.stringify({ testResults: Object.entries(byFile).map(([f, names]) => ({
  name: path.join(process.cwd(), f), status: "failed",
  assertionResults: names.map((n) => ({ fullName: n, status: "failed" })),
})) }));
process.exit(failing.length === 0 ? 0 : 1);
`;

type Failing = [string, string][] | { runs: [string, string][][] };

function setup(trunkFailing: Failing, changeFailing: Failing) {
  const root = mkdtempSync(join(tmpdir(), "verify-base-"));
  const trunk = join(root, "trunk");
  const change = join(root, "change");
  for (const [dir, failing] of [[trunk, trunkFailing], [change, changeFailing]] as const) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "failing.json"), JSON.stringify(failing));
  }
  const runner = join(root, "runner.cjs");
  writeFileSync(runner, RUNNER);
  // The baseline cache is keyed by trunk commit, so the trunk must be a repository.
  spawnSync("git", ["init", "-q"], { cwd: trunk });
  spawnSync("git", ["-c", "user.email=t@e.invalid", "-c", "user.name=T", "commit", "-q", "--allow-empty", "-m", "t"], { cwd: trunk });
  const r = spawnSync("node", [VERIFY, "trailing-id"], {
    cwd: change,
    encoding: "utf-8",
    env: {
      ...process.env,
      VERIFY_STEPS: JSON.stringify([{ argv: ["node", runner], report: "jest" }]),
      VERIFY_BASELINE_CWD: trunk,
      VERIFY_BASELINE_CACHE: join(root, "cache"),
    },
  });
  return { ...r, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("VERIFICATION IS RELATIVE TO TRUNK, and says so", () => {
  test("only trunk's own failures: PASSES, and every tolerated one is printed", () => {
    const r = setup([["a.test.ts", "x"]], [["a.test.ts", "x"]]);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("PRE-EXISTING on trunk (tolerated): a.test.ts :: x");
    r.cleanup();
  });

  test("a NEW failure fails the change, and is named", () => {
    const r = setup([["a.test.ts", "x"]], [["a.test.ts", "x"], ["b.test.ts", "y"]]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("NEW FAILURE introduced by this change: b.test.ts :: y");
    r.cleanup();
  });

  test("a new failure INSIDE an already-red file is still new — identities, not files", () => {
    const r = setup([["a.test.ts", "x"]], [["a.test.ts", "x"], ["a.test.ts", "z"]]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("NEW FAILURE introduced by this change: a.test.ts :: z");
    r.cleanup();
  });

  test("a clean change on a red trunk passes without consulting anything", () => {
    const r = setup([["a.test.ts", "x"]], []);
    expect(r.status).toBe(0);
    r.cleanup();
  });
});

describe("ONE SAMPLE IS NOT AN ATTRIBUTION: a new failure is measured again before it is believed", () => {
  test("MEASURED on AIAGENT-1658: a failure that does not reproduce when the change is re-run PASSES, printed as flaky", () => {
    // The change's first run fails an untouched server test; the re-run of that file passes.
    const r = setup([], { runs: [[["server/entrypoint.test.ts", "pins the heap"]], []] });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("DID NOT REPRODUCE when re-run (FLAKY - not attributed to this change): server/entrypoint.test.ts :: pins the heap");
    r.cleanup();
  });

  test("a failure that happens on trunk too when re-run is pre-existing, and PASSES", () => {
    // Trunk's cached baseline was a green sample; re-run now, trunk fails it as well.
    const r = setup({ runs: [[], [["ws.test.ts", "auth"]]] }, [["ws.test.ts", "auth"]]);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("FAILS ON TRUNK TOO when re-run (pre-existing, intermittent there): ws.test.ts :: auth");
    r.cleanup();
  });

  test("a failure that reproduces on the change and not on trunk is the change's - refused, and named", () => {
    const r = setup([], [["b.test.ts", "y"]]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("re-running 1 new failure(s)");
    expect(r.stderr).toContain("NEW FAILURE introduced by this change: b.test.ts :: y");
    r.cleanup();
  });

  test("only the flaky one is excused: a real new failure beside it still refuses the change", () => {
    const r = setup([], { runs: [[["a.test.ts", "flaky"], ["b.test.ts", "real"]], [["b.test.ts", "real"]]] });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FLAKY - not attributed to this change): a.test.ts :: flaky");
    expect(r.stderr).toContain("NEW FAILURE introduced by this change: b.test.ts :: real");
    expect(r.stderr).not.toContain("NEW FAILURE introduced by this change: a.test.ts");
    r.cleanup();
  });
});
