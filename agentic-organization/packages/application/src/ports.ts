import type {
  AuditEvent,
  IdempotencyRecord,
  Initiative,
  OutboxEvent,
  Project,
  SupervisorSignal,
  WorkAnchorTarget,
  WorkItem,
  WorkStateTransition,
} from "../../domain/src/index.ts";

export type Clock = {
  now: () => string;
};

export type IdGenerator = {
  createId: (prefix: string) => string;
};

export type CommandEffects = {
  supervisorSignals: readonly SupervisorSignal[];
  auditEvents: readonly AuditEvent[];
  outboxEvents: readonly OutboxEvent[];
  workAnchors?: WorkAnchorCommandEffects | undefined;
};

export type WorkAnchorCommandEffects = {
  projects: readonly CommandWorkAnchorProject[];
  initiatives: readonly CommandWorkAnchorInitiative[];
  workItems: readonly CommandWorkAnchorWorkItem[];
  workAnchorTargets: readonly CommandWorkAnchorTarget[];
  workItemTransitions: readonly CommandWorkAnchorTransitionInput[];
};

export type CommandWorkAnchorRecordMetadata = {
  updatedAt: string;
  version: number;
  correlationId: string;
  causationId: string;
  traceId: string;
};

export type CommandWorkAnchorProject = Project & {
  metadata: CommandWorkAnchorRecordMetadata;
};

export type CommandWorkAnchorInitiative = Initiative & {
  metadata: CommandWorkAnchorRecordMetadata;
};

export type CommandWorkAnchorWorkItem = WorkItem & {
  metadata: CommandWorkAnchorRecordMetadata;
};

export type CommandWorkAnchorTarget = WorkAnchorTarget & {
  metadata: CommandWorkAnchorRecordMetadata;
};

export type CommandWorkStateTransition = WorkStateTransition & {
  sequence: number;
  metadata: CommandWorkAnchorRecordMetadata;
};

export type CommandWorkAnchorTransitionInput = {
  expectedVersion: number;
  nextWorkItem: CommandWorkAnchorWorkItem;
  transition: CommandWorkStateTransition;
  transitionContext?: {
    hasTriageFields?: boolean;
  };
};

export type WorkAnchorStateReaderPort = {
  findProject: (projectId: string) => Promise<CommandWorkAnchorProject | undefined>;
  findInitiative: (initiativeId: string) => Promise<CommandWorkAnchorInitiative | undefined>;
  findWorkItem: (workItemId: string) => Promise<CommandWorkAnchorWorkItem | undefined>;
};

export type RecordCommandOutcomeInput<Result = unknown> = {
  idempotencyRecord: IdempotencyRecord<Result>;
  effects: CommandEffects;
};

export const CommandOutcomePersistenceStatus = {
  Committed: "committed",
  IdempotencyConflict: "idempotency_conflict",
  Replayed: "replayed",
} as const;

export type CommandOutcomePersistenceStatus =
  (typeof CommandOutcomePersistenceStatus)[keyof typeof CommandOutcomePersistenceStatus];

export type RecordCommandOutcomeResult<Result = unknown> =
  | {
      status: typeof CommandOutcomePersistenceStatus.Committed;
      result: Result;
    }
  | {
      status: typeof CommandOutcomePersistenceStatus.Replayed;
      result: Result;
    }
  | {
      status: typeof CommandOutcomePersistenceStatus.IdempotencyConflict;
      existingRequestHash?: string;
    };

export type CommandStateStore<Result = unknown> = {
  findIdempotencyRecord: (idempotencyKey: string) => Promise<IdempotencyRecord<Result> | undefined>;
  recordCommandOutcome: (input: RecordCommandOutcomeInput<Result>) => Promise<RecordCommandOutcomeResult<Result>>;
};

export type CommandStateStoreFactory<Result = unknown> = {
  createCommandStateStore: () => CommandStateStore<Result>;
};
