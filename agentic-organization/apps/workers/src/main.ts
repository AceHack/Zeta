import { createHash, randomUUID } from "node:crypto";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";

import type { AgenticEventEnvelope } from "../../../packages/domain/src/index.ts";
import type { EventPublisher } from "../../../packages/messaging/src/index.ts";
import type {
  NatsDeadLetterPublisher,
  NatsJetStreamPullConsumer,
} from "../../../packages/messaging-nats/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type EventPayloadHashCalculator,
  type ReactionPlanActionExecutorPort,
} from "../../../packages/runtime/src/index.ts";
import {
  createCockroachControlPlaneStateStore,
  createCockroachHermesRuntime,
  createCockroachMemory,
  createCockroachSqlExecutor,
} from "../../../packages/state-cockroach/src/index.ts";
import {
  createFirstLegalOptionComposer,
  createHermesReactionPlanActionExecutor,
  createModelBackedComposer,
  toAsyncComposer,
  type AsyncEphemeralComposerPort,
} from "../../../packages/application/src/index.ts";
import { composeOrganizationReactionPlanActionExecutor } from "./organization-executor-composition.ts";
import { createOllamaChatPort } from "./adapters/ollama-chat-port.ts";
import { createSubprocessSandbox } from "./adapters/subprocess-sandbox.ts";
import type { InboundEventSource } from "../../../packages/workers/src/index.ts";
import {
  createCockroachMigrationBootstrapper,
  type CreateCockroachMigrationBootstrapperInput,
} from "./adapters/cockroach-migration-bootstrapper.ts";
import {
  createCockroachReadinessProbe,
  type CreateCockroachReadinessProbeInput,
} from "./adapters/cockroach-readiness.ts";
import {
  createCockroachWorkerShutdownPort,
  createCockroachWorkerSqlClient,
  type CockroachWorkerShutdownPool,
  type CreateCockroachWorkerSqlClientInput,
} from "./adapters/cockroach-worker-client.ts";
import {
  createJsonWorkerTelemetrySink,
  type CreateJsonWorkerTelemetrySinkInput,
  type JsonWorkerTelemetryRecord,
} from "./adapters/json-worker-telemetry-sink.ts";
import {
  connectNatsWorkerAdapters,
  type ConnectNatsWorkerAdaptersInput,
  type NatsWorkerAdapters,
} from "./adapters/nats-worker-connection.ts";
import {
  createNatsJsTransportConnectionFactory,
  type CreateNatsJsTransportConnectionFactoryInput,
} from "./adapters/nats-js-transport-connection.ts";
import {
  createPgCockroachWorkerPool,
  type CreatePgCockroachWorkerPoolInput,
  type PgCockroachWorkerPool,
} from "./adapters/pg-cockroach-worker-pool.ts";
import {
  WorkerKeepAliveConfigDefault,
  parseWorkerRuntimeConfigFromEnv,
  type WorkerProcessConfig,
  type WorkerProcessEnvironment,
} from "./config.ts";
import { runKeepAliveLoop } from "./keep-alive-loop.ts";
import { composeDurableWorkerRuntimePorts } from "./durable-composition.ts";
import { composeWorkerRuntime } from "./composition.ts";
import {
  WorkerEntrypointExitCode,
  WorkerEntrypointSignalName,
  createWorkerProcessEntrypoint,
  type WorkerEntrypointSignalListener,
  type WorkerEntrypointSignalSource,
  type WorkerEntrypointSignalSubscription,
  type WorkerEntrypointSleeper,
} from "./worker-process-entrypoint.ts";
import {
  WorkerProcessLoopEventName,
  type WorkerProcessLoopObserver,
} from "./worker-process-loop.ts";
import { createWorkerProcess, type WorkerProcessShutdownPort } from "./worker-process.ts";

export const WorkerMainDefault = {
  IterationDelayMs: 1000,
  Sha256: "sha256",
} as const;

export const WorkerMainLogStream = {
  Stderr: "stderr",
  Stdout: "stdout",
} as const;

export type WorkerMainLogStream = (typeof WorkerMainLogStream)[keyof typeof WorkerMainLogStream];

export type WorkerMainLogRecord = {
  stream: WorkerMainLogStream;
  message: string;
};

export type WorkerMainLogger = {
  log: (record: WorkerMainLogRecord) => void;
};

