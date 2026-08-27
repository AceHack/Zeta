import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  auditWorkflow,
  main,
  normalizePath,
  pathMatches,
  runAudit,
} from "./lint-no-clean-sarif-for-skipped-analysis.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");

/**
 * The defect shape, reduced to the parts that matter: a job with no analyser
 * step synthesises an empty SARIF and uploads it under a real analysis
 * category. Held as a fixture rather than read from `origin/main` so the test
 * keeps measuring the SHAPE after the real workflow is fixed -- reading the
 * live branch would make this test evaporate the moment it succeeds.
 *
 * Measured against the real pre-fix `codeql.yml`: 5 findings, one per
 * category (actions, csharp, python, javascript-typescript, java-kotlin).
 */
const PRE_FIX = `
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
jobs:
  path-gate:
    runs-on: ubuntu-24.04
    steps:
      - name: Emit no-findings SARIF
        if: steps.decide.outputs.is_fork_pr != 'true'
        run: |
          for lang in actions javascript-typescript; do
            cat > "sarif/empty-\${lang}.sarif" <<SARIF
          { "version": "2.1.0", "runs": [ { "results": [] } ] }
          SARIF
          done
      - name: Upload no-findings SARIF (javascript-typescript)
        if: steps.decide.outputs.is_fork_pr != 'true'
        uses: github/codeql-action/upload-sarif@db488dd
        with:
          sarif_file: sarif/empty-javascript-typescript.sarif
          category: "/language:javascript-typescript"
`;

const eventGated = PRE_FIX.replaceAll(
  "if: steps.decide.outputs.is_fork_pr != 'true'",
  "if: >-\n          steps.decide.outputs.is_fork_pr != 'true'\n          && github.event_name != 'push'\n          && github.event_name != 'schedule'",
);

const prOnly = PRE_FIX.replace("on:\n  push:\n    branches: [main]\n  pull_request:", "on:\n  pull_request:");

const unsuccessful = PRE_FIX.replace(
  '"runs": [ { "results": [] } ]',
  '"runs": [ { "results": [], "invocations": [ { "executionSuccessful": false } ] } ]',
);

const analyserOwned = PRE_FIX.replace(
  "      - name: Emit no-findings SARIF",
  "      - name: Initialize CodeQL\n        uses: github/codeql-action/init@db488dd\n      - name: Emit no-findings SARIF",
);

describe("the defect this lint was written for", () => {
  // THE FALSIFIER. If this can pass with the guard removed, the lint is a check
  // that cannot fail -- the exact class it exists to catch. Pinned to a COUNT,
  // not to `> 0`, so a recognizer that silently stops linking emit sites to
  // upload sites fails here instead of reporting a clean workflow.
  test("a clean synthesised SARIF from a non-analyser job is a finding", () => {
    const out = auditWorkflow(PRE_FIX, "codeql.yml");
    expect(out.emitSites).toHaveLength(1);
    expect(out.uploadSites).toHaveLength(1);
    expect(out.findings).toHaveLength(1);
    expect(out.findings.at(0)?.sarifFile).toBe("sarif/empty-javascript-typescript.sarif");
  });
});

describe("AN EVENT GATE IS NOT A REMEDY -- the regression that PR #15636 caught", () => {
  // This file's FIRST version cleared both of these, on the reasoning that a
  // `pull_request` analysis lands on `refs/pull/N/merge` and is discarded with
  // the ref. Measured false the same day: closing a PR-ref alert auto-resolves
  // the `github-advanced-security[bot]` review thread (its `resolvedBy` IS that
  // bot), and `required_conversation_resolution` is true on this repo -- so the
  // erased finding removes a merge blocker while auto-merge is armed. These two
  // tests are the ratchet that stops the weaker rule coming back.
  test("gating off push AND schedule is still a finding", () => {
    expect(auditWorkflow(eventGated, "w.yml").findings).toHaveLength(1);
  });

  test("a pull_request-only workflow is still a finding", () => {
    expect(auditWorkflow(prOnly, "w.yml").findings).toHaveLength(1);
  });
});

describe("the two real remedies, each clearing only its own case", () => {
  test("declaring executionSuccessful:false clears it", () => {
    const out = auditWorkflow(unsuccessful, "w.yml");
    expect(out.emitSites.at(0)?.declaresUnsuccessful).toBe(true);
    expect(out.findings).toHaveLength(0);
  });

  test("a job that runs the analyser clears it", () => {
    const out = auditWorkflow(analyserOwned, "w.yml");
    expect(out.emitSites.at(0)?.jobRunsAnalyser).toBe(true);
    expect(out.findings).toHaveLength(0);
  });

  // `executionSuccessful: true` is not the marker and must not be mistaken for
  // it -- without this, a substring-y matcher would clear an honest-looking
  // SARIF that asserts the opposite of what the remedy requires.
  test("executionSuccessful:true does NOT clear it", () => {
    const wrongWay = PRE_FIX.replace(
      '"runs": [ { "results": [] } ]',
      '"runs": [ { "results": [], "invocations": [ { "executionSuccessful": true } ] } ]',
    );
    expect(auditWorkflow(wrongWay, "w.yml").findings).toHaveLength(1);
  });
});

