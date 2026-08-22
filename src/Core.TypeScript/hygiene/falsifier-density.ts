/**
 * Falsifier density — how many test files carry a check that can FAIL?
 *
 * Aaron 2026-08-20: "the biggest obstical to human AI trust is proper
 * [un]implemented excetiopns of vacuious claims" and "we should track falsfiers
 * over features as a best practice diciplie".
 *
 * A discipline that says "track falsifiers" without a way to count them would be
 * vacuous BY ITS OWN STANDARD. This is the counter, so the discipline arrives with
 * its meter.
 *
 * WHAT THIS MEASURES, precisely, so it is not over-read:
 *   a test file is NEGATIVE-BEARING if it contains at least one check shaped like a
 *   refusal -- an expected throw/rejection, an assertion of `false`/`not`, or a test
 *   NAME drawn from refusal vocabulary.
 *
 * WHAT IT DOES NOT MEASURE: whether any given assertion is actually falsifiable.
 * That is `mutation-runner.ts`'s job and it is strictly stronger -- a test that
 * survives mutation is not a falsifier no matter how it is spelled. This is the
 * cheap wide screen; mutation testing is the expensive narrow proof. Read a high
 * score here as "the shape is present", never as "the checks are sound".
 *
 * Register: UNMETERED. The count is exact; the claim that the count tracks
 * falsifiability is a proxy, and the proxy is unvalidated.
 */

import { readFileSync } from "node:fs";

/** Assertion-level shapes that can only appear on a failure path. */
const NEGATIVE_ASSERTION =
  /\.toThrow|\.rejects\b|toBe\(false\)|toBeFalsy\(|\.not\.|Assert\.Throws|shouldFail|toEqual\(\[\]\)|raise\s+<|Expect\.throws/;

/** Test-name vocabulary that declares a refusal rather than a success. */
const NEGATIVE_NAME =
  /\b(refus\w*|reject\w*|fail(s|ed|ing|-closed)?|never|invalid|vacuo\w*|counterexample|violat\w*|must not|does not|cannot|forbid\w*|denie[sd]|absent|missing|malformed|corrupt\w*|mutant|red\b)/i;

/** A `test("...")` / `it("...")` / `[<Fact>] let ...` name, best-effort across TS and F#. */
const TEST_NAME =
  /(?:\b(?:test|it)\s*\(\s*["'`]([^"'`]{3,200})["'`])|(?:\[<(?:Fact|Property)[^>]*>\]\s*\r?\n\s*let\s+``([^`]{3,200})``)/g;

export interface FileVerdict {
  readonly path: string;
  readonly tests: number;
  readonly negativeAssertions: number;
  readonly negativeNames: number;
  /** true when the file carries at least one refusal-shaped check. */
  readonly negativeBearing: boolean;
}

export function scanSource(path: string, src: string): FileVerdict {
  const names: string[] = [];
  for (const m of src.matchAll(TEST_NAME)) names.push(m[1] ?? m[2] ?? "");
  const negativeNames = names.filter((n) => NEGATIVE_NAME.test(n)).length;
  let negativeAssertions = 0;
  for (const line of src.split(/\r?\n/)) if (NEGATIVE_ASSERTION.test(line)) negativeAssertions++;
  return {
    path,
    tests: names.length,
    negativeAssertions,
    negativeNames,
    negativeBearing: negativeAssertions > 0 || negativeNames > 0,
  };
}

export interface Density {
  readonly files: number;
  readonly negativeBearing: number;
  /** negativeBearing / files, or 0 when there are no files. */
  readonly density: number;
  /** Files with tests but no refusal-shaped check anywhere — the work-list. */
  readonly barren: readonly FileVerdict[];
}

export function summarize(verdicts: readonly FileVerdict[]): Density {
  const withTests = verdicts.filter((v) => v.tests > 0);
  const bearing = withTests.filter((v) => v.negativeBearing);
  const barren = withTests
    .filter((v) => !v.negativeBearing)
    .slice()
    .sort((a, b) => b.tests - a.tests);
  return {
    files: withTests.length,
    negativeBearing: bearing.length,
    density: withTests.length === 0 ? 0 : bearing.length / withTests.length,
    barren,
  };
}

export function scanPaths(paths: readonly string[]): Density {
  const verdicts: FileVerdict[] = [];
  for (const p of paths) {
    try {
      verdicts.push(scanSource(p, readFileSync(p, "utf8")));
    } catch {
      // unreadable file contributes nothing; a scan that cannot read must not
      // silently count as a pass
    }
  }
  return summarize(verdicts);
}

if (import.meta.main) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error("usage: bun falsifier-density.ts <test-file>...");
    process.exit(2);
  }
  const d = scanPaths(paths);
  const pct = (d.density * 100).toFixed(1);
  console.log(
    JSON.stringify(
      {
        files: d.files,
        negativeBearing: d.negativeBearing,
        densityPct: Number(pct),
        barrenTop: d.barren.slice(0, 20).map((v) => ({ path: v.path, tests: v.tests })),
      },
      null,
      2,
    ),
  );
}
