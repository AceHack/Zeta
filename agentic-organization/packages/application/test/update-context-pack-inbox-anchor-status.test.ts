import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandType,
  type ContextPackInboxAnchor,
} from "../../domain/src/index.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  updateContextPackInboxAnchorStatus,
  type CommandResult,
  type UpdateContextPackInboxAnchorStatusCommand,
} from "../src/index.ts";

const ContextPackInboxAnchorStatusTestId = {
  AgentDirector: "agent-director-001",
  AgentDeveloper: "agent-developer-001",
  Audit: "audit-001",
  Causation: "cause-context-pack-inbox-anchor-status-001",
  Command: "cmd-context-pack-inbox-anchor-status-001",
  Correlation: "corr-context-pack-inbox-anchor-status-001",
  HatDirector: "hat-assignment-director-001",
  HatDeveloper: "hat-assignment-dev-001",
  Idempotency: "idem-context-pack-inbox-anchor-status-001",
  InboxAnchor: "context-pack-inbox-anchor-001",
  Project: "project-agentic-org",
  RequestHash: "hash-context-pack-inbox-anchor-status-001",
  Team: "team-runtime",
  Trace: "trace-context-pack-inbox-anchor-status-001",
  WorkItem: "work-context-pack-001",
} as const;

const ContextPackInboxAnchorStatusTestTime = {
  ChangedAt: "2026-06-03T16:00:00.000Z",
  DeliveredAt: "2026-06-03T14:00:00.000Z",
  SnoozedUntil: "2026-06-04T13:00:00.000Z",
} as const;

const command: UpdateContextPackInboxAnchorStatusCommand = {
  commandId: ContextPackInboxAnchorStatusTestId.Command,
  type: CommandType.UpdateContextPackInboxAnchorStatus,
  idempotencyKey: ContextPackInboxAnchorStatusTestId.Idempotency,
  requestHash: ContextPackInboxAnchorStatusTestId.RequestHash,
  correlationId: ContextPackInboxAnchorStatusTestId.Correlation,
  causationId: ContextPackInboxAnchorStatusTestId.Causation,
  traceId: ContextPackInboxAnchorStatusTestId.Trace,
  organizationId: "org-lfg",
  projectId: ContextPackInboxAnchorStatusTestId.Project,
  teamId: ContextPackInboxAnchorStatusTestId.Team,
  workItemId: ContextPackInboxAnchorStatusTestId.WorkItem,
  inboxAnchorId: ContextPackInboxAnchorStatusTestId.InboxAnchor,
  targetHatAssignmentId: ContextPackInboxAnchorStatusTestId.HatDirector,
  targetAgentId: ContextPackInboxAnchorStatusTestId.AgentDirector,
  status: ContextPackInboxAnchorStatus.Read,
  actor: {
    agentId: ContextPackInboxAnchorStatusTestId.AgentDeveloper,
    hatAssignmentId: ContextPackInboxAnchorStatusTestId.HatDeveloper,
  },
};