export type WorkerMainSignalRegistrar = {
  on: (signal: WorkerEntrypointSignalName, listener: () => void) => void;
  off: (signal: WorkerEntrypointSignalName, listener: () => void) => void;
};

export type WorkerMainClock = {
  now: () => string;
  setTimeout: (callback: () => void, durationMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type WorkerMainConstructors = {
  createPgPool: (input: CreatePgCockroachWorkerPoolInput) => Promise<PgCockroachWorkerPool>;
  createSqlClient: (input: CreateCockroachWorkerSqlClientInput) => ReturnType<typeof createCockroachWorkerSqlClient>;
  connectNatsAdapters: (input: ConnectNatsWorkerAdaptersInput) => Promise<NatsWorkerAdapters>;
  createNatsTransportFactory: (
    input?: CreateNatsJsTransportConnectionFactoryInput,
  ) => ReturnType<typeof createNatsJsTransportConnectionFactory>;
  createTelemetrySink: (input: CreateJsonWorkerTelemetrySinkInput) => ReturnType<typeof createJsonWorkerTelemetrySink>;
  createMigrationBootstrapper: (
    input: CreateCockroachMigrationBootstrapperInput,
  ) => ReturnType<typeof createCockroachMigrationBootstrapper>;
  createReadinessProbe: (input: CreateCockroachReadinessProbeInput) => ReturnType<typeof createCockroachReadinessProbe>;
  createCockroachShutdownPort: (input: {
    pool: CockroachWorkerShutdownPool;
  }) => ReturnType<typeof createCockroachWorkerShutdownPort>;
};

export type WorkerMainDurablePorts = {
  inboundEventSource: InboundEventSource;
  reactionPlanActionExecutor: ReactionPlanActionExecutorPort;
  calculatePayloadHash: EventPayloadHashCalculator;
  createId: (prefix: string) => string;
};

export type RunMainDependencies = {
  env: WorkerProcessEnvironment;
  logger: WorkerMainLogger;
  signalRegistrar: WorkerMainSignalRegistrar;
  clock: WorkerMainClock;
  constructors: WorkerMainConstructors;
  durablePorts: WorkerMainDurablePorts;
  iterationDelayMs: number;
  maxCycles?: number | undefined;
};

export async function runMain(overrides?: Partial<RunMainDependencies>): Promise<number> {
  const deps = resolveRunMainDependencies(overrides);

  let config: WorkerProcessConfig;

  try {
    config = parseWorkerRuntimeConfigFromEnv(deps.env);
  } catch (error) {
    deps.logger.log({
      stream: WorkerMainLogStream.Stderr,
      message: `worker startup aborted: ${extractMainErrorMessage(error)}`,
    });

    return WorkerEntrypointExitCode.Degraded;
  }

  return await runWorkerWithResolvedConfig({
    config,
    deps,
  });
}

type RunWorkerWithResolvedConfigInput = {
  config: WorkerProcessConfig;
  deps: RunMainDependencies;
};

async function runWorkerWithResolvedConfig(input: RunWorkerWithResolvedConfigInput): Promise<number> {
  const { config, deps } = input;
  const telemetrySink = deps.constructors.createTelemetrySink({
    writer: createLoggerJsonLineWriter(deps.logger),
    now: deps.clock.now,
  });

  const pool = await deps.constructors.createPgPool({
    databaseUrl: config.cockroachDatabaseUrl,
  });
  const sqlClient = deps.constructors.createSqlClient({
    pool,
  });
  const cockroachExecutor = createCockroachSqlExecutor({
    client: sqlClient,
  });
  const natsAdapters = await deps.constructors.connectNatsAdapters({
    config: {
      durableName: config.natsDurableName,
      environment: config.environment,
      organizationId: config.organizationId,
      servers: config.natsServers,
      streamName: config.natsStreamName,
    },
    deadLetterMessageIdFactory: {
      createId: (message) => createSha256Digest(message.payload),
    },
    transportFactory: deps.constructors.createNatsTransportFactory(),
  });

  // The autonomous data plane: reaction-plan actions run through a Hermes run,
  // whose heartbeat persists agent liveness to the durable control-plane store so
  // the deterministic keep-alive engine watches the agent. (The Hermes runtime is
  // in-process today; a real agent backend swaps in behind the same port.)
  const controlPlaneStore = createCockroachControlPlaneStateStore({ executor: cockroachExecutor });

  // The agent's decision intelligence. When an in-cluster model endpoint is
  // configured the agent makes REAL model calls (falling back to the
  // deterministic policy if the model is unreachable or picks an illegal move —
  // the decision kernel re-checks every choice, so the model never widens the
  // rules). Otherwise the deterministic first-legal-option policy is used.
  const agentComposer: AsyncEphemeralComposerPort =
    config.llmBaseUrl !== undefined && config.llmModel !== undefined
      ? createModelBackedComposer({
          chat: createOllamaChatPort({ baseUrl: config.llmBaseUrl, model: config.llmModel }),
          fallback: createFirstLegalOptionComposer(),
        })
      : toAsyncComposer(createFirstLegalOptionComposer());

  const hermesExecutor = createHermesReactionPlanActionExecutor({
    // durable Hermes runs — every agent run is a durable, auditable row
    createHermesRuntime: () => createCockroachHermesRuntime({ executor: cockroachExecutor }),
    // durable Hindsight memory — what the agent retains/recalls persists across restarts
    createMemory: () => createCockroachMemory({ executor: cockroachExecutor }),
    agentHeartbeatWriter: controlPlaneStore,
    agentHeartbeatDeadlineMs: config.workerKeepAliveOrgHeartbeatDeadlineMs,
    generateId: deps.durablePorts.createId,
    // the live decision backend (model calls) + real sandboxed tool execution
    composer: agentComposer,
    sandbox: createSubprocessSandbox(),
    nodeBinary: argv[0] ?? "node",
  });

  // The entire organizational structure: each reaction-plan action runs the
  // Hermes agent (above) AND produces a durable, auditable org artifact — a
  // supervisor-triage discussion anchor created through the command pipeline,
  // anchored to a real work item. Agent autonomy meets org substrate.
  const reactionPlanActionExecutor = composeOrganizationReactionPlanActionExecutor({
    cockroachExecutor,
    agentExecutor: hermesExecutor,
    createId: deps.durablePorts.createId,
    now: deps.clock.now,
  });

  try {
    const runtimePorts = composeDurableWorkerRuntimePorts({
      config,
      durableAdapters: {
        cockroachExecutor,
        eventPublisher: natsAdapters.eventPublisher satisfies EventPublisher,
        inboundEventSource: deps.durablePorts.inboundEventSource,
        natsDeadLetterPublisher: natsAdapters.deadLetterPublisher satisfies NatsDeadLetterPublisher,
        natsPullConsumer: natsAdapters.pullConsumer satisfies NatsJetStreamPullConsumer,
        reactionPlanActionExecutor,
        telemetrySink,
      },
      runtimeUtilities: {
        calculatePayloadHash: deps.durablePorts.calculatePayloadHash,
        createId: deps.durablePorts.createId,
        now: deps.clock.now,
      },
    });
    const runtime = composeWorkerRuntime({
      config: {
        environment: config.environment,
        organizationId: config.organizationId,
        natsStreamName: config.natsStreamName,
        natsDurableName: config.natsDurableName,
        natsInboundBatchSize: config.natsInboundBatchSize,
      },
      // keepAliveLane is intentionally omitted here — it runs on its OWN independent
      // loop (below) so the org heartbeat cadence is decoupled from the work cycle
      ports: {
        organizationWorkerHost: runtimePorts.organizationWorkerHost,
        natsEventConsumer: runtimePorts.natsEventConsumer,
        telemetrySink: runtimePorts.telemetrySink,
      },
    });
    const process = createWorkerProcess({
      bootstrappers: [
        deps.constructors.createMigrationBootstrapper({
          executor: cockroachExecutor,
        }),
      ],
      readinessProbes: [
        deps.constructors.createReadinessProbe({
          client: sqlClient,
        }),
        natsAdapters.readinessProbe,
      ],
      runtime,
      shutdownPorts: collectShutdownPorts({
        deps,
        pool,
        natsAdapters,
      }),
    });

    const entrypoint = createWorkerProcessEntrypoint({
      process,
      observer: createMainLoopObserver(deps.logger),
      signalSource: createProcessSignalSource(deps.signalRegistrar),
      sleeper: createMainSleeper(deps.clock),
      iterationDelayMs: deps.iterationDelayMs,
      maxCycles: deps.maxCycles,
    });

    // Run the deterministic keep-alive on its own cadence, concurrently with the
    // work loop. The org heartbeat ticks every LoopIntervalMs regardless of what
    // the work loop is doing (a slow agent run or a 30s idle NATS poll can no
    // longer delay the org's proof of life). When the work loop stops (signal),
    // we stop the keep-alive loop and let its current tick finish.
    const keepAliveStopped = { value: false };
    const keepAliveLoop = runKeepAliveLoop({
      lane: runtimePorts.keepAliveLane,
      intervalMs: WorkerKeepAliveConfigDefault.LoopIntervalMs,
      isStopRequested: () => keepAliveStopped.value,
      sleep: (ms) => sleepUnlessStopped(deps.clock, ms, () => keepAliveStopped.value),
      observer: {
        record: (record) =>
          deps.logger.log({
            stream: WorkerMainLogStream.Stdout,
            message: JSON.stringify({
              eventName: "agentic.worker.keep_alive.tick",
              tick: record.tick,
              status: record.status,
              failureCount: record.failureCount,
            }),
          }),
      },
    });

    const result = await entrypoint.run();

    keepAliveStopped.value = true;
    await keepAliveLoop;

    return result.exitCode;
  } catch (error) {
    deps.logger.log({
      stream: WorkerMainLogStream.Stderr,
      message: `worker run failed: ${extractMainErrorMessage(error)}`,
    });

    await disposeAfterFailureBestEffort({
      deps,
      pool,
      natsAdapters,
    });

    return WorkerEntrypointExitCode.Degraded;
  }
}

type CollectShutdownPortsInput = {
  deps: RunMainDependencies;
  pool: PgCockroachWorkerPool;
  natsAdapters: NatsWorkerAdapters;
};

function collectShutdownPorts(input: CollectShutdownPortsInput): readonly WorkerProcessShutdownPort[] {
  return [
    input.natsAdapters.shutdown,
    input.deps.constructors.createCockroachShutdownPort({
      pool: input.pool,
    }),
  ];
}

type DisposeAfterFailureBestEffortInput = {
  deps: RunMainDependencies;
  pool: PgCockroachWorkerPool;
  natsAdapters: NatsWorkerAdapters;
};

async function disposeAfterFailureBestEffort(input: DisposeAfterFailureBestEffortInput): Promise<void> {
  try {
    await input.natsAdapters.shutdown.shutdown();
  } catch (error) {
    input.deps.logger.log({
      stream: WorkerMainLogStream.Stderr,
      message: `nats shutdown after failure failed: ${extractMainErrorMessage(error)}`,
    });
  }

  try {
    await input.deps.constructors
      .createCockroachShutdownPort({
        pool: input.pool,
      })
      .shutdown();
  } catch (error) {
    input.deps.logger.log({
      stream: WorkerMainLogStream.Stderr,
      message: `cockroach shutdown after failure failed: ${extractMainErrorMessage(error)}`,
    });
  }
}

function sleepUnlessStopped(clock: WorkerMainClock, durationMs: number, isStopped: () => boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    if (isStopped()) {
      resolve();
      return;
    }
    clock.setTimeout(() => resolve(), durationMs);
  });
}

