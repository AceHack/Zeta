import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
} from "../../domain/src/index.ts";
import { CommandResultStatus, type CommandResult } from "../src/command-result.ts";
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
});
