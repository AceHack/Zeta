import type { CommandHandlerRegistry } from "./command-handler-registry.ts";
import { CommandErrorCode, CommandResultStatus, type CommandResult } from "./command-result.ts";
import type { SendSupervisorSignalCommand } from "./handlers/send-supervisor-signal.ts";
import type { Clock, CommandStateStore, CommandStateStoreFactory, IdGenerator } from "./ports.ts";

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

  const result = await dispatchCommand(command, store, dependencies);
  await store.saveIdempotencyRecord({
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    result,
  });

  return result;
}

async function dispatchCommand(
  command: PipelineCommand,
  store: CommandStateStore<CommandResult>,
  dependencies: CommandPipelineDependencies,
): Promise<CommandResult> {
  const handler = dependencies.handlerRegistry.resolveHandler(command.type);

  if (handler !== undefined) {
    return await handler.execute(command, {
      ...dependencies,
      store,
    });
  }

  return {
    status: CommandResultStatus.Rejected,
    idempotency: {
      replayed: false,
    },
    error: {
      code: CommandErrorCode.UnsupportedCommand,
      message: "unsupported command type",
    },
  };
}
