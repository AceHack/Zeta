import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  AgenticEventType,
  StageOutcome,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import type {
  CommandAuthorizationPort,
  CommandAuthorizationRequest,
  PolicyDecisionObservation,
  PolicyDecisionObservationPort,
} from "../../policy/src/index.ts";
import {
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
} from "../../policy/src/index.ts";
import {
  asZetaIdDecimal,
  createCommandHandlerRegistry,
  createCommandPipeline,
  createObserveLifecycleTransitionHandler,
  CommandOutcomePersistenceStatus,
  CommandResultStatus,
  ObserveCommandType,
  ObserveLifecycleActionType,
  RunLifecyclePhase,
  RunScope,
  type CommandResult,
  type CommandEffects,
  type CommandStateStoreFactory,
  type ObserveLifecycleTransitionCommand,
} from "../src/index.ts";

test("observe lifecycle transition command appends a work-item state-change event through the command pipeline", async () => {
  let capturedEffects: CommandEffects | undefined;
  const pipeline = createCommandPipeline<ObserveLifecycleTransitionCommand>({
    stateStoreFactory: captureEffectsStoreFactory((effects) => {
      capturedEffects = effects;
    }),
    commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
    policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
    handlerRegistry: createCommandHandlerRegistry<ObserveLifecycleTransitionCommand, CommandResult>([
      createObserveLifecycleTransitionHandler(),
    ]),
    workAnchorStateReader: {
      findProject: async () => undefined,
      findInitiative: async () => undefined,
      findWorkItem: async () => ({
        workItemId: "work-1",
        organizationId: "org-1",
        projectId: "project-1",
        workItemType: WorkItemType.Task,
        title: "Implement observe CLI",
        description: "Route observe lifecycle actions through durable command evidence.",
        state: WorkItemState.Ready,
        createdAt: "2026-05-31T11:55:00.000Z",
        createdBy: { agentId: "agent-1", hatAssignmentId: "hat-assignment-1" },
        metadata: {
          updatedAt: "2026-05-31T11:55:00.000Z",
          version: 1,
          correlationId: "corr-previous",
          causationId: "cause-previous",
          traceId: "trace-previous",
        },
      }),
    },
    now: () => "2026-05-31T12:00:00.000Z",
    createId: (prefix) => `${prefix}-001`,
  });

  const result = await pipeline.execute({
    commandId: "cmd-observe-lifecycle-1",
    type: ObserveCommandType.LifecycleTransition,
    idempotencyKey: "idem-observe-lifecycle-1",
    requestHash: "hash-observe-lifecycle-1",
    correlationId: "corr-observe-lifecycle-1",
    causationId: "cause-observe-lifecycle-1",
    traceId: "trace-observe-lifecycle-1",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
    actor: { agentId: "agent-1", hatAssignmentId: "hat-assignment-1" },
    runId: asZetaIdDecimal("1"),
    fromPhase: RunLifecyclePhase.AwaitingGate,
    actionType: ObserveLifecycleActionType.Execute,
    toPhase: RunLifecyclePhase.Executing,
    toScope: RunScope.WorkItem,
    hatAssignmentId: asZetaIdDecimal("99"),
  });

  equal(result.status, CommandResultStatus.Accepted);
  equal(result.emittedEvents?.[0]?.eventType, AgenticEventType.WorkItemStateChanged);
  equal(capturedEffects?.outboxEvents[0]?.outboxEventId, "outbox-001");
  equal(capturedEffects?.outboxEvents[0]?.envelope.eventType, AgenticEventType.WorkItemStateChanged);
  equal(capturedEffects?.outboxEvents[0]?.envelope.policy?.decisionId, "policy-decision-allow-001");
  equal(capturedEffects?.workAnchors?.workItemTransitions[0]?.transition.fromState, WorkItemState.Ready);
  equal(capturedEffects?.workAnchors?.workItemTransitions[0]?.transition.toState, WorkItemState.InProgress);
});

test("observe lifecycle transition stamps consulted docs on successful completion", async () => {
  let capturedEffects: CommandEffects | undefined;
  const pipeline = createLifecyclePipeline({
    workItemState: WorkItemState.Review,
    capture: (effects) => {
      capturedEffects = effects;
    },
  });

  const result = await pipeline.execute(lifecycleCommand({
    actionType: ObserveLifecycleActionType.Complete,
    fromPhase: RunLifecyclePhase.AwaitingReview,
    toPhase: RunLifecyclePhase.Completed,
    evidenceArtifactIds: ["evidence:review-approved"],
  }));

  equal(result.status, CommandResultStatus.Accepted);
  deepEqual(capturedEffects?.docConsultOutcomeStamps, [{
    organizationId: "org-1",
    agentId: "agent-1",
    hatAssignmentId: "hat-assignment-1",
    projectId: "project-1",
    workItemId: "work-1",
    outcome: StageOutcome.Approve,
    outcomeRef: "work_state_transition:work-state-transition-001",
    outcomeRecordedAt: "2026-05-31T12:00:00.000Z",
  }]);
});

