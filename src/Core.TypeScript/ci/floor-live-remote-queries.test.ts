// Falsifiers for the floor-scope guard.
//
// THREE OBLIGATIONS, and the change is worthless without all three:
//
//   1. A PR WITH A CLEAN DIFF IS NO LONGER BLOCKED BY GLOBAL STATE. Nothing in the
//      `gate-required` closure may enumerate a live remote population, so the floor's
//      verdict cannot move under work the candidate never touched.
//   2. THE AUDIT STILL CATCHES WHAT IT IS FOR. AH003 was not deleted — it is invoked, and
//      its exit code is honoured, by the alarm workflow; and its own falsifiers still run.
//   3. THE GUARD ITSELF CANNOT GO BLIND UNDER A REFACTOR. It did, measurably, between the
//      merge base and `main` — see §"resolution survives an indirection layer" below.
//
// Obligation 2 is what separates this from "we removed an annoying check". A guard that
// only proved (1) would be satisfied by deleting the audit, which would destroy the only
// thing standing between the archive lane and silent record loss.
//
// Obligation 3 is the one that had to be added after the fact, and it is the sharpest: a
// guard whose reach a neighbouring refactor can shorten reports GREEN while the defect it
// was written for sits untouched. That is worse than the blocking problem this change
// removes, because a blocked PR is loud and a blind floor check is silent.
//
// The scan itself reads COMMITTED TEXT ONLY — no clock, no network. A check on "may the
// floor depend on live state" that depended on live state would be the defect it names.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  bunScriptTargets,
  FLOOR_ROOT_JOB,
  findPopulationQuery,
  floorClosure,
  GATE_WORKFLOW,
  localImportTargets,
  main,
  MAX_RESOLUTION_HOPS,
  parseWorkflowJobs,
  POPULATION_QUERIES,
  scanFloor,
  stripComments,
  type WorkflowJob,
} from "./floor-live-remote-queries.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const ALARM_WORKFLOW = ".github/workflows/archive-strand-alarm.yml";
const AUDIT_TOOL = "src/Core.TypeScript/hygiene/audit-orphaned-archive-refs.ts";
const ROSTER = "src/Core.TypeScript/ci/cross-verify-roster.ts";

const scanned = scanFloor(REPO_ROOT);

function ok(): { readonly findings: readonly unknown[]; readonly floor: readonly string[] } {
  if ("error" in scanned) throw new Error(`scanFloor refused: ${scanned.error}`);
  return scanned;
}

// ── OBLIGATION 1 ──────────────────────────────────────────────────────────────────────────

