import {
  CommandOutcomeEffectConflictReason,
  CommandOutcomePersistenceStatus,
  type CommandStateStore,
  type CommandStateStoreFactory,
} from "../../application/src/ports.ts";
import type {
  AuditEvent,
  DecisionRecord,
  DiscussionAnchor,
  IdempotencyRecord,
  OutboxEvent,
  SupervisorSignal,
  WorkScheduleBlock,
} from "../../domain/src/index.ts";
import { DiscussionAnchorType, ScheduleBlockState } from "../../domain/src/index.ts";
import {
  WorkAnchorConflictReason,
  WorkAnchorPersistenceStatus,
  type PersistedInitiative,
  type PersistedProject,
  type PersistedWorkAnchorTarget,
  type PersistedWorkItem,
  type PersistedWorkStateTransition,
  type TransitionWorkItemInput,
  type WorkAnchorPersistenceResult,
  validateWorkItemTransitionInput,
} from "./work-anchor-store.ts";

export type InMemoryOrganizationStoreSnapshot<Result = unknown> = {
  readonly workItems: readonly PersistedWorkItem[];
  readonly projects: readonly PersistedProject[];
  readonly initiatives: readonly PersistedInitiative[];
  readonly workAnchorTargets: readonly PersistedWorkAnchorTarget[];
  readonly workStateTransitions: readonly PersistedWorkStateTransition[];
  readonly supervisorSignals: readonly SupervisorSignal[];
  readonly discussionAnchors: readonly DiscussionAnchor[];
  readonly decisionRecords: readonly DecisionRecord[];
  readonly workScheduleBlocks: readonly WorkScheduleBlock[];
  readonly auditEvents: readonly AuditEvent[];
  readonly outboxEvents: readonly OutboxEvent[];
  readonly idempotencyRecords: ReadonlyMap<string, IdempotencyRecord<Result>>;
};

export type InMemoryOrganizationStoreFactory<Result = unknown> = CommandStateStoreFactory<Result> & {
  readonly snapshot: InMemoryOrganizationStoreSnapshot<Result>;
};

export function createInMemoryOrganizationStoreFactory<Result = unknown>(): InMemoryOrganizationStoreFactory<Result> {
  let currentSnapshot = createEmptySnapshot<Result>();

  return {
    get snapshot() {
      return cloneMutableSnapshot(currentSnapshot);
    },
    createCommandStateStore: () => {
      currentSnapshot = createEmptySnapshot<Result>();
      return createCommandStateStore(currentSnapshot);
    },
  };
}

type MutableInMemoryOrganizationStoreSnapshot<Result> = {
  workItems: PersistedWorkItem[];
  projects: PersistedProject[];
  initiatives: PersistedInitiative[];
  workAnchorTargets: PersistedWorkAnchorTarget[];
  workStateTransitions: PersistedWorkStateTransition[];
  supervisorSignals: SupervisorSignal[];
  discussionAnchors: DiscussionAnchor[];
  decisionRecords: DecisionRecord[];
  workScheduleBlocks: WorkScheduleBlock[];
  auditEvents: AuditEvent[];
  outboxEvents: OutboxEvent[];
  idempotencyRecords: Map<string, IdempotencyRecord<Result>>;
};

function createEmptySnapshot<Result>(): MutableInMemoryOrganizationStoreSnapshot<Result> {
  return {
    workItems: [],
    projects: [],
    initiatives: [],
    workAnchorTargets: [],
    workStateTransitions: [],
    supervisorSignals: [],
    discussionAnchors: [],
    decisionRecords: [],
    workScheduleBlocks: [],
    auditEvents: [],
    outboxEvents: [],
    idempotencyRecords: new Map<string, IdempotencyRecord<Result>>(),
  };
}