describe("update context-pack inbox anchor status handler", () => {
  test("emits a typed status transition effect for the matching per-hat inbox anchor", async () => {
    const outcome = await updateContextPackInboxAnchorStatus(command, {
      now: () => ContextPackInboxAnchorStatusTestTime.ChangedAt,
      createId: (prefix) => `${prefix}-001`,
      contextPackInboxAnchorStateReader: {
        findContextPackInboxAnchor: async () => createInboxAnchor(),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    equal(result.contextPackInboxAnchor?.inboxAnchorId, command.inboxAnchorId);
    equal(result.contextPackInboxAnchorStatusTransition?.status, ContextPackInboxAnchorStatus.Read);
    equal(result.contextPackInboxAnchorStatusTransition?.changedAt, ContextPackInboxAnchorStatusTestTime.ChangedAt);
    deepEqual(outcome.effects.contextPackInboxAnchorStatusTransitions, [
      result.contextPackInboxAnchorStatusTransition,
    ]);
    deepEqual(result.artifacts, [{
      artifactType: CommandResultArtifactType.ContextPackInboxAnchor,
      artifactId: command.inboxAnchorId,
      label: "Director context pack is stale",
    }]);
    deepEqual(result.auditEventIds, [ContextPackInboxAnchorStatusTestId.Audit]);
  });

  test("rejects malformed target statuses before emitting effects", async () => {
    const outcome = await updateContextPackInboxAnchorStatus({
      ...command,
      status: "archived",
    } as unknown as UpdateContextPackInboxAnchorStatusCommand, {
      now: () => ContextPackInboxAnchorStatusTestTime.ChangedAt,
      createId: (prefix) => `${prefix}-001`,
      contextPackInboxAnchorStateReader: {
        findContextPackInboxAnchor: async () => createInboxAnchor(),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "context-pack inbox anchor status is invalid");
    deepEqual(outcome.effects.contextPackInboxAnchorStatusTransitions, []);
  });

  test("rejects unread target status because unread is owned by anchor creation", async () => {
    const outcome = await updateContextPackInboxAnchorStatus({
      ...command,
      status: ContextPackInboxAnchorStatus.Unread,
    }, {
      now: () => ContextPackInboxAnchorStatusTestTime.ChangedAt,
      createId: (prefix) => `${prefix}-001`,
      contextPackInboxAnchorStateReader: {
        findContextPackInboxAnchor: async () => createInboxAnchor(),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "context-pack inbox anchor status transition is invalid");
    deepEqual(outcome.effects.contextPackInboxAnchorStatusTransitions, []);
  });

  test("emits a snoozed transition with a required wake time for deferred inbox anchors", async () => {
    const outcome = await updateContextPackInboxAnchorStatus({
      ...command,
      status: ContextPackInboxAnchorStatus.Snoozed,
      snoozedUntil: ContextPackInboxAnchorStatusTestTime.SnoozedUntil,
    }, {
      now: () => ContextPackInboxAnchorStatusTestTime.ChangedAt,
      createId: (prefix) => `${prefix}-001`,
      contextPackInboxAnchorStateReader: {
        findContextPackInboxAnchor: async () => createInboxAnchor(),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    equal(result.contextPackInboxAnchorStatusTransition?.status, ContextPackInboxAnchorStatus.Snoozed);
    equal(result.contextPackInboxAnchorStatusTransition?.snoozedUntil, ContextPackInboxAnchorStatusTestTime.SnoozedUntil);
    deepEqual(outcome.effects.contextPackInboxAnchorStatusTransitions, [
      result.contextPackInboxAnchorStatusTransition,
    ]);
  });

  test("rejects snoozed status transitions without a future wake time", async () => {
    const outcome = await updateContextPackInboxAnchorStatus({
      ...command,
      status: ContextPackInboxAnchorStatus.Snoozed,
      snoozedUntil: ContextPackInboxAnchorStatusTestTime.ChangedAt,
    }, {
      now: () => ContextPackInboxAnchorStatusTestTime.ChangedAt,
      createId: (prefix) => `${prefix}-001`,
      contextPackInboxAnchorStateReader: {
        findContextPackInboxAnchor: async () => createInboxAnchor(),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "context-pack inbox anchor snooze time must be in the future");
    deepEqual(outcome.effects.contextPackInboxAnchorStatusTransitions, []);
  });

  test("rejects missing inbox anchors without emitting transition effects", async () => {
    const outcome = await updateContextPackInboxAnchorStatus(command, {
      now: () => ContextPackInboxAnchorStatusTestTime.ChangedAt,
      createId: (prefix) => `${prefix}-001`,
      contextPackInboxAnchorStateReader: {
        findContextPackInboxAnchor: async () => undefined,
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "context-pack inbox anchor was not found");
    deepEqual(outcome.effects.contextPackInboxAnchorStatusTransitions, []);
  });

  test("rejects status updates when the persisted anchor scope does not match the command", async () => {
    const outcome = await updateContextPackInboxAnchorStatus(command, {
      now: () => ContextPackInboxAnchorStatusTestTime.ChangedAt,
      createId: (prefix) => `${prefix}-001`,
      contextPackInboxAnchorStateReader: {
        findContextPackInboxAnchor: async () => ({
          ...createInboxAnchor(),
          targetHatAssignmentId: "hat-assignment-other-001",
        }),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "context-pack inbox anchor scope does not match the command scope");
    deepEqual(outcome.effects.contextPackInboxAnchorStatusTransitions, []);
  });
});

function createInboxAnchor(): ContextPackInboxAnchor {
  return {
    inboxAnchorId: ContextPackInboxAnchorStatusTestId.InboxAnchor,
    organizationId: command.organizationId,
    projectId: ContextPackInboxAnchorStatusTestId.Project,
    teamId: ContextPackInboxAnchorStatusTestId.Team,
    workItemId: ContextPackInboxAnchorStatusTestId.WorkItem,
    targetHatAssignmentId: ContextPackInboxAnchorStatusTestId.HatDirector,
    targetAgentId: ContextPackInboxAnchorStatusTestId.AgentDirector,
    title: "Director context pack is stale",
    summary: "Wake the director hat because the blocker briefing needs refreshed context.",
    priority: ContextPackInboxAnchorPriority.Urgent,
    status: ContextPackInboxAnchorStatus.Unread,
    deliveredAt: ContextPackInboxAnchorStatusTestTime.DeliveredAt,
    traceId: ContextPackInboxAnchorStatusTestId.Trace,
  };
}
