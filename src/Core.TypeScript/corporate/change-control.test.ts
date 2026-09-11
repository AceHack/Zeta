/**
 * change-control.test.ts — the register's work becoming a real change, in the canonical vocabulary.
 *
 * Driven from actual runtime reports, so what is projected is what the organization really did.
 */

import { describe, expect, test } from "bun:test";
import { disagreementsWith, factsFor, project, projectAll } from "./change-control";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { RunOutcome } from "./qa";
import { GateKind, GateOutcome } from "./quality-gate";
import { WorkState, WorkType, setState, childrenOf } from "./goal-cascade";
import { chainFor, producesCode } from "./gate-demand";
import { isTerminal } from "../workflow-engine/agent-loop/work-lifecycle-state-machine";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const GOOD: ExternalEvent = {
  source: "portal",
  externalId: "T-1",
  kind: IntakeKind.Defect,
  severity: Severity.High,
  title: "checkout double-charges",
  reproduction: "twice",
  evidenceRefs: ["log/1"],
};

function deps(over: Partial<OrgRuntimeDeps> = {}): OrgRuntimeDeps {
  let n = 0;
  return {
    chart,
    externalEvents: [GOOD],
    agents: agentsFromChart(chart),
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p) => `${p}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    priorityInputsFor: () => ({
      executivePriority: 0.5, customerImpact: 1, severity: 1, releaseRisk: 0.2,
      blockedDownstreamCount: 2, dependencyFanOut: 1, queueAgeMs: 0, hatScarcity: 0,
      budgetBurn: 0, estimatedEffort: 0.2,
    }),
    ...over,
  };
}

const projectRun = async (over?: Partial<OrgRuntimeDeps>) => {
  const report = await runOrgRuntime(deps(over));
  return {
    report,
    projections: projectAll({
      cascade: report.cascade,
      queue: report.queue,
      gateEvaluations: report.gateEvaluations,
      nowMs: 0,
    }),
  };
};

describe("a delivered task becomes a MERGED change", () => {
  test("the full canonical path, in order", async () => {
    const { projections } = await projectRun();
    // ONE, not two. The run's leaves are a defect and a `review`; only the defect produces code, so
    // only it is a change. The verification item has no branch to open — see `producesCode`.
    expect(projections).toHaveLength(1);
    for (const p of projections) {
      expect(p.projection.state.tag).toBe("Merged");
      expect(p.projection.terminal).toBe(true);
      expect(p.projection.applied.map((a) => a.tag)).toEqual([
        "Claim",
        "StartWork",
        "OpenPr",
        "RequestReview",
        "Approve",
        "Merge",
      ]);
    }
  });

  test("NOTHING was refused — the projection and the lifecycle agree", async () => {
    const { projections } = await projectRun();
    for (const p of projections) {
      expect(p.projection.refused).toEqual([]);
      expect(p.disagreements).toEqual([]);
    }
  });

  test("the change carries the organization's own identifiers", async () => {
    const { report, projections } = await projectRun();
    const p = projections[0]!;
    expect(p.projection.state.tag).toBe("Merged");
    if (p.projection.state.tag !== "Merged") return;
    expect(p.projection.state.row.id).toBe(p.workId);
    // The row is honest about where the work came from — not a `docs/backlog/` path that has no file.
    expect(p.projection.state.row.filePath).toContain("corporate/cascade");
    expect(p.projection.state.row.trajectory).toBe("corporate-register");
    expect(report.cascade.nodes.some((n) => n.workId === p.workId)).toBe(true);
  });
});

describe("a rejected task cycles through review and does NOT merge", () => {
  test("it ends in review, having gone round once per rejection", async () => {
    const { projections } = await projectRun({ qaFallback: RunOutcome.Failed });
    for (const p of projections) {
      expect(p.projection.state.tag).toBe("InReview");
      expect(p.projection.terminal).toBe(false);
      // Each rejection is one full turn: request → push → re-review.
      const tags = p.projection.applied.map((a) => a.tag);
      const requests = tags.filter((t) => t === "ReceiveRevisionRequest").length;
      const pushes = tags.filter((t) => t === "PushRevision").length;
      expect(requests).toBeGreaterThan(0);
      expect(pushes).toBe(requests);
      expect(tags).not.toContain("Approve");
      expect(tags).not.toContain("Merge");
    }
  });

  test("THE LOOP CLOSES WITH RequestReview, not ResolveAllThreads", async () => {
    // The bug this pins was live: `ResolveAllThreads` advances straight to `Approved`, so emitting
    // it per rework made every later revision request illegal and produced a change that read as
    // approved while its gates were still failing.
    const { projections } = await projectRun({ qaFallback: RunOutcome.Failed });
    for (const p of projections) {
      expect(p.projection.applied.map((a) => a.tag)).not.toContain("ResolveAllThreads");
      expect(p.projection.refused).toEqual([]);
    }
  });

  test("and the two records do not disagree", async () => {
    const { projections } = await projectRun({ qaFallback: RunOutcome.Failed });
    for (const p of projections) expect(p.disagreements).toEqual([]);
  });
});

describe("the projection is DERIVED — it cannot be advanced on its own", () => {
  test("unstaffed work does not even claim", async () => {
    const { projections } = await projectRun({ agents: [] });
    for (const p of projections) {
      expect(p.projection.state.tag).toBe("Backlog");
      expect(p.projection.applied).toEqual([]);
    }
  });

  test("facts come from the organization's state, not from a caller", async () => {
    const { report } = await projectRun();
    const taskId = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined)!.workId;
    const facts = factsFor(taskId, {
      cascade: report.cascade,
      queue: report.queue,
      gateEvaluations: report.gateEvaluations,
      nowMs: 0,
    })!;
    expect(facts.assigneeHatId).toBeDefined();
    expect(facts.shardId).toBeDefined();
    // The DEFECT's own chain — implementation review, QA, runtime validation, release readiness —
    // not every canonical gate. `ORDERED_GATES.length` here asserted the old model, in which one
    // implementer walked all fourteen.
    expect(facts.gateEvaluations.length).toBe(chainFor(WorkType.Defect).length);
    expect(facts.cancelled).toBe(false);
    expect(factsFor("ghost", { cascade: report.cascade, queue: report.queue, gateEvaluations: [], nowMs: 0 })).toBeUndefined();
  });

  test("a CANCELLED task is CLOSED once a PR exists, and ABANDONED before one does", async () => {
    // The canonical machine's own distinction, and a real one: work dropped after a pull request is
    // open leaves a PR out there to close, while work dropped before does not. `Abandon` is legal
    // only from Backlog, Claimed and InProgress.
    const { report } = await projectRun();
    const taskId = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined)!.workId;
    const cancelled = setState(report.cascade, taskId, WorkState.Canceled);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;

    // This task got as far as a PR, so cancelling it CLOSES the change.
    const closed = projectAll({
      cascade: cancelled.cascade,
      queue: report.queue,
      gateEvaluations: report.gateEvaluations,
      nowMs: 0,
    }).find((x) => x.workId === taskId)!;
    expect(closed.projection.state.tag).toBe("Closed");
    expect(isTerminal(closed.projection.state)).toBe(true);
    expect(closed.projection.refused).toEqual([]);

    // The same task with no shard and no gate verdicts never reached a PR, so it is ABANDONED.
    const early = project({
      facts: { workId: taskId, assigneeHatId: "backend_implementer", gateEvaluations: [], cancelled: true },
      row: { id: taskId, title: "t", priority: "P2", filePath: "x", trajectory: "y" },
      prNumber: 1,
      nowMs: 0,
    });
    expect(early.state.tag).toBe("Abandoned");
    expect(early.refused).toEqual([]);
  });
});

describe("DISAGREEMENT IS DETECTABLE — the point of a derived projection", () => {
  test("a task marked done whose change never merged is reported", async () => {
    const { report } = await projectRun({ qaFallback: RunOutcome.Failed });
    const taskId = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined)!.workId;
    // Force the cascade to claim delivery the gates never granted — the exact drift change control
    // exists to catch.
    const forged = {
      ...report.cascade,
      nodes: report.cascade.nodes.map((n) => (n.workId === taskId ? { ...n, state: WorkState.Done } : n)),
    };
    const p = projectAll({
      cascade: forged,
      queue: report.queue,
      gateEvaluations: report.gateEvaluations,
      nowMs: 0,
    }).find((x) => x.workId === taskId)!;
    expect(p.disagreements.length).toBeGreaterThan(0);
    expect(p.disagreements[0]).toContain("done in the cascade but the change is");
  });

  test("a merged change whose task is not done is reported", async () => {
    const { report } = await projectRun();
    const taskId = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined)!.workId;
    // The change merged (all gates passed) but the cascade shows it open.
    const forged = {
      ...report.cascade,
      nodes: report.cascade.nodes.map((n) => (n.workId === taskId ? { ...n, state: WorkState.Open } : n)),
    };
    const facts = factsFor(taskId, {
      cascade: forged, queue: report.queue, gateEvaluations: report.gateEvaluations, nowMs: 0,
    })!;
    const node = report.cascade.nodes.find((n) => n.workId === taskId)!;
    const projection = project({
      // `owedGates` has to be supplied here. `factsFor` gathers what the register recorded and does
      // not know the item's TYPE, and a projection with no owed set falls back to all fourteen
      // canonical gates — which this item does not owe, so it would never reach `Merged` and the
      // disagreement this test exists to detect could not arise.
      facts: { ...facts, owedGates: chainFor(node.workType) },
      row: { id: taskId, title: "t", priority: "P2", filePath: "x", trajectory: "y" },
      prNumber: 1,
      nowMs: 0,
    });
    const d = disagreementsWith(projection, { cascade: forged, workId: taskId, queue: report.queue });
    // The projection only reaches `Merged` once the item's OWN chain has passed, so the fixture
    // supplies `owedGates` for the type under test. Without it the projection stops short of
    // merging and the disagreement this test exists to detect never arises — the test would pass
    // for the wrong reason, which is worse than failing.
    expect(d.some((x) => x.includes("change merged but"))).toBe(true);
  });

  test("only LEAF work is projected — a goal is not a pull request", async () => {
    const { report, projections } = await projectRun();
    const ids = new Set(projections.map((p) => p.workId));
    for (const node of report.cascade.nodes) {
      // A goal is still not a pull request — and neither is a verification task. What is projected
      // is a leaf THAT PRODUCES CODE; the rest have nothing to merge.
      const projectable =
        childrenOf(report.cascade, node.workId).length === 0 && producesCode(node.workType);
      expect(ids.has(node.workId)).toBe(projectable);
    }
  });
});

describe("shapes the pipeline does not produce, which a caller can", () => {
  const row = { id: "w1", title: "t", priority: "P2" as const, filePath: "x", trajectory: "y" };

  test("A PR NEEDS GATE EVIDENCE — a shard alone does not open one", () => {
    // In a real run a shard and gate verdicts always arrive together, so the two conditions
    // coincide and neither is tested. A caller can hand over one without the other.
    const p = project({
      facts: {
        workId: "w1",
        assigneeHatId: "backend_implementer",
        pickedByAgentId: "alice",
        shardId: "s1",
        gateEvaluations: [],
        cancelled: false,
      },
      row,
      prNumber: 1,
      nowMs: 0,
    });
    expect(p.applied.map((a) => a.tag)).toEqual(["Claim", "StartWork"]);
    expect(p.state.tag).toBe("InProgress");
    expect(p.refused).toEqual([]);
  });

  test("A REFUSED TRANSITION IS REPORTED, not swallowed", () => {
    // Gate verdicts with nothing staffed: the projection tries to request a review on work that was
    // never claimed. The canonical machine refuses, and the disagreement must SURFACE — a
    // projection that quietly drops what the lifecycle rejected is the drift it exists to catch.
    const p = project({
      facts: {
        workId: "w1",
        gateEvaluations: [
          { workId: "w1", gate: GateKind.CustomerRfpReview, outcome: GateOutcome.Approved, byHatId: "product_manager", reason: "", atMs: 0 , evidenceRefs: []},
        ],
        cancelled: false,
      },
      row,
      prNumber: 1,
      nowMs: 0,
    });
    expect(p.state.tag).toBe("Backlog");
    expect(p.refused.length).toBeGreaterThan(0);
    expect(p.refused[0]?.transition.tag).toBe("RequestReview");
    expect(p.refused[0]?.reason).toContain("illegal transition");

    // …and `disagreementsWith` surfaces it to the caller.
    const d = disagreementsWith(p, {
      cascade: { nodes: [] },
      workId: "w1",
      queue: { queueId: "q", hatId: "h", revision: 0, shards: [], claims: [], approvals: [], quorumSize: 1, heartbeatTimeoutMs: 1 },
    });
    expect(d.some((x) => x.includes("the lifecycle refused"))).toBe(true);
  });
});
