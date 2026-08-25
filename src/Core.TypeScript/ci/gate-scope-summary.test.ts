import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  gateYmlJobNames,
  matchJobs,
  parseJobsInput,
  renderMarkdown,
  renderNotice,
  summarizeGate,
  type RunJob,
} from "./gate-scope-summary.ts";

// These fixtures are REAL Actions-API job listings, captured 2026-08-19 and trimmed to the
// fields this module reads (name / status / conclusion / steps[].name / steps[].conclusion):
//
//   gate-run-jobs-docs-only.json  run 32204203148  pull_request  -- `full-verify` SKIPPED
//   gate-run-jobs-code.json       run 32202982324  pull_request  -- `full-verify` ran
//   gate-run-jobs-windows-failed.json run 31978270082  push      -- windows-2025 FAILED while
//                                                                   `gate (required)` = success
//
// The third one is the residue this module was written to make visible: it is a run in which a
// floor job's leg failed and the required check reported green anyway. The assertion below is
// therefore not a hypothetical -- it replays a merge that actually happened.

const repoRoot = join(import.meta.dir, "..", "..", "..");
const fixtureDir = join(import.meta.dir, "fixtures");

function fixture(name: string): readonly RunJob[] {
  return parseJobsInput(readFileSync(join(fixtureDir, name), "utf8"));
}

/** The floor, read from gate.yml's own `gate-required.needs:` block. */
function declaredFloor(yamlText: string): string[] {
  const after = yamlText.slice(yamlText.indexOf("\n  gate-required:"));
  const needsAt = after.indexOf("\n    needs:");
  const body = after.slice(needsAt + "\n    needs:".length);
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const m = /^ {6}- ([A-Za-z0-9_-]+)\s*$/.exec(line);
    if (m?.[1] === undefined) {
      if (line.trim().length > 0 && !line.startsWith("      -")) break;
      continue;
    }
    out.push(m[1]);
  }
  return out;
}

const gateYml = readFileSync(join(repoRoot, ".github", "workflows", "gate.yml"), "utf8");

// A `needs` context as GitHub hands it to the rollup job. `result` for a matrix job with a
// continue-on-error leg that failed is `success` -- which is precisely the defect, and is
// evidenced by the windows fixture, where `gate (required)` concluded success.
function needsOf(overrides: Record<string, string> = {}): Record<string, { result: string }> {
  const base: Record<string, { result: string }> = {};
  for (const need of declaredFloor(gateYml)) base[need] = { result: "success" };
  for (const [k, v] of Object.entries(overrides)) base[k] = { result: v };
  return base;
}

test("gate.yml parse -- every floor job id resolves to a declared display name", () => {
  const names = gateYmlJobNames(gateYml);
  const floor = declaredFloor(gateYml);
  expect(floor.length).toBeGreaterThan(0);
  for (const need of floor) {
    expect(names.has(need)).toBe(true);
  }
  // Pinned so a job rename cannot silently break the id -> API-name mapping.
  expect(names.get("build-and-test")).toBe("build-and-test (${{ matrix.os }})");
  expect(names.get("lint")).toBe("lint (semgrep)");
  expect(names.get("lint-typescript")).toBe("lint (TS)");
  expect(names.get("test-typescript-hermetic")).toBe("test (TS hermetic)");
  expect(names.get("gate-required")).toBe("gate (required)");
});

test("the hermetic TypeScript suite blocks while the environment-dependent tier remains drift", () => {
  const floor = declaredFloor(gateYml);
  expect(floor).toContain("test-typescript-hermetic");
  expect(floor).not.toContain("test-typescript-environment");
});

test("matchJobs -- exact for literal names, prefix only for matrix names", () => {
  const jobs = fixture("gate-run-jobs-code.json");
  // `lint (semgrep)` must not swallow `lint (semgrep drift)`.
  expect(matchJobs("lint (semgrep)", jobs).map((j) => j.name)).toEqual(["lint (semgrep)"]);
  const legs = matchJobs("build-and-test (${{ matrix.os }})", jobs).map((j) => j.name);
  expect(legs.length).toBe(3);
  expect(legs.every((n) => n.startsWith("build-and-test ("))).toBe(true);
});

