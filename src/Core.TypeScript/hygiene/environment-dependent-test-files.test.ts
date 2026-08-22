/**
 * The gated half of `environment-dependent-test-files.ts`.
 *
 * WHY THIS IS A TEST AND NOT ONLY A SCRIPT — the same argument as its sibling: a checker CI
 * does not run is the defect it exists to close. `bun test src/Core.TypeScript/hygiene/` runs
 * in the gate job "lint (bash retirement inventory + hygiene unit tests)", so this is live
 * from its first commit.
 *
 * Two kinds of assertion, deliberately split:
 *
 *   1. UNIT tests of `check` on synthetic input — each one names a specific way the tier
 *      split could lie, and they are the only reason the repo-wide assertion at the bottom
 *      can be trusted to mean what it says.
 *   2. The repo-wide assertion, preceded by non-vacuity so it cannot pass by finding nothing.
 *
 * THIS FILE IS ITSELF HERMETIC, which it has to be: a checker for the hermetic tier that
 * could only run in the environment-dependent tier would be self-refuting.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  BASE_CONFIG,
  HERMETIC_CONFIG,
  MIN_BASE_PATTERNS,
  REGISTRY,
  check,
  findings,
  ignorePatterns,
  loadRegistry,
  manifest,
  report,
  summary,
  without,
  type EnvEntry,
} from "./environment-dependent-test-files";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/** ONE whole-repo report, shared below: building it parses every workflow and shells git. */
const REPO_REPORT = report(REPO_ROOT);

const ALPHA = "alpha/x.test.ts";
const BETA = "beta/y.test.ts";

/** A registry entry with everything present, so each test can spoil exactly one field. */
function entry(over: Partial<EnvEntry> = {}): EnvEntry {
  return { path: ALPHA, dependency: "a thing", reason: "because", ...over };
}

const runsEverything = () => true;
const runsNothing = () => false;
const trackedAlpha: ReadonlySet<string> = new Set([ALPHA, BETA]);
const noUnexecuted: ReadonlySet<string> = new Set<string>();

describe("check names each distinct way a tier split can lie", () => {

  test("a hermetic-only exclusion with no registry entry is undeclared", () => {
    const v = check([ALPHA], [], trackedAlpha, noUnexecuted, runsEverything);
    expect(v.undeclared).toEqual([ALPHA]);
  });

  test("a declared exclusion is not undeclared", () => {
    const v = check([ALPHA], [entry()], trackedAlpha, noUnexecuted, runsEverything);
    expect(v.undeclared).toEqual([]);
  });

  test("an empty dependency is unattributed — a skip must NAME what is missing", () => {
    const v = check([ALPHA], [entry({ dependency: "  " })], trackedAlpha, noUnexecuted, runsEverything);
    expect(v.unattributed).toEqual([ALPHA]);
  });

  test("an empty reason is unattributed too", () => {
    const v = check([ALPHA], [entry({ reason: "" })], trackedAlpha, noUnexecuted, runsEverything);
    expect(v.unattributed).toEqual([ALPHA]);
  });

  test("an entry the hermetic config does not exclude is notExcluded", () => {
    const v = check([], [entry()], trackedAlpha, noUnexecuted, runsEverything);
    expect(v.notExcluded).toEqual([ALPHA]);
  });

  /**
   * THE LOAD-BEARING ONE. Excluded from hermetic AND reached by no lane is not a split, it is
   * a deletion — and it would leave the suite green over a file it stopped running, which is
   * precisely the class the split was built to end.
   */
  test("an entry no pull_request lane executes is a deletion, not a split", () => {
    const v = check([ALPHA], [entry()], trackedAlpha, noUnexecuted, runsNothing);
    expect(v.unrun).toEqual([ALPHA]);
  });

  test("a path in BOTH registries is a contradiction", () => {
    const both: ReadonlySet<string> = new Set([ALPHA]);
    const v = check([ALPHA], [entry()], trackedAlpha, both, runsEverything);
    expect(v.doubleListed).toEqual([ALPHA]);
  });

  test("a registry path that is not a tracked test file has rotted", () => {
    const gone = "gone/z.test.ts";
    const v = check([gone], [entry({ path: gone })], trackedAlpha, noUnexecuted, runsEverything);
    expect(v.untracked).toEqual([gone]);
  });

  test("a fully-formed entry produces no finding at all", () => {
    const v = check([ALPHA], [entry()], trackedAlpha, noUnexecuted, runsEverything);
    const all = [...v.undeclared, ...v.unattributed, ...v.notExcluded, ...v.unrun, ...v.doubleListed, ...v.untracked];
    expect(all).toEqual([]);
  });

  test("findings are ordinal-sorted, so a report of two problems is diffable", () => {
    const v = check([BETA, ALPHA], [], trackedAlpha, noUnexecuted, runsEverything);
    expect(v.undeclared).toEqual([ALPHA, BETA]);
  });
});

