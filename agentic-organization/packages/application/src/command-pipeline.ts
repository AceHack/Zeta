import type { CommandHandlerRegistry } from "./command-handler-registry.ts";
import { CommandErrorCode, CommandResultStatus, type CommandResult } from "./command-result.ts";
import type { SendSupervisorSignalCommand } from "./handlers/send-supervisor-signal.ts";
import {
  PolicyDecisionStatus,
  type CommandAuthorizationPort,
  type CommandAuthorizationRequest,
} from "../../policy/src/index.ts";
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
    commandAuthorizationPort: CommandAuthorizationPort;
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
  const authorizationDecision = await dependencies.commandAuthorizationPort.authorizeCommand(
    createCommandAuthorizationRequest(command),
  );

  if (authorizationDecision.status === PolicyDecisionStatus.Denied) {
    return {
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code: CommandErrorCode.PolicyDenied,
        message: "command denied by hat authority policy",
        policyDecisionId: authorizationDecision.decisionId,
        policyVersion: authorizationDecision.policyVersion,
        reason: authorizationDecision.reason,
      },
    };
  }

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

function createCommandAuthorizationRequest(command: PipelineCommand): CommandAuthorizationRequest {
  return {
    commandId: command.commandId,
    commandType: command.type,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      teamId: command.teamId,
      workItemId: command.relatedWorkItemId,
    },
    toolType: command.toolType,
    supervisorChain: {
      sourceLevel: command.sourceLevel,
      targetLevel: command.targetLevel,
    },
    trace: {
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
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
