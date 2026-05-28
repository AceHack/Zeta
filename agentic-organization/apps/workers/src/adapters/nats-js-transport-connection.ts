import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import type { JetStreamClient, JetStreamManager } from "@nats-io/jetstream";
import { connect, headers } from "@nats-io/transport-node";
import type { MsgHdrs, NatsConnection, NodeConnectionOptions } from "@nats-io/transport-node";

import type { NatsJetStreamInboundMessage } from "../../../../packages/messaging-nats/src/index.ts";
import {
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  type WorkerDependencyReadinessCheck,
} from "../worker-readiness.ts";
import type {
  NatsWorkerTransportConnectInput,
  NatsWorkerTransportConnection,
  NatsWorkerTransportConnectionFactory,
} from "./nats-worker-connection.ts";

export const NatsJsDefaultFetchExpiresMs = 30_000;

const NatsJsMessageTextDecoder = new TextDecoder();

export type NatsJsConnectionInput = {
  servers: readonly string[];
};

export type NatsJsConnection = {
  close: () => Promise<void>;
};

export type NatsJsHeaderBag = {
  get: (key: string) => string;
  keys: () => string[];
  set: (key: string, value: string) => void;
};

export type NatsJsPublishOptions = {
  headers: NatsJsHeaderBag;
  msgID: string;
};

export type NatsJsConsumerFetchInput = {
  expires: number;
  max_messages: number;
};

export type NatsJsMessage = {
  data: Uint8Array;
  headers: NatsJsHeaderBag | undefined;
  subject: string;
  ack: () => void;
  nak: () => void;
  term: () => void;
};

export type NatsJsConsumerMessages = AsyncIterable<NatsJsMessage> & {
  close: () => Promise<void | Error | undefined>;
};

export type NatsJsConsumer = {
  fetch: (input: NatsJsConsumerFetchInput) => Promise<NatsJsConsumerMessages>;
};

export type NatsJsJetStreamClient = {
  consumers: {
    get: (streamName: string, durableName: string) => Promise<NatsJsConsumer>;
  };
  publish: (subject: string, payload: string, options: NatsJsPublishOptions) => Promise<void>;
};

export type NatsJsJetStreamManager = {
  consumers: {
    info: (streamName: string, durableName: string) => Promise<unknown>;
  };
};

export type NatsJsLibraryFacade = {
  connect: (input: NatsJsConnectionInput) => Promise<NatsJsConnection>;
  createHeaders: () => NatsJsHeaderBag;
  createJetStreamClient: (connection: NatsJsConnection) => NatsJsJetStreamClient;
  createJetStreamManager: (connection: NatsJsConnection) => Promise<NatsJsJetStreamManager>;
};

export type CreateNatsJsTransportConnectionFactoryInput = {
  fetchExpiresMs?: number;
  library?: NatsJsLibraryFacade;
};

export function createNatsJsTransportConnectionFactory(
  input: CreateNatsJsTransportConnectionFactoryInput = {},
): NatsWorkerTransportConnectionFactory {
  const library = input.library ?? createDefaultNatsJsLibraryFacade();
  const fetchExpiresMs = input.fetchExpiresMs ?? NatsJsDefaultFetchExpiresMs;

  return {
    connect: async (connectionInput) => {
      const connection = await library.connect({
        servers: connectionInput.servers,
      });

      try {
        const jetStreamClient = library.createJetStreamClient(connection);
        const jetStreamManager = await library.createJetStreamManager(connection);
        const consumer = await jetStreamClient.consumers.get(connectionInput.streamName, connectionInput.durableName);

        return createNatsJsTransportConnection({
          connection,
          connectionInput,
          consumer,
          fetchExpiresMs,
          jetStreamClient,
          jetStreamManager,
          library,
        });
      } catch (error) {
        await closeNatsJsConnectionAfterStartupFailure(connection);
        throw error;
      }
    },
  };
}

type CreateNatsJsTransportConnectionInput = {
  connection: NatsJsConnection;
  connectionInput: NatsWorkerTransportConnectInput;
  consumer: NatsJsConsumer;
  fetchExpiresMs: number;
  jetStreamClient: NatsJsJetStreamClient;
  jetStreamManager: NatsJsJetStreamManager;
  library: NatsJsLibraryFacade;
};

