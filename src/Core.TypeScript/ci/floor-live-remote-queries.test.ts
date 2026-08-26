// Falsifiers for the floor-scope guard.
//
// TWO OBLIGATIONS, and the change is worthless without both:
//
//   1. A PR WITH A CLEAN DIFF IS NO LONGER BLOCKED BY GLOBAL STATE. Nothing in the
//      `gate-required` closure may enumerate a live remote population, so the floor's
//      verdict cannot move under work the candidate never touched.
//   2. THE AUDIT STILL CATCHES WHAT IT IS FOR. AH003 was not deleted — it is invoked, and
//      its exit code is honoured, by the alarm workflow; and its own falsifiers still run.
//
// Obligation 2 is what separates this from "we removed an annoying check". A guard that
// only proved (1) would be satisfied by deleting the audit, which would destroy the only
// thing standing between the archive lane and silent record loss.
//
// The scan itself reads COMMITTED TEXT ONLY — no clock, no network. A check on "may the
// floor depend on live state" that depended on live state would be the defect it names.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  bunScriptTargets,
  FLOOR_ROOT_JOB,
  findPopulationQuery,
  floorClosure,
  GATE_WORKFLOW,
  main,
  parseWorkflowJobs,
  POPULATION_QUERIES,
  scanFloor,
  stripComments,
  type WorkflowJob,
} from "./floor-live-remote-queries.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const ALARM_WORKFLOW = ".github/workflows/archive-strand-alarm.yml";
const AUDIT_TOOL = "src/Core.TypeScript/hygiene/audit-orphaned-archive-refs.ts";

const scanned = scanFloor(REPO_ROOT);

function ok(): { readonly findings: readonly unknown[]; readonly floor: readonly string[] } {
  if ("error" in scanned) throw new Error(`scanFloor refused: ${scanned.error}`);
  return scanned;
}

// ── OBLIGATION 1 ──────────────────────────────────────────────────────────────────────────

describe("the blocking floor cannot be moved by repo-wide live state", () => {
  // THE PRIMARY FALSIFIER. Red on `main` before this change, naming the exact step:
  //   job 'cross-verify' -> audit-orphaned-archive-refs.ts runs a LIVE POPULATION QUERY.
  // Restoring that step to gate.yml turns this test red again.
  test("no job in the gate-required closure runs a live population query", () => {
    expect(ok().findings).toEqual([]);
  });

  // Liveness. An empty or mis-parsed closure would make the assertion above vacuously true
  // — a check that cannot fail dressed as a clean bill of health. The floor is named in the
  // workflow's own `needs:`, so this pins that the parse actually found it.
  test("the closure it checked is the real one, not an empty set", () => {
    const floor = ok().floor;
    expect(floor).toContain(FLOOR_ROOT_JOB);
    expect(floor).toContain("cross-verify");
    expect(floor).toContain("build-and-test");
    expect(floor.length).toBeGreaterThan(4);
  });

  test("scanFloor REFUSES a verdict when the root job is absent, rather than reporting clean", () => {
    const result = scanFloor(REPO_ROOT, GATE_WORKFLOW, "no-such-job");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Refusing a verdict");
  });

  test("scanFloor reports an unreadable workflow instead of an empty finding list", () => {
    const result = scanFloor(REPO_ROOT, ".github/workflows/does-not-exist.yml");
    expect(result).toHaveProperty("error");
  });
});

// ── THE DETECTOR CAN GO RED ───────────────────────────────────────────────────────────────