test("observe lifecycle transition stamps consulted docs on review bounce", async () => {
  let capturedEffects: CommandEffects | undefined;
  const pipeline = createLifecyclePipeline({
    workItemState: WorkItemState.Review,
    capture: (effects) => {
      capturedEffects = effects;
    },
  });

  const result = await pipeline.execute(lifecycleCommand({
    actionType: ObserveLifecycleActionType.Rework,
    fromPhase: RunLifecyclePhase.AwaitingReview,
    toPhase: RunLifecyclePhase.Executing,
  }));

  equal(result.status, CommandResultStatus.Accepted);
  deepEqual(capturedEffects?.docConsultOutcomeStamps, [{
    organizationId: "org-1",
    agentId: "agent-1",
    hatAssignmentId: "hat-assignment-1",
    projectId: "project-1",
    workItemId: "work-1",
    outcome: StageOutcome.RequestChanges,
    outcomeRef: "work_state_transition:work-state-transition-001",
    outcomeRecordedAt: "2026-05-31T12:00:00.000Z",
  }]);
});

function createLifecyclePipeline(input: {
  workItemState: WorkItemState;
  capture: (effects: CommandEffects) => void;
}) {
  return createCommandPipeline<ObserveLifecycleTransitionCommand>({
    stateStoreFactory: captureEffectsStoreFactory(input.capture),
    commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
    policyDecisionObservationPort: createRecordingPolicyDecisionObservationPort(),
    handlerRegistry: createCommandHandlerRegistry<ObserveLifecycleTransitionCommand, CommandResult>([
      createObserveLifecycleTransitionHandler(),
    ]),
    workAnchorStateReader: {
      findProject: async () => undefined,
      findInitiative: async () => undefined,
      findWorkItem: async () => ({
        workItemId: "work-1",
        organizationId: "org-1",
        projectId: "project-1",
        workItemType: WorkItemType.Task,
        title: "Implement observe CLI",
        description: "Route observe lifecycle actions through durable command evidence.",
        state: input.workItemState,
        createdAt: "2026-05-31T11:55:00.000Z",
        createdBy: { agentId: "agent-1", hatAssignmentId: "hat-assignment-1" },
        metadata: {
          updatedAt: "2026-05-31T11:55:00.000Z",
          version: 1,
          correlationId: "corr-previous",
          causationId: "cause-previous",
          traceId: "trace-previous",
        },
      }),
    },
    now: () => "2026-05-31T12:00:00.000Z",
    createId: (prefix) => `${prefix}-001`,
  });
}

function lifecycleCommand(
  overrides: Pick<ObserveLifecycleTransitionCommand, "actionType" | "fromPhase" | "toPhase"> &
    Partial<Pick<ObserveLifecycleTransitionCommand, "evidenceArtifactIds">>,
): ObserveLifecycleTransitionCommand {
  return {
    commandId: "cmd-observe-lifecycle-1",
    type: ObserveCommandType.LifecycleTransition,
    idempotencyKey: `idem-observe-lifecycle-${overrides.actionType}`,
    requestHash: `hash-observe-lifecycle-${overrides.actionType}`,
    correlationId: "corr-observe-lifecycle-1",
    causationId: "cause-observe-lifecycle-1",
    traceId: "trace-observe-lifecycle-1",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
    actor: { agentId: "agent-1", hatAssignmentId: "hat-assignment-1" },
    runId: asZetaIdDecimal("1"),
    toScope: RunScope.WorkItem,
    hatAssignmentId: asZetaIdDecimal("99"),
    ...overrides,
  };
}

function captureEffectsStoreFactory<Result>(
  capture: (effects: CommandEffects) => void,
): CommandStateStoreFactory<Result> {
  return {
    createCommandStateStore: () => ({
      findIdempotencyRecord: async () => undefined,
      recordCommandOutcome: async (input) => {
        capture(input.effects);
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

function createRecordingPolicyDecisionObservationPort(): PolicyDecisionObservationPort & {
  observations: PolicyDecisionObservation[];
} {
  return {
    observations: [],
    observePolicyDecision: async () => ({
      status: PolicyDecisionObservationPersistenceStatus.Recorded,
    }),
  };
}
