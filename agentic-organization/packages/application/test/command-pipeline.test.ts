import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  EventSchemaVersion,
  SupervisorChainLevel,
  SupervisorSignalToolType,
} from "../../domain/src/index.ts";
import {
  HatAuthorityDecisionStatus,
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  type CommandAuthorizationPort,
  type CommandAuthorizationRequest,
  type PolicyDecisionObservation,
  type PolicyDecisionObservationPort,
} from "../../policy/src/index.ts";
import { createInMemoryOrganizationStoreFactory } from "../../state/src/index.ts";
import { createCommandHandlerRegistry } from "../src/command-handler-registry.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  type CommandResult,
} from "../src/command-result.ts";
import { createCommandPipeline } from "../src/command-pipeline.ts";
import {
  createSendSupervisorSignalHandler,
  type SendSupervisorSignalCommand,
} from "../src/handlers/send-supervisor-signal.ts";
import type { PipelineCommand } from "../src/command-contract.ts";
import {
  CommandOutcomePersistenceStatus,
  type CommandStateStore,
  type CommandStateStoreFactory,
  type RecordCommandOutcomeInput,
  type RecordCommandOutcomeResult,
} from "../src/ports.ts";

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

const ApplicationTestCommandType = {
  RecordGenericArtifact: "test.record_generic_artifact",
} as const;

type RecordGenericArtifactCommand = PipelineCommand & {
  type: typeof ApplicationTestCommandType.RecordGenericArtifact;
  relatedWorkItemId?: string;
};

type OrganizationTestCommand = SendSupervisorSignalCommand | RecordGenericArtifactCommand;

