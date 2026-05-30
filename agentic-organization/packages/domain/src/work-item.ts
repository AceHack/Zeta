/**
 * WorkItem — the unified spine of the Work OS (WORK_OS_OVERHAUL_GAPS_AND_DESIGN
 * §C1). A typed work item moves through a TYPE-SPECIFIC workflow layered over the
 * small shared WorkItemState enum: the shared states stay stable, while each type
 * (task/defect/release/…) declares which transitions are legal and which gates
 * they require. This unifies the three previously-separate work models.
 *
 * `legalNextTransitions(item)` is the work-item-scope "legal set" the observe →
 * decide kernel consumes: determinism computes the legal transitions + the gates
 * each requires; the agent chooser picks one; the gate-veto is applied at decide
 * time the same way observe.ts vetoes options that require an unapproved gate.
 */

import {
  WorkItemState,
  WorkItemType,
  baseLegalNextStates,
} from "./work-item-state-machine.ts";
import type { WorkItem } from "./records.ts";

/** A legal transition + the gates that must be approved before it may be taken. */
export type LegalTransition = {
  toState: WorkItemState;
  requiredGates: readonly string[];
};

/**
 * Type-specific workflow policy: which department owns the type and which gates a
 * given (from → to) transition requires. Declared as DATA (WORK_OS §Custom
 * Workflow Builder) so a new work type is a one-record change, not new code.
 */
export type WorkflowPolicy = {
  workItemType: WorkItemType;
  ownerDepartmentId: string;
  /** gates required to take a transition, keyed "from->to"; absent = no gate. */
  gatesByTransition: Readonly<Record<string, readonly string[]>>;
};

const key = (from: WorkItemState, to: WorkItemState): string => `${from}->${to}`;

/**
 * The QA gate is required to leave review → done for any type that ships product
 * behavior; a QA failure is modeled as the existing review → in_progress rework
 * transition (the bounce-back churn signal, §C4.2). The 7 business gates remain
 * the task/feature workflow (pipeline.ts) and are required across the build.
 */
const FEATURE_GATES: Readonly<Record<string, readonly string[]>> = {
  [key(WorkItemState.Triage, WorkItemState.Ready)]: ["brd_approval", "architecture_approval"],
  [key(WorkItemState.InProgress, WorkItemState.Review)]: ["implementation_review"],
  [key(WorkItemState.Review, WorkItemState.Done)]: ["runtime_validation", "final_business_validation", "release_readiness"],
};

const DEFECT_GATES: Readonly<Record<string, readonly string[]>> = {
  // defect triage→ready guard already enforced by assertWorkItemTransition (evidence);
  // a fix must pass QA runtime validation before it can close.
  [key(WorkItemState.Review, WorkItemState.Done)]: ["runtime_validation"],
};

const NO_GATES: Readonly<Record<string, readonly string[]>> = {};

export const WORKFLOW_POLICIES: Readonly<Record<WorkItemType, WorkflowPolicy>> = {
  [WorkItemType.Goal]: { workItemType: WorkItemType.Goal, ownerDepartmentId: "product_and_customer_discovery", gatesByTransition: { [key(WorkItemState.Triage, WorkItemState.Ready)]: ["brd_approval"] } },
  [WorkItemType.Report]: { workItemType: WorkItemType.Report, ownerDepartmentId: "observability_and_evidence", gatesByTransition: NO_GATES },
  [WorkItemType.ServiceRequest]: { workItemType: WorkItemType.ServiceRequest, ownerDepartmentId: "operations_and_infrastructure", gatesByTransition: NO_GATES },
  [WorkItemType.Task]: { workItemType: WorkItemType.Task, ownerDepartmentId: "engineering", gatesByTransition: FEATURE_GATES },
  [WorkItemType.Defect]: { workItemType: WorkItemType.Defect, ownerDepartmentId: "engineering", gatesByTransition: DEFECT_GATES },
  [WorkItemType.CapabilityRequest]: { workItemType: WorkItemType.CapabilityRequest, ownerDepartmentId: "capability_and_automation_expansion", gatesByTransition: { [key(WorkItemState.Triage, WorkItemState.Ready)]: ["architecture_approval"] } },
  [WorkItemType.Review]: { workItemType: WorkItemType.Review, ownerDepartmentId: "engineering_management", gatesByTransition: NO_GATES },
  [WorkItemType.Incident]: { workItemType: WorkItemType.Incident, ownerDepartmentId: "operations_and_infrastructure", gatesByTransition: NO_GATES },
  [WorkItemType.Release]: { workItemType: WorkItemType.Release, ownerDepartmentId: "delivery_and_release", gatesByTransition: { [key(WorkItemState.Review, WorkItemState.Done)]: ["release_readiness"] } },
};

export function workflowPolicyFor(type: WorkItemType): WorkflowPolicy {
  return WORKFLOW_POLICIES[type];
}

/**
 * The work-item-scope LEGAL SET: the transitions allowed from the item's current
 * state for its type, each annotated with the gates it requires. Pure; the gate
 * veto (are those gates approved?) is applied by the caller at decide time.
 */
export function legalNextTransitions(item: WorkItem): readonly LegalTransition[] {
  const policy = workflowPolicyFor(item.workItemType);
  return baseLegalNextStates(item.state).map((toState) => {
    const gates = policy.gatesByTransition[key(item.state, toState)] ?? [];
    return { toState, requiredGates: gates };
  });
}

/** Whether a (from→to) for this item's type requires no outstanding gate. */
export function transitionRequiresGates(item: WorkItem, toState: WorkItemState): readonly string[] {
  return workflowPolicyFor(item.workItemType).gatesByTransition[key(item.state, toState)] ?? [];
}
