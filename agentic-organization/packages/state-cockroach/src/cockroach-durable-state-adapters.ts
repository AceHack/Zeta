import type { CommandStateStoreFactory } from "../../application/src/ports.ts";
import type { OutboxEventSource } from "../../state/src/index.ts";
import type { EventIngestionStore } from "../../state/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";
import { createCockroachCommandStateStoreFactory, type CockroachSqlExecutor } from "./cockroach-command-state-store.ts";
import {
  createCockroachEventIngestionStore,
  type CockroachEventIngestionSqlExecutor,
} from "./cockroach-event-ingestion-store.ts";
import { createCockroachOutboxEventSource, type CockroachOutboxSqlExecutor } from "./cockroach-outbox-event-source.ts";
import {
  createCockroachPolicyDecisionObservationStore,
  type CockroachPolicyDecisionObservationSqlExecutor,
  type CockroachPolicyDecisionObservationStore,
} from "./cockroach-policy-decision-observation-store.ts";

export type CockroachOrganizationSqlExecutor = CockroachGenericSqlExecutor &
  CockroachSqlExecutor &
  CockroachOutboxSqlExecutor &
  CockroachEventIngestionSqlExecutor &
  CockroachPolicyDecisionObservationSqlExecutor;

export type CockroachDurableStateAdapters<Result> = {
  commandStateStoreFactory: CommandStateStoreFactory<Result>;
  outboxEventSource: OutboxEventSource;
  eventIngestionStore: EventIngestionStore;
  policyDecisionObservationStore: CockroachPolicyDecisionObservationStore;
};

export type CreateCockroachDurableStateAdaptersInput = {
  executor: CockroachOrganizationSqlExecutor;
};

export function createCockroachDurableStateAdapters<Result>(
  input: CreateCockroachDurableStateAdaptersInput,
): CockroachDurableStateAdapters<Result> {
  return {
    commandStateStoreFactory: createCockroachCommandStateStoreFactory<Result>({
      executor: input.executor,
    }),
    outboxEventSource: createCockroachOutboxEventSource({
      executor: input.executor,
    }),
    eventIngestionStore: createCockroachEventIngestionStore({
      executor: input.executor,
    }),
    policyDecisionObservationStore: createCockroachPolicyDecisionObservationStore({
      executor: input.executor,
    }),
  };
}
