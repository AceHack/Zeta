import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  WorkerProcessLoopEventName,
  WorkerProcessLoopFailureStage,
  WorkerProcessLoopStatus,
  WorkerProcessLifecycleStage,
  WorkerProcessShutdownStatus,
  WorkerRuntimeStatus,
  createWorkerProcessLoop,
  type WorkerProcess,
  type WorkerProcessLoopObserver,
  type WorkerProcessLoopRecord,
  type WorkerProcessRunResult,
  type WorkerProcessShutdownResult,
} from "../src/index.ts";

const WorkerProcessLoopTestValue = {
  DelayFailureMessage: "delay unavailable",
  IterationFailureMessage: "iteration exploded",
  ObserverFailureMessage: "observer unavailable",
  ShutdownFailureMessage: "shutdown unavailable",
  ShutdownPortName: "test-shutdown",
} as const;

describe("worker process loop", () => {
  test("runs bounded process cycles, observes each cycle, waits between cycles, and shuts down", async () => {
    const process = createRecordingProcess([
      createRunResult(WorkerRuntimeStatus.Healthy),
      createRunResult(WorkerRuntimeStatus.Healthy),
    ]);
    const delay = createRecordingDelay();
    const observer = createRecordingLoopObserver();
    const loop = createWorkerProcessLoop({
      process,
      delay,
      observer,
      maxCycles: 2,
      stopSignal: createManualStopSignal(),
    });

    const result = await loop.run();

    equal(result.status, WorkerProcessLoopStatus.Completed);
    equal(process.runCount, 2);
    equal(process.shutdownCount, 1);
    deepEqual(delay.iterations, [1]);
    deepEqual(
      observer.records.map((record) => record.eventName),
      [
        WorkerProcessLoopEventName.IterationCompleted,
        WorkerProcessLoopEventName.IterationCompleted,
        WorkerProcessLoopEventName.ShutdownCompleted,
      ],
    );
    deepEqual(
      result.iterations.map((iteration) => iteration.status),
      [WorkerRuntimeStatus.Healthy, WorkerRuntimeStatus.Healthy],
    );
    deepEqual(result.failures, []);
    equal(result.shutdown.status, WorkerProcessShutdownStatus.Completed);
  });

  test("stops before the next cycle when the stop signal is raised during delay", async () => {
    const stopSignal = createManualStopSignal();
    const process = createRecordingProcess([
      createRunResult(WorkerRuntimeStatus.Healthy),
      createRunResult(WorkerRuntimeStatus.Healthy),
    ]);
    const loop = createWorkerProcessLoop({
      process,
      delay: {
        waitAfterIteration: async () => {
          stopSignal.stop();
        },
      },
      observer: createRecordingLoopObserver(),
      maxCycles: 5,
      stopSignal,
    });

    const result = await loop.run();

    equal(result.status, WorkerProcessLoopStatus.Stopped);
    equal(process.runCount, 1);
    equal(process.shutdownCount, 1);
    equal(result.iterations.length, 1);
  });

  test("captures thrown cycle failures, continues later cycles, and returns degraded", async () => {
    const process = createRecordingProcess([
      new Error(WorkerProcessLoopTestValue.IterationFailureMessage),
      createRunResult(WorkerRuntimeStatus.Healthy),
    ]);
    const observer = createRecordingLoopObserver();
    const loop = createWorkerProcessLoop({
      process,
      delay: createRecordingDelay(),
      observer,
      maxCycles: 2,
      stopSignal: createManualStopSignal(),
    });

    const result = await loop.run();

    equal(result.status, WorkerProcessLoopStatus.Degraded);
    equal(process.runCount, 2);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLoopFailureStage.Iteration,
        iteration: 1,
        message: WorkerProcessLoopTestValue.IterationFailureMessage,
      },
    ]);
    deepEqual(
      observer.records.map((record) => record.eventName),
      [
        WorkerProcessLoopEventName.IterationFailed,
        WorkerProcessLoopEventName.IterationCompleted,
        WorkerProcessLoopEventName.ShutdownCompleted,
      ],
    );
  });

  test("keeps loop results visible when observer recording fails", async () => {
    const process = createRecordingProcess([createRunResult(WorkerRuntimeStatus.Healthy)]);
    const loop = createWorkerProcessLoop({
      process,
      delay: createRecordingDelay(),
      observer: createFailingLoopObserver(WorkerProcessLoopTestValue.ObserverFailureMessage),
      maxCycles: 1,
      stopSignal: createManualStopSignal(),
    });

    const result = await loop.run();

    equal(result.status, WorkerProcessLoopStatus.Degraded);
    equal(result.iterations[0]?.status, WorkerRuntimeStatus.Healthy);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLoopFailureStage.Observer,
        iteration: 1,
        message: WorkerProcessLoopTestValue.ObserverFailureMessage,
      },
      {
        stage: WorkerProcessLoopFailureStage.Observer,
        iteration: undefined,
        message: WorkerProcessLoopTestValue.ObserverFailureMessage,
      },
    ]);
  });

  test("does not spin when the delay port fails", async () => {
    const process = createRecordingProcess([
      createRunResult(WorkerRuntimeStatus.Healthy),
      createRunResult(WorkerRuntimeStatus.Healthy),
    ]);
    const loop = createWorkerProcessLoop({
      process,
      delay: {
        waitAfterIteration: async () => {
          throw new Error(WorkerProcessLoopTestValue.DelayFailureMessage);
        },
      },
      observer: createRecordingLoopObserver(),
      maxCycles: 2,
      stopSignal: createManualStopSignal(),
    });

    const result = await loop.run();

    equal(result.status, WorkerProcessLoopStatus.Degraded);
    equal(process.runCount, 1);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLoopFailureStage.Delay,
        iteration: 1,
        message: WorkerProcessLoopTestValue.DelayFailureMessage,
      },
    ]);
  });

  test("surfaces degraded shutdown after stopping the loop", async () => {
    const process = createRecordingProcess([createRunResult(WorkerRuntimeStatus.Healthy)], {
      shutdownResult: createShutdownResult(WorkerProcessShutdownStatus.Degraded),
    });
    const loop = createWorkerProcessLoop({
      process,
      delay: createRecordingDelay(),
      observer: createRecordingLoopObserver(),
      maxCycles: 1,
      stopSignal: createManualStopSignal(),
    });

    const result = await loop.run();

    equal(result.status, WorkerProcessLoopStatus.Degraded);
    equal(result.shutdown.status, WorkerProcessShutdownStatus.Degraded);
    deepEqual(result.failures, [
      {
        stage: WorkerProcessLoopFailureStage.Shutdown,
        iteration: undefined,
        message: WorkerProcessLoopTestValue.ShutdownFailureMessage,
      },
    ]);
  });
});

