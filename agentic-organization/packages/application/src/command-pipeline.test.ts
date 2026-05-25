import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType, SupervisorChainLevel, SupervisorSignalToolType } from "../../domain/src/index.ts";
import { createInMemoryOrganizationStoreFactory } from "../../state/src/index.ts";
import { createCommandHandlerRegistry } from "./command-handler-registry.ts";
import { CommandErrorCode, CommandResultStatus, type CommandResult } from "./command-result.ts";
import { createCommandPipeline, type PipelineCommand } from "./command-pipeline.ts";
import { createSendSupervisorSignalHandler } from "./handlers/send-supervisor-signal.ts";

const command: PipelineCommand = {
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

describe("command pipeline idempotency", () => {
  test("replaying the same idempotency key returns the stored result", async () => {
    const stateStoreFactory = createInMemoryOrganizationStoreFactory<CommandResult>();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const firstResult = await pipeline.execute(command);
    const replayResult = await pipeline.execute(command);

    equal(firstResult.status, CommandResultStatus.Accepted);
    equal(replayResult.status, CommandResultStatus.Accepted);
    deepEqual(replayResult.idempotency, {
      replayed: true,
    });
    equal(firstResult.supervisorSignal !== undefined, true);
    equal(replayResult.supervisorSignal !== undefined, true);
    equal(replayResult.supervisorSignal?.supervisorSignalId, firstResult.supervisorSignal?.supervisorSignalId);
    equal(stateStoreFactory.snapshot.supervisorSignals.length, 1);
    equal(stateStoreFactory.snapshot.workItems.length, 0);
    equal(stateStoreFactory.snapshot.auditEvents.length, 1);
    equal(stateStoreFactory.snapshot.outboxEvents.length, 1);
  });

  test("rejects conflicting reuse of the same idempotency key", async () => {
    const stateStoreFactory = createInMemoryOrganizationStoreFactory<CommandResult>();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const firstResult = await pipeline.execute(command);
    const conflictResult = await pipeline.execute({
      ...command,
      requestHash: "hash-supervisor-signal-conflict",
      title: "Different supervisor signal",
    });

    equal(firstResult.status, CommandResultStatus.Accepted);
    equal(conflictResult.status, CommandResultStatus.Rejected);
    equal(conflictResult.error?.code, CommandErrorCode.IdempotencyConflict);
    equal(stateStoreFactory.snapshot.supervisorSignals.length, 1);
    equal(stateStoreFactory.snapshot.outboxEvents.length, 1);
  });
});
