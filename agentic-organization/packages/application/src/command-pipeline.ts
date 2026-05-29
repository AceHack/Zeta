import type { CommandHandlerRegistry } from "./command-handler-registry.ts";
import type { PipelineCommand } from "./command-contract.ts";
import { CommandErrorCode, CommandResultStatus, type CommandResult } from "./command-result.ts";
import {
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  type CommandAuthorizationPort,
  type CommandAuthorizationRequest,
  type PolicyDecision,
  type PolicyDecisionObservation,
  type PolicyDecisionObservationPort,
} from "../../policy/src/index.ts";
import {
  CommandOutcomeEffectConflictReason,
  CommandOutcomePersistenceStatus,
  type Clock,
  type CommandEffects,
  CommandScheduleAuthorityDecisionStatus,
  type CommandScheduleAuthorityPort,
  type CommandScheduleAuthorityRequest,
  type CommandStateStore,
  type CommandStateStoreFactory,
  type DiscussionAnchorStateReaderPort,
  type HatAssignmentAuthorityReaderPort,
  type IdGenerator,
  type SupervisorSignalStateReaderPort,
  type WorkAnchorStateReaderPort,
} from "./ports.ts";

export type CommandPipeline<Command extends PipelineCommand = PipelineCommand> = {
  execute: (command: Command) => Promise<CommandResult>;
};

