// audit-build-graph-completeness.test.ts
//
// The audit exists to stop a graph from CLAIMING coverage it does not have. A test
// suite for it that only asserts the happy path would be the same defect one level
// up, so every direction below has a NEGATIVE case that fails when the check is
// removed, and the two rosters are tested for rot in both directions.
//
// The real-repo case is asserted last and deliberately: it is the one that turns
// this from a unit test into a gate.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  auditAll,
  auditJobsAreClaimed,
  auditLegsResolve,
  auditRoster,
  auditTargetsHaveLegs,
  auditUncoveredRoster,
  collectJobs,
  legId,
  parseJobIds,
  workflowFilesFromLegs,
  INFRASTRUCTURE_JOBS,
  UNCOVERED_TARGETS,
  type BuildTargetLike,
} from "./audit-build-graph-completeness.ts";

const jobs = (m: Record<string, readonly string[]>) => new Map(Object.entries(m));

describe("parseJobIds", () => {
  test("reads two-space job keys under a top-level jobs:", () => {
    expect(parseJobIds("name: x\njobs:\n  build:\n    runs-on: a\n  lint:\n    runs-on: b\n"))
      .toEqual(["build", "lint"]);
  });

  test("stops at the next top-level key -- a later mapping is not a job", () => {
    // Without the top-level-key reset, `timeout-minutes` under `defaults:` would be
    // scraped as a job id and direction C would invent a job that does not exist.
    expect(parseJobIds("jobs:\n  build:\n    runs-on: a\ndefaults:\n  run:\n"))
      .toEqual(["build"]);
  });

  test("does not read deeper-indented keys as jobs (steps are not jobs)", () => {
    expect(parseJobIds("jobs:\n  build:\n    steps:\n      - name: x\n"))
      .toEqual(["build"]);
  });

  test("a workflow with no jobs: block yields nothing rather than guessing", () => {
    expect(parseJobIds("on: push\nname: x\n")).toEqual([]);
  });
});

describe("legId", () => {
  test("strips .yml and .yaml alike", () => {
    expect(legId("gate.yml", "lint")).toBe("gate/lint");
    expect(legId("gate.yaml", "lint")).toBe("gate/lint");
  });
});

describe("direction A -- every target claims a leg", () => {
  const withLeg: BuildTargetLike = { id: "a", kind: "rust", legs: ["gate/x"] };
  const without: BuildTargetLike = { id: "b", kind: "rust", legs: [] };

  test("passes when every target claims a leg", () => {
    expect(auditTargetsHaveLegs([withLeg], new Map())).toEqual([]);
  });

  test("FAILS on a leg-less target -- the negative case", () => {
    const f = auditTargetsHaveLegs([withLeg, without], new Map());
    expect(f).toHaveLength(1);
    expect(f[0]?.code).toBe("target-without-leg");
    expect(f[0]?.subject).toBe("b");
  });

  test("a missing legs field is treated as no legs, not as unknown", () => {
    expect(auditTargetsHaveLegs([{ id: "c", kind: "rust" }], new Map())).toHaveLength(1);
  });

  test("a rostered UNCOVERED target is exempt -- and only that one", () => {
    const roster = new Map([["b", "declared gap"]]);
    expect(auditTargetsHaveLegs([without], roster)).toEqual([]);
    expect(auditTargetsHaveLegs([{ id: "z", kind: "rust", legs: [] }], roster)).toHaveLength(1);
  });
});

describe("direction B -- every claimed leg resolves to a real job", () => {
  const real = jobs({ "gate.yml": ["lint"] });

  test("passes when the leg names a job that exists", () => {
    expect(auditLegsResolve([{ id: "a", kind: "x", legs: ["gate/lint"] }], real)).toEqual([]);
  });

  test("FAILS on a dangling leg -- the exact class found on main 2026-08-19", () => {
    // `lean-proof/build` was claimed while the job is named `type-check`; a wired
    // graph would have skipped the Lean proof on every Lean change.
    const f = auditLegsResolve(
      [{ id: "lean:src/Core.Lean4", kind: "lean", legs: ["lean-proof/build"] }],
      jobs({ "lean-proof.yml": ["type-check"] }),
    );
    expect(f).toHaveLength(1);
    expect(f[0]?.code).toBe("dangling-leg");
    expect(f[0]?.subject).toBe("lean-proof/build");
  });

  test("reports a dangling leg once even when many targets claim it", () => {
    const f = auditLegsResolve(
      [
        { id: "a", kind: "x", legs: ["gate/nope"] },
        { id: "b", kind: "x", legs: ["gate/nope"] },
      ],
      real,
    );
    expect(f).toHaveLength(1);
  });
});

