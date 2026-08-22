/**
 * The gated half of `unexecuted-test-files.ts`.
 *
 * WHY THIS IS A TEST AND NOT ONLY A SCRIPT. A checker that CI does not run is the very
 * defect it exists to close - a file whose stated job is to catch drift, sitting outside
 * the lane where drift arrives. Every `hygiene/*.test.ts` is executed by the gate job
 * "lint (bash retirement inventory + hygiene unit tests)", so shipping the check as a
 * test here means it runs from its first commit rather than from a follow-up nobody files.
 *
 * Two kinds of assertion live below, and the split is deliberate:
 *
 *   1. UNIT tests of the derivation on synthetic input - these are what make a change to
 *      the parser refutable, and they are the only reason the repo-wide assertion at the
 *      bottom can be trusted to mean what it says.
 *   2. The repo-wide assertion itself, preceded by non-vacuity checks so it can never
 *      pass by discovering nothing.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MIN_INVOCATIONS,
  MIN_TEST_FILES,
  bunTestFilters,
  check,
  covers,
  executes,
  findings,
  invocationsInStep,
  isHiddenPath,
  joinContinuation,
  listItems,
  report,
  runScripts,
  summary,
  testFilesTracked,
  triggersOf,
  workDirOf,
} from "./unexecuted-test-files";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/**
 * ONE whole-repo report, shared by every assertion that needs it. Building it parses every
 * workflow and shells `git ls-files`, so a second call is a second full derivation - and
 * this file already runs alongside 57 others in the hygiene job, where a five-second
 * per-test cap is close enough that added work turns a neighbouring test red.
 */
const REPO_REPORT = report(REPO_ROOT);

/** A synthetic invocation, so the unit tests never depend on a real workflow. */
function inv(filters: readonly string[], wd = "", on: readonly string[] = ["pull_request"]) {
  const workingDirectory = wd;
  const triggers = on;
  const workflow = "w.yml";
  const step = "s";
  return { workflow, step, workingDirectory, filters, triggers };
}

/** Synthetic paths shared by the unit tests below - no real file is involved. */
const alphaDir = "alpha/";
const alphaDeep = "alpha/deep/x.test.ts";
const betaFile = "beta/x.test.ts";
const base = "x.test.ts";

describe("bun filter semantics are modelled as SUBSTRING, not prefix and not exact", () => {

  test("a trailing-slash directory covers everything beneath it", () => {
    expect(executes(inv([alphaDir]), alphaDeep)).toBe(true);
    expect(executes(inv([alphaDir]), betaFile)).toBe(false);
  });

  test("a bare basename matches, which prefix matching would have missed", () => {
    expect(executes(inv([base]), alphaDeep)).toBe(true);
  });

  test("a working-directory rebases the filter and drops what lies outside it", () => {
    const scoped = inv([base], "alpha");
    expect(executes(scoped, alphaDeep)).toBe(true);
    expect(executes(scoped, betaFile)).toBe(false);
  });

  test("no positional filters means every discoverable file under the cwd", () => {
    expect(executes(inv([]), alphaDeep)).toBe(true);
    expect(executes(inv([]), betaFile)).toBe(true);
  });
});

describe("argument parsing keeps flags out of the filter set", () => {
  const cmd = (...words: readonly string[]): string => ["bun", "test", ...words].join(" ");

  test("a value-taking flag swallows its argument instead of reading it as a path", () => {
    expect(bunTestFilters(cmd("-t", "someName", "alpha/"))).toEqual(["alpha/"]);
    expect(bunTestFilters(cmd("--timeout", "5000", "alpha/"))).toEqual(["alpha/"]);
  });

  test("parsing stops at a shell operator, so a chained command is not absorbed", () => {
    const chained = cmd("alpha/", "&&", "echo", "beta/");
    expect(bunTestFilters(chained)).toEqual(["alpha/"]);
  });

  test("multiple positional filters are all kept", () => {
    const both = cmd("alpha/", "beta/");
    expect(bunTestFilters(both)).toEqual(["alpha/", "beta/"]);
  });

  /**
   * A BUN-LEVEL FLAG BEFORE THE SUBCOMMAND is still a `bun test` invocation.
   *
   * `-c/--config` must precede `test` — bun rejects it after (MEASURED, bun 1.3.14: it reads
   * the path as a positional filter and matches nothing). The hermetic tier in gate.yml uses
   * that form, and until 2026-08-16 the invocation regex could not see it, so a lane running
   * 817 files reported as running none. An invocation form the parser cannot see is a lane
   * this checker silently writes off, which is its own defect class one level up.
   */
  test("a bun-level flag before the subcommand does not hide the invocation", () => {
    const flagged = ["bun", "--config=bunfig.hermetic.toml", "test", "alpha/"].join(" ");
    expect(bunTestFilters(flagged)).toEqual(["alpha/"]);
  });
});

