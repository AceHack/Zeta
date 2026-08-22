#!/usr/bin/env bun
/**
 * infra/k8s/tests/ratchet-app-failures.ts
 *
 * RATCHET for the full-ai-cluster/k8s GitOps tree.
 *
 * Usage:
 *   bun infra/k8s/tests/ratchet-app-failures.ts    # measure + compare (no options)
 *
 * Exit codes: 0 = count matches baseline exactly, 1 = it does not, 2 = the
 * measurement itself could not be trusted.
 *
 * WHY A RATCHET AND NOT A PLAIN STEP
 * ----------------------------------
 * `full-ai-cluster/k8s` has ~60 Applications and has never been rendered by CI;
 * `helm-validate.yml` filtered on `infra/k8s/**` only. Pointing the existing,
 * already-mutation-proved validator at it reports real failures on day one, so
 * the two obvious wirings both fail for the same reason:
 *
 *   - a plain step is PERMANENTLY RED, and a lane that is always red is one
 *     people learn to skim -- it stops carrying signal exactly when it starts
 *     to matter;
 *   - `continue-on-error: true` CAN NEVER FAIL. It would permit a regression
 *     from 23 failures to 200 without a murmur. That is a check that reports
 *     and constrains nothing.
 *
 * So: fail when the count is not EXACTLY the recorded baseline. Worse fails
 * (regression). BETTER ALSO FAILS (an improvement nobody recorded) -- and that
 * second direction is the load-bearing half, because a ceiling that only moves
 * up rots into a number nobody believes. Forcing the commit makes the baseline
 * file's git history the record of the tree getting better.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// NO MODE SWITCH, deliberately. The baseline is a single number, and the
// validator's failure count depends on whether the network checks ran: this
// tree measures 23 with rendering and 13 without, because 10 of the failures
// are chart-repo and helm-template failures an offline run never reaches. An
// offline flag here would let a green offline run be mistaken for the gate
// passing -- a check that did not run looking like one that did. One mode, one
// number. Run the validator directly if an offline pass is wanted.
if (process.argv.length !== 2) {
  console.error("usage: bun infra/k8s/tests/ratchet-app-failures.ts   (takes no options)");
  process.exit(2);
}
const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..", "..", "..");
const baselineFile = join(testsDir, "FULL-AI-CLUSTER-FAILURE-BASELINE.md");
const validator = join(testsDir, "validate-applications.ts");

const appsDir = join(repoRoot, "full-ai-cluster", "k8s", "applications");
const rootApp = join(repoRoot, "full-ai-cluster", "k8s", "bootstrap", "root-application.yaml");

function die(code: number, msg: string): never {
  console.error(msg);
  process.exit(code);
}

// ── The baseline ─────────────────────────────────────────────────────────────
//
// Parsed out of the Markdown so the number a human reads and the number CI
// enforces are the same characters in the same file. Exactly one line may
// match; two would make "the baseline" ambiguous, and an ambiguous gate is not
// a gate.

const BASELINE_LINE = /^[ \t]*BASELINE_FAILURES:[ \t]*(\d+)[ \t]*$/;

function readBaseline(): number {
  if (!existsSync(baselineFile)) die(2, "baseline file is missing: " + baselineFile);
  const text = readFileSync(baselineFile, "utf-8");
  const hits = text.split("\n").flatMap((line) => {
    const m = BASELINE_LINE.exec(line);
    return m ? [Number(m[1])] : [];
  });
  const only = hits.length === 1 ? hits[0] : undefined;
  if (only === undefined) {
    die(2, "expected exactly one BASELINE_FAILURES line in " + baselineFile + ", found " + String(hits.length));
  }
  return only;
}

// The validator prints exactly one of these; anything else means the run did
// not happen the way we think it did.
const RESULTS_LINE = /^Results:[ \t]+(\d+) passed,[ \t]+(\d+) failed[ \t]*$/;

interface Measured {
  readonly passed: number;
  readonly failed: number;
  readonly lines: string[];
}

/** The bullet lines under the validator's `Failures:` heading. */
function failureLines(output: string): string[] {
  const all = output.split("\n");
  const start = all.indexOf("Failures:");
  if (start === -1) return [];
  const out: string[] = [];
  for (const line of all.slice(start + 1)) {
    if (!line.startsWith("  - ")) break;
    out.push(line.slice(4));
  }
  return out;
}

/**
 * Run the validator and read its summary.
 *
 * NO PIPE. `Bun.spawnSync` hands back stdout and the exit code as separate
 * values, so the status is the validator's own and not some last stage of a
 * pipeline. This repo has already been bitten by a job that reported success
 * for months while its tool exited 1, because the exit code was read through a
 * pipe -- see the note on the render step in .github/workflows/helm-validate.yml.
 *
 * The other trap this guards is EMPTY OUTPUT. When the mise toolchain is not
 * trusted, `bun` resolves to nothing and the failure mode is a silent empty
 * result, not an error. A ratchet that read "no failures found" out of an empty
 * buffer would report a perfect score for a run that never happened, which is
 * the worst possible reading. So: no summary line parsed => exit 2, loudly, and
 * never a count.
 */
