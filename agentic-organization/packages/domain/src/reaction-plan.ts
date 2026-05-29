import type { SupervisorChainLevel } from "./supervisor-communication.ts";

export const ReactionPlanActionType = {
  CreateSupervisorTriage: "create_supervisor_triage",
  RequestImplementationAssignment: "request_implementation_assignment",
  RequestReviewGate: "request_review_gate",
} as const;

export type ReactionPlanActionType = (typeof ReactionPlanActionType)[keyof typeof ReactionPlanActionType];

export const RequiredHat = {
  CSuite: "c_suite",
  Director: "director",
  EngineeringManager: "engineering_manager",
  ExecutiveBoard: "executive_board",
  Reviewer: "reviewer",
} as const;

export type RequiredHat = (typeof RequiredHat)[keyof typeof RequiredHat];

export const ReactionPlanReason = {
  SupervisorSignalNeedsTriage: "supervisor signal needs triage",
  WorkItemEnteredReadyState: "work item entered ready state",
  WorkItemEnteredReviewState: "work item entered review state",
} as const;

export type ReactionPlanReason = (typeof ReactionPlanReason)[keyof typeof ReactionPlanReason];

export const ReactionPlanStatus = {
  Claimed: "claimed",
  Completed: "completed",
  Failed: "failed",
  Planned: "planned",
} as const;

export type ReactionPlanStatus = (typeof ReactionPlanStatus)[keyof typeof ReactionPlanStatus];

type BaseReactionPlanAction = {
  actionType: ReactionPlanActionType;
  triggerEventId: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId: string;
  requiredHat: RequiredHat;
  reason: ReactionPlanReason;
};

export type CreateSupervisorTriageReactionPlanAction = BaseReactionPlanAction & {
  actionType: typeof ReactionPlanActionType.CreateSupervisorTriage;
  supervisorSignalId: string;
  targetLevel: SupervisorChainLevel;
  requiredHat:
    | typeof RequiredHat.CSuite
    | typeof RequiredHat.Director
    | typeof RequiredHat.EngineeringManager
    | typeof RequiredHat.ExecutiveBoard;
  reason: typeof ReactionPlanReason.SupervisorSignalNeedsTriage;
};

export type RequestImplementationAssignmentReactionPlanAction = BaseReactionPlanAction & {
  actionType: typeof ReactionPlanActionType.RequestImplementationAssignment;
  requiredHat: typeof RequiredHat.EngineeringManager;
  reason: typeof ReactionPlanReason.WorkItemEnteredReadyState;
};

export type RequestReviewGateReactionPlanAction = BaseReactionPlanAction & {
  actionType: typeof ReactionPlanActionType.RequestReviewGate;
  requiredHat: typeof RequiredHat.Reviewer;
  reason: typeof ReactionPlanReason.WorkItemEnteredReviewState;
};

export type ReactionPlanAction =
  | CreateSupervisorTriageReactionPlanAction
  | RequestImplementationAssignmentReactionPlanAction
  | RequestReviewGateReactionPlanAction;
