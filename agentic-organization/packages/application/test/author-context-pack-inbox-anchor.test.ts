import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandType,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  authorContextPackInboxAnchor,
  type CommandResult,
  type CommandWorkAnchorWorkItem,
  type AuthorContextPackInboxAnchorCommand,
} from "../src/index.ts";

const command: AuthorContextPackInboxAnchorCommand = {
  commandId: "cmd-context-pack-inbox-anchor-001",
  type: CommandType.AuthorContextPackInboxAnchor,
  idempotencyKey: "idem-context-pack-inbox-anchor-001",
  requestHash: "hash-context-pack-inbox-anchor-001",
  correlationId: "corr-context-pack-inbox-anchor-001",
  causationId: "cause-context-pack-inbox-anchor-001",
  traceId: "trace-context-pack-inbox-anchor-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  teamId: "team-runtime",
  workItemId: "work-context-pack-001",
  targetHatAssignmentId: "hat-assignment-director-001",
  targetAgentId: "agent-director-001",
  title: "Director context pack is stale",
  summary: "Wake the director hat because the blocker briefing needs refreshed context.",
  priority: ContextPackInboxAnchorPriority.Urgent,
  sourceRef: "context_pack:pack-director-stale",
  actor: {
    agentId: "agent-developer-001",
    hatAssignmentId: "hat-assignment-dev-001",
  },
};

describe("author context-pack inbox anchor handler", () => {
  test("returns a typed inbox anchor effect for the target hat assignment", async () => {
    const outcome = await authorContextPackInboxAnchor(command, {
      now: () => "2026-06-03T14:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: {
        findProject: async () => undefined,
        findInitiative: async () => undefined,
        findWorkItem: async () => createWorkItem(),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    equal(result.contextPackInboxAnchor?.inboxAnchorId, "context-pack-inbox-anchor-001");
    equal(result.contextPackInboxAnchor?.targetHatAssignmentId, command.targetHatAssignmentId);
    equal(result.contextPackInboxAnchor?.targetAgentId, command.targetAgentId);
    equal(result.contextPackInboxAnchor?.priority, ContextPackInboxAnchorPriority.Urgent);
    equal(result.contextPackInboxAnchor?.status, ContextPackInboxAnchorStatus.Unread);
    equal(result.contextPackInboxAnchor?.deliveredAt, "2026-06-03T14:00:00.000Z");
    deepEqual(outcome.effects.contextPackInboxAnchors, [result.contextPackInboxAnchor]);
    deepEqual(result.artifacts, [{
      artifactType: CommandResultArtifactType.ContextPackInboxAnchor,
      artifactId: "context-pack-inbox-anchor-001",
      label: command.title,
    }]);
  });

  test("supports target-hat inbox anchors without active work provenance", async () => {
    const outcome = await authorContextPackInboxAnchor({
      ...command,
      teamId: undefined,
      workItemId: undefined,
    }, {
      now: () => "2026-06-03T14:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    ok(!("teamId" in result.contextPackInboxAnchor!));
    ok(!("workItemId" in result.contextPackInboxAnchor!));
    equal(result.contextPackInboxAnchor?.sourceRef, command.sourceRef);
  });

  test("rejects malformed priority before emitting effects", async () => {
    const outcome = await authorContextPackInboxAnchor({
      ...command,
      priority: "panic",
    } as unknown as AuthorContextPackInboxAnchorCommand, {
      now: () => "2026-06-03T14:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "context-pack inbox anchor priority is invalid");
    deepEqual(outcome.effects.contextPackInboxAnchors, []);
  });

  test("rejects work-scoped inbox anchors when the work item scope mismatches", async () => {
    const outcome = await authorContextPackInboxAnchor(command, {
      now: () => "2026-06-03T14:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: {
        findProject: async () => undefined,
        findInitiative: async () => undefined,
        findWorkItem: async () => ({
          ...createWorkItem(),
          projectId: "project-other",
        }),
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "context-pack inbox anchor work item scope does not match the command scope");
    deepEqual(outcome.effects.contextPackInboxAnchors, []);
  });
});

function createWorkItem(): CommandWorkAnchorWorkItem {
  return {
    workItemId: command.workItemId!,
    organizationId: command.organizationId,
    projectId: command.projectId,
    workItemType: WorkItemType.Task,
    title: "Context pack writer",
    description: "Work anchor used by context-pack inbox anchor tests.",
    state: WorkItemState.InProgress,
    createdAt: "2026-06-03T13:00:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-06-03T13:00:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}