describe("the recognizers, pinned because each one can go dark silently", () => {
  // THE MEASURED RECOGNIZER BUG. `${{ matrix.language }}` contains spaces, so
  // matching the heredoc target against the RAW script truncates the path at
  // the first space and yields `sarif/no-source-${{`. The truncated path links
  // to no upload, the pair goes unseen, and the lint reports a clean workflow
  // over a site it never looked at. Caught on this file's first run.
  test("a heredoc target holding a ${{ }} expression is not truncated", () => {
    const wf = `
on:
  push:
jobs:
  emit-only:
    steps:
      - name: Emit
        run: |
          cat > "sarif/no-source-\${{ matrix.language }}.sarif" <<SARIF
          { "runs": [ { "results": [] } ] }
          SARIF
      - name: Upload
        uses: github/codeql-action/upload-sarif@db488dd
        with:
          sarif_file: sarif/no-source-\${{ matrix.language }}.sarif
`;
    const out = auditWorkflow(wf, "w.yml");
    expect(out.emitSites.at(0)?.writes).toEqual(["sarif/no-source-*.sarif"]);
    expect(out.findings).toHaveLength(1);
  });

  test("normalizePath collapses both expression syntaxes", () => {
    expect(normalizePath("sarif/empty-${lang}.sarif")).toBe("sarif/empty-*.sarif");
    expect(normalizePath("sarif/x-${{ matrix.language }}.sarif")).toBe("sarif/x-*.sarif");
  });

  test("pathMatches does not let a hole cross a path separator", () => {
    expect(pathMatches("sarif/empty-*.sarif", "sarif/empty-python.sarif")).toBe(true);
    expect(pathMatches("sarif/empty-*.sarif", "sarif/sub/empty-a.sarif")).toBe(false);
  });

  test("an unparseable workflow is not silently cleared as a pass", () => {
    const out = auditWorkflow("\t: [unbalanced\n  - {", "broken.yml");
    expect(out.emitSites).toHaveLength(0);
    expect(out.uploadSites).toHaveLength(0);
    expect(out.findings).toHaveLength(0);
  });
});

describe("the live tree", () => {
  test("codeql.yml on this branch synthesises no clean SARIF at all", () => {
    const text = readFileSync(join(REPO, ".github", "workflows", "codeql.yml"), "utf8");
    const out = auditWorkflow(text, "codeql.yml");
    expect(out.findings).toEqual([]);
    // The path-gate baseline is GONE, not merely gated: the only empty-SARIF
    // emitter left is `analyze`'s no-source baseline, which owns its category.
    expect(out.emitSites.map((e) => e.job)).toEqual(["analyze"]);
    expect(out.emitSites.at(0)?.jobRunsAnalyser).toBe(true);
  });

  // NON-VACUITY. A pass over an empty corpus is the failure this lint exists to
  // catch, so the corpus is asserted non-empty independently of the verdict.
  test("both recognizers still match something in the repo", () => {
    const report = runAudit(REPO);
    expect(report.workflowsScanned).toBeGreaterThan(10);
    expect(report.emitSites.length).toBeGreaterThan(0);
    expect(report.uploadSites.length).toBeGreaterThan(0);
    expect(report.darkRecognizers).toEqual([]);
  });

  test("the audit exits 0 on this branch", () => {
    expect(main([])).toBe(0);
  });

  test("an unknown argument is a usage error, not a pass", () => {
    expect(main(["--nope"])).toBe(1);
  });
});

// NO NUL BYTES. Not decoration: the first draft of the audit source carried
// four NUL bytes in a template literal, which made `file` report it as `data`
// and `grep` refuse it as binary -- a source file invisible to every text tool
// in the repo, including the greps other audits use to find it. Cheap to check,
// silent to miss.
describe("the audit's own source is text", () => {
  for (const f of ["lint-no-clean-sarif-for-skipped-analysis.ts", "lint-no-clean-sarif-for-skipped-analysis.test.ts"]) {
    test(`${f} contains no NUL byte`, () => {
      const buf = readFileSync(join(import.meta.dir, f));
      expect(buf.indexOf(0)).toBe(-1);
    });
  }
});