function createCommandStateStore<Result>(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<Result>,
): CommandStateStore<Result> {
  return {
    findIdempotencyRecord: async (idempotencyKey) => snapshot.idempotencyRecords.get(idempotencyKey),
    recordCommandOutcome: async (input) => {
      const existingRecord = snapshot.idempotencyRecords.get(input.idempotencyRecord.idempotencyKey);

      if (existingRecord?.requestHash === input.idempotencyRecord.requestHash) {
        return {
          status: CommandOutcomePersistenceStatus.Replayed,
          result: existingRecord.result,
        };
      }

      if (existingRecord !== undefined) {
        return {
          status: CommandOutcomePersistenceStatus.IdempotencyConflict,
          existingRequestHash: existingRecord.requestHash,
        };
      }

      const effectConflict = findCommandEffectConflict(snapshot, input.effects);

      if (effectConflict !== undefined) {
        return {
          status: CommandOutcomePersistenceStatus.EffectConflict,
          reason: effectConflict,
        };
      }

      const nextSnapshot = cloneMutableSnapshot(snapshot);

      nextSnapshot.idempotencyRecords.set(input.idempotencyRecord.idempotencyKey, cloneRecord(input.idempotencyRecord));
      try {
        applyProjectCreates(nextSnapshot, input.effects.workAnchors?.projects ?? []);
        applyInitiativeCreates(nextSnapshot, input.effects.workAnchors?.initiatives ?? []);
        applyWorkItemCreates(nextSnapshot, input.effects.workAnchors?.workItems ?? []);
        applyWorkAnchorTargetCreates(nextSnapshot, input.effects.workAnchors?.workAnchorTargets ?? []);
        applyWorkItemTransitions(nextSnapshot, input.effects.workAnchors?.workItemTransitions ?? []);
      } catch (error) {
        if (error instanceof InMemoryWorkAnchorEffectConflictError) {
          return {
            status: CommandOutcomePersistenceStatus.EffectConflict,
            reason: CommandOutcomeEffectConflictReason.WorkAnchorEffectConflict,
          };
        }

        throw error;
      }
      nextSnapshot.supervisorSignals.push(...input.effects.supervisorSignals.map(cloneRecord));
      applyDiscussionAnchorCreates(nextSnapshot, input.effects.discussionAnchors);
      applyDecisionRecordCreates(nextSnapshot, input.effects.decisionRecords);
      applyWorkScheduleBlockCreates(nextSnapshot, input.effects.workScheduleBlocks);
      nextSnapshot.auditEvents.push(...input.effects.auditEvents.map(cloneRecord));
      nextSnapshot.outboxEvents.push(...input.effects.outboxEvents.map(cloneRecord));
      replaceSnapshot(snapshot, nextSnapshot);

      return {
        status: CommandOutcomePersistenceStatus.Committed,
        result: input.idempotencyRecord.result,
      };
    },
  };
}

function cloneMutableSnapshot<Result>(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<Result>,
): MutableInMemoryOrganizationStoreSnapshot<Result> {
  return {
    workItems: snapshot.workItems.map(cloneRecord),
    projects: snapshot.projects.map(cloneRecord),
    initiatives: snapshot.initiatives.map(cloneRecord),
    workAnchorTargets: snapshot.workAnchorTargets.map(cloneRecord),
    workStateTransitions: snapshot.workStateTransitions.map(cloneRecord),
    supervisorSignals: snapshot.supervisorSignals.map(cloneRecord),
    discussionAnchors: snapshot.discussionAnchors.map(cloneRecord),
    decisionRecords: snapshot.decisionRecords.map(cloneRecord),
    workScheduleBlocks: snapshot.workScheduleBlocks.map(cloneRecord),
    auditEvents: snapshot.auditEvents.map(cloneRecord),
    outboxEvents: snapshot.outboxEvents.map(cloneRecord),
    idempotencyRecords: cloneIdempotencyRecords(snapshot.idempotencyRecords),
  };
}

