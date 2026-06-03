export const ContextPackInboxAnchorPriority = {
  Normal: "normal",
  Urgent: "urgent",
} as const;

export type ContextPackInboxAnchorPriority =
  (typeof ContextPackInboxAnchorPriority)[keyof typeof ContextPackInboxAnchorPriority];

export const ContextPackInboxAnchorStatus = {
  Unread: "unread",
  Read: "read",
  Snoozed: "snoozed",
  Dismissed: "dismissed",
} as const;

export type ContextPackInboxAnchorStatus =
  (typeof ContextPackInboxAnchorStatus)[keyof typeof ContextPackInboxAnchorStatus];

export type ContextPackInboxAnchor = {
  inboxAnchorId: string;
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  title: string;
  summary: string;
  priority: ContextPackInboxAnchorPriority;
  status: ContextPackInboxAnchorStatus;
  deliveredAt: string;
  snoozedUntil?: string | undefined;
  sourceRef?: string | undefined;
  traceId?: string | undefined;
};

export type ContextPackInboxAnchorStatusTransition = {
  inboxAnchorId: string;
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  status: ContextPackInboxAnchorTerminalStatus;
  changedAt: string;
  snoozedUntil?: string | undefined;
  traceId?: string | undefined;
};

export type ContextPackInboxAnchorTerminalStatus =
  | typeof ContextPackInboxAnchorStatus.Read
  | typeof ContextPackInboxAnchorStatus.Snoozed
  | typeof ContextPackInboxAnchorStatus.Dismissed;

export function isContextPackInboxAnchorPriority(value: unknown): value is ContextPackInboxAnchorPriority {
  return typeof value === "string" &&
    Object.values(ContextPackInboxAnchorPriority).includes(value as ContextPackInboxAnchorPriority);
}

export function isContextPackInboxAnchorStatus(value: unknown): value is ContextPackInboxAnchorStatus {
  return typeof value === "string" &&
    Object.values(ContextPackInboxAnchorStatus).includes(value as ContextPackInboxAnchorStatus);
}

export function isContextPackInboxAnchorTerminalStatus(
  value: unknown,
): value is ContextPackInboxAnchorTerminalStatus {
  return value === ContextPackInboxAnchorStatus.Read ||
    value === ContextPackInboxAnchorStatus.Snoozed ||
    value === ContextPackInboxAnchorStatus.Dismissed;
}
