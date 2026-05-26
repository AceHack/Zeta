import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType, SupervisorChainLevel, SupervisorSignalToolType } from "../../domain/src/index.ts";
import { createInMemoryOrganizationStoreFactory } from "../../state/src/index.ts";
import { createCommandHandlerRegistry } from "../src/command-handler-registry.ts";
import { CommandErrorCode, CommandResultStatus, type CommandResult } from "../src/command-result.ts";
import { createCommandPipeline, type PipelineCommand } from "../src/command-pipeline.ts";
import { createSendSupervisorSignalHandler } from "../src/handlers/send-supervisor-signal.ts";
import {
  CommandOutcomePersistenceStatus,
  type CommandStateStore,
  type CommandStateStoreFactory,
  type RecordCommandOutcomeInput,
  type RecordCommandOutcomeResult,
} from "../src/ports.ts";

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

  test("records command effects and idempotency through one outcome port", async () => {
    const stateStoreFactory = createRecordingCommandStateStoreFactory<CommandResult>();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(command);

    equal(result.status, CommandResultStatus.Accepted);
    equal(stateStoreFactory.recordedOutcomes.length, 1);
    equal(stateStoreFactory.recordedOutcomes[0]?.idempotencyRecord.idempotencyKey, command.idempotencyKey);
    equal(stateStoreFactory.recordedOutcomes[0]?.effects.supervisorSignals.length, 1);
    equal(stateStoreFactory.recordedOutcomes[0]?.effects.auditEvents.length, 1);
    equal(stateStoreFactory.recordedOutcomes[0]?.effects.outboxEvents.length, 1);
  });

  test("returns replay when outcome persistence loses a same-request idempotency race", async () => {
    const stateStoreFactory = createOutcomeResultCommandStateStoreFactory<CommandResult>({
      status: CommandOutcomePersistenceStatus.Replayed,
      result: {
        status: CommandResultStatus.Accepted,
        idempotency: {
          replayed: false,
        },
      },
    });
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(command);

    equal(result.status, CommandResultStatus.Accepted);
    deepEqual(result.idempotency, {
      replayed: true,
    });
    equal(stateStoreFactory.recordedOutcomes.length, 1);
  });

  test("returns idempotency conflict when outcome persistence loses a different-request race", async () => {
    const stateStoreFactory = createOutcomeResultCommandStateStoreFactory<CommandResult>({
      status: CommandOutcomePersistenceStatus.IdempotencyConflict,
      existingRequestHash: "hash-other-request",
    });
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(command);

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.IdempotencyConflict);
    equal(stateStoreFactory.recordedOutcomes.length, 1);
  });

  test("does not perform piecemeal command writes when outcome recording fails", async () => {
    const stateStoreFactory = createFailingOutcomeCommandStateStoreFactory<CommandResult>("transaction unavailable");
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    try {
      await pipeline.execute(command);
      throw new Error("expected command outcome recording to fail");
    } catch (error) {
      equal(error instanceof Error, true);
      equal((error as Error).message, "transaction unavailable");
    }

    equal(stateStoreFactory.appendCallCount, 0);
    equal(stateStoreFactory.recordCallCount, 1);
  });
});

type RecordingCommandStateStoreFactory<Result> = CommandStateStoreFactory<Result> & {
  recordedOutcomes: RecordCommandOutcomeInput<Result>[];
};

function createRecordingCommandStateStoreFactory<Result>(): RecordingCommandStateStoreFactory<Result> {
  const recordedOutcomes: RecordCommandOutcomeInput<Result>[] = [];

  return {
    recordedOutcomes,
    createCommandStateStore: () => ({
      findIdempotencyRecord: async () => undefined,
      recordCommandOutcome: async (input) => {
        recordedOutcomes.push(input);

        return {
          status: CommandOutcomePersistenceStatus.Committed,
          result: input.idempotencyRecord.result,
        };
      },
    }),
  };
}

function createOutcomeResultCommandStateStoreFactory<Result>(
  outcomeResult: RecordCommandOutcomeResult<Result>,
): RecordingCommandStateStoreFactory<Result> {
  const recordedOutcomes: RecordCommandOutcomeInput<Result>[] = [];

  return {
    recordedOutcomes,
    createCommandStateStore: () => ({
      findIdempotencyRecord: async () => undefined,
      recordCommandOutcome: async (input) => {
        recordedOutcomes.push(input);
        return outcomeResult;
      },
    }),
  };
}

type FailingOutcomeCommandStateStoreFactory<Result> = CommandStateStoreFactory<Result> & {
  readonly appendCallCount: number;
  readonly recordCallCount: number;
};

function createFailingOutcomeCommandStateStoreFactory<Result>(
  message: string,
): FailingOutcomeCommandStateStoreFactory<Result> {
  let appendCallCount = 0;
  let recordCallCount = 0;

  return {
    get appendCallCount() {
      return appendCallCount;
    },
    get recordCallCount() {
      return recordCallCount;
    },
    createCommandStateStore: () =>
      ({
        findIdempotencyRecord: async () => undefined,
        recordCommandOutcome: async () => {
          recordCallCount += 1;
          throw new Error(message);
        },
        appendSupervisorSignal: async () => {
          appendCallCount += 1;
        },
        appendAuditEvent: async () => {
          appendCallCount += 1;
        },
        appendOutboxEvent: async () => {
          appendCallCount += 1;
        },
      }) as CommandStateStore<Result>,
  };
}
