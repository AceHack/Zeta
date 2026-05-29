import type {
  Initiative,
  Project,
  WorkAnchorTarget,
  WorkItem,
  WorkItemTransitionContext,
  WorkStateTransition,
} from "../../domain/src/index.ts";
import { assertWorkItemTransition } from "../../domain/src/index.ts";

export type WorkAnchorRecordMetadata = {
  updatedAt: string;
  version: number;
  correlationId: string;
  causationId: string;
  traceId: string;
};

export type CreateWorkAnchorInput<Record extends object = object> = Record & {
  metadata: WorkAnchorRecordMetadata;
};

export type PersistedProject = CreateWorkAnchorInput<Project>;
export type PersistedInitiative = CreateWorkAnchorInput<Initiative>;
export type PersistedWorkItem = CreateWorkAnchorInput<WorkItem>;
export type PersistedWorkAnchorTarget = CreateWorkAnchorInput<WorkAnchorTarget>;
export type PersistedWorkStateTransition = CreateWorkAnchorInput<WorkStateTransition> & {
  sequence: number;
};

export const WorkAnchorPersistenceStatus = {
  Committed: "committed",
  Conflict: "conflict",
} as const;

export type WorkAnchorPersistenceStatus =
  (typeof WorkAnchorPersistenceStatus)[keyof typeof WorkAnchorPersistenceStatus];

export const WorkAnchorConflictReason = {
  DuplicateRecord: "duplicate_record",
  DuplicateTransitionId: "duplicate_transition_id",
  DuplicateTransitionSequence: "duplicate_transition_sequence",
  IllegalWorkItemTransition: "illegal_work_item_transition",
  InvalidNextVersion: "invalid_next_version",
  InvalidTransitionSequence: "invalid_transition_sequence",
  MissingWorkItem: "missing_work_item",
  StateTransitionMismatch: "state_transition_mismatch",
  VersionMismatch: "version_mismatch",
  WorkItemScopeMismatch: "work_item_scope_mismatch",
  WorkItemMismatch: "work_item_mismatch",
} as const;

export type WorkAnchorConflictReason =
  (typeof WorkAnchorConflictReason)[keyof typeof WorkAnchorConflictReason];

export type WorkAnchorPersistenceResult =
  | {
      status: typeof WorkAnchorPersistenceStatus.Committed;
    }
  | {
      status: typeof WorkAnchorPersistenceStatus.Conflict;
      reason: WorkAnchorConflictReason;
    };

export type TransitionWorkItemInput = {
  expectedVersion: number;
  nextWorkItem: PersistedWorkItem;
  transition: PersistedWorkStateTransition;
  transitionContext?: WorkItemLifecycleEvidence;
};

export type WorkItemLifecycleEvidence = Pick<WorkItemTransitionContext, "hasTriageFields">;

export type ValidateWorkItemTransitionInput = {
  currentWorkItem: PersistedWorkItem;
  transitionInput: TransitionWorkItemInput;
  hasTransitionId: (workStateTransitionId: string) => boolean;
  hasTransitionSequence: (workItemId: string, sequence: number) => boolean;
};

export type WorkAnchorStateReader = {
  findProject: (projectId: string) => Promise<PersistedProject | undefined>;
  findInitiative: (initiativeId: string) => Promise<PersistedInitiative | undefined>;
  findWorkItem: (workItemId: string) => Promise<PersistedWorkItem | undefined>;
  findWorkAnchorTarget: (workAnchorTargetId: string) => Promise<PersistedWorkAnchorTarget | undefined>;
  listWorkStateTransitions: (workItemId: string) => Promise<readonly PersistedWorkStateTransition[]>;
};

export type WorkAnchorStateWriter = {
  createProject: (project: PersistedProject) => Promise<WorkAnchorPersistenceResult>;
  createInitiative: (initiative: PersistedInitiative) => Promise<WorkAnchorPersistenceResult>;
  createWorkItem: (workItem: PersistedWorkItem) => Promise<WorkAnchorPersistenceResult>;
  createWorkAnchorTarget: (workAnchorTarget: PersistedWorkAnchorTarget) => Promise<WorkAnchorPersistenceResult>;
  transitionWorkItem: (input: TransitionWorkItemInput) => Promise<WorkAnchorPersistenceResult>;
};

export type WorkAnchorStateStore = WorkAnchorStateReader & WorkAnchorStateWriter;

export type InMemoryWorkAnchorStateSnapshot = {
  readonly projects: ReadonlyMap<string, PersistedProject>;
  readonly initiatives: ReadonlyMap<string, PersistedInitiative>;
  readonly workItems: ReadonlyMap<string, PersistedWorkItem>;
  readonly workAnchorTargets: ReadonlyMap<string, PersistedWorkAnchorTarget>;
  readonly workStateTransitions: ReadonlyMap<string, PersistedWorkStateTransition>;
};

