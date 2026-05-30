import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import type { AgenticEventEnvelope } from "../../../packages/domain/src/index.ts";
import type { EventPublication } from "../../../packages/messaging/src/index.ts";
import type {
  NatsDeadLetterMessage,
  NatsJetStreamInboundMessage,
} from "../../../packages/messaging-nats/src/index.ts";
import { ReactionPlanExecutionStatus } from "../../../packages/runtime/src/index.ts";
import type {
  CockroachAnySqlResult,
  CockroachSqlClient,
} from "../../../packages/state-cockroach/src/index.ts";
import {
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  WorkerProcessBootstrapperName,
  type WorkerProcessBootstrapper,
  type WorkerProcessShutdownPort,
  type WorkerDependencyReadinessProbe,
} from "../src/index.ts";
import {
  WorkerMainLogStream,
  runMain,
  type RunMainDependencies,
  type WorkerMainClock,
  type WorkerMainConstructors,
  type WorkerMainDurablePorts,
  type WorkerMainLogRecord,
  type WorkerMainLogger,
  type WorkerMainSignalRegistrar,
} from "../src/main.ts";

const WorkerMainTestExitCode = {
  Degraded: 1,
  Success: 0,
} as const;

const WorkerMainTestEnv = {
  COCKROACH_DATABASE_URL: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
  AGENTIC_ORG_ENV: "dev",
  AGENTIC_ORG_ID: "org-lfg",
  NATS_SERVERS: "nats://nats.nats.svc.cluster.local:4222",
  NATS_STREAM: "agentic-org-events",
  NATS_DURABLE: "agentic-org-v0-automation-planner",
  NATS_INBOUND_BATCH_SIZE: "25",
  WORKER_INBOUND_BATCH_SIZE: "10",
  WORKER_OUTBOX_BATCH_SIZE: "5",
  WORKER_REACTION_PLAN_BATCH_SIZE: "3",
  WORKER_REACTION_PLAN_LEASE_MS: "300000",
} as const;

describe("worker main composition entrypoint", () => {
  test("composes a clean bounded run from injected fakes and returns success exit code", async () => {
    const logger = createRecordingLogger();
    const signalRegistrar = createRecordingSignalRegistrar();
    const clock = createDeterministicClock();
    const shutdownPool = createRecordingShutdownPool();
    const natsAdapters = createRecordingNatsAdapters();
    const bootstrap = createRecordingBootstrap();

    const exitCode = await runMain(
      createTestDependencies({
        logger,
        signalRegistrar,
        clock,
        shutdownPool,
        natsAdapters,
        bootstrap,
      }),
    );

    equal(exitCode, WorkerMainTestExitCode.Success);
    deepEqual(signalRegistrar.registeredSignals, ["SIGINT", "SIGTERM"]);
    deepEqual(signalRegistrar.removedSignals, ["SIGINT", "SIGTERM"]);
    equal(bootstrap.bootstrapCount, 1);
    ok(natsAdapters.readinessCheckCount >= 1);
    deepEqual(shutdownPool.endCount >= 1, true);
    equal(natsAdapters.shutdownCount, 1);
    ok(
      logger.records.some(
        (record) =>
          record.stream === WorkerMainLogStream.Stdout && record.message.includes("shutdown_completed"),
      ),
    );
  });

  test("returns a degraded exit code without invoking constructors when config is missing", async () => {
    const logger = createRecordingLogger();
    const constructorsInvoked = { count: 0 };

    const exitCode = await runMain({
      env: {},
      logger,
      signalRegistrar: createRecordingSignalRegistrar(),
      clock: createDeterministicClock(),
      constructors: createThrowingConstructors(constructorsInvoked),
      durablePorts: createTestDurablePorts(),
      iterationDelayMs: 1,
      maxCycles: 1,
    });

    equal(exitCode, WorkerMainTestExitCode.Degraded);
    equal(constructorsInvoked.count, 0);
    ok(
      logger.records.some(
        (record) =>
          record.stream === WorkerMainLogStream.Stderr && record.message.includes("worker startup aborted"),
      ),
    );
  });
});

type CreateTestDependenciesInput = {
  logger: WorkerMainLogger;
  signalRegistrar: WorkerMainSignalRegistrar;
  clock: WorkerMainClock;
  shutdownPool: RecordingShutdownPool;
  natsAdapters: RecordingNatsAdapters;
  bootstrap: RecordingBootstrap;
};

function createTestDependencies(input: CreateTestDependenciesInput): RunMainDependencies {
  return {
    env: { ...WorkerMainTestEnv } as RunMainDependencies["env"],
    logger: input.logger,
    signalRegistrar: input.signalRegistrar,
    clock: input.clock,
    constructors: createTestConstructors({
      shutdownPool: input.shutdownPool,
      natsAdapters: input.natsAdapters,
      bootstrap: input.bootstrap,
    }),
    durablePorts: createTestDurablePorts(),
    iterationDelayMs: 1,
    maxCycles: 1,
  };
}

type CreateTestConstructorsInput = {
  shutdownPool: RecordingShutdownPool;
  natsAdapters: RecordingNatsAdapters;
  bootstrap: RecordingBootstrap;
};

