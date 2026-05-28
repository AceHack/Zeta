import {
  createNatsJetStreamEventPublisher,
  type NatsDeadLetterMessage,
  type NatsDeadLetterPublisher,
  type NatsJetStreamClient,
  type NatsJetStreamMessage,
  type NatsJetStreamPullConsumer,
} from "../../../../packages/messaging-nats/src/index.ts";
import { buildAgenticDeadLetterSubject, type EventPublisher } from "../../../../packages/messaging/src/index.ts";
import {
  WorkerDependencyName,
  type WorkerDependencyReadinessCheck,
  type WorkerDependencyReadinessProbe,
} from "../worker-readiness.ts";
import type { WorkerProcessShutdownPort } from "../worker-process.ts";

export const NatsWorkerConnectionState = {
  Closed: "closed",
  Connected: "connected",
} as const;

export type NatsWorkerConnectionState = (typeof NatsWorkerConnectionState)[keyof typeof NatsWorkerConnectionState];

export const NatsWorkerDeadLetterHeaderName = {
  Reason: "Nats-Dead-Letter-Reason",
  SourceSubject: "Nats-Dead-Letter-Source-Subject",
} as const;

export type NatsWorkerDeadLetterHeaderName =
  (typeof NatsWorkerDeadLetterHeaderName)[keyof typeof NatsWorkerDeadLetterHeaderName];

export const NatsWorkerMessageIdPrefix = {
  DeadLetter: "dlq",
} as const;

export type NatsWorkerMessageIdPrefix = (typeof NatsWorkerMessageIdPrefix)[keyof typeof NatsWorkerMessageIdPrefix];

export type NatsWorkerConnectionConfig = {
  durableName: string;
  environment: string;
  organizationId: string;
  servers: readonly string[];
  streamName: string;
};

export type NatsWorkerTransportConnectInput = NatsWorkerConnectionConfig;

export type NatsWorkerTransportConnection = NatsJetStreamClient &
  NatsJetStreamPullConsumer & {
    checkReadiness: () => Promise<WorkerDependencyReadinessCheck>;
    close: () => Promise<void>;
  };

export type NatsWorkerTransportConnectionFactory = {
  connect: (input: NatsWorkerTransportConnectInput) => Promise<NatsWorkerTransportConnection>;
};

export type NatsWorkerDeadLetterMessageIdFactory = {
  createId: (message: NatsDeadLetterMessage) => string;
};

export type NatsWorkerShutdownPort = WorkerProcessShutdownPort;

export type NatsWorkerAdapters = {
  deadLetterPublisher: NatsDeadLetterPublisher;
  eventPublisher: EventPublisher;
  pullConsumer: NatsJetStreamPullConsumer;
  readinessProbe: WorkerDependencyReadinessProbe;
  shutdown: NatsWorkerShutdownPort;
};

export type ConnectNatsWorkerAdaptersInput = {
  config: NatsWorkerConnectionConfig;
  deadLetterMessageIdFactory: NatsWorkerDeadLetterMessageIdFactory;
  transportFactory: NatsWorkerTransportConnectionFactory;
};

export async function connectNatsWorkerAdapters(input: ConnectNatsWorkerAdaptersInput): Promise<NatsWorkerAdapters> {
  const connection = await input.transportFactory.connect({
    durableName: input.config.durableName,
    environment: input.config.environment,
    organizationId: input.config.organizationId,
    servers: input.config.servers,
    streamName: input.config.streamName,
  });

  return {
    deadLetterPublisher: createNatsWorkerDeadLetterPublisher({
      client: connection,
      config: input.config,
      messageIdFactory: input.deadLetterMessageIdFactory,
    }),
    eventPublisher: createNatsJetStreamEventPublisher({
      client: connection,
    }),
    pullConsumer: connection,
    readinessProbe: {
      name: WorkerDependencyName.Nats,
      check: async () => {
        const check = await connection.checkReadiness();

        return {
          ...check,
          name: WorkerDependencyName.Nats,
        };
      },
    },
    shutdown: {
      name: WorkerDependencyName.Nats,
      shutdown: async () => {
        await connection.close();
      },
    },
  };
}

type CreateNatsWorkerDeadLetterPublisherInput = {
  client: NatsJetStreamClient;
  config: NatsWorkerConnectionConfig;
  messageIdFactory: NatsWorkerDeadLetterMessageIdFactory;
};

function createNatsWorkerDeadLetterPublisher(input: CreateNatsWorkerDeadLetterPublisherInput): NatsDeadLetterPublisher {
  return {
    publish: async (message) => {
      await input.client.publish(
        createDeadLetterJetStreamMessage({
          config: input.config,
          message,
          messageIdFactory: input.messageIdFactory,
        }),
      );
    },
  };
}

type CreateDeadLetterJetStreamMessageInput = {
  config: NatsWorkerConnectionConfig;
  message: NatsDeadLetterMessage;
  messageIdFactory: NatsWorkerDeadLetterMessageIdFactory;
};

function createDeadLetterJetStreamMessage(input: CreateDeadLetterJetStreamMessageInput): NatsJetStreamMessage {
  return {
    subject: buildAgenticDeadLetterSubject({
      environment: input.config.environment,
      organizationId: input.config.organizationId,
      reason: input.message.reason,
    }),
    payload: input.message.payload,
    messageId: `${NatsWorkerMessageIdPrefix.DeadLetter}-${input.messageIdFactory.createId(input.message)}`,
    headers: {
      ...input.message.headers,
      [NatsWorkerDeadLetterHeaderName.SourceSubject]: input.message.sourceSubject,
      [NatsWorkerDeadLetterHeaderName.Reason]: input.message.reason,
    },
  };
}
