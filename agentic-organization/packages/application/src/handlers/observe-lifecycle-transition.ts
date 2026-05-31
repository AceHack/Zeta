import {
  AgenticAggregateType,
  AgenticEventType,
  assertWorkItemTransition,
  createAgenticEventEnvelope,
  WorkItemState,
  type AgenticEventEnvelope,
} from "../../../domain/src/index.ts";
import type { CommandHandler, CommandHandlerOutcome } from "../command-handler-registry.ts";
import type { PipelineCommand } from "../command-contract.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  type CommandResult,
} from "../command-result.ts";
import {
  ObserveCommandType,
  RunLifecyclePhase,
  type LifecycleTransitionCommandPayload,
} from "../observe.ts";
import type {
  Clock,
  CommandEffects,
  CommandWorkAnchorTransitionInput,
  CommandWorkAnchorWorkItem,
  IdGenerator,
  WorkAnchorStateReaderPort,
} from "../ports.ts";

export const ObserveLifecycleTransitionIdPrefix = {
  Audit: "audit",
  Event: "evt",
  Outbox: "outbox",
  WorkStateTransition: "work-state-transition",
} as const;

export type ObserveLifecycleTransitionIdPrefix =
  (typeof ObserveLifecycleTransitionIdPrefix)[keyof typeof ObserveLifecycleTransitionIdPrefix];

export const ObserveLifecycleTransitionValidationErrorMessage = {
  MissingWorkItem: "observe lifecycle transition requires an existing work item",
  MissingWorkItemReader: "observe lifecycle transition requires work-anchor validation",
  UnsupportedLifecycleAction: "observe lifecycle action is not mapped to a work-item state transition",
  WorkItemStateMismatch: "observe lifecycle transition does not match the current work-item state",
  IllegalWorkItemTransition: "observe lifecycle transition is illegal for the current work item",
} as const;

export type ObserveLifecycleTransitionValidationErrorMessage =
  (typeof ObserveLifecycleTransitionValidationErrorMessage)[keyof typeof ObserveLifecycleTransitionValidationErrorMessage];

export type ObserveLifecycleTransitionCommand = PipelineCommand &
  LifecycleTransitionCommandPayload & {
    type: typeof ObserveCommandType.LifecycleTransition;
    workItemId: string;
    teamId?: string;
    evidenceArtifactIds?: readonly string[];
    assignedEngineerHatAssignmentId?: string;
    scheduledWorkBlockId?: string;
  };

