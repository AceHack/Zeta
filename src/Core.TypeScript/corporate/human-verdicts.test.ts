import { describe, expect, test } from "bun:test";
import { humanRejectionEvents, humanRejectionsToRecord } from "./human-verdicts";
import { GateOutcome, type GateEvaluation, type GateKind } from "./quality-gate";
import type { HumanAction } from "./human-action";

const reject = (over: Partial<HumanAction> = {}): HumanAction =>
  ({
    actionId: "reject-1",
    kind: "reject_gate",
    byHuman: "max",
    atMs: 5,
    subjectId: "task-12",
    reason: "the reproduction runs against a replica of the component",
    detail: { gate: "reproduction" },
    ...over,
  }) as HumanAction;

const approved: GateEvaluation = {
  workId: "task-12",
  gate: "reproduction" as GateKind,
  outcome: GateOutcome.Approved,
  byHatId: "qa_director",
  reason: "reproduced",
  atMs: 100,
  evidenceRefs: [],
};

describe("A PERSON'S NO STANDS AT ANY STEP", () => {
  test("a rejection of a step an agent approved becomes that step's NEWEST verdict, with the person's reason and the action as evidence", () => {
    const out = humanRejectionsToRecord({ actions: [reject()], evaluations: [approved], known: new Set(["task-12"]), checkpointGates: new Set(), atMs: 101 });
    expect(out.length).toBe(1);
    expect(out[0]?.evaluation).toMatchObject({ outcome: GateOutcome.Rejected, byHatId: "person:max", atMs: 101, evidenceRefs: ["human-action/reject-1"] });
    expect(out[0]?.evaluation.atMs).toBeGreaterThan(approved.atMs);
    const events = humanRejectionEvents(out, () => "evt-9");
    expect(events[0]).toMatchObject({ id: "evt-9", kind: "quality_gate_evaluation", subjectId: "task-12" });
  });

  test("ONCE: a rejection already on the record is not written again - so a later approval of new work stands", () => {
    const recorded = { ...approved, outcome: GateOutcome.Rejected, atMs: 101, evidenceRefs: ["human-action/reject-1"] };
    const later = { ...approved, atMs: 200, reason: "reproduced on the real component" };
    expect(humanRejectionsToRecord({ actions: [reject()], evaluations: [approved, recorded, later], known: new Set(["task-12"]), checkpointGates: new Set(), atMs: 201 })).toEqual([]);
  });

  test("checkpoint gates keep their own path; work the organization does not have and approvals are not touched", () => {
    const base = { evaluations: [approved], known: new Set(["task-12"]), atMs: 101 };
    expect(humanRejectionsToRecord({ ...base, actions: [reject()], checkpointGates: new Set(["reproduction"]) })).toEqual([]);
    expect(humanRejectionsToRecord({ ...base, actions: [reject({ subjectId: "task-99" })], checkpointGates: new Set() })).toEqual([]);
    expect(humanRejectionsToRecord({ ...base, actions: [reject({ kind: "approve_gate" as never })], checkpointGates: new Set() })).toEqual([]);
  });
});
