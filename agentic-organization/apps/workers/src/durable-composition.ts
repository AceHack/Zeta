import {
  createOutboxPublisher,
  resolveAgenticMessagingDomain,
  type EventPublisher,
} from "../../../packages/messaging/src/index.ts";
import {
  createNatsJetStreamEventConsumer,
  type NatsDeadLetterPublisher,
  type NatsJetStreamEventConsumer,
  type NatsJetStreamPullConsumer,
} from "../../../packages/messaging-nats/src/index.ts";
import {
  evaluateV0AutomationRules,
  createEventIngestionProcessor,
  createReactionPlanExecutor,
  type EventPayloadHashCalculator,
  type ReactionPlanActionExecutorPort,
} from "../../../packages/runtime/src/index.ts";
import { createKeepAliveLane, type KeepAliveLane } from "../../../packages/keepalive/src/index.ts";
import { InboundEventConsumerName } from "../../../packages/state/src/index.ts";
import {
  createCockroachControlPlaneStateStore,
  createCockroachDurableStateAdapters,
  createCockroachKeepAliveActionSink,
  createCockroachKeepAliveSnapshotSource,
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
  natsDeadLetterPublisher: NatsDeadLetterPublisher;
  natsPullConsumer: NatsJetStreamPullConsumer;
  reactionPlanActionExecutor: ReactionPlanActionExecutorPort;
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
  keepAliveLane: KeepAliveLane;
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
    createId: input.runtimeUtilities.createId,
    now: input.runtimeUtilities.now,
  });
  const reactionPlanExecutor = createReactionPlanExecutor({
    queue: stateAdapters.reactionPlanWorkQueue,
    actionExecutor: input.durableAdapters.reactionPlanActionExecutor,
    batchSize: input.config.workerReactionPlanBatchSize,
    leaseDurationMs: input.config.workerReactionPlanLeaseMs,
    now: input.runtimeUtilities.now,
    createId: input.runtimeUtilities.createId,
  });
  const natsEventConsumer = createNatsJetStreamEventConsumer({
    pullConsumer: input.durableAdapters.natsPullConsumer,
    eventIngestionProcessor,
    deadLetterPublisher: input.durableAdapters.natsDeadLetterPublisher,
  });
  const keepAliveLane = composeDurableKeepAliveLane(input);

  return {
    organizationWorkerHost: createOrganizationWorkerHost({
      outboxPublisher,
      inboundEventSource: input.durableAdapters.inboundEventSource,
      eventIngestionProcessor,
      reactionPlanExecutor,
      outboxBatchSize: input.config.workerOutboxBatchSize,
      inboundBatchSize: input.config.workerInboundBatchSize,
    }),
    natsEventConsumer,
    telemetrySink: input.durableAdapters.telemetrySink,
    keepAliveLane,
  };
}

/**
 * Compose the deterministic keep-alive control plane on durable Cockroach state:
 * a control-plane store (org proof-of-life + alert log) -> snapshot source ->
 * action sink -> lane. The lane ticks the org heartbeat every worker cycle and
 * routes self-heal signals to durable state — the operator's #1 tenet, real.
 */
function composeDurableKeepAliveLane(input: ComposeDurableWorkerRuntimePortsInput): KeepAliveLane {
  const controlPlaneStore = createCockroachControlPlaneStateStore({
    executor: input.durableAdapters.cockroachExecutor,
  });

  return createKeepAliveLane({
    source: createCockroachKeepAliveSnapshotSource({
      store: controlPlaneStore,
      organizationId: input.config.organizationId,
      orgHeartbeatDeadlineMs: input.config.workerKeepAliveOrgHeartbeatDeadlineMs,
      // the engine measures org age via the DB clock; this clock only feeds the
      // (v1-empty) lease-expiry branch — derive epoch ms from the injected ISO now
      clock: { now: () => Date.parse(input.runtimeUtilities.now()) },
    }),
    sink: createCockroachKeepAliveActionSink({
      store: controlPlaneStore,
      organizationId: input.config.organizationId,
      generateAlertId: () => input.runtimeUtilities.createId("ctrl-alert"),
    }),
  });
}