/** A synthetic workflow, assembled line by line so no real file has to hold the fixture. */
const FIXTURE = [
  "name: fixture",
  "on:",
  "  pull_request:",
  "    types: [opened]",
  "  schedule:",
  "    - cron: 0 0 * * *",
  "jobs:",
  "  a:",
  "    steps:",
  "      - name: plain",
  "        run: bun test alpha/",
  "      - name: scoped",
  "        working-directory: nested/dir",
  "        run: bun test only.test.ts",
  "      - name: block",
  "        run: |",
  "          echo hello",
  "          bun test one.test.ts two.test.ts",
  "      - name: flagged",
  "        run: bun --config=bunfig.hermetic.toml test",
].join("\n");

describe("workflow parsing", () => {
  const bothTriggers = ["pull_request", "schedule"];

  test("block-form triggers are read, including the cadence one", () => {
    expect(triggersOf(FIXTURE, "fixture.yml")).toEqual(bothTriggers);
  });

  test("a workflow with no parseable trigger THROWS, never reading as zero coverage", () => {
    expect(() => triggersOf("name: broken", "broken.yml")).toThrow();
  });

  const runSteps = listItems(FIXTURE).filter((b) => runScripts(b).length > 0);

  test("exactly four run steps are found, and no other list item is taken for one", () => {
    expect(runSteps.length).toBe(4);
  });

  test("a step keeps its own working-directory", () => {
    const dirs = runSteps.map(workDirOf);
    expect(dirs).toEqual(["", "nested/dir", "", ""]);
  });

  /**
   * END-TO-END on the fixture, not only on `bunTestFilters`: the flagged form has to survive
   * `invocationsInStep`, whose own regex is the thing that could not see it before
   * 2026-08-16. A filter-less invocation means "runs everything discoverable", which is
   * exactly what the hermetic tier is.
   */
  test("a bun-level flag before the subcommand still yields a filter-less invocation", () => {
    const flagged = runSteps[3] ?? { indent: 0, lines: [] };
    const found = invocationsInStep(flagged, new Map(), "fixture.yml", bothTriggers);
    expect(found.map((i) => i.filters)).toEqual([[]]);
  });

  test("a block scalar is unwrapped, so filters inside it are seen", () => {
    const body = runScripts(runSteps[2] ?? { indent: 0, lines: [] })[0] ?? "";
    const lines = body.split("\n");
    const idx = lines.findIndex((l) => l.includes("one.test.ts"));
    expect(bunTestFilters(joinContinuation(lines, idx))).toEqual(["one.test.ts", "two.test.ts"]);
  });
});

describe("the allow-list cannot become a silent mute or a stale one", () => {
  const entry = (p: string, r: string) => ({ path: p, reason: r });

  test("an unexecuted file with no entry is a finding", () => {
    expect(check([alphaDeep], []).undeclared).toEqual([alphaDeep]);
  });

  test("an entry with a real reason silences exactly that file", () => {
    const v = check([alphaDeep], [entry(alphaDeep, "needs a live cluster")]);
    expect(v.undeclared).toEqual([]);
    expect(v.reasonless).toEqual([]);
    expect(v.stale).toEqual([]);
  });

  test("a whitespace-only reason is the escape hatch this forbids", () => {
    const v = check([betaFile], [entry(betaFile, "  ")]);
    expect(v.reasonless).toEqual([betaFile]);
  });

  test("an entry covering nothing unexecuted is STALE, so the list cannot rot", () => {
    const v = check([alphaDeep], [entry(betaFile, "a real reason")]);
    expect(v.stale).toEqual([betaFile]);
  });

  test("a directory entry covers its subtree; an exact entry does not", () => {
    expect(covers(entry(alphaDir, "r"), alphaDeep)).toBe(true);
    expect(covers(entry(alphaDeep, "r"), alphaDeep)).toBe(true);
    expect(covers(entry(alphaDeep, "r"), betaFile)).toBe(false);
  });
});

/**
 * The regression for 081KZYXRYR8087G0R003E6JZA4, planted in THIS repository on purpose.
 *
 * The fixture is the live defect, not an analogue of it: `bun run pages:build` copies
 * `docs/` into the gitignored `dist/`, so 18 archived test files acquired a second path
 * and the checker exited 1 on every machine that had built while CI stayed green. This
 * plants one file of that exact shape and asserts the discovered set is unmoved.
 *
 * Two guards keep it from passing vacuously - the failure mode of a "it isn't there" test:
 * the plant is asserted to EXIST on disk (so a silently failed write cannot look like a
 * pass), and a known tracked file is asserted to be PRESENT (so an empty derivation cannot
 * either). Reintroduce the working-tree walk and this goes red.
 */