export type ObserveLifecycleTransitionDependencies = Clock &
  IdGenerator & {
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

type WorkItemTransitionMapping = {
  fromPhase: RunLifecyclePhase;
  toPhase: RunLifecyclePhase;
  fromState: WorkItemState;
  toState: WorkItemState;
};

const LIFECYCLE_TRANSITIONS: Readonly<Record<string, WorkItemTransitionMapping>> = {
  execute: {
    fromPhase: RunLifecyclePhase.AwaitingGate,
    toPhase: RunLifecyclePhase.Executing,
    fromState: WorkItemState.Ready,
    toState: WorkItemState.InProgress,
  },
  request_review: {
    fromPhase: RunLifecyclePhase.AwaitingEvidence,
    toPhase: RunLifecyclePhase.AwaitingReview,
    fromState: WorkItemState.InProgress,
    toState: WorkItemState.Review,
  },
  complete: {
    fromPhase: RunLifecyclePhase.AwaitingReview,
    toPhase: RunLifecyclePhase.Completed,
    fromState: WorkItemState.Review,
    toState: WorkItemState.Done,
  },
  rework: {
    fromPhase: RunLifecyclePhase.AwaitingReview,
    toPhase: RunLifecyclePhase.Executing,
    fromState: WorkItemState.Review,
    toState: WorkItemState.InProgress,
  },
  resume: {
    fromPhase: RunLifecyclePhase.Blocked,
    toPhase: RunLifecyclePhase.Observing,
    fromState: WorkItemState.Blocked,
    toState: WorkItemState.InProgress,
  },
} as const;

export function createObserveLifecycleTransitionHandler(): CommandHandler<
  ObserveLifecycleTransitionCommand,
  CommandResult
> {
  return {
    commandType: ObserveCommandType.LifecycleTransition,
    execute: observeLifecycleTransition,
  };
}

export async function observeLifecycleTransition(
  command: ObserveLifecycleTransitionCommand,
  dependencies: ObserveLifecycleTransitionDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const mapping = LIFECYCLE_TRANSITIONS[command.actionType];
  if (
    mapping === undefined ||
    mapping.fromPhase !== command.fromPhase ||
    mapping.toPhase !== command.toPhase
  ) {
    return createRejectedOutcome(command, ObserveLifecycleTransitionValidationErrorMessage.UnsupportedLifecycleAction);
  }

  const workItemValidation = await loadWorkItem(command, dependencies);
  if (workItemValidation.status === "rejected") {
    return createRejectedOutcome(command, workItemValidation.message);
  }

  if (workItemValidation.workItem.state !== mapping.fromState) {
    return createRejectedOutcome(command, ObserveLifecycleTransitionValidationErrorMessage.WorkItemStateMismatch);
  }

  if (!isLegalTransition(workItemValidation.workItem, mapping, command)) {
    return createRejectedOutcome(command, ObserveLifecycleTransitionValidationErrorMessage.IllegalWorkItemTransition);
  }

  const occurredAt = dependencies.now();
  const transitionInput = createWorkAnchorTransition(command, workItemValidation.workItem, mapping, dependencies, occurredAt);
  const auditEventId = dependencies.createId(ObserveLifecycleTransitionIdPrefix.Audit);
  const envelope = createAgenticEventEnvelope<Record<string, unknown>>({
    eventId: dependencies.createId(ObserveLifecycleTransitionIdPrefix.Event),
    eventType: AgenticEventType.WorkItemStateChanged,
    occurredAt,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      ...createOptionalTeamScope(command),
      workItemId: command.workItemId,
    },
    aggregate: {
      aggregateId: command.workItemId,
      aggregateType: AgenticAggregateType.WorkItem,
      aggregateVersion: transitionInput.nextWorkItem.metadata.version,
    },
    trace: {
      commandId: command.commandId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
    payload: {
      fromState: mapping.fromState,
      toState: mapping.toState,
      runId: command.runId,
      actionType: command.actionType,
      fromPhase: command.fromPhase,
      toPhase: command.toPhase,
      toScope: command.toScope,
    },
  });

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [
        {
          artifactType: CommandResultArtifactType.WorkItem,
          artifactId: command.workItemId,
          label: `observe ${command.actionType}`,
        },
      ],
      emittedEvents: [
        {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          aggregateId: envelope.aggregate.aggregateId,
          aggregateType: envelope.aggregate.aggregateType,
        },
      ],
      auditEventIds: [auditEventId],
      workItem: transitionInput.nextWorkItem,
      idempotency: {
        replayed: false,
      },
    },
    effects: createEffects(
      command,
      transitionInput,
      auditEventId,
      dependencies.createId(ObserveLifecycleTransitionIdPrefix.Outbox),
      occurredAt,
      envelope,
    ),
  };
}

function createRejectedOutcome(
  command: ObserveLifecycleTransitionCommand,
  message: ObserveLifecycleTransitionValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code: CommandErrorCode.PreconditionFailed,
        message,
      },
    },
    effects: createEmptyEffects(),
  };
}

async function loadWorkItem(
  command: ObserveLifecycleTransitionCommand,
  dependencies: ObserveLifecycleTransitionDependencies,
): Promise<
  | { status: "accepted"; workItem: CommandWorkAnchorWorkItem }
  | { status: "rejected"; message: ObserveLifecycleTransitionValidationErrorMessage }
> {
  if (dependencies.workAnchorStateReader === undefined) {
    return {
      status: "rejected",
      message: ObserveLifecycleTransitionValidationErrorMessage.MissingWorkItemReader,
    };
  }

  const workItem = await dependencies.workAnchorStateReader.findWorkItem(command.workItemId);
  if (workItem === undefined) {
    return {
      status: "rejected",
      message: ObserveLifecycleTransitionValidationErrorMessage.MissingWorkItem,
    };
  }

  return { status: "accepted", workItem };
}