export type InMemoryWorkAnchorStateStore = WorkAnchorStateStore & {
  readonly snapshot: InMemoryWorkAnchorStateSnapshot;
};

export function createInMemoryWorkAnchorStateStore(): InMemoryWorkAnchorStateStore {
  const snapshot = createEmptyWorkAnchorSnapshot();

  return {
    get snapshot() {
      return cloneSnapshot(snapshot);
    },
    findProject: async (projectId) => cloneOptionalRecord(snapshot.projects.get(projectId)),
    findInitiative: async (initiativeId) => cloneOptionalRecord(snapshot.initiatives.get(initiativeId)),
    findWorkItem: async (workItemId) => cloneOptionalRecord(snapshot.workItems.get(workItemId)),
    findWorkAnchorTarget: async (workAnchorTargetId) =>
      cloneOptionalRecord(snapshot.workAnchorTargets.get(workAnchorTargetId)),
    listWorkStateTransitions: async (workItemId) =>
      Array.from(snapshot.workStateTransitions.values())
        .filter((transition) => transition.workItemId === workItemId)
        .sort(compareWorkStateTransitions)
        .map(cloneRecord),
    createProject: async (project) => createRecord(snapshot.projects, project.projectId, project),
    createInitiative: async (initiative) => createRecord(snapshot.initiatives, initiative.initiativeId, initiative),
    createWorkItem: async (workItem) => createRecord(snapshot.workItems, workItem.workItemId, workItem),
    createWorkAnchorTarget: async (workAnchorTarget) =>
      createRecord(snapshot.workAnchorTargets, workAnchorTarget.workAnchorTargetId, workAnchorTarget),
    transitionWorkItem: async (input) => transitionWorkItem(snapshot, input),
  };
}

const WorkItemVersionIncrement = 1;

type MutableInMemoryWorkAnchorStateSnapshot = {
  projects: Map<string, PersistedProject>;
  initiatives: Map<string, PersistedInitiative>;
  workItems: Map<string, PersistedWorkItem>;
  workAnchorTargets: Map<string, PersistedWorkAnchorTarget>;
  workStateTransitions: Map<string, PersistedWorkStateTransition>;
};

function createEmptyWorkAnchorSnapshot(): MutableInMemoryWorkAnchorStateSnapshot {
  return {
    projects: new Map<string, PersistedProject>(),
    initiatives: new Map<string, PersistedInitiative>(),
    workItems: new Map<string, PersistedWorkItem>(),
    workAnchorTargets: new Map<string, PersistedWorkAnchorTarget>(),
    workStateTransitions: new Map<string, PersistedWorkStateTransition>(),
  };
}

function createRecord<Record>(
  records: Map<string, Record>,
  recordId: string,
  record: Record,
): Promise<WorkAnchorPersistenceResult> {
  if (records.has(recordId)) {
    return Promise.resolve(createConflictResult(WorkAnchorConflictReason.DuplicateRecord));
  }

  records.set(recordId, cloneRecord(record));

  return Promise.resolve({
    status: WorkAnchorPersistenceStatus.Committed,
  });
}

function transitionWorkItem(
  snapshot: MutableInMemoryWorkAnchorStateSnapshot,
  input: TransitionWorkItemInput,
): Promise<WorkAnchorPersistenceResult> {
  const currentWorkItem = snapshot.workItems.get(input.nextWorkItem.workItemId);

  if (currentWorkItem === undefined) {
    return Promise.resolve(createConflictResult(WorkAnchorConflictReason.MissingWorkItem));
  }

  const validationConflict = validateWorkItemTransitionInput({
    currentWorkItem,
    transitionInput: input,
    hasTransitionId: (workStateTransitionId) => snapshot.workStateTransitions.has(workStateTransitionId),
    hasTransitionSequence: (workItemId, sequence) => hasTransitionSequence(snapshot, workItemId, sequence),
  });

  if (validationConflict !== undefined) {
    return Promise.resolve(validationConflict);
  }

  snapshot.workItems.set(input.nextWorkItem.workItemId, cloneRecord(input.nextWorkItem));
  snapshot.workStateTransitions.set(input.transition.workStateTransitionId, cloneRecord(input.transition));

  return Promise.resolve({
    status: WorkAnchorPersistenceStatus.Committed,
  });
}

function hasTransitionSequence(
  snapshot: MutableInMemoryWorkAnchorStateSnapshot,
  workItemId: string,
  sequence: number,
): boolean {
  return Array.from(snapshot.workStateTransitions.values()).some(
    (transition) => transition.workItemId === workItemId && transition.sequence === sequence,
  );
}

