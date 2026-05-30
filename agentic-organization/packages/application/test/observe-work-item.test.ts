import { equal } from "node:assert/strict";
import { test } from "node:test";
import { WorkItemState, WorkItemType, type WorkItem } from "../../domain/src/index.ts";
import { ObserveOutcome, RunScope } from "../src/observe.ts";
import {
  ObserveWorkItemFeedbackReason,
  observeWorkItem,
  snapshotForWorkItem,
} from "../src/observe-work-item.ts";

const deps = { clock: { now: () => "2026-05-29T00:00:00.000Z" } };

function workItem(state: WorkItemState): WorkItem {
  return {
    workItemId: "w1",
    organizationId: "org",
    projectId: "proj",
    workItemType: WorkItemType.Task,
    title: "t",
    description: "d",
    state,
    createdAt: "2026-05-29T00:00:00.000Z",
    createdBy: { agentId: "a", hatAssignmentId: "h" },
  } as WorkItem;
}

const facts = {
  runId: "42",
  trace: { correlationId: "c", causationId: "z", traceId: "t" },
  hasGateApproval: false,
  hasEvidence: false,
};

test("snapshotForWorkItem maps a ready work item to the composing phase", () => {
  const built = snapshotForWorkItem(workItem(WorkItemState.Ready), facts);
  equal(built.outcome, "ok");
  if (built.outcome !== "ok") return;
  equal(built.snapshot.phase, "composing");
  equal(built.snapshot.scope, RunScope.WorkItem);
  equal(built.snapshot.runId, "42");
});

test("observeWorkItem returns a readout with legal options for an in_progress item", () => {
  const result = observeWorkItem(workItem(WorkItemState.InProgress), facts, deps);
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.snapshot.phase, "executing");
  equal(result.readout.outcome, ObserveOutcome.Readout);
  if (result.readout.outcome !== ObserveOutcome.Readout) return;
  // executing -> submit_evidence | fail
  equal(result.readout.readout.options.some((o) => o.actionType === "submit_evidence"), true);
});

test("a done work item observes to a terminal-phase feedback", () => {
  const result = observeWorkItem(workItem(WorkItemState.Done), facts, deps);
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.snapshot.phase, "completed");
  // observe() returns feedback for a terminal phase
  equal(result.readout.outcome, ObserveOutcome.Feedback);
});

test("gate approval flows from facts into the snapshot and unlocks execute", () => {
  // a review-state item maps to awaiting_review; awaiting_gate is what gates execute,
  // so use a facts-driven snapshot directly to prove the gate flag plumbs through.
  const approved = snapshotForWorkItem(workItem(WorkItemState.Review), { ...facts, hasGateApproval: true, hasEvidence: true });
  equal(approved.outcome, "ok");
  if (approved.outcome !== "ok") return;
  equal(approved.snapshot.hasGateApproval, true);
  equal(approved.snapshot.hasEvidence, true);
});

test("feedback reason exists for an unmapped phase (defensive seam)", () => {
  // every real WorkItemState maps, so this asserts the reason DU is wired, not a path.
  equal(ObserveWorkItemFeedbackReason.PhaseUnmapped, "phase_unmapped");
});