describe("command pipeline idempotency", () => {
  test("executes heterogeneous command handlers from one runtime registry", async () => {
    const genericCommand: RecordGenericArtifactCommand = {
      commandId: "cmd-generic-artifact-mixed-001",
      type: ApplicationTestCommandType.RecordGenericArtifact,
      idempotencyKey: "idem-generic-artifact-mixed-001",
      requestHash: "hash-generic-artifact-mixed-001",
      correlationId: "corr-generic-artifact-mixed-001",
      causationId: "cause-generic-artifact-mixed-001",
      traceId: "trace-generic-artifact-mixed-001",
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
    };
    const pipeline = createCommandPipeline<OrganizationTestCommand>({
      stateStoreFactory: createRecordingCommandStateStoreFactory<CommandResult>(),
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
      handlerRegistry: createCommandHandlerRegistry<OrganizationTestCommand, CommandResult>([
        createSendSupervisorSignalHandler(),
        createGenericArtifactHandler(),
      ]),
      now: () => "2026-05-28T21:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const supervisorResult = await pipeline.execute(command);
    const genericResult = await pipeline.execute(genericCommand);

    equal(supervisorResult.status, CommandResultStatus.Accepted);
    equal(supervisorResult.supervisorSignal?.supervisorSignalId, "supervisor-signal-001");
    equal(genericResult.status, CommandResultStatus.Accepted);
    deepEqual(genericResult.artifacts, [
      {
        artifactType: CommandResultArtifactType.Generic,
        artifactId: "generic-artifact-001",
        label: "Generic command artifact",
      },
    ]);
  });

  test("executes a second registered command type without changing pipeline internals", async () => {
    const genericCommand: RecordGenericArtifactCommand = {
      commandId: "cmd-generic-artifact-001",
      type: ApplicationTestCommandType.RecordGenericArtifact,
      idempotencyKey: "idem-generic-artifact-001",
      requestHash: "hash-generic-artifact-001",
      correlationId: "corr-generic-artifact-001",
      causationId: "cause-generic-artifact-001",
      traceId: "trace-generic-artifact-001",
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
    };
    const commandAuthorizationPort = createAllowingCommandAuthorizationPort();
    const pipeline = createCommandPipeline<RecordGenericArtifactCommand>({
      stateStoreFactory: createRecordingCommandStateStoreFactory<CommandResult>(),
      commandAuthorizationPort,
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
      handlerRegistry: createCommandHandlerRegistry([createGenericArtifactHandler()]),
      now: () => "2026-05-28T21:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(genericCommand);

    equal(result.status, CommandResultStatus.Accepted);
    equal(result.commandId, genericCommand.commandId);
    deepEqual(result.artifacts, [
      {
        artifactType: CommandResultArtifactType.Generic,
        artifactId: "generic-artifact-001",
        label: "Generic command artifact",
      },
    ]);
    deepEqual(result.emittedEvents, []);
    deepEqual(commandAuthorizationPort.requests[0], {
      commandId: genericCommand.commandId,
      commandType: genericCommand.type,
      actor: genericCommand.actor,
      scope: {
        organizationId: genericCommand.organizationId,
        projectId: genericCommand.projectId,
      },
      trace: {
        correlationId: genericCommand.correlationId,
        causationId: genericCommand.causationId,
        traceId: genericCommand.traceId,
        idempotencyKey: genericCommand.idempotencyKey,
      },
    });
  });

  test("derives committed event and audit metadata from handler effects", async () => {
    const genericCommand: RecordGenericArtifactCommand = {
      commandId: "cmd-generic-artifact-002",
      type: ApplicationTestCommandType.RecordGenericArtifact,
      idempotencyKey: "idem-generic-artifact-002",
      requestHash: "hash-generic-artifact-002",
      correlationId: "corr-generic-artifact-002",
      causationId: "cause-generic-artifact-002",
      traceId: "trace-generic-artifact-002",
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
    };
    const pipeline = createCommandPipeline<RecordGenericArtifactCommand>({
      stateStoreFactory: createRecordingCommandStateStoreFactory<CommandResult>(),
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
      handlerRegistry: createCommandHandlerRegistry([createGenericArtifactHandlerWithEffects()]),
      now: () => "2026-05-28T21:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(genericCommand);

    equal(result.status, CommandResultStatus.Accepted);
    deepEqual(result.emittedEvents, [
      {
        eventId: "evt-committed-001",
        eventType: AgenticEventType.WorkItemChanged,
        aggregateId: "work-generic-artifact-002",
        aggregateType: AgenticAggregateType.WorkItem,
      },
    ]);
    deepEqual(result.auditEventIds, ["audit-committed-001"]);
  });

  test("replaying the same idempotency key returns the stored result", async () => {
    const stateStoreFactory = createInMemoryOrganizationStoreFactory<CommandResult>();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
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
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
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
    equal(conflictResult.commandId, command.commandId);
    equal(conflictResult.error?.code, CommandErrorCode.IdempotencyConflict);
    equal(stateStoreFactory.snapshot.supervisorSignals.length, 1);
    equal(stateStoreFactory.snapshot.outboxEvents.length, 1);
  });

  test("records command effects and idempotency through one outcome port", async () => {
    const stateStoreFactory = createRecordingCommandStateStoreFactory<CommandResult>();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
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
    deepEqual(stateStoreFactory.recordedOutcomes[0]?.effects.auditEvents[0]?.policy, {
      decisionId: "policy-decision-allow-001",
      policyVersion: "policy-v1",
    });
    deepEqual(stateStoreFactory.recordedOutcomes[0]?.effects.outboxEvents[0]?.envelope.policy, {
      decisionId: "policy-decision-allow-001",
      policyVersion: "policy-v1",
    });
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
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
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
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
      handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(command);

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.commandId, command.commandId);
    equal(result.error?.code, CommandErrorCode.IdempotencyConflict);
    equal(stateStoreFactory.recordedOutcomes.length, 1);
  });

  test("does not perform piecemeal command writes when outcome recording fails", async () => {
    const stateStoreFactory = createFailingOutcomeCommandStateStoreFactory<CommandResult>("transaction unavailable");
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
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

  test("rejects commands before idempotency lookup when hat policy denies authority", async () => {
    const stateStoreFactory = createRecordingCommandStateStoreFactory<CommandResult>();
    const commandAuthorizationPort = createDenyingCommandAuthorizationPort("policy-decision-denied-001");
    const policyDecisionObservationPort = createRecordingPolicyDecisionObservationPort();
    const deniedHandler = createRecordingCommandHandler();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      commandAuthorizationPort,
      policyDecisionObservationPort,
      handlerRegistry: createCommandHandlerRegistry([deniedHandler]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(command);

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.commandId, command.commandId);
    deepEqual(result.policy, {
      decisionId: "policy-decision-denied-001",
      policyVersion: "policy-v1",
    });
    equal(result.error?.code, CommandErrorCode.PolicyDenied);
    equal(result.error?.policyDecisionId, "policy-decision-denied-001");
    equal(result.error?.policyVersion, "policy-v1");
    equal(result.error?.reason, HatAuthorityDecisionStatus.Expired);
    deepEqual(policyDecisionObservationPort.observations, [
      {
        commandId: command.commandId,
        commandType: command.type,
        actor: command.actor,
        scope: {
          organizationId: command.organizationId,
          projectId: command.projectId,
          teamId: command.policyContext.scope.teamId,
          workItemId: command.policyContext.scope.workItemId,
        },
        toolType: command.policyContext.toolType,
        supervisorChain: {
          sourceLevel: command.policyContext.supervisorChain.sourceLevel,
          targetLevel: command.policyContext.supervisorChain.targetLevel,
        },
        trace: {
          correlationId: command.correlationId,
          causationId: command.causationId,
          traceId: command.traceId,
          idempotencyKey: command.idempotencyKey,
        },
        decision: {
          status: PolicyDecisionStatus.Denied,
          decisionId: "policy-decision-denied-001",
          policyVersion: "policy-v1",
          reason: HatAuthorityDecisionStatus.Expired,
        },
        observedAt: "2026-05-25T20:00:00.000Z",
      },
    ]);
    equal(commandAuthorizationPort.requests.length, 1);
    deepEqual(commandAuthorizationPort.requests[0], {
      commandId: command.commandId,
      commandType: command.type,
      actor: command.actor,
      scope: {
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: command.policyContext.scope.teamId,
        workItemId: command.policyContext.scope.workItemId,
      },
      toolType: command.policyContext.toolType,
      supervisorChain: {
        sourceLevel: command.policyContext.supervisorChain.sourceLevel,
        targetLevel: command.policyContext.supervisorChain.targetLevel,
      },
      trace: {
        correlationId: command.correlationId,
        causationId: command.causationId,
        traceId: command.traceId,
        idempotencyKey: command.idempotencyKey,
      },
    });
    equal(deniedHandler.executeCallCount, 0);
    equal(stateStoreFactory.findCallCount, 0);
    equal(stateStoreFactory.recordedOutcomes.length, 0);
  });

  test("rejects denied commands without executing business effects when policy observation fails", async () => {
    const stateStoreFactory = createRecordingCommandStateStoreFactory<CommandResult>();
    const deniedHandler = createRecordingCommandHandler();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      commandAuthorizationPort: createDenyingCommandAuthorizationPort("policy-decision-denied-001"),
      policyDecisionObservationPort: createFailingPolicyDecisionObservationPort("policy sink unavailable"),
      handlerRegistry: createCommandHandlerRegistry([deniedHandler]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(command);

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.commandId, command.commandId);
    deepEqual(result.policy, {
      decisionId: "policy-decision-denied-001",
      policyVersion: "policy-v1",
    });
    equal(result.error?.code, CommandErrorCode.PolicyObservationFailed);
    equal(result.error?.policyDecisionId, "policy-decision-denied-001");
    equal(result.error?.observationFailureReason, "policy_decision_observation_unavailable");
    equal(deniedHandler.executeCallCount, 0);
    equal(stateStoreFactory.findCallCount, 0);
    equal(stateStoreFactory.recordedOutcomes.length, 0);
  });

  test("distinguishes conflicting policy observations from transient observation failures", async () => {
    const stateStoreFactory = createRecordingCommandStateStoreFactory<CommandResult>();
    const deniedHandler = createRecordingCommandHandler();
    const pipeline = createCommandPipeline({
      stateStoreFactory,
      commandAuthorizationPort: createDenyingCommandAuthorizationPort("policy-decision-denied-001"),
      policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(
        PolicyDecisionObservationPersistenceStatus.Conflict,
      ),
      handlerRegistry: createCommandHandlerRegistry([deniedHandler]),
      now: () => "2026-05-25T20:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await pipeline.execute(command);

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.commandId, command.commandId);
    deepEqual(result.policy, {
      decisionId: "policy-decision-denied-001",
      policyVersion: "policy-v1",
    });
    equal(result.error?.code, CommandErrorCode.PolicyObservationConflict);
    equal(result.error?.policyDecisionId, "policy-decision-denied-001");
    equal(result.error?.observationFailureReason, "policy_decision_observation_conflict");
    equal(deniedHandler.executeCallCount, 0);
    equal(stateStoreFactory.findCallCount, 0);
    equal(stateStoreFactory.recordedOutcomes.length, 0);
  });
});

type RecordingCommandStateStoreFactory<Result> = CommandStateStoreFactory<Result> & {
  readonly findCallCount: number;
  recordedOutcomes: RecordCommandOutcomeInput<Result>[];
};

function createRecordingCommandStateStoreFactory<Result>(): RecordingCommandStateStoreFactory<Result> {
  const recordedOutcomes: RecordCommandOutcomeInput<Result>[] = [];
  let findCallCount = 0;

  return {
    get findCallCount() {
      return findCallCount;
    },
    recordedOutcomes,
    createCommandStateStore: () => ({
      findIdempotencyRecord: async () => {
        findCallCount += 1;
        return undefined;
      },
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

function createAllowingCommandAuthorizationPort(): CommandAuthorizationPort & {
  requests: CommandAuthorizationRequest[];
} {
  const requests: CommandAuthorizationRequest[] = [];

  return {
    requests,
    authorizeCommand: async (request) => {
      requests.push(request);

      return {
        status: PolicyDecisionStatus.Allowed,
        decisionId: "policy-decision-allow-001",
        policyVersion: "policy-v1",
      };
    },
  };
}

function createRecordingPolicyDecisionObservationPort(
  status: PolicyDecisionObservationPersistenceStatus = PolicyDecisionObservationPersistenceStatus.Recorded,
): PolicyDecisionObservationPort & {
  observations: PolicyDecisionObservation[];
} {
  const observations: PolicyDecisionObservation[] = [];

  return {
    observations,
    observePolicyDecision: async (observation) => {
      observations.push(observation);
      return { status };
    },
  };
}

function createFailingPolicyDecisionObservationPort(message: string): PolicyDecisionObservationPort {
  return {
    observePolicyDecision: async () => {
      throw new Error(message);
    },
  };
}

function createDenyingCommandAuthorizationPort(decisionId: string): CommandAuthorizationPort & {
  requests: CommandAuthorizationRequest[];
} {
  const requests: CommandAuthorizationRequest[] = [];

  return {
    requests,
    authorizeCommand: async (request) => {
      requests.push(request);

      return {
        status: PolicyDecisionStatus.Denied,
        decisionId,
        policyVersion: "policy-v1",
        reason: HatAuthorityDecisionStatus.Expired,
      };
    },
  };
}

function createRecordingCommandHandler() {
  let executeCallCount = 0;

  return {
    commandType: CommandType.SendSupervisorSignal,
    get executeCallCount() {
      return executeCallCount;
    },
    execute: async (_recordCommand: PipelineCommand) => {
      executeCallCount += 1;

      return {
        result: {
          status: CommandResultStatus.Accepted,
          idempotency: {
            replayed: false,
          },
        },
        effects: {
          supervisorSignals: [],
          auditEvents: [],
          outboxEvents: [],
        },
      };
    },
  };
}

function createGenericArtifactHandler() {
  return {
    commandType: ApplicationTestCommandType.RecordGenericArtifact,
    execute: async (recordCommand: RecordGenericArtifactCommand) => ({
      result: {
        commandId: recordCommand.commandId,
        status: CommandResultStatus.Accepted,
        artifacts: [
          {
            artifactType: CommandResultArtifactType.Generic,
            artifactId: "generic-artifact-001",
            label: "Generic command artifact",
          },
        ],
        emittedEvents: [],
        auditEventIds: [],
        idempotency: {
          replayed: false,
        },
      },
      effects: {
        supervisorSignals: [],
        auditEvents: [],
        outboxEvents: [],
      },
    }),
  };
}

function createGenericArtifactHandlerWithEffects() {
  return {
    commandType: ApplicationTestCommandType.RecordGenericArtifact,
    execute: async (recordCommand: RecordGenericArtifactCommand) => ({
      result: {
        commandId: recordCommand.commandId,
        status: CommandResultStatus.Accepted,
        artifacts: [
          {
            artifactType: CommandResultArtifactType.Generic,
            artifactId: "generic-artifact-002",
            label: "Generic command artifact",
          },
        ],
        emittedEvents: [],
        auditEventIds: [],
        idempotency: {
          replayed: false,
        },
      },
      effects: {
        supervisorSignals: [],
        auditEvents: [
          {
            auditEventId: "audit-committed-001",
            eventName: AgenticEventType.WorkItemChanged,
            aggregateId: "work-generic-artifact-002",
            actor: recordCommand.actor,
            occurredAt: "2026-05-28T21:00:00.000Z",
          },
        ],
        outboxEvents: [
          {
            outboxEventId: "outbox-committed-001",
            envelope: {
              eventId: "evt-committed-001",
              eventType: AgenticEventType.WorkItemChanged,
              schemaVersion: EventSchemaVersion.AgenticOrgEventV1,
              occurredAt: "2026-05-28T21:00:00.000Z",
              scope: {
                organizationId: recordCommand.organizationId,
                projectId: recordCommand.projectId,
                workItemId: "work-generic-artifact-002",
              },
              actor: recordCommand.actor,
              aggregate: {
                aggregateId: "work-generic-artifact-002",
                aggregateType: AgenticAggregateType.WorkItem,
                aggregateVersion: 1,
              },
              trace: {
                commandId: recordCommand.commandId,
                correlationId: recordCommand.correlationId,
                causationId: recordCommand.causationId,
                traceId: recordCommand.traceId,
                idempotencyKey: recordCommand.idempotencyKey,
              },
              replay: {
                isReplay: false,
              },
              payload: {},
            },
          },
        ],
      },
    }),
  };
}

function createOutcomeResultCommandStateStoreFactory<Result>(
  outcomeResult: RecordCommandOutcomeResult<Result>,
): RecordingCommandStateStoreFactory<Result> {
  const recordedOutcomes: RecordCommandOutcomeInput<Result>[] = [];
  let findCallCount = 0;

  return {
    get findCallCount() {
      return findCallCount;
    },
    recordedOutcomes,
    createCommandStateStore: () => ({
      findIdempotencyRecord: async () => {
        findCallCount += 1;
        return undefined;
      },
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