function measure(): Measured {
  const argv = ["bun", validator, "--apps-dir", appsDir, "--root-app", rootApp, "--render"];
  console.log("running: " + argv.join(" ") + "\n");
  const run = Bun.spawnSync(argv, { stdout: "pipe", stderr: "pipe", cwd: repoRoot });
  const output = run.stdout.toString() + run.stderr.toString();
  console.log(output);

  const summaries = output.split("\n").flatMap((line) => {
    const m = RESULTS_LINE.exec(line);
    return m ? [{ passed: Number(m[1]), failed: Number(m[2]) }] : [];
  });
  if (summaries.length !== 1) {
    die(
      2,
      "MEASUREMENT NOT TRUSTED: expected exactly one 'Results: N passed, M failed' line from the " +
        "validator, found " +
        String(summaries.length) +
        " (validator exit code " +
        String(run.exitCode) +
        ", " +
        String(output.length) +
        " bytes of output). An empty or unparseable run is NOT zero " +
        "failures. If output is empty, the usual cause is an untrusted mise config: run `mise trust`.",
    );
  }
  const s = summaries[0] as { passed: number; failed: number };
  return { passed: s.passed, failed: s.failed, lines: failureLines(output) };
}

// -- Compare -----------------------------------------------------------------

const baseline = readBaseline();
const first = measure();

// CONFIRM BEFORE ACCUSING. Measured 2026-08-20 on this tree: two identical
// runs minutes apart returned 23 and 24 failures, the extra one being helm
// itself dying with a Go runtime panic ("pointer to unallocated span") while
// rendering redis -- a tool crash, not a manifest defect. An exact-match gate
// that reds on that flake is a gate people mute, which would cost exactly what
// this ratchet is for.
//
// The absorption is deliberately narrow: a SECOND measurement is taken only
// when the first disagrees with the baseline, and it never decides the verdict
// on its own. Two runs that AGREE are believed, whatever they say. Two runs
// that DISAGREE are not a pass and not a fail -- they are an untrustworthy
// measurement, reported as exit 2 with the exact entries that moved. Retrying
// until the number is convenient would be result-shopping; this cannot do that,
// because it stops at two and disagreement is never green.
let measured = first;
if (first.failed !== baseline) {
  console.log(
    "\nfirst measurement (" +
      String(first.failed) +
      ") disagrees with the baseline (" +
      String(baseline) +
      "); re-measuring once to tell a real change from a tool flake.\n",
  );
  const second = measure();
  if (second.failed !== first.failed) {
    const a = new Set(first.lines);
    const b = new Set(second.lines);
    const moved = [
      ...first.lines.filter((l) => !b.has(l)).map((l) => "  only in run 1: " + l),
      ...second.lines.filter((l) => !a.has(l)).map((l) => "  only in run 2: " + l),
    ];
    die(
      2,
      "MEASUREMENT NOT TRUSTED: two runs of the same tree disagree -- " +
        String(first.failed) +
        " then " +
        String(second.failed) +
        " failures.\n" +
        "This is neither a pass nor a fail; the number itself is unstable, and these are the " +
        "entries that moved:\n" +
        moved.join("\n") +
        "\n" +
        "A flaky entry is worth a ticket of its own -- an unstable gate decays into an ignored one.",
    );
  }
  measured = second;
}
const { passed, failed } = measured;

console.log("=".repeat(78));
console.log("RATCHET: full-ai-cluster/k8s applications");
console.log("  measured: " + String(passed) + " passed, " + String(failed) + " failed");
console.log("  baseline: " + String(baseline) + " failed  (" + baselineFile + ")");
console.log("=".repeat(78));

if (failed === baseline) {
  console.log("OK: failure count is exactly at the recorded ceiling. No regression.");
  console.log("This is NOT a clean tree. " + String(failed) + " known failures remain -- see the baseline file.");
  process.exit(0);
}

if (failed > baseline) {
  die(
    1,
    "REGRESSION: " +
      String(failed) +
      " failures, ceiling is " +
      String(baseline) +
      " (+" +
      String(failed - baseline) +
      ").\n" +
      "Something in this change broke manifests that used to validate. Read the Failures: " +
      "list above; the new entries are yours.\n" +
      "Raising the ceiling is NOT the fix. It is only correct when the tree genuinely gained " +
      "scope (a new Application with known-unfinished values), and then it needs a sentence in " +
      baselineFile +
      " saying so.",
  );
}

die(
  1,
  "IMPROVEMENT NOT RECORDED: " +
    String(failed) +
    " failures, ceiling is still " +
    String(baseline) +
    " (-" +
    String(baseline - failed) +
    ").\n" +
    "This is good news and it still fails, on purpose: a ceiling that only ever moves up stops " +
    "meaning anything, and the improvement would be silently re-spendable by the next change.\n" +
    "Fix: in " +
    baselineFile +
    " set\n\n    BASELINE_FAILURES: " +
    String(failed) +
    "\n\n" +
    "and update the measured date, the commit, and the composition table so it still sums to " +
    String(failed) +
    ". Commit that in the same PR that earned it.",
);