test("a code PR and a docs-only PR produce VISIBLY different summaries", () => {
  const code = summarizeGate(needsOf(), fixture("gate-run-jobs-code.json"), gateYmlJobNames(gateYml));
  const docs = summarizeGate(
    needsOf({ "full-verify": "skipped" }),
    fixture("gate-run-jobs-docs-only.json"),
    gateYmlJobNames(gateYml),
  );

  expect(code.scope).toBe("full");
  expect(docs.scope).toBe("reduced");
  expect(code.skippedFloorJobs).toEqual([]);
  expect(docs.skippedFloorJobs).toEqual(["full-verify"]);

  // The step-level difference inside a job that "ran" in BOTH cases -- this is the half that
  // a job-level rollup cannot see: build-and-test reports success either way.
  const legOf = (s: typeof code, os: string) =>
    s.rows.flatMap((r) => r.legs).find((l) => l.name === `build-and-test (${os})`);
  const codeLeg = legOf(code, "ubuntu-24.04");
  const docsLeg = legOf(docs, "ubuntu-24.04");
  expect(codeLeg?.conclusion).toBe("success");
  expect(docsLeg?.conclusion).toBe("success");
  expect(docsLeg?.stepsSkipped).toBeGreaterThan(codeLeg?.stepsSkipped ?? 0);
  const skippedNames = (docsLeg?.skippedStepNames ?? []).join(" | ");
  expect(skippedNames).toContain("Build (0 Warning(s)");
  expect(docsLeg?.skippedStepNames).toContain("Test");
  expect((codeLeg?.skippedStepNames ?? []).join(" | ")).not.toContain("Build (0 Warning(s)");

  // And the rendered artifacts differ, not just the model.
  expect(renderMarkdown(code)).not.toBe(renderMarkdown(docs));
  expect(renderNotice(code)).toContain("scope=full");
  expect(renderNotice(docs)).toContain("scope=reduced");
  expect(renderNotice(docs)).toContain("full-verify");
});

test("a continue-on-error leg that FAILED is named, while the rollup still reads success", () => {
  const jobs = fixture("gate-run-jobs-windows-failed.json");
  // Ground truth from the captured run: the leg failed and the required check went green.
  expect(jobs.find((j) => j.name === "build-and-test (windows-2025)")?.conclusion).toBe("failure");
  expect(jobs.find((j) => j.name === "gate (required)")?.conclusion).toBe("success");

  const s = summarizeGate(needsOf(), jobs, gateYmlJobNames(gateYml));
  expect(s.nonBlockingFailures).toEqual(["build-and-test (windows-2025)"]);
  expect(renderMarkdown(s)).toContain("FAILED (non-blocking)");
  expect(renderNotice(s)).toContain("NON-BLOCKING FAILURES: build-and-test (windows-2025)");
});

test("the non-blocking classification is derived, not windows-specific", () => {
  // Same shape, a leg name with no Windows in it: still classified non-blocking, because the
  // rule is (API conclusion = failure) AND (this need's rollup result = success).
  const jobs: RunJob[] = [
    { name: "build-and-test (freebsd-42)", conclusion: "failure", steps: [{ name: "Test", conclusion: "failure" }] },
    { name: "build-and-test (ubuntu-24.04)", conclusion: "success", steps: [{ name: "Test", conclusion: "success" }] },
  ];
  const s = summarizeGate(
    { "build-and-test": { result: "success" } },
    jobs,
    new Map([["build-and-test", "build-and-test (${{ matrix.os }})"]]),
  );
  expect(s.nonBlockingFailures).toEqual(["build-and-test (freebsd-42)"]);

  // And a leg that failed while its own need FAILED is a real block, not a non-blocking leg.
  const blocking = summarizeGate(
    { "build-and-test": { result: "failure" } },
    jobs,
    new Map([["build-and-test", "build-and-test (${{ matrix.os }})"]]),
  );
  expect(blocking.nonBlockingFailures).toEqual([]);
});


// ── THE CLASSIFICATION ITSELF, PINNED ─────────────────────────────────────────────────
//
// Everything above tests the REPORTING of a non-blocking leg. These two test the
// CLASSIFICATION that decides which legs are non-blocking in the first place, because
// after 2026-08-19 that is a maintainer decision rather than an implementation detail,
// and a decision with no falsifier is a decision that drifts back silently.
//
// Aaron 2026-08-19: "windows and mac are drift checks, it's fine to check per pr if we
// want but we don't want to block on them", then, closing the macOS half the same day:
// "we are moving away from anything that blocks into drift checks instead."

/** Prefixes named by the `continue-on-error:` expression on `build-and-test`. */
function driftCheckPrefixes(yamlText: string): string[] {
  const jobAt = yamlText.indexOf("\n  build-and-test:");
  if (jobAt < 0) throw new Error("build-and-test job not found in gate.yml");
  const after = yamlText.slice(jobAt);
  const flagAt = after.indexOf("\n    continue-on-error:");
  if (flagAt < 0) throw new Error("build-and-test carries no continue-on-error: flag");
  const line = after.slice(flagAt + 1, after.indexOf("\n", flagAt + 1));
  const prefixes: string[] = [];
  // Only the `startsWith(matrix.os, '<prefix>')` shape is understood. Anything else
  // must fail loudly: a parser that shrugged at an expression it could not read would
  // report "no drift checks" and pass, which is the vacuity class this file exists for.
  const re = /startsWith\(matrix\.os,\s*'([^']+)'\)/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(line)) !== null) {
    prefixes.push(m[1] as string);
    consumed += m[0].length;
  }
  const skeleton = line
    .replace(/startsWith\(matrix\.os,\s*'[^']+'\)/g, "")
    .replace(/^\s*continue-on-error:\s*\$\{\{/, "")
    .replace(/\}\}\s*$/, "")
    .replace(/\|\|/g, "")
    .trim();
  if (prefixes.length === 0 || skeleton.length > 0 || consumed === 0) {
    throw new Error(`continue-on-error expression is not a pure startsWith disjunction: ${line.trim()}`);
  }
  return prefixes;
}

