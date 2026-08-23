// src/Core.TypeScript/hygiene/lint-drift-publication-lands.test.ts
//
// The guard needs BOTH directions or it is decorative, and both directions here are
// reconstructions of shapes that actually shipped:
//
//   SENSITIVITY — the exact `drift-sweep.yml` and `drift-dashboard-cadence.yml` lines that
//                 ran green for ten days must be reported. Fixtures below are verbatim
//                 transcriptions of the defect, not paraphrases of it, so a future
//                 loosening of the matcher fails here rather than in production.
//   SPECIFICITY — the REPAIRED shape must pass, a non-publication workflow must not be
//                 rostered at all, and a `continue-on-error` GENERATION step must not be
//                 mistaken for a swallowed publication. That last one matters: the drift
//                 producer is deliberately non-fatal because it reports on legs that
//                 cannot block, and a lint that forbade it would be pressure to weaken a
//                 correct design.
//
// Also pinned: the real `.github/workflows` tree, so a regression in the repo itself is
// red here and not only in CI.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  auditDir,
  auditWorkflow,
  blankFullLineComments,
  declaresDriftPublication,
  isSwallowed,
  logicalCommands,
  pushTargetsMain,
  scanSteps,
} from "./lint-drift-publication-lands.ts";

const withWorkflows = (files: Readonly<Record<string, string>>): string => {
  const dir = mkdtempSync(join(tmpdir(), "driftpub-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
};

const rules = (vs: ReturnType<typeof auditWorkflow>): string[] => vs.map((v) => v.rule).sort();

// The two lines, transcribed from the workflows as they stood on 2026-08-23.
const SWEEP_PUSH = "            if git push 2>/tmp/push-err; then";
const DASHBOARD_PUSH =
  '            git push origin HEAD:main || echo "::warning::[dashboard] push failed — token may lack capability"';

describe("the live defect is reported", () => {
  test("drift-sweep's bare `git push` is a push at main", () => {
    expect(pushTargetsMain(SWEEP_PUSH)).toBe(true);
  });

  test("drift-dashboard-cadence's explicit HEAD:main push is a push at main", () => {
    expect(pushTargetsMain(DASHBOARD_PUSH)).toBe(true);
  });

  test("`|| echo ::warning::` is a swallow", () => {
    expect(isSwallowed(DASHBOARD_PUSH)).toBe(true);
  });

  test("the `push race` fallback that hid 1,597 green runs is a swallow", () => {
    expect(isSwallowed('git push || echo "tick bookkeeping lost a push race — next tick re-records"')).toBe(true);
  });

  // OWNED MISS, pinned. The first version of this lint scanned PHYSICAL lines and passed
  // on this fixture, because the `|| echo` sits on a continuation line carrying neither
  // `git push` nor `flush`. The shipped workflows both use the multi-line shape, so the one
  // spelling the lint would actually meet was the one it could not see — a guard that
  // guards nothing, inside the guard against guards that guard nothing. Found by running
  // the discrimination proof against the real workflow, not by reading the code.
  test("a swallow on a CONTINUATION line is still a swallow", () => {
    const wf = [
      "jobs:",
      "  sweep:",
      "    steps:",
      "      - name: Preflight",
      "        run: git push --dry-run origin HEAD:refs/heads/credprobe/drift-sweep",
      "      - name: Flush",
      "        run: |",
      "          bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush \\",
      "            --lane drift-sweep \\",
      "            --paths data/platform-drift.json \\",
      '            --message "drift: tick" || echo "::warning::flush failed"',
      "",
    ].join("\n");
    expect(rules(auditWorkflow("sweep.yml", wf))).toEqual(["swallow"]);
  });

  test("the join is keyed to the line the command STARTS on, so the report cites the command", () => {
    const cmds = logicalCommands(["a \\", "  b \\", "  c", "d"]);
    expect(cmds.map((c) => c.start)).toEqual([0, 3]);
    expect(cmds[0]?.text).toContain("c");
  });

  test("`|| true` and `|| exit 0` are swallows too — the same move, quieter", () => {
    expect(isSwallowed("git push origin HEAD:main || true")).toBe(true);
    expect(isSwallowed("git push origin HEAD:main || exit 0")).toBe(true);
  });

  test("a whole broken lane reports route + swallow + capability", () => {
    const wf = [
      "jobs:",
      "  sweep:",
      "    steps:",
      "      - name: Publish",
      "        run: |",
      "          git add docs/drift-events data/platform-drift.json",
      DASHBOARD_PUSH,
      "",
    ].join("\n");
    expect(rules(auditWorkflow("broken.yml", wf))).toEqual(["capability", "route", "swallow"]);
  });
});

describe("the repaired shape passes", () => {
  const repaired = [
    "jobs:",
    "  sweep:",
    "    steps:",
    "      - name: Preflight the push credential",
    "        run: |",
    '          probe() { git push --dry-run origin "HEAD:refs/heads/credprobe/drift-sweep" 2>&1; }',
    "          probe",
    "      - name: Flush",
    "        run: |",
    "          bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush \\",
    "            --lane drift-sweep \\",
    "            --paths docs/drift-events data/platform-drift.json \\",
    '            --message "drift: record sweep tick"',
    "",
  ].join("\n");

  test("route + swallow + capability are all satisfied", () => {
    expect(auditWorkflow("repaired.yml", repaired)).toEqual([]);
  });

  test("the probe alone does not count as a publication (a dry run publishes nothing)", () => {
    expect(pushTargetsMain('git push --dry-run origin "HEAD:refs/heads/credprobe/x"')).toBe(false);
  });
});

describe("specificity — what must NOT be reported", () => {
  test("a workflow that never publishes a drift artifact is not a lane at all", () => {
    const wf = ["jobs:", "  build:", "    steps:", "      - run: git push origin HEAD:main", ""].join("\n");
    expect(auditWorkflow("unrelated.yml", wf)).toEqual([]);
  });

  test("MERELY MENTIONING an artifact in prose does not roster a workflow", () => {
    // gate.yml discusses `data/platform-drift.json` at length and publishes nothing.
    const wf = [
      "# The dashboard reads data/platform-drift.json and docs/drift-events/.",
      "jobs:",
      "  gate:",
      "    steps:",
      "      - run: bun src/Core.TypeScript/ci/drift-loud.ts --ledger data/platform-drift.json",
      "",
    ].join("\n");
    expect(auditWorkflow("gate.yml", wf)).toEqual([]);
  });

  test("a continue-on-error GENERATION step is untouched — only PUBLISHING is constrained", () => {
    const wf = [
      "jobs:",
      "  sweep:",
      "    steps:",
      "      - name: Publish per-leg platform drift",
      "        continue-on-error: true",
      "        run: |",
      "          bun src/Core.TypeScript/ci/platform-drift-report.ts --out data/platform-drift.json",
      "      - name: Preflight",
      "        run: git push --dry-run origin HEAD:refs/heads/credprobe/drift-sweep",
      "      - name: Flush",
      "        run: |",
      "          git add data/platform-drift.json",
      "          bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush --lane drift-sweep --paths data/platform-drift.json",
      "",
    ].join("\n");
    expect(auditWorkflow("sweep.yml", wf)).toEqual([]);
  });

  test("but a continue-on-error PUBLISHING step is reported — REST cannot see this one", () => {
    const wf = [
      "jobs:",
      "  sweep:",
      "    steps:",
      "      - name: Preflight",
      "        run: git push --dry-run origin HEAD:refs/heads/credprobe/drift-sweep",
      "      - name: Flush",
      "        continue-on-error: true",
      "        run: |",
      "          git add data/platform-drift.json",
      "          bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush --lane drift-sweep --paths data/platform-drift.json",
      "",
    ].join("\n");
    expect(rules(auditWorkflow("sweep.yml", wf))).toEqual(["swallow"]);
  });

  test("a lane's own explanatory prose is not code — comments are blanked, numbering kept", () => {
    const text = ["# git push origin HEAD:main || echo swallowed", "real: line"].join("\n");
    const out = blankFullLineComments(text);
    expect(out).toEqual(["", "real: line"]);
  });

  test("a lane that quotes the forbidden push only in a comment is clean", () => {
    const wf = [
      "jobs:",
      "  sweep:",
      "    steps:",
      "      - name: Preflight",
      "        run: git push --dry-run origin HEAD:refs/heads/credprobe/drift-sweep",
      "      - name: Flush",
      "        run: |",
      "          # This used to be `git push origin HEAD:main || echo warn` and it was refused daily.",
      "          git add data/platform-drift.json",
      "          bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush --lane drift-sweep --paths data/platform-drift.json",
      "",
    ].join("\n");
    expect(auditWorkflow("sweep.yml", wf)).toEqual([]);
  });
});

describe("roster derivation", () => {
  test("`git add` and `--paths` both declare a publication; neither alone suffices", () => {
    expect(declaresDriftPublication("git add docs/drift-events data/platform-drift.json")).toBe(true);
    expect(declaresDriftPublication("--paths data/platform-drift.json")).toBe(true);
    expect(declaresDriftPublication("git add README.md")).toBe(false);
    expect(declaresDriftPublication("cat data/platform-drift.json")).toBe(false);
  });

  test("the pattern admits artifacts nobody has written yet — no hand-kept list to stale", () => {
    expect(declaresDriftPublication("git add data/drift-somethingnew.json")).toBe(true);
    expect(declaresDriftPublication("--paths db/drift-future/roster.json")).toBe(true);
  });

  test("scanSteps attributes continue-on-error to the step that declares it, not its neighbours", () => {
    const lines = [
      "    steps:",
      "      - name: a",
      "        continue-on-error: true",
      "        run: one",
      "      - name: b",
      "        run: two",
    ];
    const steps = scanSteps(lines);
    expect(steps.length).toBe(2);
    expect(steps[0]?.continueOnError).toBe(true);
    expect(steps[1]?.continueOnError).toBe(false);
  });
});

describe("the real tree", () => {
  test("every drift publication lane in .github/workflows is clean", () => {
    const { lanes, violations } = auditDir(".github/workflows");
    expect(violations).toEqual([]);
    // Scan floor: a rename that emptied the roster would otherwise pass vacuously here
    // too — the exact defect this file exists to close, one level up.
    expect(lanes.length).toBeGreaterThan(0);
  });

  test("both known lanes are rostered — the census, not a sample", () => {
    const { lanes } = auditDir(".github/workflows");
    expect(lanes).toContain("drift-sweep.yml");
    expect(lanes).toContain("drift-dashboard-cadence.yml");
  });

  test("a lane injected with the historical defect is caught in situ", () => {
    // The strongest form of the guard: take the REAL repaired workflow, reintroduce the
    // one line that was there for ten days, and require the lint to go red.
    const dir = withWorkflows({
      "drift-sweep.yml": [
        "jobs:",
        "  sweep:",
        "    steps:",
        "      - name: Flush",
        "        run: |",
        "          git add docs/drift-events data/platform-drift.json",
        SWEEP_PUSH,
        "",
      ].join("\n"),
    });
    const { lanes, violations } = auditDir(dir);
    expect(lanes).toEqual(["drift-sweep.yml"]);
    expect(rules(violations)).toEqual(["capability", "route"]);
  });
});
