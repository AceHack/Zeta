import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  WorkItemState,
  WorkItemType,
  WorkItemSource,
  legalNextTransitions,
  transitionRequiresGates,
  workflowPolicyFor,
  type WorkItem,
} from "../src/index.ts";

function item(type: WorkItemType, state: WorkItemState): WorkItem {
  return {
    workItemId: "wi-1", organizationId: "org-lfg", workItemType: type, state,
    title: "t", description: "d", projectId: "proj-1", initiativeId: "init-1",
    source: WorkItemSource.Internal, createdAt: "2026-05-30T00:00:00.000Z",
    createdBy: { agentId: "a-1", hatAssignmentId: "ha-1" },
  };
}

test("all 9 work types have a workflow policy with an owner department", () => {
  for (const type of Object.values(WorkItemType)) {
    const p = workflowPolicyFor(type);
    equal(p.workItemType, type);
    ok(p.ownerDepartmentId.length > 0);
  }
});

test("legalNextTransitions follows the shared state machine and annotates gates", () => {
  // a feature task at triage may go to ready, gated by brd + architecture approval
  const t = legalNextTransitions(item(WorkItemType.Task, WorkItemState.Triage));
  const toReady = t.find((x) => x.toState === WorkItemState.Ready);
  ok(toReady, "triage→ready should be legal");
  equal(toReady!.requiredGates.includes("brd_approval"), true);
  equal(toReady!.requiredGates.includes("architecture_approval"), true);
});

test("feature review→done requires the QA + business gates (QA cannot be skipped)", () => {
  const gates = transitionRequiresGates(item(WorkItemType.Task, WorkItemState.Review), WorkItemState.Done);
  equal(gates.includes("runtime_validation"), true); // the QA gate
  equal(gates.includes("release_readiness"), true);
});

test("a defect fix must pass QA runtime validation to close", () => {
  const gates = transitionRequiresGates(item(WorkItemType.Defect, WorkItemState.Review), WorkItemState.Done);
  equal(gates.includes("runtime_validation"), true);
});

test("review→in_progress (QA bounce-back / rework) is always legal and gate-free", () => {
  const t = legalNextTransitions(item(WorkItemType.Defect, WorkItemState.Review));
  const rework = t.find((x) => x.toState === WorkItemState.InProgress);
  ok(rework, "review→in_progress rework must exist (the bounce-back path)");
  equal(rework!.requiredGates.length, 0);
});

test("service requests and reports flow with no heavy gates", () => {
  equal(transitionRequiresGates(item(WorkItemType.ServiceRequest, WorkItemState.Triage), WorkItemState.Ready).length, 0);
  equal(transitionRequiresGates(item(WorkItemType.Report, WorkItemState.Triage), WorkItemState.Ready).length, 0);
});