function isLegalTransition(
  workItem: CommandWorkAnchorWorkItem,
  mapping: WorkItemTransitionMapping,
  command: ObserveLifecycleTransitionCommand,
): boolean {
  try {
    assertWorkItemTransition(mapping.fromState, mapping.toState, {
      assignedEngineerHatAssignmentId: command.assignedEngineerHatAssignmentId,
      scheduledWorkBlockId: command.scheduledWorkBlockId,
      hasRequiredEvidence: (command.evidenceArtifactIds?.length ?? 0) > 0,
      workItemType: workItem.workItemType,
    });
    return true;
  } catch {
    return false;
  }
}

function createWorkAnchorTransition(
  command: ObserveLifecycleTransitionCommand,
  workItem: CommandWorkAnchorWorkItem,
  mapping: WorkItemTransitionMapping,
  dependencies: ObserveLifecycleTransitionDependencies,
  occurredAt: string,
): CommandWorkAnchorTransitionInput {
  const nextVersion = workItem.metadata.version + 1;
  const nextWorkItem: CommandWorkAnchorWorkItem = {
    ...workItem,
    state: mapping.toState,
    updatedAt: occurredAt,
    metadata: {
      updatedAt: occurredAt,
      version: nextVersion,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };

  return {
    expectedVersion: workItem.metadata.version,
    nextWorkItem,
    transition: {
      workStateTransitionId: dependencies.createId(ObserveLifecycleTransitionIdPrefix.WorkStateTransition),
      organizationId: command.organizationId,
      projectId: command.projectId,
      workItemId: command.workItemId,
      sequence: workItem.metadata.version,
      fromState: mapping.fromState,
      toState: mapping.toState,
      evidenceArtifactIds: command.evidenceArtifactIds ?? [],
      transitionedAt: occurredAt,
      transitionedBy: command.actor,
      metadata: {
        updatedAt: occurredAt,
        version: nextVersion,
        correlationId: command.correlationId,
        causationId: command.causationId,
        traceId: command.traceId,
      },
      ...createOptionalAssignedEngineer(command),
      ...createOptionalScheduledBlock(command),
    },
  };
}

function createEffects(
  command: ObserveLifecycleTransitionCommand,
  transitionInput: CommandWorkAnchorTransitionInput,
  auditEventId: string,
  outboxEventId: string,
  occurredAt: string,
  envelope: AgenticEventEnvelope<Record<string, unknown>>,
): CommandEffects {
  return {
    supervisorSignals: [],
    discussionAnchors: [],
    decisionRecords: [],
    qualityGateEvaluations: [],
    workScheduleBlocks: [],
    auditEvents: [
      {
        auditEventId,
        eventName: AgenticEventType.WorkItemStateChanged,
        aggregateId: command.workItemId,
        actor: command.actor,
        occurredAt,
      },
    ],
    outboxEvents: [
      {
        outboxEventId,
        envelope,
      },
    ],
    workAnchors: {
      projects: [],
      initiatives: [],
      workItems: [],
      workAnchorTargets: [],
      workItemTransitions: [transitionInput],
    },
  };
}

function createEmptyEffects(): CommandEffects {
  return {
    supervisorSignals: [],
    discussionAnchors: [],
    decisionRecords: [],
    qualityGateEvaluations: [],
    workScheduleBlocks: [],
    auditEvents: [],
    outboxEvents: [],
    workAnchors: {
      projects: [],
      initiatives: [],
      workItems: [],
      workAnchorTargets: [],
      workItemTransitions: [],
    },
  };
}

function createOptionalTeamScope(command: ObserveLifecycleTransitionCommand): { teamId?: string } {
  return command.teamId === undefined ? {} : { teamId: command.teamId };
}

function createOptionalAssignedEngineer(
  command: ObserveLifecycleTransitionCommand,
): { assignedEngineerHatAssignmentId?: string } {
  return command.assignedEngineerHatAssignmentId === undefined
    ? {}
    : { assignedEngineerHatAssignmentId: command.assignedEngineerHatAssignmentId };
}

function createOptionalScheduledBlock(command: ObserveLifecycleTransitionCommand): { scheduledWorkBlockId?: string } {
  return command.scheduledWorkBlockId === undefined ? {} : { scheduledWorkBlockId: command.scheduledWorkBlockId };
}