describe("the blocking floor cannot be moved by repo-wide live state", () => {
  // THE PRIMARY FALSIFIER. Red on `main` before this change, rc=1, naming the exact chain:
  //   cross-verify -> cross-verify-roster.ts -> audit-orphaned-archive-refs.ts
  //                                             runs a LIVE POPULATION QUERY (git ls-remote)
  // Restoring the leg to gate.yml's matrix AND the roster turns this test red again — both,
  // because the two lists are parity-checked as sequences, so one alone is a different red.
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

  test("bunScriptTargets finds the invocation edges the scan follows", () => {
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

// ── THE GUARD MUST SEE THROUGH A DISPATCHER ───────────────────────────────────────────────
//
// THE MEASURED REGRESSION THIS BLOCK EXISTS FOR. This guard shipped resolving exactly ONE
// hop: `bun x.ts` in a `run:` block, and x.ts read. On 2026-08-26 `cross-verify` was
// restructured into a 31-leg matrix whose every leg runs
// `bun src/Core.TypeScript/ci/cross-verify-roster.ts --run <id>`, and the roster then
// invokes each audit. Measured at both trees with the identical guard binary:
//
//   merge base d8a55190bf  rc=1  RED, naming audit-orphaned-archive-refs.ts
//   origin/main 06914eec9e rc=0  GREEN — and the `git ls-remote` was still there
//
// Nobody edited the guard. Nobody edited the audit. A floor check stopped checking because
// of a refactor two files away — the vacuity class arriving by STRUCTURAL CHANGE rather
// than by authoring, which is the harder half to notice because no diff shows it.
//
// So the fixtures below reconstruct that exact shape in miniature, and the removal control
// is what keeps them from being satisfied by a detector that simply always fires.

describe("resolution survives an indirection layer being inserted between gate.yml and a tool", () => {
  function fixture(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), "floor-scope-"));
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    return root;
  }

  const WORKFLOW = ".github/workflows/gate.yml";
  const gateYml = (legs: readonly string[]): string =>
    `jobs:
  cross-verify:
    strategy:
      matrix:
        audit:
${legs.map((l) => `          - ${l}`).join("\n")}
    steps:
      - run: bun tools/roster.ts --run "$AUDIT"
  gate-required:
    needs:
      - cross-verify
    steps:
      - run: echo ok
`;
  const roster = (legs: readonly string[]): string =>
    `export const AUDITS = [
${legs.map((l) => `  { id: "${l}", command: "bun tools/audit-${l}.ts" },`).join("\n")}
];
`;
  const strandAudit = 'import { spawnSync } from "node:child_process";\nspawnSync("git", ["ls-remote", "--heads", "origin"]);\n';
  const innocentAudit = 'console.log("reads the committed tree only");\n';

  // THE PIN. Reintroduce the dispatcher-behind-a-dispatcher shape and the guard must still
  // convict. Under the one-hop code this test fails: `findings` is empty.
  test("a query TWO hops away is found, and the finding names the chain", () => {
    const root = fixture({
      [WORKFLOW]: gateYml(["strand", "innocent"]),
      "tools/roster.ts": roster(["strand", "innocent"]),
      "tools/audit-strand.ts": strandAudit,
      "tools/audit-innocent.ts": innocentAudit,
    });
    try {
      const result = scanFloor(root, WORKFLOW, "gate-required");
      expect(result).not.toHaveProperty("error");
      const { findings } = result as { findings: readonly { site: string; via: readonly string[]; query: string }[] };
      expect(findings).toHaveLength(1);
      expect(findings[0]?.site).toBe("tools/audit-strand.ts");
      expect(findings[0]?.query).toBe("git ls-remote");
      // The chain is the whole point of the red: without it the reader sees a job name and
      // a file with no account of how one reaches the other.
      expect(findings[0]?.via).toEqual(["tools/roster.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // THE REMOVAL CONTROL. Same tree, one leg dropped from BOTH lists — the change this PR
  // makes — and the guard goes green. Without this the test above would also pass for a
  // detector that convicted unconditionally.
  test("dropping that leg from both lists makes the same tree green", () => {
    const root = fixture({
      [WORKFLOW]: gateYml(["innocent"]),
      "tools/roster.ts": roster(["innocent"]),
      "tools/audit-strand.ts": strandAudit, // still on disk, simply no longer reachable
      "tools/audit-innocent.ts": innocentAudit,
    });
    try {
      const result = scanFloor(root, WORKFLOW, "gate-required");
      expect((result as { findings: readonly unknown[] }).findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // The other edge kind: a tool that is clean itself and imports a helper that is not.
  test("a query behind a relative import is found", () => {
    const root = fixture({
      [WORKFLOW]: gateYml([]).replace("        audit:\n", "        audit:\n          - only\n"),
      "tools/roster.ts": 'import { refs } from "./remote-helper.ts";\nexport const AUDITS = [{ id: "only", run: refs }];\n',
      "tools/remote-helper.ts": `export const refs = () => {\n${strandAudit}};\n`,
    });
    try {
      const { findings } = scanFloor(root, WORKFLOW, "gate-required") as {
        findings: readonly { site: string; via: readonly string[] }[];
      };
      expect(findings.map((f) => f.site)).toEqual(["tools/remote-helper.ts"]);
      expect(findings[0]?.via).toEqual(["tools/roster.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // A cycle must terminate rather than hang, and it must not stop the query being found.
  test("an import cycle terminates and still convicts", () => {
    const root = fixture({
      [WORKFLOW]: gateYml([]).replace("        audit:\n", "        audit:\n          - only\n"),
      "tools/roster.ts": 'import "./b.ts";\n',
      "tools/b.ts": `import "./roster.ts";\n${strandAudit}`,
    });
    try {
      const { findings } = scanFloor(root, WORKFLOW, "gate-required") as { findings: readonly { site: string }[] };
      expect(findings.map((f) => f.site)).toEqual(["tools/b.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // THE BOUND IS REAL, AND SAYING SO IS THE HONEST HALF. A chain longer than
  // MAX_RESOLUTION_HOPS is NOT examined. This test asserts the limit rather than hiding it:
  // if the bound is ever raised, or the walk is made unbounded, this is the line that has
  // to be edited on purpose. Stated plainly: it also passes under the OLD one-hop code, so
  // it is a statement of scope, not evidence that the transitive walk works — the three
  // tests above are that.
  test(`a chain deeper than MAX_RESOLUTION_HOPS (${MAX_RESOLUTION_HOPS}) is NOT examined`, () => {
    const depth = MAX_RESOLUTION_HOPS + 1;
    const files: Record<string, string> = {
      [WORKFLOW]: gateYml([]).replace("        audit:\n", "        audit:\n          - only\n"),
    };
    files["tools/roster.ts"] = 'import "./h1.ts";\n';
    for (let i = 1; i < depth; i++) files[`tools/h${i}.ts`] = `import "./h${i + 1}.ts";\n`;
    files[`tools/h${depth}.ts`] = strandAudit;
    const root = fixture(files);
    try {
      const { findings } = scanFloor(root, WORKFLOW, "gate-required") as { findings: readonly unknown[] };
      expect(findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("localImportTargets follows relative specifiers and ignores bare ones", () => {
    const root = fixture({ "a/b.ts": "", "a/c/index.ts": "" });
    try {
      const src = 'import x from "./b.ts";\nimport y from "./c";\nimport { z } from "node:fs";\nimport p from "some-pkg";\n';
      expect([...localImportTargets(src, "a/entry.ts", root)].sort()).toEqual(["a/b.ts", "a/c/index.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // THE REAL-TREE HALF of the pin: the fixtures above prove the mechanism, this proves the
  // mechanism is pointed at the actual dispatcher. `cross-verify-roster.ts` names its
  // audits as `bun <path>.ts` inside string literals, which is the edge that had to be
  // followed — if the roster ever stops naming them that way, this is the early warning.
  test("the real roster names its audits in the form the walk follows", () => {
    const targets = bunScriptTargets(stripComments(readFileSync(join(REPO_ROOT, ROSTER), "utf8")));
    expect(targets.length).toBeGreaterThan(10);
    expect(targets).toContain("src/Core.TypeScript/hygiene/audit-skip-token-cannot-land.ts");
    // And the one that was removed is no longer among them.
    expect(targets).not.toContain(AUDIT_TOOL);
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

  // Both halves of the two-view list must record why the leg left. Prose rots, but a
  // missing pointer is how the next reader re-adds the leg believing nobody thought about
  // it — and here the two lists are parity-checked as SEQUENCES, so an id restored in one
  // and not the other is red for the wrong reason and reads as a broken refactor.
  test("the matrix no longer declares the leg, and says where it went", () => {
    const gate = readFileSync(join(REPO_ROOT, GATE_WORKFLOW), "utf8");
    expect(gate).toContain("archive-strand-alarm.yml");
    expect(gate).not.toMatch(/^\s+- orphaned-archive-refs\s*$/mu);
  });

  test("the roster no longer declares the audit, and says where it went", () => {
    const roster = readFileSync(join(REPO_ROOT, ROSTER), "utf8");
    expect(roster).toContain("archive-strand-alarm.yml");
    expect(roster).not.toMatch(/^\s*id: "orphaned-archive-refs"/mu);
    expect(roster).not.toMatch(/^\s*command: "bun src\/Core\.TypeScript\/hygiene\/audit-orphaned-archive-refs\.ts"/mu);
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
