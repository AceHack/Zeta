import { WorkItemState, WorkItemType } from "./work-item-state-machine.ts";

/**
 * State Reconciliation Table — the North-Star-mandated single authoritative
 * mapping that prevents Work OS / V0 schema / UI / event names / observe.ts
 * from diverging (see docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md "State Name
 * Divergence").
 *
 * Every distinct kind of fact here is an explicit DU; substantively-distinct
 * states are never buried in if-chains or optional fields (repo rule
 * IMPLICIT-NOT-EXPLICIT is class error).
 */

/**
 * The party that owns the quality gate guarding entry into / exit from a state.
 * Explicit DU rather than a free string so gate ownership is enumerable and
 * exhaustively checkable.
 */
export const GateOwner = {
  None: "none",
  EngineeringManager: "engineering_manager",
  CodeReviewer: "code_reviewer",
  QaReviewer: "qa_reviewer",
  ReleaseManager: "release_manager",
} as const;

export type GateOwner = (typeof GateOwner)[keyof typeof GateOwner];

/**
 * One reconciliation row per WorkItemState value. Maps the V0 enum state to its
 * conceptual Work OS name, UI column, event name, owning package, and gate owner.
 */
export type StateReconciliationRow = {
  workItemState: WorkItemState;
  conceptualWorkOsState: string;
  uiColumn: string;
  eventName: string;
  ownerPackage: string;
  gateOwner: GateOwner;
};

/**
 * State transitions emit the real AgenticEventType "work_item.state_changed"
 * event (see packages/domain/src/event-envelope.ts). Every row uses this
 * single event name because reaching a state IS a state transition.
 */
const STATE_CHANGED_EVENT = "work_item.state_changed";

const DOMAIN_PACKAGE = "packages/domain";

/**
 * The reconciliation map — keyed by WorkItemState so the mapping is
 * COMPILE-EXHAUSTIVE: adding a WorkItemState value makes this object literal a
 * type error until a row is supplied (OCP — a new variant breaks the build, not
 * just a runtime test). Values are consistent with the docs (created -> "Backlog"
 * UI column, done -> "Done" with a release gate).
 */
const STATE_RECONCILIATION_MAP: Readonly<Record<WorkItemState, StateReconciliationRow>> = {
  [WorkItemState.Created]: {
    workItemState: WorkItemState.Created,
    conceptualWorkOsState: "Captured",
    uiColumn: "Backlog",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // Nothing gates capture; a work item simply exists once created.
    gateOwner: GateOwner.None,
  },
  [WorkItemState.Intake]: {
    workItemState: WorkItemState.Intake,
    conceptualWorkOsState: "Intake",
    uiColumn: "Backlog",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // Intake is an internal grooming step before triage; no gate owner yet.
    gateOwner: GateOwner.None,
  },
  [WorkItemState.Triage]: {
    workItemState: WorkItemState.Triage,
    conceptualWorkOsState: "Triage",
    uiColumn: "Triage",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // Engineering management owns the decision to promote triaged work to ready.
    gateOwner: GateOwner.EngineeringManager,
  },
  [WorkItemState.Ready]: {
    workItemState: WorkItemState.Ready,
    conceptualWorkOsState: "Ready",
    uiColumn: "Ready",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // Engineering management owns assignment + scheduling before in_progress.
    gateOwner: GateOwner.EngineeringManager,
  },
  [WorkItemState.InProgress]: {
    workItemState: WorkItemState.InProgress,
    conceptualWorkOsState: "In Progress",
    uiColumn: "In Progress",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // No external gate while engineering executes; the run loop governs it.
    gateOwner: GateOwner.None,
  },
  [WorkItemState.Blocked]: {
    workItemState: WorkItemState.Blocked,
    conceptualWorkOsState: "Blocked",
    uiColumn: "Blocked",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // Engineering management owns blocker resolution / re-prioritisation.
    gateOwner: GateOwner.EngineeringManager,
  },
  [WorkItemState.Review]: {
    workItemState: WorkItemState.Review,
    conceptualWorkOsState: "In Review",
    uiColumn: "Review",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // Code review gates the review -> done transition.
    gateOwner: GateOwner.CodeReviewer,
  },
  [WorkItemState.Done]: {
    workItemState: WorkItemState.Done,
    conceptualWorkOsState: "Done",
    uiColumn: "Done",
    eventName: STATE_CHANGED_EVENT,
    ownerPackage: DOMAIN_PACKAGE,
    // Release management owns the terminal release gate.
    gateOwner: GateOwner.ReleaseManager,
  },
};

/**
 * The 8 reconciliation rows as a list, derived from the compile-exhaustive map
 * for iteration/rendering. One row per WorkItemState, no dupes, no gaps.
 */
export const STATE_RECONCILIATION: readonly StateReconciliationRow[] =
  Object.values(STATE_RECONCILIATION_MAP);

/**
 * Lookup the reconciliation row for a given WorkItemState. Total over the 8
 * enumerated states (the map is exhaustive), but the signature stays honest
 * about a lookup with an out-of-enum value.
 */