function createProcessSignalSource(registrar: WorkerMainSignalRegistrar): WorkerEntrypointSignalSource {
  return {
    subscribe: (signal, listener): WorkerEntrypointSignalSubscription => {
      const handler = () => {
        (listener satisfies WorkerEntrypointSignalListener)(signal);
      };
      registrar.on(signal, handler);

      return {
        dispose: () => {
          registrar.off(signal, handler);
        },
      };
    },
  };
}

function createMainSleeper(clock: WorkerMainClock): WorkerEntrypointSleeper {
  return {
    sleep: async (sleepInput) =>
      await new Promise<void>((resolve) => {
        if (sleepInput.stopSignal.isStopRequested()) {
          resolve();
          return;
        }

        const handle = clock.setTimeout(() => {
          resolve();
        }, sleepInput.durationMs);

        if (sleepInput.stopSignal.isStopRequested()) {
          clock.clearTimeout(handle);
          resolve();
        }
      }),
  };
}

function createMainLoopObserver(logger: WorkerMainLogger): WorkerProcessLoopObserver {
  return {
    record: async (record) => {
      logger.log({
        stream:
          record.eventName === WorkerProcessLoopEventName.IterationFailed
            ? WorkerMainLogStream.Stderr
            : WorkerMainLogStream.Stdout,
        message: `worker loop ${JSON.stringify(record)}`,
      });
    },
  };
}

