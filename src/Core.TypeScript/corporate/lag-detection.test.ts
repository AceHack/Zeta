/**
 * lag-detection.test.ts — a detector that reports nothing looks exactly like a healthy organization.
 *
 * That sentence is the whole test file. Every condition here has two tests — it fires when the lag
 * is real, and it is reported as NOT CHECKED when the observation it needs was never supplied —
 * because the difference between "clear" and "nobody looked" is the difference between an
 * organization that is fine and one about to stall.
 *
 * The mutant this is written against is any `?? []` that turns a missing observation into an empty
 * one. That single character makes twelve conditions pass forever.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import {
  detectLag,
  LAG_CONDITION_COUNT,
  LagKind,
  lagOfKind,
  REASSIGNMENT_THRESHOLD,
  sweptEverything,
  type LagInput,
} from "./lag-detection";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 1_000_000;
const SLA = 60_000;

function sweep(over: Partial<LagInput> = {}) {
  return detectLag(chart, { nowMs: NOW, ...over });
}

const HEALTHY_ASSIGNMENT = {
  workId: "task-1",
  hatId: "backend_implementer",
  tokenExpiresMs: NOW + 3_600_000,
  heartbeatAtMs: NOW,
  startedAtMs: NOW - 1_000,
};

describe("NOT CHECKED IS NOT CLEAR — the field this module exists for", () => {
  test("a sweep with NO observations finds nothing and admits it checked nothing", () => {
    const r = sweep();
    expect(r.findings).toEqual([]);
    expect(r.checked).toEqual([]);
    expect(r.notChecked).toHaveLength(12);
    // The callable form of the question, so a caller cannot read a clean report as a healthy one.
    expect(sweptEverything(r)).toBe(false);
    expect(r.summary).toContain("12 not checked");
  });

  test("AN EMPTY OBSERVATION IS CHECKED-AND-CLEAR, which is a different fact from absent", () => {
    // The distinction the whole report hinges on: asked and nothing was wrong, versus never asked.
    const asked = sweep({ reviews: [] });
    expect(asked.checked).toContain(LagKind.ReviewerMissing);
    expect(asked.notChecked).not.toContain(LagKind.ReviewerMissing);
    expect(sweep().notChecked).toContain(LagKind.ReviewerMissing);
  });

  test("A CONDITION NEEDING TWO OBSERVATIONS IS UNCHECKED WITH ONLY ONE", () => {
    // Silence needs assignments AND an SLA. Checking it with a threshold nobody supplied would mean
    // inventing a number, and a finding against an invented threshold is one nobody can act on.
    const noSla = sweep({ assignments: [HEALTHY_ASSIGNMENT] });
    expect(noSla.notChecked).toContain(LagKind.AssignmentSilent);
    expect(noSla.checked).toContain(LagKind.ExpiredAssignmentToken);

    const both = sweep({ assignments: [HEALTHY_ASSIGNMENT], silenceSlaMs: SLA });
    expect(both.checked).toContain(LagKind.AssignmentSilent);
  });

  test("EVERY NAMED CONDITION HAS A DETECTOR — a kind with nothing behind it is a promise", () => {
    // The enum and the detector table are two lists that must agree. Adding a `LagKind` and
    // forgetting its detector would leave a condition the report never mentions in EITHER column:
    // not found, and not reported as unchecked. Invisible in the one place invisibility is the bug.
    expect(LAG_CONDITION_COUNT).toBe(12);
    expect(Object.values(LagKind)).toHaveLength(LAG_CONDITION_COUNT);
    const swept = sweep();
    expect(new Set([...swept.checked, ...swept.notChecked])).toEqual(new Set(Object.values(LagKind)));
  });

  test("a FULL sweep says so", () => {
    const r = sweep({
      cascade: [],
      assignments: [],
      silenceSlaMs: SLA,
      expectedDurationMs: 10_000,
      runs: [],
      reservedSupply: [],
      reservationSlaMs: SLA,
      reviews: [],
      qaReady: [],
      releaseCandidates: [],
      blocked: [],
      queues: [],
      reassignments: new Map(),
    });
    expect(sweptEverything(r)).toBe(true);
    expect(r.checked).toHaveLength(12);
    expect(r.findings).toEqual([]);
  });
});

describe("each of the doc's twelve fires on the real thing", () => {
  test("open work with nobody on it", () => {
    const node: CascadeNode = {
      workId: "task-9",
      workType: WorkType.Task,
      title: "t",
      state: WorkState.Open,
      ownerHatId: "tech_lead",
    };
    const r = sweep({ cascade: [node] });
    expect(lagOfKind(r, LagKind.UnassignedReadyWork)[0]?.subjectId).toBe("task-9");
    // ...and not once somebody has it.
    expect(lagOfKind(sweep({ cascade: [{ ...node, assigneeHatId: "backend_implementer" }] }), LagKind.UnassignedReadyWork)).toEqual([]);
  });

  test("an expired token", () => {
    const r = sweep({ assignments: [{ ...HEALTHY_ASSIGNMENT, tokenExpiresMs: NOW - 1 }] });
    expect(lagOfKind(r, LagKind.ExpiredAssignmentToken)).toHaveLength(1);
    expect(lagOfKind(sweep({ assignments: [HEALTHY_ASSIGNMENT] }), LagKind.ExpiredAssignmentToken)).toEqual([]);
  });

  test("a silent assignment, at the SLA boundary and not before", () => {
    const at = sweep({ assignments: [{ ...HEALTHY_ASSIGNMENT, heartbeatAtMs: NOW - SLA }], silenceSlaMs: SLA });
    const just = sweep({ assignments: [{ ...HEALTHY_ASSIGNMENT, heartbeatAtMs: NOW - SLA + 1 }], silenceSlaMs: SLA });
    expect(lagOfKind(at, LagKind.AssignmentSilent)).toHaveLength(1);
    expect(lagOfKind(just, LagKind.AssignmentSilent)).toEqual([]);
  });

  test("a run bound to nothing — the doc's 'no work should be invisible', defeated", () => {
    const r = sweep({ runs: [{ runId: "run-1" }, { runId: "run-2", workId: "task-1" }, { runId: "run-3", workId: "  " }] });
    expect(lagOfKind(r, LagKind.UnboundRun).map((f) => f.subjectId)).toEqual(["run-1", "run-3"]);
  });

  test("supply reserved and never drawn against", () => {
    const idle = { hatId: "qa_engineer", reservedAtMs: NOW - SLA, taskStarted: false };
    expect(lagOfKind(sweep({ reservedSupply: [idle], reservationSlaMs: SLA }), LagKind.ReservedSupplyIdle)).toHaveLength(1);
    expect(lagOfKind(sweep({ reservedSupply: [{ ...idle, taskStarted: true }], reservationSlaMs: SLA }), LagKind.ReservedSupplyIdle)).toEqual([]);
  });

  test("work in review with no reviewer", () => {
    const r = sweep({ reviews: [{ workId: "task-1" }, { workId: "task-2", reviewerHatId: "tech_lead" }] });
    expect(lagOfKind(r, LagKind.ReviewerMissing).map((f) => f.subjectId)).toEqual(["task-1"]);
  });

  test("QA-ready work with no QA assignment", () => {
    const r = sweep({ qaReady: [{ workId: "task-1" }] });
    expect(lagOfKind(r, LagKind.QaAssignmentMissing)).toHaveLength(1);
  });

  test("a release candidate short of evidence, ORDINALLY listed", () => {
    const r = sweep({ releaseCandidates: [{ workId: "task-1", missingEvidence: ["traces", "screenshots", "logs"] }] });
    expect(lagOfKind(r, LagKind.ReleaseEvidenceMissing)[0]?.detail).toContain("logs, screenshots, traces");
    expect(lagOfKind(sweep({ releaseCandidates: [{ workId: "task-1", missingEvidence: [] }] }), LagKind.ReleaseEvidenceMissing)).toEqual([]);
  });

  test("a blocker owner who has not answered", () => {
    const asked = { workId: "task-1", ownerHatId: "security_engineer", askedAtMs: NOW - SLA, answered: false };
    expect(lagOfKind(sweep({ blocked: [asked], silenceSlaMs: SLA }), LagKind.BlockerOwnerSilent)).toHaveLength(1);
    expect(lagOfKind(sweep({ blocked: [{ ...asked, answered: true }], silenceSlaMs: SLA }), LagKind.BlockerOwnerSilent)).toEqual([]);
  });

  test("A QUEUE IS SATURATED AGAINST CAPACITY, not against a fixed number", () => {
    // Depth alone says nothing: ten items and five drainers is fine, ten and one is not. Comparing
    // depth to a constant would fire on a busy healthy queue and stay quiet on a stalled thin one.
    const deep = { queueId: "review", depth: 10, drainingHats: 5, perHatCapacity: 2 };
    expect(lagOfKind(sweep({ queues: [deep] }), LagKind.QueueSaturated)).toEqual([]);
    expect(lagOfKind(sweep({ queues: [{ ...deep, drainingHats: 1 }] }), LagKind.QueueSaturated)).toHaveLength(1);
  });

  test("REPEATED reassignment, not a single correction", () => {
    // One reassignment is the mechanism working — an owner went silent and somebody picked it up.
    // A second says the item keeps coming back, which is about the item rather than either owner.
    expect(REASSIGNMENT_THRESHOLD).toBe(2);
    expect(lagOfKind(sweep({ reassignments: new Map([["task-1", 1]]) }), LagKind.RepeatedReassignment)).toEqual([]);
    expect(lagOfKind(sweep({ reassignments: new Map([["task-1", 2]]) }), LagKind.RepeatedReassignment)).toHaveLength(1);
  });

  test("...and repeated findings are ORDINAL, not map-insertion order", () => {
    const r = sweep({ reassignments: new Map([["task-9", 3], ["task-2", 3], ["task-5", 3]]) });
    expect(lagOfKind(r, LagKind.RepeatedReassignment).map((f) => f.subjectId)).toEqual(["task-2", "task-5", "task-9"]);
  });

  test("an assignment running PAST its expected duration, exclusive at the boundary", () => {
    const long = { ...HEALTHY_ASSIGNMENT, startedAtMs: NOW - 20_000 };
    expect(lagOfKind(sweep({ assignments: [long], expectedDurationMs: 10_000 }), LagKind.AssignmentOverdue)).toHaveLength(1);
    expect(lagOfKind(sweep({ assignments: [long], expectedDurationMs: 30_000 }), LagKind.AssignmentOverdue)).toEqual([]);
    // EXACTLY the expected duration is on time. "Expected" is a budget, and spending all of it is
    // not overrunning it — firing here would report every assignment that lands on its estimate.
    expect(lagOfKind(sweep({ assignments: [long], expectedDurationMs: 20_000 }), LagKind.AssignmentOverdue)).toEqual([]);
    expect(lagOfKind(sweep({ assignments: [long], expectedDurationMs: 19_999 }), LagKind.AssignmentOverdue)).toHaveLength(1);
  });
});

describe("EVERY FINDING IS ADDRESSED TO SOMEBODY WHO CAN ACT ON IT", () => {
  test("a missing reviewer reaches the hat that provisions reviewers", () => {
    const r = sweep({ reviews: [{ workId: "task-1" }] });
    expect(lagOfKind(r, LagKind.ReviewerMissing)[0]?.ownerHatId).toBe("engineering_manager");
  });

  test("missing QA reaches QA, and a saturated queue reaches the allocator", () => {
    expect(lagOfKind(sweep({ qaReady: [{ workId: "t" }] }), LagKind.QaAssignmentMissing)[0]?.ownerHatId).toBe("qa_manager");
    expect(
      lagOfKind(sweep({ queues: [{ queueId: "q", depth: 9, drainingHats: 1, perHatCapacity: 2 }] }), LagKind.QueueSaturated)[0]?.ownerHatId,
    ).toBe("rmo_office");
  });

  test("A SILENT ASSIGNMENT REACHES THE SUPERVISOR, never the silent hat itself", () => {
    const r = sweep({ assignments: [{ ...HEALTHY_ASSIGNMENT, heartbeatAtMs: NOW - SLA }], silenceSlaMs: SLA });
    expect(lagOfKind(r, LagKind.AssignmentSilent)[0]?.ownerHatId).toBe("tech_lead");
  });

  test("AN UNANSWERED BLOCKER ESCALATES PAST the owner who did not answer", () => {
    // Addressing it to that same hat is a reminder, and a reminder is what already went unanswered.
    const r = sweep({
      blocked: [{ workId: "task-1", ownerHatId: "security_engineer", askedAtMs: NOW - SLA, answered: false }],
      silenceSlaMs: SLA,
    });
    expect(lagOfKind(r, LagKind.BlockerOwnerSilent)[0]?.ownerHatId).toBe("security_director");
  });

  test("no finding is addressed to nobody", () => {
    const r = sweep({
      cascade: [{ workId: "t", workType: WorkType.Task, title: "t", state: WorkState.Open, ownerHatId: "tech_lead" }],
      assignments: [{ ...HEALTHY_ASSIGNMENT, tokenExpiresMs: NOW - 1, heartbeatAtMs: NOW - SLA, startedAtMs: NOW - 99_999 }],
      silenceSlaMs: SLA,
      expectedDurationMs: 1,
      runs: [{ runId: "r" }],
      reservedSupply: [{ hatId: "h", reservedAtMs: NOW - SLA, taskStarted: false }],
      reservationSlaMs: SLA,
      reviews: [{ workId: "t" }],
      qaReady: [{ workId: "t" }],
      releaseCandidates: [{ workId: "t", missingEvidence: ["x"] }],
      blocked: [{ workId: "t", ownerHatId: "security_engineer", askedAtMs: NOW - SLA, answered: false }],
      queues: [{ queueId: "q", depth: 5, drainingHats: 0, perHatCapacity: 2 }],
      reassignments: new Map([["t", 4]]),
    });
    // All twelve fire at once, and every one of them names a real hat.
    expect(new Set(r.findings.map((f) => f.kind)).size).toBe(12);
    for (const f of r.findings) expect(chart.byId.has(f.ownerHatId)).toBe(true);
  });
});
