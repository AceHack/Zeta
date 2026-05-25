import type { AuditEvent, IdempotencyRecord, OutboxEvent, SupervisorSignal } from "../../domain/src/index.ts";

export type Clock = {
  now: () => string;
};

export type IdGenerator = {
  createId: (prefix: string) => string;
};

export type IdempotencyRecordStore<Result = unknown> = {
  findIdempotencyRecord: (idempotencyKey: string) => Promise<IdempotencyRecord<Result> | undefined>;
  saveIdempotencyRecord: (record: IdempotencyRecord<Result>) => Promise<void>;
};

export type SupervisorSignalStore = {
  appendSupervisorSignal: (supervisorSignal: SupervisorSignal) => Promise<void>;
};

export type AuditEventStore = {
  appendAuditEvent: (auditEvent: AuditEvent) => Promise<void>;
};

export type OutboxEventStore = {
  appendOutboxEvent: (outboxEvent: OutboxEvent) => Promise<void>;
};

export type CommandStateStore<Result = unknown> = IdempotencyRecordStore<Result> &
  SupervisorSignalStore &
  AuditEventStore &
  OutboxEventStore;

export type CommandStateStoreFactory<Result = unknown> = {
  createCommandStateStore: () => CommandStateStore<Result>;
};