describe("without is set difference, ordinal-ordered", () => {

  test("drops exactly the members of the second set", () => {
    expect(without([BETA, ALPHA], new Set([BETA]))).toEqual([ALPHA]);
  });

  test("keeps everything when nothing is dropped", () => {
    expect(without([BETA, ALPHA], new Set())).toEqual([ALPHA, BETA]);
  });
});

describe("the configs parse, and neither can pass by being empty", () => {

  test(BASE_CONFIG + " yields a plausible ignore list", () => {
    expect(ignorePatterns(REPO_ROOT, BASE_CONFIG).length).toBeGreaterThanOrEqual(MIN_BASE_PATTERNS);
  });

  test("a config with no pathIgnorePatterns THROWS rather than reading as clean", () => {
    expect(() => ignorePatterns(REPO_ROOT, "package.json")).toThrow(/pathIgnorePatterns/);
  });

  test("a config that does not exist THROWS", () => {
    expect(() => ignorePatterns(REPO_ROOT, "bunfig.no-such-file.toml")).toThrow(/does not exist/);
  });
});

describe("the repo's own tier split", () => {

  test("NON-VACUITY: the registry names at least one environment-dependent file", () => {
    expect(loadRegistry(REPO_ROOT).length).toBeGreaterThanOrEqual(1);
  });

  test("NON-VACUITY: workflows were parsed, so the run-somewhere check is not trivial", () => {
    expect(REPO_REPORT.invocations.length).toBeGreaterThanOrEqual(8);
  });

  test(HERMETIC_CONFIG + " is a strict SUPERSET of " + BASE_CONFIG, () => {
    expect(REPO_REPORT.dropped).toEqual([]);
    expect(REPO_REPORT.hermeticOnly.length).toBeGreaterThanOrEqual(1);
  });

  test("every entry NAMES a concrete missing dependency, not a category", () => {
    const vague = new Set(["environment", "ci", "env", "n/a", "none", "tooling"]);
    const bad = REPO_REPORT.registry.filter((e) => vague.has(e.dependency.trim().toLowerCase()));
    expect(bad.map((e) => e.path)).toEqual([]);
  });

  test("the manifest prints one dependency-labelled line per entry", () => {
    expect(manifest(REPO_REPORT).length).toBe(REPO_REPORT.registry.length);
    manifest(REPO_REPORT).forEach((line) => {
      expect(line).toContain("[needs: ");
    });
  });

  test("the summary line reports four counts", () => {
    expect(summary(REPO_REPORT).split(" = ")[1]?.split(" ")).toHaveLength(4);
  });

  /**
   * THE ASSERTION THIS FILE EXISTS FOR. Every hermetic-tier exclusion is declared in
   * `registry/environment-dependent-test-files.json`, names the dependency whose absence
   * causes it, and is executed by some pull_request-lane invocation. A failure here is
   * printed with the offending paths, not as a bare boolean.
   */
  test("every hermetic-tier exclusion is declared, attributed, and run somewhere", () => {
    expect(findings(REPO_REPORT).join("\n"), REGISTRY + " is out of sync with " + HERMETIC_CONFIG).toBe("");
  });
});
