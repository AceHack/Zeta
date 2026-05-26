import type { SupervisorChainLevel } from "./supervisor-communication.ts";

export const ReactionPlanActionType = {
  CreateSupervisorTriage: "create_supervisor_triage",
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
} as const;

export type ReactionPlanReason = (typeof ReactionPlanReason)[keyof typeof ReactionPlanReason];

export const ReactionPlanStatus = {
  Planned: "planned",
} as const;

export type ReactionPlanStatus = (typeof ReactionPlanStatus)[keyof typeof ReactionPlanStatus];

export type ReactionPlanAction = {
  actionType: ReactionPlanActionType;
  triggerEventId: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId: string;
  supervisorSignalId?: string;
  targetLevel?: SupervisorChainLevel;
  requiredHat: RequiredHat;
  reason: ReactionPlanReason;
};
