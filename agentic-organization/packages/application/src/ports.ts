import type {
  AuditEvent,
  AgenticActor,
  DecisionRecord,
  DiscussionAnchor,
  HatAssignmentAuthoritySnapshot,
  IdempotencyRecord,
  Initiative,
  OutboxEvent,
  Project,
  SupervisorSignal,
  WorkAnchorTarget,
  WorkItem,
  WorkScheduleBlock,
  WorkStateTransition,
} from "../../domain/src/index.ts";
import type { CommandType } from "../../domain/src/index.ts";

export type Clock = {
  now: () => string;
};

export type IdGenerator = {
  createId: (prefix: string) => string;
};

export type CommandEffects = {
  supervisorSignals: readonly SupervisorSignal[];
  discussionAnchors: readonly DiscussionAnchor[];
  decisionRecords: readonly DecisionRecord[];
  workScheduleBlocks: readonly WorkScheduleBlock[];
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

export type DiscussionAnchorStateReaderPort = {
  findDiscussionAnchor: (discussionAnchorId: string) => Promise<DiscussionAnchor | undefined>;
};

export type HatAssignmentAuthorityReaderPort = {
  findHatAssignmentAuthority: (
    hatAssignmentId: string,
  ) => Promise<HatAssignmentAuthoritySnapshot | undefined>;
};

export type SupervisorSignalStateReaderPort = {
  findSupervisorSignal: (supervisorSignalId: string) => Promise<SupervisorSignal | undefined>;
};

export type WorkScheduleBlockAuthorityLookup = {
  agentId: string;
  hatAssignmentId: string;
  evaluatedAt: string;
};

export type WorkScheduleBlockAuthorityReaderPort = {
  findAuthorizingScheduleBlocks: (
    lookup: WorkScheduleBlockAuthorityLookup,
  ) => Promise<readonly WorkScheduleBlock[]>;
};

export const CommandScheduleAuthorityDecisionStatus = {
  Allowed: "allowed",
  Denied: "denied",
  NotRequired: "not_required",
} as const;

export type CommandScheduleAuthorityDecisionStatus =
  (typeof CommandScheduleAuthorityDecisionStatus)[keyof typeof CommandScheduleAuthorityDecisionStatus];

export const CommandScheduleAuthorityDenialReason = {
  ScheduleBlockRequired: "schedule_block_required",
  ScheduleBlockScopeMismatch: "schedule_block_scope_mismatch",
  ScheduleBlockTypeDenied: "schedule_block_type_denied",
} as const;

export type CommandScheduleAuthorityDenialReason =
  (typeof CommandScheduleAuthorityDenialReason)[keyof typeof CommandScheduleAuthorityDenialReason];

export type CommandScheduleAuthorityRequest = {
  commandId: string;
  commandType: CommandType | string;
  actor: AgenticActor;
  scope: {
    organizationId: string;
    projectId: string;
    teamId?: string | undefined;
    workItemId?: string | undefined;
  };
  resource?: Record<string, string> | undefined;
  evaluatedAt: string;
};

export type CommandScheduleAuthorityDecision =
  | {
      status:
        | typeof CommandScheduleAuthorityDecisionStatus.Allowed
        | typeof CommandScheduleAuthorityDecisionStatus.NotRequired;
      scheduleBlockId?: string | undefined;
    }
  | {
      status: typeof CommandScheduleAuthorityDecisionStatus.Denied;
      reason: CommandScheduleAuthorityDenialReason;
      message: string;
      scheduleBlockId?: string | undefined;
    };

export type CommandScheduleAuthorityPort = {
  authorizeCommandSchedule: (
    request: CommandScheduleAuthorityRequest,
  ) => Promise<CommandScheduleAuthorityDecision>;
};

export type RecordCommandOutcomeInput<Result = unknown> = {
  idempotencyRecord: IdempotencyRecord<Result>;
  effects: CommandEffects;
};

export const CommandOutcomePersistenceStatus = {
  Committed: "committed",
  EffectConflict: "effect_conflict",
  IdempotencyConflict: "idempotency_conflict",
  Replayed: "replayed",
} as const;

export type CommandOutcomePersistenceStatus =
  (typeof CommandOutcomePersistenceStatus)[keyof typeof CommandOutcomePersistenceStatus];

export const CommandOutcomeEffectConflictReason = {
  UnsupportedDiscussionAnchorEffectType: "unsupported_discussion_anchor_effect_type",
  WorkAnchorEffectConflict: "work_anchor_effect_conflict",
  WorkScheduleBlockOverlap: "work_schedule_block_overlap",
} as const;

export type CommandOutcomeEffectConflictReason =
  (typeof CommandOutcomeEffectConflictReason)[keyof typeof CommandOutcomeEffectConflictReason];

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
    }
  | {
      status: typeof CommandOutcomePersistenceStatus.EffectConflict;
      reason: CommandOutcomeEffectConflictReason;
    };

export type CommandStateStore<Result = unknown> = {
  findIdempotencyRecord: (idempotencyKey: string) => Promise<IdempotencyRecord<Result> | undefined>;
  recordCommandOutcome: (input: RecordCommandOutcomeInput<Result>) => Promise<RecordCommandOutcomeResult<Result>>;
};

export type CommandStateStoreFactory<Result = unknown> = {
  createCommandStateStore: () => CommandStateStore<Result>;
};