describe("the detector is not vacuous — it fires on the class it exists to catch", () => {
  const JOBS = `jobs:
  helper:
    name: helper
    steps:
      - name: enumerate
        run: git ls-remote --heads origin 'refs/heads/x*'
  gate-required:
    name: gate (required)
    needs:
      - helper
    steps:
      - run: echo ok
  unrelated:
    name: not in the floor
    steps:
      - run: gh pr list --state open
`;

  test("an inline population query in a floor job is a finding", () => {
    const jobs = parseWorkflowJobs(JOBS);
    const floor = floorClosure(jobs, "gate-required");
    expect([...floor].sort()).toEqual(["gate-required", "helper"]);
    const helper = jobs.find((j) => j.id === "helper");
    expect(findPopulationQuery(stripComments(helper?.runs.join("\n") ?? ""))?.query.id).toBe("git ls-remote");
  });

  // The scan is scoped to the floor, not the whole workflow: a `gh pr list` in a job nobody
  // requires is fine, and flagging it would make the check noise.
  test("a population query OUTSIDE the floor is not a finding", () => {
    const jobs = parseWorkflowJobs(JOBS);
    expect(floorClosure(jobs, "gate-required").has("unrelated")).toBe(false);
  });

  test("every roster entry actually matches the form it names", () => {
    const samples: Readonly<Record<string, string>> = {
      "git ls-remote": 'spawnSync("git", ["ls-remote", "--heads", remote])',
      "gh pr list": "gh pr list --state merged",
      "gh run list": "gh run list --workflow gate",
    };
    for (const q of POPULATION_QUERIES) {
      const sample = samples[q.id];
      expect(sample).toBeDefined();
      expect(findPopulationQuery(sample ?? "")?.query.id).toBe(q.id);
      // A roster entry with no stated reason is one nobody can argue against later.
      expect(q.why.length).toBeGreaterThan(20);
    }
  });

  // The audit's own header discusses `gh pr list` at length, and several floor tools mention
  // `gh api` in prose. A scanner that counted comments would cry wolf on documentation, and
  // a check people learn to ignore is worth less than no check.
  test("prose ABOUT a query is not a query", () => {
    expect(findPopulationQuery(stripComments("// its input is `gh pr list`, so it is blind\n"))).toBeNull();
    expect(findPopulationQuery(stripComments("# we deliberately avoid git ls-remote here\n"))).toBeNull();
    expect(findPopulationQuery(stripComments("/* uses git ls-remote */\nconst x = 1;\n"))).toBeNull();
    // ...but the same text OUTSIDE a comment still counts. Strings are not exempted: that
    // direction is the safe one.
    expect(findPopulationQuery(stripComments("run: git ls-remote origin\n"))?.query.id).toBe("git ls-remote");
  });

  // THE NON-VACUITY PIN, and the one that closes the cheapest way to make this whole change
  // look clean: drop `ls-remote` from the roster and every floor assertion above goes green
  // while the detector has gone blind. So the detector is pointed straight at the file that
  // was removed from the floor, and must still recognise it.
  test("the tool that motivated this check is STILL detected when scanned directly", () => {
    const tool = readFileSync(join(REPO_ROOT, AUDIT_TOOL), "utf8");
    const hit = findPopulationQuery(stripComments(tool));
    expect(hit?.query.id).toBe("git ls-remote");
    expect(hit?.evidence).toContain("ls-remote");
  });

  test("bunScriptTargets finds the one hop the scan follows", () => {
    expect(bunScriptTargets("bun src/a/b.ts --flag && bun test src/c.test.ts")).toEqual([
      "src/a/b.ts",
      "src/c.test.ts",
    ]);
  });

  test("needs: parses in block, inline-list and scalar forms", () => {
    const parse = (text: string): readonly WorkflowJob[] => parseWorkflowJobs(text);
    expect(parse("jobs:\n  a:\n    needs: [x, y]\n").at(0)?.needs).toEqual(["x", "y"]);
    expect(parse("jobs:\n  a:\n    needs: z\n").at(0)?.needs).toEqual(["z"]);
    expect(parse("jobs:\n  a:\n    needs:\n      - p\n      - q\n").at(0)?.needs).toEqual(["p", "q"]);
  });
});

// ── OBLIGATION 2 ──────────────────────────────────────────────────────────────────────────

