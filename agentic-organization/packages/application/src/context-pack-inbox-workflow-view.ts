import {
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  type ContextPackInboxAnchor,
  type ContextPackInboxAnchorStatus as ContextPackInboxAnchorStatusType,
} from "../../domain/src/index.ts";
export {
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  type ContextPackInboxAnchor,
} from "../../domain/src/index.ts";

export const ContextPackInboxWorkflowBatchKind = {
  UrgentUnread: "urgent_unread",
  NormalUnread: "normal_unread",
  SnoozedDue: "snoozed_due",
  SnoozedFuture: "snoozed_future",
  Read: "read",
} as const;

export type ContextPackInboxWorkflowBatchKind =
  (typeof ContextPackInboxWorkflowBatchKind)[keyof typeof ContextPackInboxWorkflowBatchKind];

export const ContextPackInboxWorkflowActionKind = {
  MarkRead: "mark_read",
  Snooze: "snooze",
  Dismiss: "dismiss",
} as const;

export type ContextPackInboxWorkflowActionKind =
  (typeof ContextPackInboxWorkflowActionKind)[keyof typeof ContextPackInboxWorkflowActionKind];

export type ContextPackInboxWorkflowAction = {
  kind: ContextPackInboxWorkflowActionKind;
  targetStatus: ContextPackInboxAnchorStatusType;
  requiresSnoozedUntil: boolean;
};

export type ContextPackInboxWorkflowItem = {
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
  actions: readonly ContextPackInboxWorkflowAction[];
};

export type ContextPackInboxWorkflowBatch = {
  kind: ContextPackInboxWorkflowBatchKind;
  items: readonly ContextPackInboxWorkflowItem[];
};

export type ContextPackInboxWorkflowSummary = {
  totalVisibleCount: number;
  urgentUnreadCount: number;
  normalUnreadCount: number;
  readCount: number;
  snoozedDueCount: number;
  snoozedFutureCount: number;
};

export type ContextPackInboxWorkflowView = {
  organizationId: string;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  observedAt: string;
  summary: ContextPackInboxWorkflowSummary;
  batches: readonly ContextPackInboxWorkflowBatch[];
};

export type ContextPackInboxWorkflowViewInput = {
  organizationId: string;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  observedAt: string;
  inboxAnchors: readonly ContextPackInboxAnchor[];
};

const CONTEXT_PACK_INBOX_WORKFLOW_BATCH_ORDER: readonly ContextPackInboxWorkflowBatchKind[] = [
  ContextPackInboxWorkflowBatchKind.UrgentUnread,
  ContextPackInboxWorkflowBatchKind.NormalUnread,
  ContextPackInboxWorkflowBatchKind.SnoozedDue,
  ContextPackInboxWorkflowBatchKind.SnoozedFuture,
  ContextPackInboxWorkflowBatchKind.Read,
];

const CONTEXT_PACK_INBOX_WORKFLOW_ACTIONS: readonly ContextPackInboxWorkflowAction[] = [
  {
    kind: ContextPackInboxWorkflowActionKind.MarkRead,
    targetStatus: ContextPackInboxAnchorStatus.Read,
    requiresSnoozedUntil: false,
  },
  {
    kind: ContextPackInboxWorkflowActionKind.Snooze,
    targetStatus: ContextPackInboxAnchorStatus.Snoozed,
    requiresSnoozedUntil: true,
  },
  {
    kind: ContextPackInboxWorkflowActionKind.Dismiss,
    targetStatus: ContextPackInboxAnchorStatus.Dismissed,
    requiresSnoozedUntil: false,
  },
];

export function contextPackInboxWorkflowViewFor(
  input: ContextPackInboxWorkflowViewInput,
): ContextPackInboxWorkflowView {
  const items = input.inboxAnchors
    .filter((anchor) => contextPackInboxAnchorMatchesWorkflowInput(anchor, input))
    .filter((anchor) => anchor.status !== ContextPackInboxAnchorStatus.Dismissed)
    .map(contextPackInboxWorkflowItemFor)
    .sort(compareContextPackInboxWorkflowItem);
  const batches = CONTEXT_PACK_INBOX_WORKFLOW_BATCH_ORDER
    .map((kind) => ({
      kind,
      items: items.filter((item) => contextPackInboxWorkflowBatchKindFor(item, input.observedAt) === kind),
    }))
    .filter((batch) => batch.items.length > 0);

  return {
    organizationId: input.organizationId,
    targetHatAssignmentId: input.targetHatAssignmentId,
    ...(input.targetAgentId === undefined ? {} : { targetAgentId: input.targetAgentId }),
    observedAt: input.observedAt,
    summary: contextPackInboxWorkflowSummaryFor(items, input.observedAt),
    batches,
  };
}