function createLoggerJsonLineWriter(logger: WorkerMainLogger): CreateJsonWorkerTelemetrySinkInput["writer"] {
  return {
    write: async (record: JsonWorkerTelemetryRecord) => {
      logger.log({
        stream: WorkerMainLogStream.Stdout,
        message: JSON.stringify(record),
      });
    },
  };
}

function resolveRunMainDependencies(overrides: Partial<RunMainDependencies> | undefined): RunMainDependencies {
  return {
    env: overrides?.env ?? (process.env satisfies WorkerProcessEnvironment),
    logger: overrides?.logger ?? createDefaultWorkerMainLogger(),
    signalRegistrar: overrides?.signalRegistrar ?? createDefaultSignalRegistrar(),
    clock: overrides?.clock ?? createDefaultWorkerMainClock(),
    constructors: overrides?.constructors ?? createDefaultWorkerMainConstructors(),
    durablePorts: overrides?.durablePorts ?? createDefaultWorkerMainDurablePorts(),
    iterationDelayMs: overrides?.iterationDelayMs ?? WorkerMainDefault.IterationDelayMs,
    maxCycles: overrides?.maxCycles,
  };
}

function createDefaultWorkerMainLogger(): WorkerMainLogger {
  return {
    log: (record) => {
      if (record.stream === WorkerMainLogStream.Stderr) {
        process.stderr.write(`${record.message}\n`);
        return;
      }

      process.stdout.write(`${record.message}\n`);
    },
  };
}

