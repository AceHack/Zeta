import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import { CommandErrorCode, CommandResultStatus, type CommandResult } from "../src/command-result.ts";
import type { CommandWorkAnchorWorkItem } from "../src/ports.ts";
import { sendSupervisorSignal, type SendSupervisorSignalCommand } from "../src/handlers/send-supervisor-signal.ts";

const command: SendSupervisorSignalCommand = {
  commandId: "cmd-supervisor-signal-001",
  type: CommandType.SendSupervisorSignal,
  idempotencyKey: "idem-supervisor-signal-001",
  requestHash: "hash-supervisor-signal-001",
  correlationId: "corr-supervisor-signal-001",
  causationId: "cause-team-work-001",
  traceId: "trace-supervisor-signal-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  targetHatAssignmentId: "hat-assignment-em-001",
  actor: {
    agentId: "agent-developer-001",
    hatAssignmentId: "hat-assignment-dev-001",
  },
  title: "Blocked on scoped NATS publisher",
  message: "The team cannot validate the outbox worker until a supervisor routes a scoped NATS publisher decision.",
  policyContext: {
    scope: {
      teamId: "team-runtime",
      workItemId: "work-outbox-001",
    },
    toolType: SupervisorSignalToolType.ReportBlocker,
    supervisorChain: {
      sourceLevel: SupervisorChainLevel.TeamMember,
      targetLevel: SupervisorChainLevel.Manager,
    },
  },
};

describe("send supervisor signal handler", () => {
  test("returns chain communication, audit event, and outbox event effects", async () => {
    const outcome = await sendSupervisorSignal(command, {
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    ok(result.supervisorSignal);
    equal(result.supervisorSignal.status, SupervisorSignalStatus.Sent);
    deepEqual(outcome.effects.supervisorSignals, [result.supervisorSignal]);
    equal(outcome.effects.auditEvents.length, 1);
    equal(outcome.effects.outboxEvents.length, 1);
    deepEqual(outcome.effects.outboxEvents[0]?.envelope, {
      eventId: "evt-001",
      eventType: AgenticEventType.SupervisorSignalSent,
      schemaVersion: "agentic.org.event.v1",
      occurredAt: "2026-05-25T20:00:00.000Z",
      scope: {
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: command.policyContext.scope.teamId,
        workItemId: command.policyContext.scope.workItemId,
      },
      actor: command.actor,
      aggregate: {
        aggregateId: result.supervisorSignal.supervisorSignalId,
        aggregateType: AgenticAggregateType.SupervisorSignal,
        aggregateVersion: 1,
      },
      trace: {
        commandId: command.commandId,
        correlationId: command.correlationId,
        causationId: command.causationId,
        traceId: command.traceId,
        idempotencyKey: command.idempotencyKey,
      },
      replay: {
        isReplay: false,
      },
      payload: {
        sourceLevel: SupervisorChainLevel.TeamMember,
        targetLevel: SupervisorChainLevel.Manager,
        targetHatAssignmentId: command.targetHatAssignmentId,
        toolType: SupervisorSignalToolType.ReportBlocker,
        status: SupervisorSignalStatus.Sent,
        title: command.title,
      },
    });
  });

  test("rejects supervisor signals for missing work anchors before emitting effects", async () => {
    const outcome = await sendSupervisorSignal(command, {
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: {
        findProject: async () => undefined,
        findInitiative: async () => undefined,
        findWorkItem: async () => undefined,
      },
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "supervisor signal requires an existing related work item");
    deepEqual(outcome.effects, {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
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

  test("rejects malformed supervisor signal JSON inputs before emitting effects", async () => {
    const outcome = await sendSupervisorSignal(
      {
        ...command,
        targetHatAssignmentId: 42,
      } as unknown as SendSupervisorSignalCommand,
      {
        now: () => "2026-05-25T20:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "supervisor signal target hat assignment is required");
    equal(outcome.effects.supervisorSignals.length, 0);
  });

  test("rejects invalid supervisor chain levels before emitting effects", async () => {
    const outcome = await sendSupervisorSignal(
      {
        ...command,
        policyContext: {
          ...command.policyContext,
          supervisorChain: {
            ...command.policyContext.supervisorChain,
            targetLevel: "floating_manager",
          },
        },
      } as unknown as SendSupervisorSignalCommand,
      {
        now: () => "2026-05-25T20:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "supervisor signal target level is invalid");
    equal(outcome.effects.supervisorSignals.length, 0);
  });

  test("rejects supervisor signals that do not move up the chain", async () => {
    const outcome = await sendSupervisorSignal(
      {
        ...command,
        policyContext: {
          ...command.policyContext,
          supervisorChain: {
            sourceLevel: SupervisorChainLevel.Manager,
            targetLevel: SupervisorChainLevel.TeamMember,
          },
        },
      },
      {
        now: () => "2026-05-25T20:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "supervisor signal must target a higher supervisor chain level");
    equal(outcome.effects.supervisorSignals.length, 0);
  });

  test("rejects supervisor signals when the work anchor scope does not match the command", async () => {
    const outcome = await sendSupervisorSignal(command, {
      now: () => "2026-05-25T20:00:00.000Z",
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
    equal(result.error?.message, "supervisor signal work item scope does not match the command scope");
    deepEqual(outcome.effects, {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
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
});

function createWorkItem(): CommandWorkAnchorWorkItem {
  return {
    workItemId: command.policyContext.scope.workItemId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    workItemType: WorkItemType.Task,
    title: "Scoped NATS publisher",
    description: "Work anchor used by the supervisor signal tests.",
    state: WorkItemState.InProgress,
    createdAt: "2026-05-25T19:00:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-25T19:00:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}
