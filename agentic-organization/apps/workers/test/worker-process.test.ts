import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  WorkerProcessLifecycleStage,
  WorkerProcessShutdownStatus,
  WorkerReadinessStatus,
  WorkerRuntimeStatus,
  createWorkerProcess,
  type WorkerDependencyReadinessProbe,
  type WorkerProcessBootstrapper,
  type WorkerProcessShutdownPort,
  type WorkerRuntime,
} from "../src/index.ts";

const WorkerProcessTestMessage = {
  DependencyNotReady: "dependency not ready",
  MigrationFailed: "migration failed",
  RuntimeFailed: "runtime failed",
  ShutdownFailed: "shutdown failed",
} as const;

describe("worker process lifecycle", () => {
  test("runs bootstrap steps before readiness and one runtime cycle", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [createRecordingBootstrapper("cockroach-migrations", calls)],
      readinessProbes: [createReadyProbe(calls)],
      runtime: createRecordingRuntime(calls),
      shutdownPorts: [],
    });

    const result = await process.runOnce();

    equal(result.status, WorkerRuntimeStatus.Healthy);
    equal(result.readiness?.status, WorkerReadinessStatus.Ready);
    equal(result.runtimeResult?.status, WorkerRuntimeStatus.Healthy);
    deepEqual(result.failures, []);
    deepEqual(calls, ["bootstrap:cockroach-migrations", "readiness:nats", "runtime"]);
  });

  test("runs bootstrap steps once for the process and reuses the bootstrapped state across cycles", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [createRecordingBootstrapper("cockroach-migrations", calls)],
      readinessProbes: [createReadyProbe(calls)],
      runtime: createRecordingRuntime(calls),
      shutdownPorts: [],
    });

    await process.runOnce();
    await process.runOnce();

    deepEqual(calls, ["bootstrap:cockroach-migrations", "readiness:nats", "runtime", "readiness:nats", "runtime"]);
  });

  test("does not run readiness or runtime when bootstrap fails", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [createFailingBootstrapper("cockroach-migrations", calls)],
      readinessProbes: [createReadyProbe(calls)],
      runtime: createRecordingRuntime(calls),
      shutdownPorts: [],
    });

    const result = await process.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    equal(result.readiness, undefined);
    equal(result.runtimeResult, undefined);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLifecycleStage.Bootstrap,
        name: "cockroach-migrations",
        message: WorkerProcessTestMessage.MigrationFailed,
      },
    ]);
    deepEqual(calls, ["bootstrap:cockroach-migrations"]);
  });

  test("does not retry a failed process bootstrap on later runtime cycles", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [createFailingBootstrapper("cockroach-migrations", calls)],
      readinessProbes: [createReadyProbe(calls)],
      runtime: createRecordingRuntime(calls),
      shutdownPorts: [],
    });

    await process.runOnce();
    const result = await process.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    equal(result.readiness, undefined);
    equal(result.runtimeResult, undefined);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLifecycleStage.Bootstrap,
        name: "cockroach-migrations",
        message: WorkerProcessTestMessage.MigrationFailed,
      },
    ]);
    deepEqual(calls, ["bootstrap:cockroach-migrations"]);
  });

  test("stops bootstrap chain after the first failed bootstrapper", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [
        createRecordingBootstrapper("schema-bootstrap", calls),
        createFailingBootstrapper("seed-bootstrap", calls),
        createRecordingBootstrapper("late-bootstrap", calls),
      ],
      readinessProbes: [createReadyProbe(calls)],
      runtime: createRecordingRuntime(calls),
      shutdownPorts: [],
    });

    const result = await process.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    equal(result.readiness, undefined);
    equal(result.runtimeResult, undefined);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLifecycleStage.Bootstrap,
        name: "seed-bootstrap",
        message: WorkerProcessTestMessage.MigrationFailed,
      },
    ]);
    deepEqual(calls, ["bootstrap:schema-bootstrap", "bootstrap:seed-bootstrap"]);
  });

  test("does not run runtime when readiness is degraded", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [createRecordingBootstrapper("cockroach-migrations", calls)],
      readinessProbes: [createNotReadyProbe(calls)],
      runtime: createRecordingRuntime(calls),
      shutdownPorts: [],
    });

    const result = await process.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    equal(result.readiness?.status, WorkerReadinessStatus.Degraded);
    equal(result.runtimeResult, undefined);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLifecycleStage.Readiness,
        name: WorkerDependencyName.Nats,
        message: WorkerProcessTestMessage.DependencyNotReady,
      },
    ]);
    deepEqual(calls, ["bootstrap:cockroach-migrations", "readiness:nats"]);
  });

  test("returns degraded lifecycle evidence when runtime throws", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [createRecordingBootstrapper("cockroach-migrations", calls)],
      readinessProbes: [createReadyProbe(calls)],
      runtime: createFailingRuntime(calls),
      shutdownPorts: [],
    });

    const result = await process.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    equal(result.readiness?.status, WorkerReadinessStatus.Ready);
    equal(result.runtimeResult, undefined);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLifecycleStage.Runtime,
        name: WorkerProcessLifecycleStage.Runtime,
        message: WorkerProcessTestMessage.RuntimeFailed,
      },
    ]);
    deepEqual(calls, ["bootstrap:cockroach-migrations", "readiness:nats", "runtime"]);
  });

  test("attempts every shutdown port and reports failures without hiding successful shutdowns", async () => {
    const calls: string[] = [];
    const process = createWorkerProcess({
      bootstrappers: [],
      readinessProbes: [],
      runtime: createRecordingRuntime(calls),
      shutdownPorts: [
        createRecordingShutdownPort("nats", calls),
        createFailingShutdownPort("cockroach", calls),
        createRecordingShutdownPort("telemetry", calls),
      ],
    });

    const result = await process.shutdown();

    equal(result.status, WorkerProcessShutdownStatus.Degraded);
    deepEqual(result.closedPortNames, ["nats", "telemetry"]);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLifecycleStage.Shutdown,
        name: "cockroach",
        message: WorkerProcessTestMessage.ShutdownFailed,
      },
    ]);
    deepEqual(calls, ["shutdown:nats", "shutdown:cockroach", "shutdown:telemetry"]);
  });
});

