import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { NatsHeaderName } from "../../../packages/messaging-nats/src/index.ts";
import {
  NatsJsDefaultFetchExpiresMs,
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  createNatsJsTransportConnectionFactory,
  type NatsJsConsumerMessages,
  type NatsJsHeaderBag,
  type NatsJsLibraryFacade,
} from "../src/index.ts";

describe("NATS JS transport connection adapter", () => {
  test("connects to NATS and binds the configured stream and durable consumer", async () => {
    const library = createRecordingNatsJsLibrary();
    const factory = createNatsJsTransportConnectionFactory({ library });

    await factory.connect(createTransportInput());

    deepEqual(library.connectInputs, [{ servers: ["nats://nats.nats.svc.cluster.local:4222"] }]);
    deepEqual(library.consumerGetInputs, [
      {
        streamName: "agentic-org-events",
        durableName: "agentic-org-v0-automation-planner",
      },
    ]);
  });

  test("publishes JetStream messages with message ID and headers", async () => {
    const library = createRecordingNatsJsLibrary();
    const connection = await createNatsJsTransportConnectionFactory({ library }).connect(createTransportInput());

    await connection.publish({
      subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
      payload: "{\"eventId\":\"evt-001\"}",
      messageId: "evt-001",
      headers: {
        [NatsHeaderName.EventId]: "evt-001",
        [NatsHeaderName.TraceId]: "trace-001",
      },
    });

    deepEqual(library.jetStreamClient.publishedMessages, [
      {
        subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
        payload: "{\"eventId\":\"evt-001\"}",
        options: {
          msgID: "evt-001",
          headers: {
            [NatsHeaderName.EventId]: "evt-001",
            [NatsHeaderName.TraceId]: "trace-001",
          },
        },
      },
    ]);
  });

  test("fetches batches and adapts NATS JS messages to inbound messages", async () => {
    const library = createRecordingNatsJsLibrary({
      messages: [
        createRecordingNatsJsMessage({
          subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
          payload: "{\"eventId\":\"evt-001\"}",
          headers: {
            [NatsHeaderName.EventId]: "evt-001",
          },
        }),
      ],
    });
    const connection = await createNatsJsTransportConnectionFactory({ library }).connect(createTransportInput());

    const messages = await connection.fetchNextBatch({ batchSize: 3 });
    await messages[0]?.acknowledge();
    await messages[0]?.negativeAcknowledge();
    await messages[0]?.terminate();

    deepEqual(library.consumerFetchInputs, [
      {
        max_messages: 3,
        expires: NatsJsDefaultFetchExpiresMs,
      },
    ]);
    deepEqual(
      messages.map((message) => ({
        subject: message.subject,
        payload: message.payload,
        headers: message.headers,
      })),
      [
        {
          subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
          payload: "{\"eventId\":\"evt-001\"}",
          headers: {
            [NatsHeaderName.EventId]: "evt-001",
          },
        },
      ],
    );
    deepEqual(library.messages[0]?.actions, ["ack", "nak", "term"]);
  });

  test("rejects fetch when consumer message cleanup reports an error", async () => {
    const library = createRecordingNatsJsLibrary({
      consumerCloseResult: new Error("consumer message cleanup failed"),
      messages: [
        createRecordingNatsJsMessage({
          subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
          payload: "{\"eventId\":\"evt-001\"}",
        }),
      ],
    });
    const connection = await createNatsJsTransportConnectionFactory({ library }).connect(createTransportInput());

    try {
      await connection.fetchNextBatch({ batchSize: 3 });
      throw new Error("expected NATS adapter fetch to fail");
    } catch (error) {
      equal(error instanceof Error, true);
      equal((error as Error).message, "consumer message cleanup failed");
    }
  });

  test("checks durable consumer readiness and closes the NATS connection", async () => {
    const library = createRecordingNatsJsLibrary();
    const connection = await createNatsJsTransportConnectionFactory({ library }).connect(createTransportInput());

    const readiness = await connection.checkReadiness();
    await connection.close();

    deepEqual(readiness, {
      name: WorkerDependencyName.Nats,
      status: WorkerDependencyReadinessStatus.Ready,
    });
    deepEqual(library.consumerInfoInputs, [
      {
        streamName: "agentic-org-events",
        durableName: "agentic-org-v0-automation-planner",
      },
    ]);
    equal(library.natsConnection.closeCount, 1);
  });

  test("fails startup when the configured durable consumer cannot be bound", async () => {
    const library = createRecordingNatsJsLibrary({
      consumerGetError: new Error("durable consumer not found"),
    });
    const factory = createNatsJsTransportConnectionFactory({ library });

    try {
      await factory.connect(createTransportInput());
      throw new Error("expected NATS adapter connection to fail");
    } catch (error) {
      equal(error instanceof Error, true);
      equal((error as Error).message, "durable consumer not found");
    }
    equal(library.natsConnection.closeCount, 1);
  });

  test("preserves the startup failure when cleanup close rejects", async () => {
    const library = createRecordingNatsJsLibrary({
      connectionCloseError: new Error("connection close failed"),
      consumerGetError: new Error("durable consumer not found"),
    });
    const factory = createNatsJsTransportConnectionFactory({ library });

    try {
      await factory.connect(createTransportInput());
      throw new Error("expected NATS adapter connection to fail");
    } catch (error) {
      equal(error instanceof Error, true);
      equal((error as Error).message, "durable consumer not found");
    }
    equal(library.natsConnection.closeCount, 1);
  });

  test("closes the NATS connection when JetStream manager creation fails", async () => {
    const library = createRecordingNatsJsLibrary({
      jetStreamManagerError: new Error("jetstream manager unavailable"),
    });
    const factory = createNatsJsTransportConnectionFactory({ library });

    try {
      await factory.connect(createTransportInput());
      throw new Error("expected NATS adapter connection to fail");
    } catch (error) {
      equal(error instanceof Error, true);
      equal((error as Error).message, "jetstream manager unavailable");
    }
    equal(library.natsConnection.closeCount, 1);
  });
});