function createDefaultSignalRegistrar(): WorkerMainSignalRegistrar {
  return {
    on: (signal, listener) => {
      process.on(signal, listener);
    },
    off: (signal, listener) => {
      process.off(signal, listener);
    },
  };
}

function createDefaultWorkerMainClock(): WorkerMainClock {
  return {
    now: () => new Date().toISOString(),
    setTimeout: (callback, durationMs) => setTimeout(callback, durationMs),
    clearTimeout: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

function createDefaultWorkerMainConstructors(): WorkerMainConstructors {
  return {
    createPgPool: (input) => createPgCockroachWorkerPool(input),
    createSqlClient: (input) => createCockroachWorkerSqlClient(input),
    connectNatsAdapters: (input) => connectNatsWorkerAdapters(input),
    createNatsTransportFactory: (input) => createNatsJsTransportConnectionFactory(input),
    createTelemetrySink: (input) => createJsonWorkerTelemetrySink(input),
    createMigrationBootstrapper: (input) => createCockroachMigrationBootstrapper(input),
    createReadinessProbe: (input) => createCockroachReadinessProbe(input),
    createCockroachShutdownPort: (input) => createCockroachWorkerShutdownPort(input),
  };
}

function createDefaultWorkerMainDurablePorts(): WorkerMainDurablePorts {
  return {
    inboundEventSource: {
      pullNextBatch: async () => [],
    },
    reactionPlanActionExecutor: {
      executeReactionPlanAction: async () => ({
        status: ReactionPlanExecutionStatus.Succeeded,
        result: {
          message: "worker host accepted reaction plan action",
          createdWorkItemIds: [],
          createdDiscussionAnchorIds: [],
        },
      }),
    },
    calculatePayloadHash: (envelope: AgenticEventEnvelope) =>
      `${WorkerMainDefault.Sha256}:${createSha256Digest(JSON.stringify(envelope))}`,
    createId: (prefix) => `${prefix}-${randomUUID()}`,
  };
}

function createSha256Digest(value: string): string {
  return createHash(WorkerMainDefault.Sha256).update(value).digest("hex");
}

function extractMainErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];

  if (entryPoint === undefined) {
    return false;
  }

  try {
    return fileURLToPath(new URL(import.meta.url)) === entryPoint;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  void runMain().then((code) => {
    process.exit(code);
  });
}
