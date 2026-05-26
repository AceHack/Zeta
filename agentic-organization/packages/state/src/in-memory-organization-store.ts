import {
  CommandOutcomePersistenceStatus,
  type CommandStateStore,
  type CommandStateStoreFactory,
} from "../../application/src/ports.ts";
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

      snapshot.idempotencyRecords.set(input.idempotencyRecord.idempotencyKey, input.idempotencyRecord);
      snapshot.supervisorSignals.push(...input.effects.supervisorSignals);
      snapshot.auditEvents.push(...input.effects.auditEvents);
      snapshot.outboxEvents.push(...input.effects.outboxEvents);

      return {
        status: CommandOutcomePersistenceStatus.Committed,
        result: input.idempotencyRecord.result,
      };
    },
  };
}