type RecordingProcessStep = WorkerProcessRunResult | Error;

function createRecordingProcess(
  steps: readonly RecordingProcessStep[],
  options: { shutdownResult?: WorkerProcessShutdownResult } = {},
): WorkerProcess & {
  readonly runCount: number;
  readonly shutdownCount: number;
} {
  let runCount = 0;
  let shutdownCount = 0;

  return {
    get runCount() {
      return runCount;
    },
    get shutdownCount() {
      return shutdownCount;
    },
    runOnce: async () => {
      const step = steps[runCount] ?? createRunResult(WorkerRuntimeStatus.Healthy);
      runCount += 1;

      if (step instanceof Error) {
        throw step;
      }

      return step;
    },
    shutdown: async () => {
      shutdownCount += 1;
      return options.shutdownResult ?? createShutdownResult(WorkerProcessShutdownStatus.Completed);
    },
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

function createShutdownResult(status: WorkerProcessShutdownStatus): WorkerProcessShutdownResult {
  return {
    status,
    closedPortNames: [],
    failures:
      status === WorkerProcessShutdownStatus.Completed
        ? []
        : [
            {
              stage: WorkerProcessLifecycleStage.Shutdown,
              name: WorkerProcessLoopTestValue.ShutdownPortName,
              message: WorkerProcessLoopTestValue.ShutdownFailureMessage,
            },
          ],
  };
}

function createRecordingDelay(): {
  iterations: number[];
  waitAfterIteration: (input: { iteration: number }) => Promise<void>;
} {
  const iterations: number[] = [];

  return {
    iterations,
    waitAfterIteration: async (input) => {
      iterations.push(input.iteration);
    },
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

function createFailingLoopObserver(message: string): WorkerProcessLoopObserver {
  return {
    record: async () => {
      throw new Error(message);
    },
  };
}

function createManualStopSignal(): {
  isStopRequested: () => boolean;
  stop: () => void;
} {
  let stopped = false;

  return {
    isStopRequested: () => stopped,
    stop: () => {
      stopped = true;
    },
  };
}
