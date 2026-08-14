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
import { join } from "node:path";
import {
  MIN_INVOCATIONS,
  MIN_TEST_FILES,
  bunTestFilters,
  check,
  covers,
  executes,
  findings,
  joinContinuation,
  listItems,
  report,
  runScripts,
  triggersOf,
  workDirOf,
} from "./unexecuted-test-files";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

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

  test("exactly three run steps are found, and no other list item is taken for one", () => {
    expect(runSteps.length).toBe(3);
  });

  test("a step keeps its own working-directory", () => {
    const dirs = runSteps.map(workDirOf);
    expect(dirs).toEqual(["", "nested/dir", ""]);
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

describe("this repository", () => {
  const r = report(REPO_ROOT);

  test("the walk actually found the test suite - a vacuous pass is not a pass", () => {
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
