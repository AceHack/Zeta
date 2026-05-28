import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  WorkerEntrypointExitCode,
  WorkerEntrypointSignalName,
  WorkerProcessLoopEventName,
  WorkerProcessLoopStatus,
  WorkerProcessLoopFailureStage,
  WorkerProcessShutdownStatus,
  WorkerRuntimeStatus,
  createWorkerProcessEntrypoint,
  type WorkerEntrypointSignalListener,
  type WorkerEntrypointSignalSource,
  type WorkerEntrypointSleeper,
  type WorkerProcess,
  type WorkerProcessLoopObserver,
  type WorkerProcessLoopRecord,
  type WorkerProcessRunResult,
  type WorkerProcessShutdownResult,
} from "../src/index.ts";

const WorkerProcessEntrypointTestValue = {
  DelayMs: 25,
  SleepFailureMessage: "sleep unavailable",
} as const;

describe("worker process entrypoint", () => {
  test("registers stop signals, runs the loop, disposes listeners, and maps a clean bounded run to success", async () => {
    const signalSource = createRecordingSignalSource();
    const observer = createRecordingLoopObserver();
    const entrypoint = createWorkerProcessEntrypoint({
      process: createRecordingProcess([createRunResult(WorkerRuntimeStatus.Healthy)]),
      observer,
      signalSource,
      sleeper: createRecordingSleeper(),
      iterationDelayMs: WorkerProcessEntrypointTestValue.DelayMs,
      maxCycles: 1,
    });

    const result = await entrypoint.run();

    equal(result.exitCode, WorkerEntrypointExitCode.Success);
    equal(result.loopResult.status, WorkerProcessLoopStatus.Completed);
    deepEqual(signalSource.registeredSignals, [
      WorkerEntrypointSignalName.Sigint,
      WorkerEntrypointSignalName.Sigterm,
    ]);
    deepEqual(signalSource.disposedSignals, [
      WorkerEntrypointSignalName.Sigint,
      WorkerEntrypointSignalName.Sigterm,
    ]);
    deepEqual(
      observer.records.map((record) => record.eventName),
      [WorkerProcessLoopEventName.IterationCompleted, WorkerProcessLoopEventName.ShutdownCompleted],
    );
  });

  test("stops gracefully when a registered signal is received during the delay window", async () => {
    const signalSource = createRecordingSignalSource();
    const process = createRecordingProcess([
      createRunResult(WorkerRuntimeStatus.Healthy),
      createRunResult(WorkerRuntimeStatus.Healthy),
    ]);
    const sleeper = createRecordingSleeper({
      beforeSleep: () => {
        signalSource.emit(WorkerEntrypointSignalName.Sigterm);
      },
    });
    const entrypoint = createWorkerProcessEntrypoint({
      process,
      observer: createRecordingLoopObserver(),
      signalSource,
      sleeper,
      iterationDelayMs: WorkerProcessEntrypointTestValue.DelayMs,
      maxCycles: 5,
    });

    const result = await entrypoint.run();

    equal(result.exitCode, WorkerEntrypointExitCode.Success);
    equal(result.loopResult.status, WorkerProcessLoopStatus.Stopped);
    equal(process.runCount, 1);
    deepEqual(result.receivedSignals, [WorkerEntrypointSignalName.Sigterm]);
    deepEqual(sleeper.sleepCalls, []);
  });

  test("maps degraded loop results to degraded exit intent without hiding loop evidence", async () => {
    const entrypoint = createWorkerProcessEntrypoint({
      process: createRecordingProcess([createRunResult(WorkerRuntimeStatus.Degraded)]),
      observer: createRecordingLoopObserver(),
      signalSource: createRecordingSignalSource(),
      sleeper: createRecordingSleeper(),
      iterationDelayMs: WorkerProcessEntrypointTestValue.DelayMs,
      maxCycles: 1,
    });

    const result = await entrypoint.run();

    equal(result.exitCode, WorkerEntrypointExitCode.Degraded);
    equal(result.loopResult.status, WorkerProcessLoopStatus.Degraded);
    equal(result.loopResult.iterations[0]?.status, WorkerRuntimeStatus.Degraded);
  });

  test("captures delay failures as loop evidence and exits degraded", async () => {
    const entrypoint = createWorkerProcessEntrypoint({
      process: createRecordingProcess([
        createRunResult(WorkerRuntimeStatus.Healthy),
        createRunResult(WorkerRuntimeStatus.Healthy),
      ]),
      observer: createRecordingLoopObserver(),
      signalSource: createRecordingSignalSource(),
      sleeper: createFailingSleeper(WorkerProcessEntrypointTestValue.SleepFailureMessage),
      iterationDelayMs: WorkerProcessEntrypointTestValue.DelayMs,
      maxCycles: 2,
    });

    const result = await entrypoint.run();

    equal(result.exitCode, WorkerEntrypointExitCode.Degraded);
    deepEqual(result.loopResult.failures, [
      {
        stage: WorkerProcessLoopFailureStage.Delay,
        iteration: 1,
        message: WorkerProcessEntrypointTestValue.SleepFailureMessage,
      },
    ]);
  });
});

