import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  InitiativeStatus,
  ProjectStatus,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import { CommandErrorCode, CommandResultArtifactType, CommandResultStatus, type CommandResult } from "../src/index.ts";
import { createWorkItem, type CreateWorkItemCommand } from "../src/handlers/create-work-item.ts";
import type { CommandWorkAnchorInitiative, CommandWorkAnchorProject, WorkAnchorStateReaderPort } from "../src/ports.ts";

const command: CreateWorkItemCommand = {
  commandId: "cmd-create-work-item-001",
  type: CommandType.CreateWorkItem,
  idempotencyKey: "idem-create-work-item-001",
  requestHash: "hash-create-work-item-001",
  correlationId: "corr-create-work-item-001",
  causationId: "cause-create-work-item-001",
  traceId: "trace-create-work-item-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  actor: {
    agentId: "agent-tpm-001",
    hatAssignmentId: "hat-assignment-tpm-001",
  },
  workItemType: WorkItemType.Task,
  title: "Create the first generic work item command",
  description: "The Organization needs the first concrete work-anchor command.",
};

describe("create work item handler", () => {
  test("returns work-anchor, audit, and outbox effects for a new work item", async () => {
    const outcome = await createWorkItem(command, {
      now: () => "2026-05-28T21:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    deepEqual(result.artifacts, [
      {
        artifactType: CommandResultArtifactType.WorkItem,
        artifactId: "work-item-001",
        label: command.title,
      },
    ]);
    deepEqual(result.emittedEvents, [
      {
        eventId: "evt-001",
        eventType: AgenticEventType.WorkItemChanged,
        aggregateId: "work-item-001",
        aggregateType: AgenticAggregateType.WorkItem,
      },
    ]);
    deepEqual(result.auditEventIds, ["audit-001"]);
    equal(outcome.effects.workAnchors?.workItems.length, 1);
    deepEqual(outcome.effects.workAnchors?.workItems[0], {
      workItemId: "work-item-001",
      organizationId: command.organizationId,
      projectId: command.projectId,
      workItemType: WorkItemType.Task,
      title: command.title,
      description: command.description,
      state: WorkItemState.Created,
      createdAt: "2026-05-28T21:00:00.000Z",
      createdBy: command.actor,
      metadata: {
        updatedAt: "2026-05-28T21:00:00.000Z",
        version: 1,
        correlationId: command.correlationId,
        causationId: command.causationId,
        traceId: command.traceId,
      },
    });
    deepEqual(outcome.effects.auditEvents, [
      {
        auditEventId: "audit-001",
        eventName: AgenticEventType.WorkItemChanged,
        aggregateId: "work-item-001",
        actor: command.actor,
        occurredAt: "2026-05-28T21:00:00.000Z",
      },
    ]);
    equal(outcome.effects.outboxEvents.length, 1);
    deepEqual(outcome.effects.outboxEvents[0]?.envelope.aggregate, {
      aggregateId: "work-item-001",
      aggregateType: AgenticAggregateType.WorkItem,
      aggregateVersion: 1,
    });
    equal(outcome.effects.outboxEvents[0]?.envelope.eventType, AgenticEventType.WorkItemChanged);
  });

  test("rejects blank work item titles before emitting effects", async () => {
    const outcome = await createWorkItem(
      {
        ...command,
        title: " ",
      },
      {
        now: () => "2026-05-28T21:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    ok(result.error?.message.includes("title"));
    deepEqual(outcome.effects, {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      auditEvents: [],
      outboxEvents: [],
      workAnchors: {
        projects: [],
        initiatives: [],
        workItems: [],
        workAnchorTargets: [],
        workItemTransitions: [],
      },
    });
  });

  test("rejects work item creation when the referenced project is missing", async () => {
    const outcome = await createWorkItem(command, {
      now: () => "2026-05-28T21:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: createWorkAnchorStateReader({
        project: undefined,
      }),
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "work item project does not exist");
    equal(outcome.effects.workAnchors?.workItems.length, 0);
    equal(outcome.effects.auditEvents.length, 0);
    equal(outcome.effects.outboxEvents.length, 0);
  });

  test("rejects work item creation when the project scope does not match the command", async () => {
    const outcome = await createWorkItem(command, {
      now: () => "2026-05-28T21:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: createWorkAnchorStateReader({
        project: {
          ...createProject(),
          organizationId: "org-other",
        },
      }),
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "work item project scope does not match the command scope");
    equal(outcome.effects.workAnchors?.workItems.length, 0);
  });

  test("rejects work item creation when the referenced initiative is missing", async () => {
    const outcome = await createWorkItem(
      {
        ...command,
        initiativeId: "initiative-agentic-org-001",
      },
      {
        now: () => "2026-05-28T21:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader({
          project: createProject(),
          initiative: undefined,
        }),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "work item initiative does not exist");
    equal(outcome.effects.workAnchors?.workItems.length, 0);
  });

  test("rejects work item creation when the initiative scope does not match the command", async () => {
    const outcome = await createWorkItem(
      {
        ...command,
        initiativeId: "initiative-agentic-org-001",
      },
      {
        now: () => "2026-05-28T21:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader({
          project: createProject(),
          initiative: {
            ...createInitiative(),
            projectId: "project-other",
          },
        }),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "work item initiative scope does not match the command scope");
    equal(outcome.effects.workAnchors?.workItems.length, 0);
  });
});

function createWorkAnchorStateReader(input: {
  project: CommandWorkAnchorProject | undefined;
  initiative?: CommandWorkAnchorInitiative | undefined;
}): WorkAnchorStateReaderPort {
  return {
    findProject: async () => input.project,
    findInitiative: async () => input.initiative,
    findWorkItem: async () => undefined,
  };
}

function createProject(): CommandWorkAnchorProject {
  return {
    projectId: command.projectId,
    organizationId: command.organizationId,
    name: "Agentic Organization",
    status: ProjectStatus.Active,
    createdAt: "2026-05-28T20:00:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-28T20:00:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function createInitiative(): CommandWorkAnchorInitiative {
  return {
    initiativeId: "initiative-agentic-org-001",
    organizationId: command.organizationId,
    projectId: command.projectId,
    title: "Work anchor command handlers",
    status: InitiativeStatus.Active,
    createdAt: "2026-05-28T20:10:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-28T20:10:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}