function replaceSnapshot<Result>(
  target: MutableInMemoryOrganizationStoreSnapshot<Result>,
  source: MutableInMemoryOrganizationStoreSnapshot<Result>,
): void {
  target.workItems = source.workItems;
  target.projects = source.projects;
  target.initiatives = source.initiatives;
  target.workAnchorTargets = source.workAnchorTargets;
  target.workStateTransitions = source.workStateTransitions;
  target.supervisorSignals = source.supervisorSignals;
  target.discussionAnchors = source.discussionAnchors;
  target.decisionRecords = source.decisionRecords;
  target.workScheduleBlocks = source.workScheduleBlocks;
  target.auditEvents = source.auditEvents;
  target.outboxEvents = source.outboxEvents;
  target.idempotencyRecords = source.idempotencyRecords;
}

function applyWorkItemTransitions(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  transitions: readonly TransitionWorkItemInput[],
): void {
  for (const transitionInput of transitions) {
    const currentWorkItemIndex = snapshot.workItems.findIndex(
      (workItem) => workItem.workItemId === transitionInput.nextWorkItem.workItemId,
    );
    const currentWorkItem = snapshot.workItems[currentWorkItemIndex];

    if (currentWorkItem === undefined) {
      throwWorkAnchorConflict(WorkAnchorConflictReason.MissingWorkItem);
    }

    const validationConflict = validateWorkItemTransitionInput({
      currentWorkItem,
      transitionInput,
      hasTransitionId: (workStateTransitionId) =>
        snapshot.workStateTransitions.some((transition) => transition.workStateTransitionId === workStateTransitionId),
      hasTransitionSequence: (workItemId, sequence) =>
        snapshot.workStateTransitions.some(
          (transition) => transition.workItemId === workItemId && transition.sequence === sequence,
        ),
    });

    if (validationConflict?.status === WorkAnchorPersistenceStatus.Conflict) {
      throwWorkAnchorPersistenceConflict(validationConflict);
    }

    snapshot.workItems[currentWorkItemIndex] = cloneRecord(transitionInput.nextWorkItem);
    snapshot.workStateTransitions.push(cloneRecord(transitionInput.transition));
  }
}

function applyProjectCreates(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  projects: readonly PersistedProject[],
): void {
  for (const project of projects) {
    assertUniqueRecord(snapshot.projects, (record) => record.projectId === project.projectId);
    snapshot.projects.push(cloneRecord(project));
  }
}

function applyInitiativeCreates(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  initiatives: readonly PersistedInitiative[],
): void {
  for (const initiative of initiatives) {
    assertUniqueRecord(snapshot.initiatives, (record) => record.initiativeId === initiative.initiativeId);
    snapshot.initiatives.push(cloneRecord(initiative));
  }
}

function applyWorkItemCreates(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  workItems: readonly PersistedWorkItem[],
): void {
  for (const workItem of workItems) {
    assertUniqueRecord(snapshot.workItems, (record) => record.workItemId === workItem.workItemId);
    snapshot.workItems.push(cloneRecord(workItem));
  }
}

function applyWorkAnchorTargetCreates(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  workAnchorTargets: readonly PersistedWorkAnchorTarget[],
): void {
  for (const workAnchorTarget of workAnchorTargets) {
    assertUniqueRecord(
      snapshot.workAnchorTargets,
      (record) => record.workAnchorTargetId === workAnchorTarget.workAnchorTargetId,
    );
    snapshot.workAnchorTargets.push(cloneRecord(workAnchorTarget));
  }
}

function applyDiscussionAnchorCreates(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  discussionAnchors: readonly DiscussionAnchor[],
): void {
  for (const discussionAnchor of discussionAnchors) {
    assertUniqueRecord(
      snapshot.discussionAnchors,
      (record) => record.discussionAnchorId === discussionAnchor.discussionAnchorId,
    );
    snapshot.discussionAnchors.push(cloneRecord(discussionAnchor));
  }
}