/** Every OS the `matrix-setup` job can emit, across both branches of its if/else. */
function matrixOsValues(yamlText: string): string[] {
  const out = new Set<string>();
  for (const line of yamlText.split("\n")) {
    const m = /echo 'os=(\[[^\]]*\])'/.exec(line);
    if (m?.[1] === undefined) continue;
    for (const os of JSON.parse(m[1]) as string[]) out.add(os);
  }
  if (out.size === 0) throw new Error("matrix-setup emitted no os list this test could read");
  return [...out].sort();
}

test("the drift-check platform set is exactly what the maintainer classified", () => {
  const prefixes = driftCheckPrefixes(gateYml).sort();
  expect(prefixes).toEqual(["macos-", "windows-"]);

  const all = matrixOsValues(gateYml);
  const drift = all.filter((os) => prefixes.some((pre) => os.startsWith(pre)));
  const blocking = all.filter((os) => !prefixes.some((pre) => os.startsWith(pre)));

  // Every leg is classified, and the classification is the one on file. Adding a leg
  // without deciding its class fails HERE, not at the merge that should not have landed.
  expect(drift).toEqual(["macos-26", "windows-11-arm", "windows-2025"]);
  expect(blocking).toEqual(["ubuntu-24.04", "ubuntu-24.04-arm"]);

  // Restoring blocking authority to a drift platform is a floor amendment and goes
  // through the consent path named at gate-required, not through an edit to the flag.
  expect(blocking.some((os) => os.startsWith("macos-"))).toBe(false);
});

test("a failed macos-26 leg is NAMED, not swallowed, once macOS stops blocking", () => {
  // Derived from the captured windows run rather than invented: same real job listing,
  // with macos-26's conclusion flipped to failure. That is the exact shape the API
  // produces for a continue-on-error leg -- the windows leg in this very fixture proves
  // `failure` (not `skipped`, not `neutral`) is what a continue-on-error job reports.
  const captured = fixture("gate-run-jobs-windows-failed.json");
  const jobs: RunJob[] = captured.map((j) =>
    j.name === "build-and-test (macos-26)" ? { ...j, conclusion: "failure" } : j,
  );
  expect(jobs.find((j) => j.name === "build-and-test (macos-26)")?.conclusion).toBe("failure");

  const s = summarizeGate(needsOf(), jobs, gateYmlJobNames(gateYml));

  // The rollup still reports success -- that is the whole point of the flip, and it is
  // why the three assertions below are the ones that keep it from being vacuous.
  expect(s.nonBlockingFailures).toContain("build-and-test (macos-26)");
  expect(renderMarkdown(s)).toContain("build-and-test (macos-26)");
  expect(renderMarkdown(s)).toContain("FAILED (non-blocking)");
  expect(renderNotice(s)).toContain("NON-BLOCKING FAILURES:");
  expect(renderNotice(s)).toContain("build-and-test (macos-26)");
});

test("macOS blocking again would be reported as a block, not as drift", () => {
  // The converse, so the previous test cannot pass by naming everything. If the flag is
  // ever narrowed back, macos-26's failure reds `build-and-test`, and this summary must
  // stop calling it non-blocking rather than keep reassuring a reader it was tolerated.
  const captured = fixture("gate-run-jobs-windows-failed.json");
  const jobs: RunJob[] = captured.map((j) =>
    j.name === "build-and-test (macos-26)" ? { ...j, conclusion: "failure" } : j,
  );
  const s = summarizeGate(needsOf({ "build-and-test": "failure" }), jobs, gateYmlJobNames(gateYml));
  expect(s.nonBlockingFailures).toEqual([]);
});

test("a floor entry with no matching job is reported UNRESOLVED, not silently dropped", () => {
  const s = summarizeGate(
    { "a-job-that-never-ran": { result: "success" } },
    fixture("gate-run-jobs-code.json"),
    new Map(),
  );
  expect(s.unresolvedNeeds).toEqual(["a-job-that-never-ran"]);
  expect(s.scope).toBe("unknown");
  expect(renderMarkdown(s)).toContain("UNRESOLVED");
});

test("parseJobsInput accepts the envelope, a bare array, and the NDJSON stream form", () => {
  const one: RunJob = { name: "x", conclusion: "success", steps: [] };
  expect(parseJobsInput(JSON.stringify({ jobs: [one] })).length).toBe(1);
  expect(parseJobsInput(JSON.stringify([one])).length).toBe(1);
  expect(parseJobsInput(`${JSON.stringify(one)}\n${JSON.stringify(one)}\n`).length).toBe(2);
  expect(parseJobsInput("   ").length).toBe(0);
});
