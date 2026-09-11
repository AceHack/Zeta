/**
 * observe-org.test.ts — what a person is shown when they are asked to approve something.
 *
 * The failure this pins is not a crash. It is a page that puts an Approve button over a gate NAME
 * and no artifact, so a person signs for a thing they were never shown — which is the rubber stamp
 * the fourteen gates exist to prevent, arriving one layer out where nothing is watching for it.
 *
 * Two properties carry the whole defence, and both are DERIVED from what the register itself wrote:
 *
 *   - `produced` — what the phase made, or `undefined` when it made nothing.
 *   - `rubberStamped` — whether the verdict was a simulated reviewer's default, read off the
 *     `auto-approved:` reference the runtime writes.
 */

import { describe, expect, test } from "bun:test";

import { viewOf } from "./observe-org";
import { OrgEventKind, type OrgEvent } from "./org-event";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";
import { WorkType } from "./goal-cascade";

function ev(over: Partial<OrgEvent> & { readonly fact: NonNullable<OrgEvent["fact"]> }): OrgEvent {
  return {
    id: "e1",
    kind: OrgEventKind.DecisionRecorded,
    atMs: 10,
    subjectId: "task-1",
    decision: "recorded",
    supervisorChain: [],
    evidenceRefs: [],
    ...over,
  };
}

/** The minimum log that puts one leaf work item on the board. */
const created = ev({
  id: "e0",
  kind: OrgEventKind.WorkItemTransition,
  atMs: 1,
  fact: {
    kind: "work_created",
    workId: "task-1",
    workType: WorkType.Task,
    title: "stop the double-apply",
    ownerHatId: "tech_lead",
  },
});

/** The assignment, as its own fact — the fold keeps creation and staffing apart. */
const assigned = ev({
  id: "e0b",
  kind: OrgEventKind.HatAssignment,
  atMs: 2,
  fact: { kind: "work_assigned", workId: "task-1", assigneeHatId: "backend_implementer" },
});

function verdicts(...list: readonly Partial<GateEvaluation>[]): OrgEvent {
  return ev({
    id: "ev-gates",
    kind: OrgEventKind.QualityGateEvaluation,
    atMs: 20,
    fact: {
      kind: "gates_evaluated",
      evaluations: list.map((o) => ({
        workId: "task-1",
        gate: GateKind.BusinessContextGrooming,
        outcome: GateOutcome.Approved,
        byHatId: "product_director",
        reason: "fine",
        atMs: 20,
        evidenceRefs: [],
        ...o,
      })),
    },
  });
}

const output = (gate: GateKind, refs: readonly string[], summary: string): OrgEvent =>
  ev({
    id: `out-${String(gate)}`,
    atMs: 15,
    fact: {
      kind: "phase_output",
      workId: "task-1",
      gate: String(gate),
      refs,
      summary,
      producedByHatId: "backend_implementer",
    },
  });

const stageOf = (events: readonly OrgEvent[], gate: GateKind) => {
  const v = viewOf(events, 1, 100);
  return v.work[0]?.stages.find((s) => s.gate === String(gate));
};

describe("WHAT AM I APPROVING — the phase's output reaches the person", () => {
  test("a phase that produced something shows what it produced", () => {
    const s = stageOf([created, assigned, output(GateKind.BrdApproval, ["docs/brd.md"], "the BRD, 3 requirements")], GateKind.BrdApproval);
    expect(s?.produced?.summary).toBe("the BRD, 3 requirements");
    expect(s?.produced?.refs).toEqual(["docs/brd.md"]);
  });

  test("a phase that produced NOTHING is undefined, not an empty document", () => {
    // The distinction the red banner rests on. An empty artifact would let the page render "here is
    // what was made" over nothing, which is worse than saying nothing was made.
    expect(stageOf([created, assigned], GateKind.BrdApproval)?.produced).toBeUndefined();
  });

  test("THE LATEST OUTPUT WINS — a reviewer is not shown the version already turned down", () => {
    const events = [
      created,
      { ...output(GateKind.BrdApproval, ["v1.md"], "first draft"), atMs: 15 },
      { ...output(GateKind.BrdApproval, ["v2.md"], "rewritten after rejection"), id: "out-2", atMs: 40 },
    ];
    expect(stageOf(events, GateKind.BrdApproval)?.produced?.summary).toBe("rewritten after rejection");
  });

  test("output is keyed by WORK AND GATE, so one item's BRD is not shown against another's", () => {
    const other = ev({
      id: "out-other",
      atMs: 15,
      subjectId: "task-2",
      fact: {
        kind: "phase_output",
        workId: "task-2",
        gate: String(GateKind.BrdApproval),
        refs: ["other.md"],
        summary: "somebody else's BRD",
        producedByHatId: "frontend_implementer",
      },
    });
    expect(stageOf([created, assigned, other], GateKind.BrdApproval)?.produced).toBeUndefined();
  });
});

describe("A DEFAULT IS NOT A JUDGEMENT, and the page must be able to tell them apart", () => {
  test("an auto-approved verdict is marked as not reviewed", () => {
    // Derived from the reference the runtime itself writes, never from a flag somebody could set.
    const s = stageOf(
      [created, assigned, verdicts({ evidenceRefs: ["auto-approved:business_context_grooming:task-1"] })],
      GateKind.BusinessContextGrooming,
    );
    expect(s?.state).toBe("passed");
    expect(s?.rubberStamped).toBe(true);
  });

  test("a verdict with real evidence is NOT marked — the mark is not blanket", () => {
    const s = stageOf(
      [created, assigned, verdicts({ evidenceRefs: ["test:qa/run-17.json"] })],
      GateKind.BusinessContextGrooming,
    );
    expect(s?.rubberStamped).toBe(false);
  });

  test("a person's approval is neither auto-approved nor anonymous", () => {
    const s = stageOf(
      [created, assigned, verdicts({ evidenceRefs: ["human-action/ha-7"] })],
      GateKind.BusinessContextGrooming,
    );
    expect(s?.byHuman).toBe(true);
    expect(s?.rubberStamped).toBe(false);
  });

  test("THE ITEM COUNTS THEM, because 'passed 14 gates' means less when 13 consulted nobody", () => {
    const v = viewOf(
      [
        created,
        verdicts(
          { gate: GateKind.BusinessContextGrooming, evidenceRefs: ["auto-approved:a:task-1"] },
          { gate: GateKind.CustomerRfpReview, evidenceRefs: ["auto-approved:b:task-1"] },
          { gate: GateKind.BrdApproval, evidenceRefs: ["human-action/ha-1"] },
        ),
      ],
      1,
      100,
    );
    expect(v.work[0]?.rubberStamped).toBe(2);
  });

  test("nothing is rubber-stamped in a log with no verdicts", () => {
    expect(viewOf([created, assigned], 1, 100).work[0]?.rubberStamped).toBe(0);
  });
});