describe("AH003 was RELOCATED, not deleted — the audit still catches what it is for", () => {
  const alarm = readFileSync(join(REPO_ROOT, ALARM_WORKFLOW), "utf8");

  test("the alarm workflow invokes the audit", () => {
    expect(alarm).toContain(`bun ${AUDIT_TOOL}`);
  });

  // THE LOAD-BEARING ONE. Moving a check to a lane that swallows its exit code is worse
  // than leaving it where it was: it would look like enforcement and constrain nothing.
  // These are the three ways the status gets lost in a shell step, and none may appear.
  test("the alarm does NOT swallow the audit's exit code", () => {
    // Comments stripped first: this workflow's header EXPLAINS why it must not use
    // `continue-on-error`, and matching that prose would be the same "documentation read as
    // code" mistake the detector's own comment-stripping exists to prevent.
    const body = stripComments(alarm);
    expect(body).not.toContain("continue-on-error");
    const auditStep = body.slice(body.indexOf("id: audit"), body.indexOf("Raise or refresh"));
    expect(auditStep).toContain(AUDIT_TOOL);
    // The audit's rc is captured and re-raised as the step's rc — nothing else decides.
    expect(auditStep).toContain('exit "$rc"');
    expect(auditStep).not.toMatch(/\|\|\s*true/u);
    expect(auditStep).not.toMatch(/\|\s*tee/u);
  });

  test("the alarm runs on a schedule, so detection does not wait for someone to open a PR", () => {
    expect(alarm).toMatch(/^\s+- cron: "/mu);
  });

  // The alarm deliberately has NO pull_request trigger: adding one would recreate the exact
  // live-remote-in-a-PR-lane coupling this change removes, on the same tool.
  test("the alarm has no pull_request trigger", () => {
    const triggers = alarm.slice(alarm.indexOf("\non:"), alarm.indexOf("\npermissions:"));
    expect(triggers).not.toContain("pull_request");
  });

  // A red run in a repo with 80+ workflows is easy to miss, so the alarm has a second
  // surface. Same pattern, and same reason, as heartbeat-liveness.yml.
  test("a failure raises a deduplicated tracking issue", () => {
    expect(alarm).toContain("gh issue create");
    expect(alarm).toContain("gh issue comment");
    expect(alarm).toContain("archive-strand");
    expect(alarm).toContain("if: failure() && steps.audit.outcome == 'failure'");
  });

  // The cheap wrong fix. The alarm's issue body says so explicitly; this pins that it does.
  test("the alarm tells the reader NOT to delete stranded refs", () => {
    expect(alarm).toContain("DO NOT DELETE THESE REFS");
  });

  test("the audit tool is still present and still gates on the ratchet", () => {
    const tool = readFileSync(join(REPO_ROOT, AUDIT_TOOL), "utf8");
    expect(tool).toContain("STRANDED_BASELINE");
    expect(tool).toContain("export function gate(");
  });

  // What replaces the blocking placement on the PR lane: the tool's OWN falsifiers, which
  // run offline in `test-typescript-hermetic` (bare `bun test`, in the required floor). So
  // the tool cannot regress unnoticed even though its live verdict no longer blocks.
  test("the audit's falsifiers still exist and are discovered by the hermetic suite", () => {
    const testPath = "src/Core.TypeScript/hygiene/audit-orphaned-archive-refs.test.ts";
    const spec = readFileSync(join(REPO_ROOT, testPath), "utf8");
    expect(spec).toContain("FAILS the moment one more record is stranded");
    for (const bunfig of ["bunfig.toml", "bunfig.hermetic.toml"]) {
      expect(readFileSync(join(REPO_ROOT, bunfig), "utf8")).not.toContain("audit-orphaned-archive-refs");
    }
  });

  // gate.yml must not silently forget why the step left. Prose rots, but a missing pointer
  // is how the next reader re-adds the step believing nobody thought about it.
  test("gate.yml records where AH003 went", () => {
    const gate = readFileSync(join(REPO_ROOT, GATE_WORKFLOW), "utf8");
    expect(gate).toContain("archive-strand-alarm.yml");
    expect(gate).not.toMatch(/^\s+run: bun src\/Core\.TypeScript\/hygiene\/audit-orphaned-archive-refs\.ts/mu);
  });
});

describe("the CLI", () => {
  test("exit 0 on the real repository", () => {
    expect(main(["--root", REPO_ROOT])).toBe(0);
  });

  // Exit 2, never 1: a check that could not run must not present as one that ran and
  // failed, and must never present as one that passed.
  test("exit 2 when it cannot run", () => {
    expect(main(["--root", join(REPO_ROOT, "does-not-exist")])).toBe(2);
  });

  // OVER-REACH GUARD, not proof of the fix: `stripComments` is exercised by the prose test
  // above; this only pins that it is total on empty input. It passes under the broken code
  // too and is NOT counted as evidence.
  test("[over-reach guard] stripComments is total on empty input", () => {
    expect(stripComments("")).toBe("");
  });
});
