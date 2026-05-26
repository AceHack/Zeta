import type { AuditEvent, IdempotencyRecord, OutboxEvent, SupervisorSignal } from "../../domain/src/index.ts";

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
