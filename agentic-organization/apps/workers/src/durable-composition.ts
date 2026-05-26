import {
  createOutboxPublisher,
  resolveAgenticMessagingDomain,
  type EventPublisher,
} from "../../../packages/messaging/src/index.ts";
import type { NatsJetStreamEventConsumer } from "../../../packages/messaging-nats/src/index.ts";
import {
  evaluateV0AutomationRules,
  createEventIngestionProcessor,
  type EventPayloadHashCalculator,
} from "../../../packages/runtime/src/index.ts";
import { InboundEventConsumerName } from "../../../packages/state/src/index.ts";
import {
  createCockroachDurableStateAdapters,
  type CockroachOrganizationSqlExecutor,
} from "../../../packages/state-cockroach/src/index.ts";
import {
  createOrganizationWorkerHost,
  type InboundEventSource,
  type OrganizationWorkerHost,
} from "../../../packages/workers/src/index.ts";
import type { WorkerProcessConfig } from "./config.ts";
import type { WorkerRuntimeTelemetrySink } from "./worker-runtime.ts";

export type DurableWorkerRuntimeAdapters = {
  cockroachExecutor: CockroachOrganizationSqlExecutor;
  eventPublisher: EventPublisher;
  inboundEventSource: InboundEventSource;
  natsEventConsumer: NatsJetStreamEventConsumer;
  telemetrySink: WorkerRuntimeTelemetrySink;
};

export type DurableWorkerRuntimeUtilities = {
  calculatePayloadHash: EventPayloadHashCalculator;
  createId: (prefix: string) => string;
  now: () => string;
};

export type DurableWorkerRuntimePorts = {
  organizationWorkerHost: OrganizationWorkerHost;
  natsEventConsumer: NatsJetStreamEventConsumer;
  telemetrySink: WorkerRuntimeTelemetrySink;
};

export type ComposeDurableWorkerRuntimePortsInput = {
  config: WorkerProcessConfig;
  durableAdapters: DurableWorkerRuntimeAdapters;
  runtimeUtilities: DurableWorkerRuntimeUtilities;
};

export function composeDurableWorkerRuntimePorts(
  input: ComposeDurableWorkerRuntimePortsInput,
): DurableWorkerRuntimePorts {
  const stateAdapters = createCockroachDurableStateAdapters({
    executor: input.durableAdapters.cockroachExecutor,
  });
  const eventIngestionProcessor = createEventIngestionProcessor({
    store: stateAdapters.eventIngestionStore,
    evaluateRules: evaluateV0AutomationRules,
    consumerName: InboundEventConsumerName.V0AutomationPlanner,
    calculatePayloadHash: input.runtimeUtilities.calculatePayloadHash,
    now: input.runtimeUtilities.now,
    createId: input.runtimeUtilities.createId,
  });
  const outboxPublisher = createOutboxPublisher({
    outboxSource: stateAdapters.outboxEventSource,
    eventPublisher: input.durableAdapters.eventPublisher,
    environment: input.config.environment,
    resolveDomain: resolveAgenticMessagingDomain,
    now: input.runtimeUtilities.now,
  });

  return {
    organizationWorkerHost: createOrganizationWorkerHost({
      outboxPublisher,
      inboundEventSource: input.durableAdapters.inboundEventSource,
      eventIngestionProcessor,
      outboxBatchSize: input.config.workerOutboxBatchSize,
      inboundBatchSize: input.config.workerInboundBatchSize,
    }),
    natsEventConsumer: input.durableAdapters.natsEventConsumer,
    telemetrySink: input.durableAdapters.telemetrySink,
  };
}