export type CommandPipelineDependencies<Command extends PipelineCommand = PipelineCommand> = Clock &
  IdGenerator & {
    stateStoreFactory: CommandStateStoreFactory<CommandResult>;
    commandAuthorizationPort: CommandAuthorizationPort;
    policyDecisionObservationPort: PolicyDecisionObservationPort;
    commandScheduleAuthorityPort?: CommandScheduleAuthorityPort | undefined;
    handlerRegistry: CommandHandlerRegistry<Command, CommandResult>;
    discussionAnchorStateReader?: DiscussionAnchorStateReaderPort | undefined;
    hatAssignmentAuthorityReader?: HatAssignmentAuthorityReaderPort | undefined;
    supervisorSignalStateReader?: SupervisorSignalStateReaderPort | undefined;
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createCommandPipeline<Command extends PipelineCommand = PipelineCommand>(
  dependencies: CommandPipelineDependencies<Command>,
): CommandPipeline<Command> {
  const store = dependencies.stateStoreFactory.createCommandStateStore();

  return {
    execute: (command) => executeCommand(command, store, dependencies),
  };
}

async function executeCommand<Command extends PipelineCommand>(
  command: Command,
  store: CommandStateStore<CommandResult>,
  dependencies: CommandPipelineDependencies<Command>,
): Promise<CommandResult> {
  const authorizationDecision = await dependencies.commandAuthorizationPort.authorizeCommand(
    createCommandAuthorizationRequest(command),
  );

  if (authorizationDecision.status === PolicyDecisionStatus.Denied) {
    try {
      const observationResult = await dependencies.policyDecisionObservationPort.observePolicyDecision(
        createPolicyDecisionObservation(command, authorizationDecision, dependencies.now()),
      );
      if (observationResult.status === PolicyDecisionObservationPersistenceStatus.Conflict) {
        return createPolicyObservationConflictResult(command, authorizationDecision);
      }
    } catch {
      return {
        commandId: command.commandId,
        status: CommandResultStatus.Rejected,
        policy: createPolicyEvidence(authorizationDecision),
        idempotency: {
          replayed: false,
        },
        error: {
          code: CommandErrorCode.PolicyObservationFailed,
          message: "command denied but policy decision observation failed",
          policyDecisionId: authorizationDecision.decisionId,
          policyVersion: authorizationDecision.policyVersion,
          reason: authorizationDecision.reason,
          observationFailureReason: "policy_decision_observation_unavailable",
        },
      };
    }

    return {
      commandId: command.commandId,
      status: CommandResultStatus.Rejected,
      policy: createPolicyEvidence(authorizationDecision),
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
    return createIdempotencyConflictResult(command);
  }

  const scheduleAuthorityResult = await authorizeCommandSchedule(command, dependencies);

  if (scheduleAuthorityResult !== undefined) {
    return scheduleAuthorityResult;
  }

  const outcome = await dispatchCommand(command, dependencies);
  const result =
    outcome.result.status === CommandResultStatus.Accepted
      ? attachPolicyDecisionToResult(outcome.result, outcome.effects, authorizationDecision)
      : outcome.result;

  if (isRetryablePreconditionFailure(result)) {
    return result;
  }

  const effects =
    result.status === CommandResultStatus.Accepted
      ? attachPolicyDecisionEvidence(outcome.effects, authorizationDecision)
      : createEmptyCommandEffects();

  const persistenceResult = await store.recordCommandOutcome({
    idempotencyRecord: {
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      result,
    },
    effects,
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
    return createIdempotencyConflictResult(command);
  }

  if (persistenceResult.status === CommandOutcomePersistenceStatus.EffectConflict) {
    return createEffectConflictResult(command, persistenceResult.reason);
  }

  return result;
}

async function authorizeCommandSchedule<Command extends PipelineCommand>(
  command: Command,
  dependencies: CommandPipelineDependencies<Command>,
): Promise<CommandResult | undefined> {
  if (dependencies.commandScheduleAuthorityPort === undefined) {
    return undefined;
  }

  const decision = await dependencies.commandScheduleAuthorityPort.authorizeCommandSchedule(
    createCommandScheduleAuthorityRequest(command, dependencies.now()),
  );

  if (decision.status !== CommandScheduleAuthorityDecisionStatus.Denied) {
    return undefined;
  }

  return {
    commandId: command.commandId,
    status: CommandResultStatus.Rejected,
    idempotency: {
      replayed: false,
    },
    error: {
      code: CommandErrorCode.ScheduleAuthorityDenied,
      message: decision.message,
      reason: decision.reason,
    },
  };
}

function createCommandScheduleAuthorityRequest(
  command: PipelineCommand,
  evaluatedAt: string,
): CommandScheduleAuthorityRequest {
  return {
    commandId: command.commandId,
    commandType: command.type,
    actor: command.actor,
    scope: {
      ...createCommandAuthorizationScope(command),
    },
    ...createOptionalCommandResource(command),
    evaluatedAt,
  };
}

function isRetryablePreconditionFailure(result: CommandResult): boolean {
  return result.status === CommandResultStatus.Rejected && result.error?.code === CommandErrorCode.PreconditionFailed;
}

function createCommandAuthorizationRequest(command: PipelineCommand): CommandAuthorizationRequest {
  return {
    commandId: command.commandId,
    commandType: command.type,
    actor: command.actor,
    scope: {
      ...createCommandAuthorizationScope(command),
    },
    ...createOptionalCommandPolicyContext(command),
    trace: {
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
  };
}

function createPolicyDecisionObservation(
  command: PipelineCommand,
  decision: PolicyDecision,
  observedAt: string,
): PolicyDecisionObservation {
  return {
    commandId: command.commandId,
    commandType: command.type,
    actor: command.actor,
    scope: {
      ...createCommandAuthorizationScope(command),
    },
    ...createOptionalCommandPolicyContext(command),
    trace: {
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
    decision,
    observedAt,
  };
}

function createOptionalCommandPolicyContext(
  command: PipelineCommand,
): Pick<CommandAuthorizationRequest, "resource" | "supervisorChain" | "toolType"> {
  return {
    ...(command.policyContext?.toolType === undefined ? {} : { toolType: command.policyContext.toolType }),
    ...(command.policyContext?.supervisorChain === undefined
      ? {}
      : { supervisorChain: command.policyContext.supervisorChain }),
    ...createOptionalCommandResource(command),
  };
}

function createOptionalCommandResource(
  command: PipelineCommand,
): Pick<CommandAuthorizationRequest, "resource"> {
  const resource = {
    ...createOptionalDirectCommandResourceValue(DirectCommandResourceProperty.AssignedAgentId, command),
    ...createOptionalDirectCommandResourceValue(DirectCommandResourceProperty.AssignedHatAssignmentId, command),
    ...createOptionalDirectCommandResourceValue(DirectCommandResourceProperty.BlockType, command),
    ...createOptionalDirectCommandResourceValue(DirectCommandResourceProperty.StartsAt, command),
    ...createOptionalDirectCommandResourceValue(DirectCommandResourceProperty.EndsAt, command),
  };

  return Object.keys(resource).length === 0 ? {} : { resource };
}

const DirectCommandResourceProperty = {
  AssignedAgentId: "assignedAgentId",
  AssignedHatAssignmentId: "assignedHatAssignmentId",
  BlockType: "blockType",
  EndsAt: "endsAt",
  StartsAt: "startsAt",
} as const;

type DirectCommandResourceProperty =
  (typeof DirectCommandResourceProperty)[keyof typeof DirectCommandResourceProperty];

function createOptionalDirectCommandResourceValue(
  property: DirectCommandResourceProperty,
  command: PipelineCommand,
): Partial<NonNullable<CommandAuthorizationRequest["resource"]>> {
  const value = getDirectCommandScopeValue(command, property);

  return value === undefined ? {} : { [property]: value };
}

function createCommandAuthorizationScope(command: PipelineCommand): CommandAuthorizationRequest["scope"] {
  return {
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...createOptionalAuthorizationScopeValue(DirectCommandScopeProperty.TeamId, command),
    ...createOptionalAuthorizationScopeValue(DirectCommandScopeProperty.WorkItemId, command),
  };
}

const DirectCommandScopeProperty = {
  TeamId: "teamId",
  WorkItemId: "workItemId",
} as const;

type DirectCommandScopeProperty = (typeof DirectCommandScopeProperty)[keyof typeof DirectCommandScopeProperty];

function createOptionalAuthorizationScopeValue(
  property: DirectCommandScopeProperty,
  command: PipelineCommand,
): Partial<CommandAuthorizationRequest["scope"]> {
  const directValue = getDirectCommandScopeValue(command, property);
  const policyContextValue = command.policyContext?.scope?.[property];
  const value = directValue ?? policyContextValue;

  return value === undefined ? {} : { [property]: value };
}

function getDirectCommandScopeValue(command: PipelineCommand, property: string): string | undefined {
  const value = (command as Record<string, unknown>)[property];

  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function attachPolicyDecisionToResult(
  result: CommandResult,
  effects: CommandEffects,
  decision: PolicyDecision,
): CommandResult {
  const policy = createPolicyEvidence(decision);

  return {
    ...result,
    policy,
    emittedEvents: effects.outboxEvents.map((outboxEvent) => ({
      eventId: outboxEvent.envelope.eventId,
      eventType: outboxEvent.envelope.eventType,
      aggregateId: outboxEvent.envelope.aggregate.aggregateId,
      aggregateType: outboxEvent.envelope.aggregate.aggregateType,
    })),
    auditEventIds: effects.auditEvents.map((auditEvent) => auditEvent.auditEventId),
  };
}

function attachPolicyDecisionEvidence(effects: CommandEffects, decision: PolicyDecision): CommandEffects {
  const policy = createPolicyEvidence(decision);

  return {
    supervisorSignals: effects.supervisorSignals,
    discussionAnchors: effects.discussionAnchors,
    decisionRecords: effects.decisionRecords,
    workScheduleBlocks: effects.workScheduleBlocks,
    workAnchors: effects.workAnchors,
    auditEvents: effects.auditEvents.map((auditEvent) => ({
      ...auditEvent,
      policy,
    })),
    outboxEvents: effects.outboxEvents.map((outboxEvent) => ({
      ...outboxEvent,
      envelope: {
        ...outboxEvent.envelope,
        policy,
      },
    })),
  };
}

async function dispatchCommand<Command extends PipelineCommand>(
  command: Command,
  dependencies: CommandPipelineDependencies<Command>,
): Promise<{ result: CommandResult; effects: CommandEffects }> {
  const handler = dependencies.handlerRegistry.resolveHandler(command.type);

  if (handler !== undefined) {
    return await handler.execute(command, dependencies);
  }

  return {
    result: {
      commandId: command.commandId,
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

function createIdempotencyConflictResult(command: PipelineCommand): CommandResult {
  return {
    commandId: command.commandId,
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

function createEffectConflictResult(
  command: PipelineCommand,
  reason: CommandOutcomeEffectConflictReason,
): CommandResult {
  return {
    commandId: command.commandId,
    status: CommandResultStatus.Rejected,
    idempotency: {
      replayed: false,
    },
    error: {
      code: CommandErrorCode.PreconditionFailed,
      message: createEffectConflictMessage(reason),
    },
  };
}

function createEffectConflictMessage(reason: CommandOutcomeEffectConflictReason): string {
  if (reason === CommandOutcomeEffectConflictReason.WorkScheduleBlockOverlap) {
    return "schedule block overlaps an existing active or scheduled block for the same hat assignment";
  }

  if (reason === CommandOutcomeEffectConflictReason.UnsupportedDiscussionAnchorEffectType) {
    return "unsupported discussion anchor effect type";
  }

  if (reason === CommandOutcomeEffectConflictReason.WorkAnchorEffectConflict) {
    return "work anchor command effect conflict";
  }

  return "command effects conflict with current state";
}

function createPolicyObservationConflictResult(
  command: PipelineCommand,
  decision: Extract<PolicyDecision, { status: "denied" }>,
): CommandResult {
  return {
    commandId: command.commandId,
    status: CommandResultStatus.Rejected,
    policy: createPolicyEvidence(decision),
    idempotency: {
      replayed: false,
    },
    error: {
      code: CommandErrorCode.PolicyObservationConflict,
      message: "command denied but policy decision observation conflicts with existing governance evidence",
      policyDecisionId: decision.decisionId,
      policyVersion: decision.policyVersion,
      reason: decision.reason,
      observationFailureReason: "policy_decision_observation_conflict",
    },
  };
}

function createPolicyEvidence(decision: PolicyDecision): NonNullable<CommandResult["policy"]> {
  return {
    decisionId: decision.decisionId,
    policyVersion: decision.policyVersion,
  };
}

function createEmptyCommandEffects(): CommandEffects {
  return {
    supervisorSignals: [],
    discussionAnchors: [],
    decisionRecords: [],
    workScheduleBlocks: [],
    auditEvents: [],
    outboxEvents: [],
    workAnchors: createEmptyWorkAnchorCommandEffects(),
  };
}

function createEmptyWorkAnchorCommandEffects(): NonNullable<CommandEffects["workAnchors"]> {
  return {
    projects: [],
    initiatives: [],
    workItems: [],
    workAnchorTargets: [],
    workItemTransitions: [],
  };
}
