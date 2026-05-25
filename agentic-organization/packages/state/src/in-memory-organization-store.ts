import type { CommandStateStore, CommandStateStoreFactory } from "../../application/src/ports.ts";
import type {
  AuditEvent,
  DiscussionAnchor,
  IdempotencyRecord,
  OutboxEvent,
  SupervisorSignal,
  WorkItem,
} from "../../domain/src/index.ts";

export type InMemoryOrganizationStoreSnapshot<Result = unknown> = {
  readonly workItems: readonly WorkItem[];
  readonly supervisorSignals: readonly SupervisorSignal[];
  readonly discussionAnchors: readonly DiscussionAnchor[];
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
      return currentSnapshot;
    },
    createCommandStateStore: () => {
      currentSnapshot = createEmptySnapshot<Result>();
      return createCommandStateStore(currentSnapshot);
    },
  };
}

type MutableInMemoryOrganizationStoreSnapshot<Result> = {
  workItems: WorkItem[];
  supervisorSignals: SupervisorSignal[];
  discussionAnchors: DiscussionAnchor[];
  auditEvents: AuditEvent[];
  outboxEvents: OutboxEvent[];
  idempotencyRecords: Map<string, IdempotencyRecord<Result>>;
};

function createEmptySnapshot<Result>(): MutableInMemoryOrganizationStoreSnapshot<Result> {
  return {
    workItems: [],
    supervisorSignals: [],
    discussionAnchors: [],
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
    saveIdempotencyRecord: async (record) => {
      snapshot.idempotencyRecords.set(record.idempotencyKey, record);
    },
    appendSupervisorSignal: async (supervisorSignal) => {
      snapshot.supervisorSignals.push(supervisorSignal);
    },
    appendAuditEvent: async (auditEvent) => {
      snapshot.auditEvents.push(auditEvent);
    },
    appendOutboxEvent: async (outboxEvent) => {
      snapshot.outboxEvents.push(outboxEvent);
    },
  };
}