function createNatsJsTransportConnection(input: CreateNatsJsTransportConnectionInput): NatsWorkerTransportConnection {
  return {
    publish: async (message) => {
      await input.jetStreamClient.publish(message.subject, message.payload, {
        msgID: message.messageId,
        headers: createNatsJsHeaders(input.library, message.headers),
      });
    },
    fetchNextBatch: async ({ batchSize }) => {
      const batch = await input.consumer.fetch({
        max_messages: batchSize,
        expires: input.fetchExpiresMs,
      });

      let collectError: unknown;

      try {
        return await collectInboundMessages(batch);
      } catch (error) {
        collectError = error;
        throw error;
      } finally {
        try {
          const closeResult = await batch.close();

          if (collectError === undefined && closeResult instanceof Error) {
            throw closeResult;
          }
        } catch (closeError) {
          if (collectError === undefined) {
            throw closeError;
          }
        }
      }
    },
    checkReadiness: async (): Promise<WorkerDependencyReadinessCheck> => {
      await input.jetStreamManager.consumers.info(input.connectionInput.streamName, input.connectionInput.durableName);

      return {
        name: WorkerDependencyName.Nats,
        status: WorkerDependencyReadinessStatus.Ready,
      };
    },
    close: async () => {
      await input.connection.close();
    },
  };
}

function createNatsJsHeaders(library: NatsJsLibraryFacade, headerRecord: Record<string, string>): NatsJsHeaderBag {
  const headerBag = library.createHeaders();

  for (const [key, value] of Object.entries(headerRecord)) {
    headerBag.set(key, value);
  }

  return headerBag;
}

async function collectInboundMessages(batch: NatsJsConsumerMessages): Promise<readonly NatsJetStreamInboundMessage[]> {
  const messages: NatsJetStreamInboundMessage[] = [];

  for await (const message of batch) {
    messages.push(adaptNatsJsMessage(message));
  }

  return messages;
}

function adaptNatsJsMessage(message: NatsJsMessage): NatsJetStreamInboundMessage {
  return {
    subject: message.subject,
    payload: NatsJsMessageTextDecoder.decode(message.data),
    headers: natsJsHeadersToRecord(message.headers),
    acknowledge: async () => {
      message.ack();
    },
    negativeAcknowledge: async () => {
      message.nak();
    },
    terminate: async () => {
      message.term();
    },
  };
}

async function closeNatsJsConnectionAfterStartupFailure(connection: NatsJsConnection): Promise<void> {
  try {
    await connection.close();
  } catch {
    // Preserve the startup failure; cleanup close errors are secondary here.
  }
}

function natsJsHeadersToRecord(headersInput: NatsJsHeaderBag | undefined): Record<string, string> {
  if (headersInput === undefined) {
    return {};
  }

  const headerRecord: Record<string, string> = {};

  for (const key of headersInput.keys()) {
    headerRecord[key] = headersInput.get(key);
  }

  return headerRecord;
}

function createDefaultNatsJsLibraryFacade(): NatsJsLibraryFacade {
  return {
    connect: async (input) => await connect(createNodeConnectionOptions(input)),
    createHeaders: () => headers(),
    createJetStreamClient: (connection) => adaptJetStreamClient(jetstream(connection as NatsConnection)),
    createJetStreamManager: async (connection) =>
      adaptJetStreamManager(await jetstreamManager(connection as NatsConnection)),
  };
}

function createNodeConnectionOptions(input: NatsJsConnectionInput): NodeConnectionOptions {
  return {
    servers: [...input.servers],
  };
}

function adaptJetStreamClient(client: JetStreamClient): NatsJsJetStreamClient {
  return {
    consumers: {
      get: async (streamName, durableName) => adaptJetStreamConsumer(await client.consumers.get(streamName, durableName)),
    },
    publish: async (subject, payload, options) => {
      await client.publish(subject, payload, {
        msgID: options.msgID,
        headers: options.headers as MsgHdrs,
      });
    },
  };
}

function adaptJetStreamConsumer(consumer: NatsJsConsumer): NatsJsConsumer {
  return {
    fetch: async (input) => await consumer.fetch(input),
  };
}

function adaptJetStreamManager(manager: JetStreamManager): NatsJsJetStreamManager {
  return {
    consumers: {
      info: async (streamName, durableName) => await manager.consumers.info(streamName, durableName),
    },
  };
}
