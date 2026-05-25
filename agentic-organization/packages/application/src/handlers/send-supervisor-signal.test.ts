import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
} from "../../../domain/src/index.ts";
import { createInMemoryOrganizationStoreFactory } from "../../../state/src/index.ts";
import { CommandResultStatus, type CommandResult } from "../command-result.ts";
import { sendSupervisorSignal, type SendSupervisorSignalCommand } from "./send-supervisor-signal.ts";

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
  teamId: "team-runtime",
  sourceLevel: SupervisorChainLevel.TeamMember,
  targetLevel: SupervisorChainLevel.Manager,
  targetHatAssignmentId: "hat-assignment-em-001",
  actor: {
    agentId: "agent-developer-001",
    hatAssignmentId: "hat-assignment-dev-001",
  },
  toolType: SupervisorSignalToolType.ReportBlocker,
  title: "Blocked on scoped NATS publisher",
  message: "The team cannot validate the outbox worker until a supervisor routes a scoped NATS publisher decision.",
  relatedWorkItemId: "work-outbox-001",
};

describe("send supervisor signal handler", () => {
  test("persists chain communication, audit event, and outbox event atomically", async () => {
    const stateStoreFactory = createInMemoryOrganizationStoreFactory<CommandResult>();
    const store = stateStoreFactory.createCommandStateStore();

    const result = await sendSupervisorSignal(command, {
      store,
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    equal(result.status, CommandResultStatus.Accepted);
    ok(result.supervisorSignal);
    equal(result.supervisorSignal.status, SupervisorSignalStatus.Sent);
    equal(stateStoreFactory.snapshot.supervisorSignals.length, 1);
    equal(stateStoreFactory.snapshot.workItems.length, 0);
    equal(stateStoreFactory.snapshot.auditEvents.length, 1);
    equal(stateStoreFactory.snapshot.outboxEvents.length, 1);
    deepEqual(stateStoreFactory.snapshot.outboxEvents[0]?.envelope, {
      eventId: "evt-001",
      eventType: AgenticEventType.SupervisorSignalSent,
      schemaVersion: "agentic.org.event.v1",
      occurredAt: "2026-05-25T20:00:00.000Z",
      scope: {
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: command.teamId,
        workItemId: command.relatedWorkItemId,
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