function createTransportInput() {
  return {
    durableName: "agentic-org-v0-automation-planner",
    environment: "dev",
    organizationId: "org-lfg",
    servers: ["nats://nats.nats.svc.cluster.local:4222"],
    streamName: "agentic-org-events",
  };
}

function createRecordingNatsJsLibrary(options?: {
  connectionCloseError?: Error;
  consumerCloseResult?: Error;
  consumerGetError?: Error;
  jetStreamManagerError?: Error;
  messages?: RecordingNatsJsMessage[];
}): NatsJsLibraryFacade & {
  connectInputs: { servers: readonly string[] }[];
  consumerFetchInputs: { max_messages: number; expires: number }[];
  consumerGetInputs: { streamName: string; durableName: string }[];
  consumerInfoInputs: { streamName: string; durableName: string }[];
  jetStreamClient: RecordingNatsJsJetStreamClient;
  messages: RecordingNatsJsMessage[];
  natsConnection: RecordingNatsJsConnection;
} {
  const connectInputs: { servers: readonly string[] }[] = [];
  const consumerFetchInputs: { max_messages: number; expires: number }[] = [];
  const consumerGetInputs: { streamName: string; durableName: string }[] = [];
  const consumerInfoInputs: { streamName: string; durableName: string }[] = [];
  const messages = [...(options?.messages ?? [])];
  const natsConnection = {
    closeCount: 0,
    close: async () => {
      natsConnection.closeCount += 1;
      if (options?.connectionCloseError !== undefined) {
        throw options.connectionCloseError;
      }
    },
  };
  const consumer = {
    fetch: async (input: { max_messages: number; expires: number }) => {
      consumerFetchInputs.push(input);
      return createNatsJsConsumerMessages(messages, options?.consumerCloseResult);
    },
  };
  const jetStreamClient: RecordingNatsJsJetStreamClient = {
    publishedMessages: [],
    publish: async (subject, payload, optionsInput) => {
      jetStreamClient.publishedMessages.push({
        subject,
        payload,
        options: {
          msgID: optionsInput.msgID,
          headers: toRecordingHeaderBag(optionsInput.headers).toRecord(),
        },
      });
    },
    consumers: {
      get: async (streamName: string, durableName: string) => {
        consumerGetInputs.push({ streamName, durableName });
        if (options?.consumerGetError !== undefined) {
          throw options.consumerGetError;
        }
        return consumer;
      },
    },
  };
  const manager = {
    consumers: {
      info: async (streamName: string, durableName: string) => {
        consumerInfoInputs.push({ streamName, durableName });
      },
    },
  };

  return {
    connectInputs,
    consumerFetchInputs,
    consumerGetInputs,
    consumerInfoInputs,
    jetStreamClient,
    messages,
    natsConnection,
    connect: async (input) => {
      connectInputs.push(input);
      return natsConnection;
    },
    createHeaders: () => createRecordingHeaderBag(),
    createJetStreamClient: () => jetStreamClient,
    createJetStreamManager: async () => {
      if (options?.jetStreamManagerError !== undefined) {
        throw options.jetStreamManagerError;
      }

      return manager;
    },
  };
}

type RecordingNatsJsConnection = {
  closeCount: number;
  close: () => Promise<void>;
};

type RecordingNatsJsJetStreamClient = {
  publishedMessages: {
    subject: string;
    payload: string;
    options: {
      msgID: string;
      headers: Record<string, string>;
    };
  }[];
  publish: (subject: string, payload: string, options: { msgID: string; headers: NatsJsHeaderBag }) => Promise<void>;
  consumers: {
    get: (streamName: string, durableName: string) => Promise<{
      fetch: (input: { max_messages: number; expires: number }) => Promise<NatsJsConsumerMessages>;
    }>;
  };
};

type RecordingNatsJsMessage = {
  actions: string[];
  data: Uint8Array;
  headers: NatsJsHeaderBag | undefined;
  subject: string;
  ack: () => void;
  nak: () => void;
  term: () => void;
};

function createRecordingNatsJsMessage(input: {
  subject: string;
  payload: string;
  headers?: Record<string, string>;
}): RecordingNatsJsMessage {
  const actions: string[] = [];

  return {
    actions,
    data: new TextEncoder().encode(input.payload),
    headers: input.headers === undefined ? undefined : createRecordingHeaderBag(input.headers),
    subject: input.subject,
    ack: () => {
      actions.push("ack");
    },
    nak: () => {
      actions.push("nak");
    },
    term: () => {
      actions.push("term");
    },
  };
}

function createNatsJsConsumerMessages(
  messages: RecordingNatsJsMessage[],
  closeResult?: Error,
): NatsJsConsumerMessages {
  return {
    async *[Symbol.asyncIterator]() {
      for (const message of messages) {
        yield message;
      }
    },
    close: async () => closeResult,
  };
}

type RecordingNatsJsHeaderBag = NatsJsHeaderBag & {
  toRecord: () => Record<string, string>;
};

function toRecordingHeaderBag(headerBag: NatsJsHeaderBag): RecordingNatsJsHeaderBag {
  return headerBag as RecordingNatsJsHeaderBag;
}

function createRecordingHeaderBag(values?: Record<string, string>): RecordingNatsJsHeaderBag {
  const record = { ...(values ?? {}) };

  return {
    keys: () => Object.keys(record),
    get: (key) => record[key] ?? "",
    set: (key, value) => {
      record[key] = value;
    },
    toRecord: () => ({ ...record }),
  };
}
