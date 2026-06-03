import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  ContextPackInboxWorkflowActionKind,
  ContextPackInboxWorkflowBatchKind,
  contextPackInboxWorkflowViewFor,
  type ContextPackInboxAnchor,
} from "../src/index.ts";

const observedAt = "2026-06-03T12:00:00.000Z";

test("context pack inbox workflow view batches active per-hat anchors with safe status actions", () => {
  const view = contextPackInboxWorkflowViewFor({
    observedAt,
    organizationId: "org-1",
    targetHatAssignmentId: "hat-director",
    targetAgentId: "agent-director",
    inboxAnchors: [
      inboxAnchor({
        inboxAnchorId: "normal-unread",
        priority: ContextPackInboxAnchorPriority.Normal,
        deliveredAt: "2026-06-03T10:00:00.000Z",
      }),
      inboxAnchor({
        inboxAnchorId: "urgent-unread-newer",
        priority: ContextPackInboxAnchorPriority.Urgent,
        deliveredAt: "2026-06-03T11:00:00.000Z",
      }),
      inboxAnchor({
        inboxAnchorId: "urgent-unread-older",
        priority: ContextPackInboxAnchorPriority.Urgent,
        deliveredAt: "2026-06-03T09:00:00.000Z",
      }),
      inboxAnchor({
        inboxAnchorId: "read-anchor",
        status: ContextPackInboxAnchorStatus.Read,
        deliveredAt: "2026-06-03T08:00:00.000Z",
      }),
      inboxAnchor({
        inboxAnchorId: "due-snoozed",
        status: ContextPackInboxAnchorStatus.Snoozed,
        snoozedUntil: "2026-06-03T11:59:00.000Z",
      }),
      inboxAnchor({
        inboxAnchorId: "future-snoozed",
        status: ContextPackInboxAnchorStatus.Snoozed,
        snoozedUntil: "2026-06-03T13:00:00.000Z",
      }),
      inboxAnchor({
        inboxAnchorId: "dismissed-hidden",
        status: ContextPackInboxAnchorStatus.Dismissed,
      }),
      inboxAnchor({
        inboxAnchorId: "other-hat-hidden",
        targetHatAssignmentId: "hat-other",
      }),
      inboxAnchor({
        inboxAnchorId: "other-agent-hidden",
        targetAgentId: "agent-other",
      }),
    ],
  });

  equal(view.targetHatAssignmentId, "hat-director");
  equal(view.targetAgentId, "agent-director");
  deepEqual(view.summary, {
    totalVisibleCount: 6,
    urgentUnreadCount: 2,
    normalUnreadCount: 1,
    readCount: 1,
    snoozedDueCount: 1,
    snoozedFutureCount: 1,
  });
  deepEqual(view.batches.map((batch) => ({
    kind: batch.kind,
    count: batch.items.length,
    ids: batch.items.map((item) => item.inboxAnchorId),
  })), [
    {
      kind: ContextPackInboxWorkflowBatchKind.UrgentUnread,
      count: 2,
      ids: ["urgent-unread-older", "urgent-unread-newer"],
    },
    {
      kind: ContextPackInboxWorkflowBatchKind.NormalUnread,
      count: 1,
      ids: ["normal-unread"],
    },
    {
      kind: ContextPackInboxWorkflowBatchKind.SnoozedDue,
      count: 1,
      ids: ["due-snoozed"],
    },
    {
      kind: ContextPackInboxWorkflowBatchKind.SnoozedFuture,
      count: 1,
      ids: ["future-snoozed"],
    },
    {
      kind: ContextPackInboxWorkflowBatchKind.Read,
      count: 1,
      ids: ["read-anchor"],
    },
  ]);
  deepEqual(view.batches[0]?.items[0]?.actions, [
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
  ]);
});

test("context pack inbox workflow view includes hat-wide anchors for the active agent", () => {
  const view = contextPackInboxWorkflowViewFor({
    observedAt,
    organizationId: "org-1",
    targetHatAssignmentId: "hat-director",
    targetAgentId: "agent-director",
    inboxAnchors: [
      inboxAnchor({ inboxAnchorId: "hat-wide", targetAgentId: undefined }),
    ],
  });

  deepEqual(view.batches[0]?.items.map((item) => item.inboxAnchorId), ["hat-wide"]);
});

function inboxAnchor(overrides: Partial<ContextPackInboxAnchor> = {}): ContextPackInboxAnchor {
  return {
    inboxAnchorId: "anchor-1",
    organizationId: "org-1",
    projectId: "project-1",
    teamId: "team-1",
    workItemId: "work-1",
    targetHatAssignmentId: "hat-director",
    targetAgentId: "agent-director",
    title: "Director context pack is stale",
    summary: "Refresh context before unblocking execution.",
    priority: ContextPackInboxAnchorPriority.Normal,
    status: ContextPackInboxAnchorStatus.Unread,
    deliveredAt: "2026-06-03T10:00:00.000Z",
    sourceRef: "context_pack:pack-1",
    traceId: "trace-1",
    ...overrides,
  };
}