function contextPackInboxAnchorMatchesWorkflowInput(
  anchor: ContextPackInboxAnchor,
  input: ContextPackInboxWorkflowViewInput,
): boolean {
  return anchor.organizationId === input.organizationId &&
    anchor.targetHatAssignmentId === input.targetHatAssignmentId &&
    (anchor.targetAgentId === undefined || anchor.targetAgentId === input.targetAgentId);
}

function contextPackInboxWorkflowItemFor(anchor: ContextPackInboxAnchor): ContextPackInboxWorkflowItem {
  return {
    inboxAnchorId: anchor.inboxAnchorId,
    organizationId: anchor.organizationId,
    projectId: anchor.projectId,
    ...(anchor.teamId === undefined ? {} : { teamId: anchor.teamId }),
    ...(anchor.workItemId === undefined ? {} : { workItemId: anchor.workItemId }),
    targetHatAssignmentId: anchor.targetHatAssignmentId,
    ...(anchor.targetAgentId === undefined ? {} : { targetAgentId: anchor.targetAgentId }),
    title: anchor.title,
    summary: anchor.summary,
    priority: anchor.priority,
    status: anchor.status,
    deliveredAt: anchor.deliveredAt,
    ...(anchor.snoozedUntil === undefined ? {} : { snoozedUntil: anchor.snoozedUntil }),
    ...(anchor.sourceRef === undefined ? {} : { sourceRef: anchor.sourceRef }),
    ...(anchor.traceId === undefined ? {} : { traceId: anchor.traceId }),
    actions: CONTEXT_PACK_INBOX_WORKFLOW_ACTIONS.map((action) => ({ ...action })),
  };
}

function compareContextPackInboxWorkflowItem(
  a: ContextPackInboxWorkflowItem,
  b: ContextPackInboxWorkflowItem,
): number {
  const priorityDelta = priorityRankFor(a.priority) - priorityRankFor(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  const deliveredDelta = Date.parse(a.deliveredAt) - Date.parse(b.deliveredAt);
  if (deliveredDelta !== 0) return deliveredDelta;
  return a.inboxAnchorId.localeCompare(b.inboxAnchorId);
}

function priorityRankFor(priority: ContextPackInboxAnchorPriority): number {
  return priority === ContextPackInboxAnchorPriority.Urgent ? 0 : 1;
}

function contextPackInboxWorkflowBatchKindFor(
  item: ContextPackInboxWorkflowItem,
  observedAt: string,
): ContextPackInboxWorkflowBatchKind {
  if (item.status === ContextPackInboxAnchorStatus.Read) {
    return ContextPackInboxWorkflowBatchKind.Read;
  }
  if (item.status === ContextPackInboxAnchorStatus.Snoozed) {
    return contextPackInboxAnchorSnoozedUntilIsDue(item.snoozedUntil, observedAt)
      ? ContextPackInboxWorkflowBatchKind.SnoozedDue
      : ContextPackInboxWorkflowBatchKind.SnoozedFuture;
  }
  return item.priority === ContextPackInboxAnchorPriority.Urgent
    ? ContextPackInboxWorkflowBatchKind.UrgentUnread
    : ContextPackInboxWorkflowBatchKind.NormalUnread;
}

function contextPackInboxAnchorSnoozedUntilIsDue(
  snoozedUntil: string | undefined,
  observedAt: string,
): boolean {
  if (snoozedUntil === undefined) return false;
  const snoozedUntilMs = Date.parse(snoozedUntil);
  const observedAtMs = Date.parse(observedAt);
  return Number.isFinite(snoozedUntilMs) && Number.isFinite(observedAtMs) && snoozedUntilMs <= observedAtMs;
}

function contextPackInboxWorkflowSummaryFor(
  items: readonly ContextPackInboxWorkflowItem[],
  observedAt: string,
): ContextPackInboxWorkflowSummary {
  return {
    totalVisibleCount: items.length,
    urgentUnreadCount: itemCountForBatch(items, observedAt, ContextPackInboxWorkflowBatchKind.UrgentUnread),
    normalUnreadCount: itemCountForBatch(items, observedAt, ContextPackInboxWorkflowBatchKind.NormalUnread),
    readCount: itemCountForBatch(items, observedAt, ContextPackInboxWorkflowBatchKind.Read),
    snoozedDueCount: itemCountForBatch(items, observedAt, ContextPackInboxWorkflowBatchKind.SnoozedDue),
    snoozedFutureCount: itemCountForBatch(items, observedAt, ContextPackInboxWorkflowBatchKind.SnoozedFuture),
  };
}

function itemCountForBatch(
  items: readonly ContextPackInboxWorkflowItem[],
  observedAt: string,
  kind: ContextPackInboxWorkflowBatchKind,
): number {
  return items.filter((item) => contextPackInboxWorkflowBatchKindFor(item, observedAt) === kind).length;
}