export function reconcileState(state: WorkItemState): StateReconciliationRow | undefined {
  return STATE_RECONCILIATION_MAP[state];
}

/**
 * observe.ts binding — maps each WorkItemState to the observe.ts
 * RunLifecyclePhase string it corresponds to. Values are the literal
 * RunLifecyclePhase strings from packages/application/src/observe.ts. We hold
 * the strings (not the imported const) so the domain package does not depend on
 * the application package; a test asserts coverage of all 8 states.
 *
 * Per-state rationale:
 *  - created/intake/triage: the work item is not yet actionable by a run, so it
 *    sits in the run-loop's "observing" phase (run is watching for legal moves).
 *  - ready: the run has a selectable work item and begins "composing" a plan.
 *  - in_progress: side-effecting work is happening -> "executing".
 *  - blocked: directly maps to observe.ts "blocked".
 *  - review: a reviewer is being awaited -> "awaiting_review".
 *  - done: terminal success -> "completed".
 */
export const RUN_PHASE_FOR_STATE: Readonly<Record<WorkItemState, string>> = {
  [WorkItemState.Created]: "observing",
  [WorkItemState.Intake]: "observing",
  [WorkItemState.Triage]: "observing",
  [WorkItemState.Ready]: "composing",
  [WorkItemState.InProgress]: "executing",
  [WorkItemState.Blocked]: "blocked",
  [WorkItemState.Review]: "awaiting_review",
  [WorkItemState.Done]: "completed",
};

/**
 * The observe.ts RunLifecyclePhase string for a given WorkItemState.
 */
export function runPhaseForState(state: WorkItemState): string {
  return RUN_PHASE_FOR_STATE[state];
}

/**
 * A type-specific lifecycle rule: a transition constraint that applies only to
 * particular WorkItemType values (distinct from the generic transitions in
 * work-item-state-machine.ts which apply to all types).
 *
 * Explicit tagged DU keyed by `kind` so each rule class is enumerable and the
 * distinct rule shapes are not buried in optional fields.
 */
export const TypeSpecificRuleKind = {
  NoSkipIntake: "no_skip_intake",
  RequiresTriageEvidence: "requires_triage_evidence",
  RequiresAssignedEngineerAndSchedule: "requires_assigned_engineer_and_schedule",
} as const;

export type TypeSpecificRuleKind = (typeof TypeSpecificRuleKind)[keyof typeof TypeSpecificRuleKind];

export type TypeSpecificRule =
  | {
      kind: typeof TypeSpecificRuleKind.NoSkipIntake;
      fromState: WorkItemState;
      toState: WorkItemState;
      requirement: string;
    }
  | {
      kind: typeof TypeSpecificRuleKind.RequiresTriageEvidence;
      fromState: WorkItemState;
      toState: WorkItemState;
      requirement: string;
    }
  | {
      kind: typeof TypeSpecificRuleKind.RequiresAssignedEngineerAndSchedule;
      fromState: WorkItemState;
      toState: WorkItemState;
      requirement: string;
    };

/**
 * Defect-specific lifecycle rules. These encode the North Star requirement that
 * a defect cannot skip created/intake, cannot reach ready without triage
 * evidence, and cannot reach in_progress without an assigned + scheduled
 * engineer. They mirror assertDefectTransitionRequirements in
 * work-item-state-machine.ts.
 */
const DEFECT_RULES: readonly TypeSpecificRule[] = [
  {
    kind: TypeSpecificRuleKind.NoSkipIntake,
    fromState: WorkItemState.Created,
    toState: WorkItemState.Intake,
    requirement: "a defect must start in created and pass through intake; it cannot skip created/intake",
  },
  {
    kind: TypeSpecificRuleKind.RequiresTriageEvidence,
    fromState: WorkItemState.Triage,
    toState: WorkItemState.Ready,
    requirement: "a defect cannot reach ready without triage fields and required evidence",
  },
  {
    kind: TypeSpecificRuleKind.RequiresAssignedEngineerAndSchedule,
    fromState: WorkItemState.Ready,
    toState: WorkItemState.InProgress,
    requirement: "a defect cannot reach in_progress without an assigned engineer and a scheduled work block",
  },
];

/**
 * Tasks carry no additional type-specific rules beyond the generic transitions;
 * they are a (possibly empty) subset of the defect rule set.
 */
const TASK_RULES: readonly TypeSpecificRule[] = [];

/**
 * The type-specific transition rules for a given WorkItemType, projected to the
 * { fromState, toState, requirement } shape the gate consumer needs. Generic
 * transitions (which apply to every type) live in work-item-state-machine.ts;
 * this returns only the TYPE-SPECIFIC overlay.
 */
export function typeSpecificRulesFor(
  type: WorkItemType,
): readonly { fromState: WorkItemState; toState: WorkItemState; requirement: string }[] {
  const rules = type === WorkItemType.Defect ? DEFECT_RULES : TASK_RULES;
  return rules.map((rule) => ({
    fromState: rule.fromState,
    toState: rule.toState,
    requirement: rule.requirement,
  }));
}
