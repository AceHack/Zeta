/**
 * Falsifier for the `codeql (required)` sentinel in `.github/workflows/codeql.yml`.
 *
 * That job is the check we intend to make REQUIRED, which means its failure mode
 * is the expensive one: if it can pass while a diff went unanalysed, it is a
 * check that cannot fail, and requiring it buys nothing while looking like it
 * bought everything.
 *
 * The script is EXTRACTED FROM THE WORKFLOW and executed, never transcribed
 * here. A copy of shipped logic in a test is a second source of truth that
 * drifts silently, and the drift always favours the test passing.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { spawnShellDeclared } from "../io/safe-io.ts";

const REPO = join(import.meta.dir, "..", "..", "..");

function decisionScript(): string {
  const wf = parse(readFileSync(join(REPO, ".github", "workflows", "codeql.yml"), "utf8")) as {
    jobs: Record<string, { steps?: { run?: string }[] }>;
  };
  const job = wf.jobs["codeql-gate"];
  if (job === undefined) throw new Error("codeql-gate job is gone from codeql.yml");
  const run = job.steps?.[0]?.run;
  if (run === undefined) throw new Error("codeql-gate's first step has no `run:` block");
  return run;
}

/**
 * Runs the real script under bash with one env combination; returns its exit code.
 *
 * `spawnShellDeclared` rather than a hand-rolled `spawnSync("bash", ["-c", ...])`:
 * this is the case its escape hatch exists for -- the shell command line IS the
 * artifact under test, not data being passed to one. Nothing here is attacker
 * input; the script comes from a file in this repo. Using the declared primitive
 * keeps the site enumerable, which is the whole point of the lint that caught the
 * first draft of this file.
 */
function decide(
  script: string,
  env: { pathGate: string; analyze: string; codeChanged: string },
): number {
  const r = spawnShellDeclared("bash", script, {
    reason:
      "The subject under test IS a shell script -- the `run:` block of codeql.yml's " +
      "sentinel job, executed verbatim so the test cannot drift from what ships.",
    env: {
      ...process.env,
      PATH_GATE_RESULT: env.pathGate,
      ANALYZE_RESULT: env.analyze,
      CODE_CHANGED: env.codeChanged,
    },
  });
  if (!r.ok) throw new Error(`spawn refused: ${r.error.kind}: ${r.error.message}`);
  const { status } = r.value;
  if (status === null) throw new Error("script did not exit (killed by timeout or signal)");
  return status;
}

const PASS = 0;

describe("codeql (required) — the sentinel admits only analysed diffs", () => {
  const script = decisionScript();

  test("code changed and the matrix succeeded — the only passing analysed case", () => {
    expect(decide(script, { pathGate: "success", analyze: "success", codeChanged: "true" })).toBe(PASS);
  });

  test("no code changed and analyze skipped — a skip is the CORRECT outcome, not a missing one", () => {
    expect(decide(script, { pathGate: "success", analyze: "skipped", codeChanged: "false" })).toBe(PASS);
  });

  // The cases that matter. Each one is a way a diff reaches `main` unanalysed
  // while a required check shows green.
  for (const analyze of ["skipped", "cancelled", "failure"]) {
    test(`code changed but analyze '${analyze}' — that diff was NOT analysed`, () => {
      expect(decide(script, { pathGate: "success", analyze, codeChanged: "true" })).not.toBe(PASS);
    });
  }

  test("path-gate itself failed — a broken decider tells us nothing, and nothing is not permission", () => {
    expect(decide(script, { pathGate: "failure", analyze: "skipped", codeChanged: "" })).not.toBe(PASS);
  });

  test("path-gate cancelled — a cancelled check is one that never ran", () => {
    expect(decide(script, { pathGate: "cancelled", analyze: "skipped", codeChanged: "true" })).not.toBe(PASS);
  });

  // THE vacuity case. An absent output arrives as the empty string, which is not
  // 'true' -- so any guard written as `!= 'true'` reads a MISSING answer as "no
  // code changed" and waves the PR through. This is the assertion the whole file
  // exists for, and the mutation test below proves it is load-bearing.
  test("code_changed EMPTY — a missing answer must not read as 'no code changed'", () => {
    expect(decide(script, { pathGate: "success", analyze: "skipped", codeChanged: "" })).not.toBe(PASS);
  });

  test("code_changed unrecognised — unknown fails closed", () => {
    expect(decide(script, { pathGate: "success", analyze: "skipped", codeChanged: "maybe" })).not.toBe(PASS);
  });

  test("the two jobs disagreeing about the diff is itself a failure", () => {
    // path-gate says no code, yet the matrix ran anyway.
    expect(decide(script, { pathGate: "success", analyze: "success", codeChanged: "false" })).not.toBe(PASS);
  });
});

describe("mutation — which guard is actually load-bearing, measured not asserted", () => {
  // This block began as a claim that the `case/esac` guard is what stops an
  // empty `code_changed` from passing. Running it showed that is FALSE: the
  // mutant with `case/esac` deleted still exits 1, because branch (3) tests
  // `= "false"` positively rather than `!= "true"` negatively, so an empty
  // value falls through to branch (4) and fails there. The claim was corrected
  // rather than the test deleted -- what follows is what the mutations actually
  // show, which is a more useful thing than what I first assumed.

  const original = decisionScript();
  const dropCase = (t: string) => t.replace(/case "\$\{CODE_CHANGED\}" in[\s\S]*?esac\n/, "");
  const naiveBranch3 = (t: string) =>
    t.replace('if [ "${CODE_CHANGED}" = "false" ]; then', 'if [ "${CODE_CHANGED}" != "true" ]; then');

  test("branch (3) alone already rejects an empty answer — `= false` beats `!= true`", () => {
    const m = dropCase(original);
    expect(m).not.toBe(original);
    expect(decide(m, { pathGate: "success", analyze: "skipped", codeChanged: "" })).not.toBe(PASS);
  });

  test("the naive `!= true` rewrite alone is still safe — because case/esac catches it first", () => {
    const m = naiveBranch3(original);
    expect(m).not.toBe(original);
    expect(decide(m, { pathGate: "success", analyze: "skipped", codeChanged: "" })).not.toBe(PASS);
  });

  // The real finding: neither guard is load-bearing ALONE, and removing either
  // one leaves a script that still behaves. It takes removing BOTH to open the
  // hole -- which is what defence-in-depth means when it is real rather than
  // claimed, and it is why neither guard should be tidied away as redundant by
  // someone who checks only that the tests still pass after deleting one.
  test("remove BOTH and an empty answer passes as 'no code changed' — the hole is real", () => {
    const m = naiveBranch3(dropCase(original));
    expect(decide(m, { pathGate: "success", analyze: "skipped", codeChanged: "" })).toBe(PASS);
    expect(decide(original, { pathGate: "success", analyze: "skipped", codeChanged: "" })).not.toBe(PASS);
  });
});