function createTestConstructors(input: CreateTestConstructorsInput): WorkerMainConstructors {
  return {
    createPgPool: async () => ({
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => undefined,
      }),
      end: input.shutdownPool.end,
    }),
    createSqlClient: () => createEmptyCockroachSqlClient(),
    connectNatsAdapters: async () => input.natsAdapters.adapters,
    createNatsTransportFactory: () => ({
      connect: async () => {
        throw new Error("transport factory connect must not be called when adapters are injected");
      },
    }),
    createTelemetrySink: (telemetryInput) => ({
      record: async (record) => {
        await telemetryInput.writer.write({
          timestamp: telemetryInput.now(),
          eventName: record.eventName,
          attributes: record.attributes,
        });
      },
    }),
    createMigrationBootstrapper: (): WorkerProcessBootstrapper => ({
      name: WorkerProcessBootstrapperName.CockroachMigrations,
      bootstrap: input.bootstrap.bootstrap,
    }),
    createReadinessProbe: (): WorkerDependencyReadinessProbe => ({
      name: WorkerDependencyName.Cockroach,
      check: async () => ({
        name: WorkerDependencyName.Cockroach,
        status: WorkerDependencyReadinessStatus.Ready,
      }),
    }),
    createCockroachShutdownPort: (shutdownInput): WorkerProcessShutdownPort => ({
      name: WorkerDependencyName.Cockroach,
      shutdown: async () => {
        await shutdownInput.pool.end();
      },
    }),
  };
}

function createTestDurablePorts(): WorkerMainDurablePorts {
  return {
    inboundEventSource: {
      pullNextBatch: async () => [],
    },
    reactionPlanActionExecutor: {
      executeReactionPlanAction: async () => ({
        status: ReactionPlanExecutionStatus.Succeeded,
        result: {
          message: "test reaction action",
          createdWorkItemIds: [],
          createdDiscussionAnchorIds: [],
        },
      }),
    },
    calculatePayloadHash: (_envelope: AgenticEventEnvelope) => "sha256:test-payload",
    createId: (prefix) => `${prefix}-test`,
  };
}

function createEmptyCockroachSqlClient(): CockroachSqlClient {
  const client: CockroachSqlClient = {
    query: async <Row = Record<string, unknown>>(): Promise<CockroachAnySqlResult<Row>> => ({
      rows: [] as Row[],
    }),
    transaction: async (operation) => await operation(client),
  };

  return client;
}

type RecordingLogger = WorkerMainLogger & {
  records: WorkerMainLogRecord[];
};

function createRecordingLogger(): RecordingLogger {
  const records: WorkerMainLogRecord[] = [];

  return {
    records,
    log: (record) => {
      records.push(record);
    },
  };
}

type RecordingSignalRegistrar = WorkerMainSignalRegistrar & {
  registeredSignals: string[];
  removedSignals: string[];
};

function createRecordingSignalRegistrar(): RecordingSignalRegistrar {
  const registeredSignals: string[] = [];
  const removedSignals: string[] = [];

  return {
    registeredSignals,
    removedSignals,
    on: (signal) => {
      registeredSignals.push(signal);
    },
    off: (signal) => {
      removedSignals.push(signal);
    },
  };
}

function createDeterministicClock(): WorkerMainClock {
  return {
    now: () => "2026-05-29T00:00:00.000Z",
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    clearTimeout: () => undefined,
  };
}

type RecordingShutdownPool = {
  endCount: number;
  end: () => Promise<void>;
};

function createRecordingShutdownPool(): RecordingShutdownPool {
  const state = { endCount: 0 };

  return {
    get endCount() {
      return state.endCount;
    },
    end: async () => {
      state.endCount += 1;
    },
  };
}

type RecordingBootstrap = {
  bootstrapCount: number;
  bootstrap: () => Promise<void>;
};

function createRecordingBootstrap(): RecordingBootstrap {
  const state = { bootstrapCount: 0 };

  return {
    get bootstrapCount() {
      return state.bootstrapCount;
    },
    bootstrap: async () => {
      state.bootstrapCount += 1;
    },
  };
}

type RecordingNatsAdapters = {
  adapters: Awaited<ReturnType<WorkerMainConstructors["connectNatsAdapters"]>>;
  readinessCheckCount: number;
  shutdownCount: number;
};

function createRecordingNatsAdapters(): RecordingNatsAdapters {
  const state = { readinessCheckCount: 0, shutdownCount: 0 };

  const adapters: Awaited<ReturnType<WorkerMainConstructors["connectNatsAdapters"]>> = {
    deadLetterPublisher: {
      publish: async (_message: NatsDeadLetterMessage) => undefined,
    },
    eventPublisher: {
      publish: async (_publication: EventPublication) => undefined,
    },
    pullConsumer: {
      fetchNextBatch: async (): Promise<readonly NatsJetStreamInboundMessage[]> => [],
    },
    readinessProbe: {
      name: WorkerDependencyName.Nats,
      check: async () => {
        state.readinessCheckCount += 1;
        return {
          name: WorkerDependencyName.Nats,
          status: WorkerDependencyReadinessStatus.Ready,
        };
      },
    },
    shutdown: {
      name: WorkerDependencyName.Nats,
      shutdown: async () => {
        state.shutdownCount += 1;
      },
    },
  };

  return {
    adapters,
    get readinessCheckCount() {
      return state.readinessCheckCount;
    },
    get shutdownCount() {
      return state.shutdownCount;
    },
  };
}

function createThrowingConstructors(invoked: { count: number }): WorkerMainConstructors {
  const fail = (): never => {
    invoked.count += 1;
    throw new Error("constructors must not run when config parsing fails");
  };

  return {
    createPgPool: async () => fail(),
    createSqlClient: () => fail(),
    connectNatsAdapters: async () => fail(),
    createNatsTransportFactory: () => fail(),
    createTelemetrySink: () => fail(),
    createMigrationBootstrapper: () => fail(),
    createReadinessProbe: () => fail(),
    createCockroachShutdownPort: () => fail(),
  };
}
