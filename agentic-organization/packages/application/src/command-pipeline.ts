import type { CommandHandlerRegistry } from "./command-handler-registry.ts";
import { CommandErrorCode, CommandResultStatus, type CommandResult } from "./command-result.ts";
import type { SendSupervisorSignalCommand } from "./handlers/send-supervisor-signal.ts";
import {
  CommandOutcomePersistenceStatus,
  type Clock,
  type CommandEffects,
  type CommandStateStore,
  type CommandStateStoreFactory,
  type IdGenerator,
} from "./ports.ts";

export type PipelineCommand = SendSupervisorSignalCommand;

export type CommandPipeline = {
  execute: (command: PipelineCommand) => Promise<CommandResult>;
};

export type CommandPipelineDependencies = Clock &
  IdGenerator & {
    stateStoreFactory: CommandStateStoreFactory<CommandResult>;
    handlerRegistry: CommandHandlerRegistry<PipelineCommand, CommandResult>;
  };

export function createCommandPipeline(dependencies: CommandPipelineDependencies): CommandPipeline {
  const store = dependencies.stateStoreFactory.createCommandStateStore();

  return {
    execute: (command) => executeCommand(command, store, dependencies),
  };
}

async function executeCommand(
  command: PipelineCommand,
  store: CommandStateStore<CommandResult>,
  dependencies: CommandPipelineDependencies,
): Promise<CommandResult> {
  const existingRecord = await store.findIdempotencyRecord(command.idempotencyKey);

  if (existingRecord?.requestHash === command.requestHash) {
    return {
      ...existingRecord.result,
      idempotency: {
        replayed: true,
      },
    };
  }

  if (existingRecord) {
    return createIdempotencyConflictResult();
  }

  const outcome = await dispatchCommand(command, dependencies);

  const persistenceResult = await store.recordCommandOutcome({
    idempotencyRecord: {
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      result: outcome.result,
    },
    effects: outcome.result.status === CommandResultStatus.Accepted ? outcome.effects : createEmptyCommandEffects(),
  });

  if (persistenceResult.status === CommandOutcomePersistenceStatus.Replayed) {
    return {
      ...persistenceResult.result,
      idempotency: {
        replayed: true,
      },
    };
  }

  if (persistenceResult.status === CommandOutcomePersistenceStatus.IdempotencyConflict) {
    return createIdempotencyConflictResult();
  }

  return outcome.result;
}

async function dispatchCommand(
  command: PipelineCommand,
  dependencies: CommandPipelineDependencies,
): Promise<{ result: CommandResult; effects: CommandEffects }> {
  const handler = dependencies.handlerRegistry.resolveHandler(command.type);

  if (handler !== undefined) {
    return await handler.execute(command, dependencies);
  }

  return {
    result: {
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code: CommandErrorCode.UnsupportedCommand,
        message: "unsupported command type",
      },
    },
    effects: createEmptyCommandEffects(),
  };
}

function createIdempotencyConflictResult(): CommandResult {
  return {
    status: CommandResultStatus.Rejected,
    idempotency: {
      replayed: false,
    },
    error: {
      code: CommandErrorCode.IdempotencyConflict,
      message: "idempotency key was reused with a different request hash",
    },
  };
}

function createEmptyCommandEffects(): CommandEffects {
  return {
    supervisorSignals: [],
    auditEvents: [],
    outboxEvents: [],
  };
}