function createRecordingBootstrapper(name: string, calls: string[]): WorkerProcessBootstrapper {
  return {
    name,
    bootstrap: async () => {
      calls.push(`bootstrap:${name}`);
    },
  };
}

function createFailingBootstrapper(name: string, calls: string[]): WorkerProcessBootstrapper {
  return {
    name,
    bootstrap: async () => {
      calls.push(`bootstrap:${name}`);
      throw new Error(WorkerProcessTestMessage.MigrationFailed);
    },
  };
}

function createReadyProbe(calls: string[]): WorkerDependencyReadinessProbe {
  return {
    name: WorkerDependencyName.Nats,
    check: async () => {
      calls.push("readiness:nats");

      return {
        name: WorkerDependencyName.Nats,
        status: WorkerDependencyReadinessStatus.Ready,
      };
    },
  };
}

function createNotReadyProbe(calls: string[]): WorkerDependencyReadinessProbe {
  return {
    name: WorkerDependencyName.Nats,
    check: async () => {
      calls.push("readiness:nats");

      return {
        name: WorkerDependencyName.Nats,
        status: WorkerDependencyReadinessStatus.NotReady,
        message: WorkerProcessTestMessage.DependencyNotReady,
      };
    },
  };
}

function createRecordingRuntime(calls: string[]): WorkerRuntime {
  return {
    runOnce: async () => {
      calls.push("runtime");

      return {
        status: WorkerRuntimeStatus.Healthy,
        workerCycle: undefined,
        natsConsumerBatch: undefined,
        failures: [],
      };
    },
  };
}

function createFailingRuntime(calls: string[]): WorkerRuntime {
  return {
    runOnce: async () => {
      calls.push("runtime");
      throw new Error(WorkerProcessTestMessage.RuntimeFailed);
    },
  };
}

function createRecordingShutdownPort(name: string, calls: string[]): WorkerProcessShutdownPort {
  return {
    name,
    shutdown: async () => {
      calls.push(`shutdown:${name}`);
    },
  };
}

function createFailingShutdownPort(name: string, calls: string[]): WorkerProcessShutdownPort {
  return {
    name,
    shutdown: async () => {
      calls.push(`shutdown:${name}`);
      throw new Error(WorkerProcessTestMessage.ShutdownFailed);
    },
  };
}
