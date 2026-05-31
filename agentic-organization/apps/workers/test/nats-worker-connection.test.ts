import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  SupervisorChainLevel,
  createAgenticEventEnvelope,
} from "../../../packages/domain/src/index.ts";
import type { EventPublication } from "../../../packages/messaging/src/index.ts";
import {
  NatsDeadLetterReason,
  NatsHeaderName,
  type NatsJetStreamInboundMessage,
} from "../../../packages/messaging-nats/src/index.ts";
import {
  RecordingTelemetry,
  W3CTraceHeaderName,
} from "../../../packages/observability/src/index.ts";
import {
  NatsWorkerConnectionState,
  NatsWorkerDeadLetterHeaderName,
  NatsWorkerMessageIdPrefix,
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  WorkerProcessShutdownStatus,
  WorkerReadinessStatus,
  WorkerRuntimeStatus,
  checkWorkerProcessReadiness,
  connectNatsWorkerAdapters,
  createWorkerProcess,
  type NatsWorkerTransportConnection,
  type NatsWorkerTransportConnectionFactory,
} from "../src/index.ts";

describe("NATS worker process adapter", () => {
  test("connects once and exposes publisher, pull consumer, dead-letter, readiness, and shutdown ports", async () => {
    const transportFactory = createRecordingTransportFactory();
    const adapters = await connectNatsWorkerAdapters({
      config: {
        durableName: "agentic-org-v0-automation-planner",
        environment: "dev",
        organizationId: "org-lfg",
        servers: ["nats://nats.nats.svc.cluster.local:4222"],
        streamName: "agentic-org-events",
      },
      deadLetterMessageIdFactory: createSequentialDeadLetterMessageIdFactory(),
      transportFactory,
    });

    await adapters.eventPublisher.publish(createEventPublication());
    const fetched = await adapters.pullConsumer.fetchNextBatch({ batchSize: 7 });
    await adapters.deadLetterPublisher.publish({
      sourceSubject: "agentic-org.dev.org-lfg.invalid",
      payload: "{",
      headers: {},
      reason: NatsDeadLetterReason.InvalidEnvelope,
    });
    await adapters.deadLetterPublisher.publish({
      sourceSubject: "agentic-org.dev.org-lfg.invalid",
      payload: '{"other":"poison"}',
      headers: {},
      reason: NatsDeadLetterReason.InvalidEnvelope,
    });
    const readiness = await adapters.readinessProbe.check();
    const shutdownResult = await createWorkerProcess({
      bootstrappers: [],
      readinessProbes: [],
      runtime: createNoopRuntime(),
      shutdownPorts: [adapters.shutdown],
    }).shutdown();

    deepEqual(transportFactory.connectInputs, [
      {
        durableName: "agentic-org-v0-automation-planner",
        environment: "dev",
        organizationId: "org-lfg",
        servers: ["nats://nats.nats.svc.cluster.local:4222"],
        streamName: "agentic-org-events",
      },
    ]);
    deepEqual(transportFactory.connection.publishedMessages, [
      {
        subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
        payload: JSON.stringify(createEnvelope()),
        messageId: "evt-supervisor-signal-001",
        headers: {
          [NatsHeaderName.EventId]: "evt-supervisor-signal-001",
          [NatsHeaderName.EventType]: AgenticEventType.SupervisorSignalSent,
          [NatsHeaderName.CorrelationId]: "corr-001",
          [NatsHeaderName.CausationId]: "cause-001",
          [NatsHeaderName.TraceId]: "trace-001",
          [NatsHeaderName.IdempotencyKey]: "idem-001",
          [NatsHeaderName.OutboxEventId]: "outbox-001",
        },
      },
      {
        subject: "agentic-org.dev.org-lfg.dead_letter.invalid_envelope",
        payload: "{",
        messageId: `${NatsWorkerMessageIdPrefix.DeadLetter}-agentic-org.dev.org-lfg.invalid-${NatsDeadLetterReason.InvalidEnvelope}-1`,
        headers: {
          [NatsWorkerDeadLetterHeaderName.SourceSubject]: "agentic-org.dev.org-lfg.invalid",
          [NatsWorkerDeadLetterHeaderName.Reason]: NatsDeadLetterReason.InvalidEnvelope,
        },
      },
      {
        subject: "agentic-org.dev.org-lfg.dead_letter.invalid_envelope",
        payload: '{"other":"poison"}',
        messageId: `${NatsWorkerMessageIdPrefix.DeadLetter}-agentic-org.dev.org-lfg.invalid-${NatsDeadLetterReason.InvalidEnvelope}-2`,
        headers: {
          [NatsWorkerDeadLetterHeaderName.SourceSubject]: "agentic-org.dev.org-lfg.invalid",
          [NatsWorkerDeadLetterHeaderName.Reason]: NatsDeadLetterReason.InvalidEnvelope,
        },
      },
    ]);
    equal(fetched.length, 1);
    deepEqual(transportFactory.connection.fetchInputs, [{ batchSize: 7 }]);
    deepEqual(readiness, {
      name: WorkerDependencyName.Nats,
      status: WorkerDependencyReadinessStatus.Ready,
    });
    deepEqual(shutdownResult, {
      status: WorkerProcessShutdownStatus.Completed,
      closedPortNames: [WorkerDependencyName.Nats],
      failures: [],
    });
    equal(transportFactory.connection.state, NatsWorkerConnectionState.Closed);
  });

  test("reports degraded process readiness when NATS readiness fails", async () => {
    const transportFactory = createRecordingTransportFactory({
      readinessStatus: WorkerDependencyReadinessStatus.NotReady,
      readinessMessage: "jetstream unavailable",
    });
    const adapters = await connectNatsWorkerAdapters({
      config: {
        durableName: "agentic-org-v0-automation-planner",
        environment: "dev",
        organizationId: "org-lfg",
        servers: ["nats://nats.nats.svc.cluster.local:4222"],
        streamName: "agentic-org-events",
      },
      deadLetterMessageIdFactory: createSequentialDeadLetterMessageIdFactory(),
      transportFactory,
    });

    const readiness = await checkWorkerProcessReadiness({
      probes: [adapters.readinessProbe],
    });

    deepEqual(readiness, {
      status: WorkerReadinessStatus.Degraded,
      checks: [
        {
          name: WorkerDependencyName.Nats,
          status: WorkerDependencyReadinessStatus.NotReady,
          message: "jetstream unavailable",
        },
      ],
    });
  });

  test("converts thrown dependency readiness checks into degraded readiness evidence", async () => {
    const transportFactory = createRecordingTransportFactory({
      readinessError: new Error("nats readiness probe threw"),
    });
    const adapters = await connectNatsWorkerAdapters({
      config: {
        durableName: "agentic-org-v0-automation-planner",
        environment: "dev",
        organizationId: "org-lfg",
        servers: ["nats://nats.nats.svc.cluster.local:4222"],
        streamName: "agentic-org-events",
      },
      deadLetterMessageIdFactory: createSequentialDeadLetterMessageIdFactory(),
      transportFactory,
    });

    const readiness = await checkWorkerProcessReadiness({
      probes: [adapters.readinessProbe],
    });

    deepEqual(readiness, {
      status: WorkerReadinessStatus.Degraded,
      checks: [
        {
          name: WorkerDependencyName.Nats,
          status: WorkerDependencyReadinessStatus.NotReady,
          message: "nats readiness probe threw",
        },
      ],
    });
  });

  test("threads telemetry into the NATS publisher", async () => {
    const transportFactory = createRecordingTransportFactory();
    const telemetry = new RecordingTelemetry({
      traceContext: {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        traceFlags: "01",
      },
    });
    const adapters = await connectNatsWorkerAdapters({
      config: {
        durableName: "agentic-org-v0-automation-planner",
        environment: "dev",
        organizationId: "org-lfg",
        servers: ["nats://nats.nats.svc.cluster.local:4222"],
        streamName: "agentic-org-events",
      },
      deadLetterMessageIdFactory: createSequentialDeadLetterMessageIdFactory(),
      transportFactory,
      telemetry,
    });

    await adapters.eventPublisher.publish(createEventPublication());

    equal(
      transportFactory.connection.publishedMessages[0]?.headers[W3CTraceHeaderName.TraceParent],
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
    equal(telemetry.spans[0]?.name, "org.nats.publish");
  });
});

function createRecordingTransportFactory(options?: {
  readinessError?: Error;
  readinessStatus?: WorkerDependencyReadinessStatus;
  readinessMessage?: string;
}): NatsWorkerTransportConnectionFactory & {
  connectInputs: {
    durableName: string;
    environment: string;
    organizationId: string;
    servers: readonly string[];
    streamName: string;
  }[];
  connection: RecordingNatsWorkerTransportConnection;
} {
  const connection = createRecordingTransportConnection(options);
  const connectInputs: {
    durableName: string;
    environment: string;
    organizationId: string;
    servers: readonly string[];
    streamName: string;
  }[] = [];

  return {
    connectInputs,
    connection,
    connect: async (input) => {
      connectInputs.push(input);
      return connection;
    },
  };
}

function createSequentialDeadLetterMessageIdFactory(): {
  createId: (message: { reason: string; sourceSubject: string }) => string;
} {
  let counter = 0;

  return {
    createId: (message) => {
      counter += 1;
      return `${message.sourceSubject}-${message.reason}-${counter}`;
    },
  };
}

type RecordingNatsWorkerTransportConnection = NatsWorkerTransportConnection & {
  fetchInputs: { batchSize: number }[];
  publishedMessages: {
    subject: string;
    payload: string;
    messageId: string;
    headers: Record<string, string>;
  }[];
  state: NatsWorkerConnectionState;
};

function createRecordingTransportConnection(options?: {
  readinessError?: Error;
  readinessStatus?: WorkerDependencyReadinessStatus;
  readinessMessage?: string;
}): RecordingNatsWorkerTransportConnection {
  const fetchInputs: { batchSize: number }[] = [];
  const publishedMessages: {
    subject: string;
    payload: string;
    messageId: string;
    headers: Record<string, string>;
  }[] = [];

  return {
    fetchInputs,
    publishedMessages,
    state: NatsWorkerConnectionState.Connected,
    publish: async (message) => {
      publishedMessages.push(message);
    },
    fetchNextBatch: async (input) => {
      fetchInputs.push(input);
      return [createInboundMessage()];
    },
    checkReadiness: async () => {
      if (options?.readinessError !== undefined) {
        throw options.readinessError;
      }

      return {
        name: WorkerDependencyName.Nats,
        status: options?.readinessStatus ?? WorkerDependencyReadinessStatus.Ready,
        ...(options?.readinessMessage === undefined ? {} : { message: options.readinessMessage }),
      };
    },
    close: async function close() {
      this.state = NatsWorkerConnectionState.Closed;
    },
  };
}

function createEventPublication(): EventPublication {
  return {
    subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
    outboxEvent: {
      outboxEventId: "outbox-001",
      envelope: createEnvelope(),
    },
  };
}

function createEnvelope() {
  return createAgenticEventEnvelope({
    eventId: "evt-supervisor-signal-001",
    eventType: AgenticEventType.SupervisorSignalSent,
    occurredAt: "2026-05-26T00:00:00.000Z",
    actor: {
      agentId: "agent-001",
      hatAssignmentId: "hat-assignment-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-item-001",
    },
    aggregate: {
      aggregateId: "supervisor-signal-001",
      aggregateType: AgenticAggregateType.SupervisorSignal,
      aggregateVersion: 1,
    },
    trace: {
      commandId: "cmd-001",
      correlationId: "corr-001",
      causationId: "cause-001",
      traceId: "trace-001",
      idempotencyKey: "idem-001",
    },
    payload: {
      targetHatAssignmentId: "hat-assignment-manager-001",
      targetLevel: SupervisorChainLevel.Manager,
    },
  });
}

function createInboundMessage(): NatsJetStreamInboundMessage {
  return {
    subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
    payload: JSON.stringify(createEnvelope()),
    headers: {},
    acknowledge: async () => undefined,
    negativeAcknowledge: async () => undefined,
    terminate: async () => undefined,
  };
}

function createNoopRuntime() {
  return {
    runOnce: async () => ({
      status: WorkerRuntimeStatus.Healthy,
      keepAlive: undefined,
      workerCycle: undefined,
      natsConsumerBatch: undefined,
      failures: [],
    }),
  };
}