type RecordingProcessStep = WorkerProcessRunResult;

function createRecordingProcess(
  steps: readonly RecordingProcessStep[],
): WorkerProcess & {
  readonly runCount: number;
} {
  let runCount = 0;

  return {
    get runCount() {
      return runCount;
    },
    runOnce: async () => {
      const step = steps[runCount] ?? createRunResult(WorkerRuntimeStatus.Healthy);
      runCount += 1;
      return step;
    },
    shutdown: async () => createShutdownResult(),
  };
}

function createRunResult(status: WorkerRuntimeStatus): WorkerProcessRunResult {
  return {
    status,
    readiness: undefined,
    runtimeResult: undefined,
    failures: [],
  };
}

function createShutdownResult(): WorkerProcessShutdownResult {
  return {
    status: WorkerProcessShutdownStatus.Completed,
    closedPortNames: [],
    failures: [],
  };
}

function createRecordingLoopObserver(): WorkerProcessLoopObserver & {
  records: WorkerProcessLoopRecord[];
} {
  const records: WorkerProcessLoopRecord[] = [];

  return {
    records,
    record: async (record) => {
      records.push(record);
    },
  };
}

function createRecordingSignalSource(): WorkerEntrypointSignalSource & {
  readonly disposedSignals: WorkerEntrypointSignalName[];
  readonly registeredSignals: WorkerEntrypointSignalName[];
  emit: (signal: WorkerEntrypointSignalName) => void;
} {
  const listeners = new Map<WorkerEntrypointSignalName, WorkerEntrypointSignalListener>();
  const disposedSignals: WorkerEntrypointSignalName[] = [];
  const registeredSignals: WorkerEntrypointSignalName[] = [];

  return {
    disposedSignals,
    registeredSignals,
    emit: (signal) => {
      listeners.get(signal)?.(signal);
    },
    subscribe: (signal, listener) => {
      registeredSignals.push(signal);
      listeners.set(signal, listener);

      return {
        dispose: () => {
          disposedSignals.push(signal);
          listeners.delete(signal);
        },
      };
    },
  };
}

function createRecordingSleeper(options: { beforeSleep?: () => void } = {}): WorkerEntrypointSleeper & {
  readonly sleepCalls: number[];
} {
  const sleepCalls: number[] = [];

  return {
    sleepCalls,
    sleep: async (input) => {
      options.beforeSleep?.();
      if (input.stopSignal.isStopRequested()) {
        return;
      }

      sleepCalls.push(input.durationMs);
    },
  };
}

function createFailingSleeper(message: string): WorkerEntrypointSleeper {
  return {
    sleep: async () => {
      throw new Error(message);
    },
  };
}
