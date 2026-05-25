export const SupervisorChainLevel = {
  TeamMember: "team_member",
  Manager: "manager",
  Director: "director",
  CSuite: "c_suite",
  ExecutiveBoard: "executive_board",
} as const;

export type SupervisorChainLevel = (typeof SupervisorChainLevel)[keyof typeof SupervisorChainLevel];

export const SupervisorSignalToolType = {
  AskQuestion: "ask_question",
  ReportBlocker: "report_blocker",
  RequestDecision: "request_decision",
  RequestResource: "request_resource",
  RequestReview: "request_review",
  ReportRisk: "report_risk",
  SuggestImprovement: "suggest_improvement",
  RequestEscalation: "request_escalation",
} as const;

export type SupervisorSignalToolType = (typeof SupervisorSignalToolType)[keyof typeof SupervisorSignalToolType];

export const SupervisorSignalStatus = {
  Sent: "sent",
  Acknowledged: "acknowledged",
  Triaged: "triaged",
  Routed: "routed",
  Closed: "closed",
} as const;

export type SupervisorSignalStatus = (typeof SupervisorSignalStatus)[keyof typeof SupervisorSignalStatus];

export const SupervisorTriageActionType = {
  AnswerDirectly: "answer_directly",
  OpenWorkItem: "open_work_item",
  EscalateToNextSupervisor: "escalate_to_next_supervisor",
  RequestSecurityReview: "request_security_review",
  ScheduleDiscussion: "schedule_discussion",
  RouteToInternalPlatform: "route_to_internal_platform",
} as const;

export type SupervisorTriageActionType = (typeof SupervisorTriageActionType)[keyof typeof SupervisorTriageActionType];
