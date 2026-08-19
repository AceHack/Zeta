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
  expect(names.get("gate-required")).toBe("gate (required)");
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