function findCommandEffectConflict(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  effects: Parameters<CommandStateStore["recordCommandOutcome"]>[0]["effects"],
): CommandOutcomeEffectConflictReason | undefined {
  for (const discussionAnchor of effects.discussionAnchors) {
    if (discussionAnchor.discussionAnchorType !== DiscussionAnchorType.WorkItem) {
      return CommandOutcomeEffectConflictReason.UnsupportedDiscussionAnchorEffectType;
    }
  }

  for (const workScheduleBlock of effects.workScheduleBlocks) {
    if (hasOverlappingWorkScheduleBlock(effects.workScheduleBlocks, workScheduleBlock)) {
      return CommandOutcomeEffectConflictReason.WorkScheduleBlockOverlap;
    }

    if (hasOverlappingWorkScheduleBlock(snapshot.workScheduleBlocks, workScheduleBlock)) {
      return CommandOutcomeEffectConflictReason.WorkScheduleBlockOverlap;
    }
  }

  return undefined;
}

function applyDecisionRecordCreates(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  decisionRecords: readonly DecisionRecord[],
): void {
  for (const decisionRecord of decisionRecords) {
    assertUniqueRecord(
      snapshot.decisionRecords,
      (record) => record.decisionRecordId === decisionRecord.decisionRecordId,
    );
    snapshot.decisionRecords.push(cloneRecord(decisionRecord));
  }
}

function applyWorkScheduleBlockCreates(
  snapshot: MutableInMemoryOrganizationStoreSnapshot<unknown>,
  workScheduleBlocks: readonly WorkScheduleBlock[],
): void {
  for (const workScheduleBlock of workScheduleBlocks) {
    assertUniqueRecord(
      snapshot.workScheduleBlocks,
      (record) => record.workScheduleBlockId === workScheduleBlock.workScheduleBlockId,
    );
    snapshot.workScheduleBlocks.push(cloneRecord(workScheduleBlock));
  }
}

function hasOverlappingWorkScheduleBlock(
  existingBlocks: readonly WorkScheduleBlock[],
  candidate: WorkScheduleBlock,
): boolean {
  return existingBlocks.some(
    (existingBlock) =>
      existingBlock.workScheduleBlockId !== candidate.workScheduleBlockId &&
      existingBlock.assignedHatAssignmentId === candidate.assignedHatAssignmentId &&
      isCapacityHoldingScheduleBlockState(existingBlock.state) &&
      isCapacityHoldingScheduleBlockState(candidate.state) &&
      Date.parse(existingBlock.startsAt) < Date.parse(candidate.endsAt) &&
      Date.parse(existingBlock.endsAt) > Date.parse(candidate.startsAt),
  );
}

function isCapacityHoldingScheduleBlockState(state: WorkScheduleBlock["state"]): boolean {
  return state === ScheduleBlockState.Scheduled || state === ScheduleBlockState.Active;
}

function assertUniqueRecord<Record>(records: readonly Record[], hasMatchingId: (record: Record) => boolean): void {
  if (records.some(hasMatchingId)) {
    throwWorkAnchorConflict(WorkAnchorConflictReason.DuplicateRecord);
  }
}

function throwWorkAnchorPersistenceConflict(result: Extract<WorkAnchorPersistenceResult, { status: "conflict" }>): never {
  throwWorkAnchorConflict(result.reason);
}

function throwWorkAnchorConflict(reason: WorkAnchorConflictReason): never {
  throw new InMemoryWorkAnchorEffectConflictError(reason);
}

class InMemoryWorkAnchorEffectConflictError extends Error {
  readonly reason: WorkAnchorConflictReason;

  constructor(reason: WorkAnchorConflictReason) {
    super(`${WorkAnchorPersistenceStatus.Conflict}:${reason}`);
    this.reason = reason;
  }
}

function cloneIdempotencyRecords<Result>(
  records: ReadonlyMap<string, IdempotencyRecord<Result>>,
): Map<string, IdempotencyRecord<Result>> {
  return new Map(Array.from(records.entries()).map(([idempotencyKey, record]) => [idempotencyKey, cloneRecord(record)]));
}

function cloneRecord<Record>(record: Record): Record {
  return structuredClone(record);
}