describe("discovery is a function of the TRACKED set, not of what this machine built", () => {
  const plantedDir = join(REPO_ROOT, "dist", "unexecuted-test-files-regression");
  const planted = join(plantedDir, "planted.test.ts");
  const self = "src/Core.TypeScript/hygiene/unexecuted-test-files.test.ts";

  test("an untracked *.test.ts under gitignored dist/ is NOT discovered", () => {
    mkdirSync(plantedDir, { recursive: true });
    writeFileSync(planted, "// planted by unexecuted-test-files.test.ts; gitignored.\n", "utf8");
    try {
      expect(existsSync(planted)).toBe(true);
      const files = testFilesTracked(REPO_ROOT);
      expect(files).toContain(self);
      expect(files.filter((f) => f.includes("unexecuted-test-files-regression"))).toEqual([]);
      expect(files.filter((f) => f.startsWith("dist/"))).toEqual([]);
    } finally {
      rmSync(plantedDir, { recursive: true, force: true });
    }
  });

  test("a dot-prefixed segment anywhere in the path counts as hidden from bun", () => {
    expect(isHiddenPath(".claude/hooks/harness.test.ts")).toBe(true);
    expect(isHiddenPath("tools/.cache/x.test.ts")).toBe(true);
    expect(isHiddenPath("src/Core.TypeScript/hygiene/x.test.ts")).toBe(false);
  });

  test("hidden files stay out of the executes derivation but land in unexecuted", () => {
    expect(REPO_REPORT.files.some(isHiddenPath)).toBe(false);
    expect(REPO_REPORT.hidden.every(isHiddenPath)).toBe(true);
    // Never credited to the bare, filter-less `bun test` -- that would invent coverage.
    expect([...REPO_REPORT.executed].some(isHiddenPath)).toBe(false);
    // Every one of them is a finding-eligible entry, not merely a number in the summary.
    REPO_REPORT.hidden.forEach((f) => {
      expect(REPO_REPORT.unexecuted).toContain(f);
    });
    // The cause still appears in the line printed on every run, so it is never silent.
    expect(summary(REPO_REPORT)).toContain("hidden-from-bun");
  });

  /**
   * The teeth added by 081KZZ1RK6A087G0R003C773WC.
   *
   * `.claude/hooks/harness.test.ts` and `.claude/hooks/stop-detect-response-rut.test.ts` sat
   * tracked and unexecuted from 2026-06-21 -- 13 assertions on the hooks that run at every
   * agent session start and stop -- and the checker's response was to print `hidden-from-bun
   * 2` and PASS. A count nobody must act on is the soft form of the defect this file closes,
   * so a hidden file is now a red build unless it is allow-listed with a written reason.
   *
   * This test plants a hidden path through the pure `check`/`whyNotRun` seam rather than
   * writing into `.claude/`, so it neither depends on the repo currently having zero hidden
   * files nor perturbs the tracked set.
   */
  test("a hidden file is a FINDING, and the finding says to move it", () => {
    const hidden = ".claude/hooks/planted.test.ts";
    const verdict = check([hidden], []);
    expect(verdict.undeclared).toEqual([hidden]);
    const planted = { ...REPO_REPORT, hidden: [hidden], unexecuted: [hidden], verdict };
    const lines = findings(planted);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(hidden);
    expect(lines[0]).toContain("dot-prefixed");
    // And an allow-list entry with a reason is still the documented escape hatch.
    const declared = check([hidden], [{ path: hidden, reason: "measured: bun cannot see it" }]);
    expect(declared.undeclared).toEqual([]);
    expect(declared.reasonless).toEqual([]);
    expect(declared.stale).toEqual([]);
  });

  /**
   * The regression this whole work-item is: the two hook tests must be somewhere bun's
   * ordinary walk reaches. Naming them explicitly means moving them back under a dot
   * directory fails here as well as in the count.
   */
  test("the Claude hook tests are discoverable, not hidden", () => {
    const hooks = REPO_REPORT.files.filter((f) => f.startsWith("src/Core.TypeScript/claude-hooks/"));
    expect(hooks).toContain("src/Core.TypeScript/claude-hooks/harness.test.ts");
    expect(hooks).toContain("src/Core.TypeScript/claude-hooks/stop-detect-response-rut.test.ts");
    expect(REPO_REPORT.hidden).toEqual([]);
  });
});

describe("this repository", () => {
  const r = REPO_REPORT;

  test("the derivation actually found the test suite - a vacuous pass is not a pass", () => {
    expect(r.files.length).toBeGreaterThan(MIN_TEST_FILES);
  });

  test("the workflow parse actually found invocations", () => {
    expect(r.invocations.length).toBeGreaterThan(MIN_INVOCATIONS);
  });

  test("the PR lane executes a substantial majority of them", () => {
    expect(r.executed.size).toBeGreaterThan(r.files.length / 2);
  });

  test("every test file runs in the PR lane or carries a reasoned allow-list entry", () => {
    expect(findings(r)).toEqual([]);
  });
});

/**
 * Added after a real regression: a capture group accidentally introduced into the run-key
 * pattern made every inline `run:` yield its own indent instead of its command, and the
 * suite still passed because nothing asserted the inline form's CONTENT. It now does.
 */
describe("run scripts are captured in both YAML forms", () => {
  const scripts = listItems(FIXTURE)
    .map((b) => runScripts(b))
    .filter((s) => s.length > 0);

  test("the inline form yields the command itself, not its indentation", () => {
    expect(scripts[0]).toEqual(["bun test alpha/"]);
  });

  test("the block-scalar form yields every line of the body", () => {
    const body = (scripts[2] ?? [""])[0] ?? "";
    expect(body.split("\n").map((l) => l.trim())).toEqual([
      "echo hello",
      "bun test one.test.ts two.test.ts",
    ]);
  });
});