describe("direction C -- every job is claimed by a target", () => {
  const three = jobs({ "gate.yml": ["lint", "build", "path-filter"] });

  test("FAILS on an unclaimed job -- the silent-skip class", () => {
    const f = auditJobsAreClaimed(
      [{ id: "a", kind: "x", legs: ["gate/lint"] }],
      three,
      new Map([["gate/path-filter", "orchestration"]]),
    );
    expect(f.map((x) => x.subject)).toEqual(["gate/build"]);
  });

  test("passes once every job is claimed or rostered", () => {
    expect(
      auditJobsAreClaimed(
        [{ id: "a", kind: "x", legs: ["gate/lint", "gate/build"] }],
        three,
        new Map([["gate/path-filter", "orchestration"]]),
      ),
    ).toEqual([]);
  });

  test("an EMPTY infrastructure roster does not silently pass orchestration jobs", () => {
    // Guards against the roster default being read as "everything is exempt".
    const f = auditJobsAreClaimed([{ id: "a", kind: "x", legs: ["gate/lint"] }], three, new Map());
    expect(f.map((x) => x.subject).sort()).toEqual(["gate/build", "gate/path-filter"]);
  });
});

describe("the rosters cannot rot and cannot shadow coverage", () => {
  test("FAILS when an infrastructure entry names a job that no longer exists", () => {
    const f = auditRoster([], jobs({ "gate.yml": ["lint"] }), new Map([["gate/gone", "why"]]));
    expect(f.map((x) => x.code)).toContain("stale-roster-entry");
  });

  test("FAILS when a job is BOTH rostered and claimed", () => {
    const f = auditRoster(
      [{ id: "a", kind: "x", legs: ["gate/lint"] }],
      jobs({ "gate.yml": ["lint"] }),
      new Map([["gate/lint", "why"]]),
    );
    expect(f.map((x) => x.code)).toContain("roster-shadows-coverage");
  });

  test("FAILS when an UNCOVERED entry names a target that no longer exists", () => {
    const f = auditUncoveredRoster([], new Map([["unit:gone", "why"]]));
    expect(f.map((x) => x.code)).toEqual(["stale-uncovered-entry"]);
  });

  test("FAILS when an UNCOVERED target has since gained a leg", () => {
    const f = auditUncoveredRoster(
      [{ id: "unit:agda", kind: "agda", legs: ["gate/agda"] }],
      new Map([["unit:agda", "why"]]),
    );
    expect(f.map((x) => x.code)).toEqual(["uncovered-target-has-leg"]);
  });

  test("every rostered reason is non-empty -- a roster without reasons is a licence", () => {
    for (const [, reason] of INFRASTRUCTURE_JOBS) expect(reason.trim().length).toBeGreaterThan(20);
    for (const [, reason] of UNCOVERED_TARGETS) expect(reason.trim().length).toBeGreaterThan(20);
  });
});

describe("workflowFilesFromLegs", () => {
  test("derives the workflow set from the legs rather than a hand-written list", () => {
    expect(
      workflowFilesFromLegs([
        { id: "a", kind: "x", legs: ["gate/lint", "lean-proof/type-check"] },
        { id: "b", kind: "x", legs: ["gate/build"] },
      ]),
    ).toEqual(["gate.yml", "lean-proof.yml"]);
  });
});

describe("the REAL repo graph is complete over the CI domain", () => {
  // This is the gate. If it fails, wiring job selection to the graph is unsound and
  // must wait -- a target with no leg, a leg with no job, or a job with no target
  // each produce a job that should have run and did not.
  const graph = JSON.parse(
    readFileSync("src/Core.TypeScript/ace/build-graph.json", "utf-8"),
  ) as { targets: BuildTargetLike[] };

  test("the graph is non-trivial -- refuse to pass on an empty surface", () => {
    expect(graph.targets.length).toBeGreaterThan(50);
  });

  test("no findings in any direction", () => {
    const files = [
      ...new Set([
        ...workflowFilesFromLegs(graph.targets),
        ...[...INFRASTRUCTURE_JOBS.keys()].map((l) => `${l.slice(0, l.indexOf("/"))}.yml`),
      ]),
    ].sort();
    const findings = auditAll(graph.targets, collectJobs(".github/workflows", files));
    expect(findings.map((f) => `${f.direction}/${f.code} ${f.subject}`)).toEqual([]);
  });

  test("the corrected legs are actually present -- the two bugs this audit found", () => {
    const byId = new Map(graph.targets.map((t) => [t.id, t]));
    // Direction B, dangling job ids: the jobs are `type-check` and `prove`.
    expect(byId.get("lean:src/Core.Lean4")?.legs).toContain("lean-proof/type-check");
    expect(byId.get("tool:tla")?.legs).toContain("tlaps-proof/prove");
    // Direction A, under-reported coverage: lint-rust walks every Cargo.toml.
    const rust = graph.targets.filter((t) => t.id.startsWith("rust:"));
    expect(rust.length).toBeGreaterThan(30);
    for (const t of rust) expect(t.legs).toContain("gate/lint-rust");
  });
});