function cloneSnapshot(snapshot: MutableInMemoryWorkAnchorStateSnapshot): InMemoryWorkAnchorStateSnapshot {
  return {
    projects: cloneRecordMap(snapshot.projects),
    initiatives: cloneRecordMap(snapshot.initiatives),
    workItems: cloneRecordMap(snapshot.workItems),
    workAnchorTargets: cloneRecordMap(snapshot.workAnchorTargets),
    workStateTransitions: cloneRecordMap(snapshot.workStateTransitions),
  };
}

function cloneRecordMap<Record>(records: ReadonlyMap<string, Record>): ReadonlyMap<string, Record> {
  return new Map(Array.from(records.entries()).map(([recordId, record]) => [recordId, cloneRecord(record)]));
}

function cloneOptionalRecord<Record>(record: Record | undefined): Record | undefined {
  return record === undefined ? undefined : cloneRecord(record);
}

function cloneRecord<Record>(record: Record): Record {
  return structuredClone(record);
}

export function validateWorkItemTransitionInput(
  input: ValidateWorkItemTransitionInput,
): WorkAnchorPersistenceResult | undefined {
  const { currentWorkItem, transitionInput } = input;

  if (transitionInput.transition.workItemId !== transitionInput.nextWorkItem.workItemId) {
    return createConflictResult(WorkAnchorConflictReason.WorkItemMismatch);
  }

  if (!hasConsistentWorkItemScope(currentWorkItem, transitionInput.nextWorkItem, transitionInput.transition)) {
    return createConflictResult(WorkAnchorConflictReason.WorkItemScopeMismatch);
  }

  if (currentWorkItem.metadata.version !== transitionInput.expectedVersion) {
    return createConflictResult(WorkAnchorConflictReason.VersionMismatch);
  }

  if (transitionInput.nextWorkItem.metadata.version !== transitionInput.expectedVersion + WorkItemVersionIncrement) {
    return createConflictResult(WorkAnchorConflictReason.InvalidNextVersion);
  }

  if (transitionInput.transition.sequence < 1) {
    return createConflictResult(WorkAnchorConflictReason.InvalidTransitionSequence);
  }

  if (
    transitionInput.transition.fromState !== currentWorkItem.state ||
    transitionInput.transition.toState !== transitionInput.nextWorkItem.state
  ) {
    return createConflictResult(WorkAnchorConflictReason.StateTransitionMismatch);
  }

  if (!isAllowedWorkItemTransition(currentWorkItem, transitionInput.transition, transitionInput.transitionContext)) {
    return createConflictResult(WorkAnchorConflictReason.IllegalWorkItemTransition);
  }

  if (input.hasTransitionId(transitionInput.transition.workStateTransitionId)) {
    return createConflictResult(WorkAnchorConflictReason.DuplicateTransitionId);
  }

  if (input.hasTransitionSequence(transitionInput.transition.workItemId, transitionInput.transition.sequence)) {
    return createConflictResult(WorkAnchorConflictReason.DuplicateTransitionSequence);
  }

  return undefined;
}

function hasConsistentWorkItemScope(
  currentWorkItem: PersistedWorkItem,
  nextWorkItem: PersistedWorkItem,
  transition: PersistedWorkStateTransition,
): boolean {
  return (
    currentWorkItem.organizationId === nextWorkItem.organizationId &&
    currentWorkItem.organizationId === transition.organizationId &&
    currentWorkItem.projectId === nextWorkItem.projectId &&
    currentWorkItem.projectId === transition.projectId &&
    currentWorkItem.initiativeId === nextWorkItem.initiativeId &&
    currentWorkItem.workItemType === nextWorkItem.workItemType
  );
}

function isAllowedWorkItemTransition(
  currentWorkItem: PersistedWorkItem,
  transition: PersistedWorkStateTransition,
  context: WorkItemLifecycleEvidence = {},
): boolean {
  try {
    assertWorkItemTransition(transition.fromState, transition.toState, {
      assignedEngineerHatAssignmentId: transition.assignedEngineerHatAssignmentId,
      hasRequiredEvidence: transition.evidenceArtifactIds.length > 0,
      hasTriageFields: context.hasTriageFields,
      scheduledWorkBlockId: transition.scheduledWorkBlockId,
      workItemType: currentWorkItem.workItemType,
    });

    return true;
  } catch {
    return false;
  }
}

function createConflictResult(reason: WorkAnchorConflictReason): WorkAnchorPersistenceResult {
  return {
    status: WorkAnchorPersistenceStatus.Conflict,
    reason,
  };
}

function compareWorkStateTransitions(
  left: PersistedWorkStateTransition,
  right: PersistedWorkStateTransition,
): number {
  if (left.sequence === right.sequence) {
    return left.workStateTransitionId.localeCompare(right.workStateTransitionId);
  }

  return left.sequence - right.sequence;
}
