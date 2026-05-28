import {
  WorkerProcessLifecycleStage,
  WorkerProcessShutdownStatus,
  type WorkerProcess,
  type WorkerProcessRunResult,
  type WorkerProcessShutdownResult,
} from "./worker-process.ts";
import { WorkerRuntimeStatus } from "./worker-runtime.ts";

export const WorkerProcessLoopStatus = {
  Completed: "completed",
  Degraded: "degraded",
  Stopped: "stopped",
} as const;

export type WorkerProcessLoopStatus = (typeof WorkerProcessLoopStatus)[keyof typeof WorkerProcessLoopStatus];

export const WorkerProcessLoopEventName = {
  IterationCompleted: "agentic.worker.loop.iteration_completed",
  IterationFailed: "agentic.worker.loop.iteration_failed",
  ShutdownCompleted: "agentic.worker.loop.shutdown_completed",
} as const;

export type WorkerProcessLoopEventName =
  (typeof WorkerProcessLoopEventName)[keyof typeof WorkerProcessLoopEventName];

export const WorkerProcessLoopFailureStage = {
  Delay: "delay",
  Iteration: "iteration",
  Observer: "observer",
  Shutdown: "shutdown",
} as const;

export type WorkerProcessLoopFailureStage =
  (typeof WorkerProcessLoopFailureStage)[keyof typeof WorkerProcessLoopFailureStage];

export type WorkerProcessLoopFailure = {
  stage: WorkerProcessLoopFailureStage;
  iteration: number | undefined;
  message: string;
};

export type WorkerProcessLoopIteration = {
  iteration: number;
  processResult: WorkerProcessRunResult | undefined;
  status: WorkerRuntimeStatus;
};

export type WorkerProcessLoopRunResult = {
  status: WorkerProcessLoopStatus;
  iterations: readonly WorkerProcessLoopIteration[];
  shutdown: WorkerProcessShutdownResult;
  failures: readonly WorkerProcessLoopFailure[];
};

export type WorkerProcessLoopRecord =
  | {
      eventName: typeof WorkerProcessLoopEventName.IterationCompleted;
      iteration: number;
      status: WorkerRuntimeStatus;
    }
  | {
      eventName: typeof WorkerProcessLoopEventName.IterationFailed;
      iteration: number;
      message: string;
    }
  | {
      eventName: typeof WorkerProcessLoopEventName.ShutdownCompleted;
      status: WorkerProcessShutdownStatus;
    };

export type WorkerProcessLoopObserver = {
  record: (record: WorkerProcessLoopRecord) => Promise<void>;
};

export type WorkerProcessLoopDelay = {
  waitAfterIteration: (input: WorkerProcessLoopDelayInput) => Promise<void>;
};

export type WorkerProcessLoopDelayInput = {
  iteration: number;
  lastResult: WorkerProcessLoopIteration;
};

export type WorkerProcessLoopStopSignal = {
  isStopRequested: () => boolean;
};

export type WorkerProcessLoop = {
  run: () => Promise<WorkerProcessLoopRunResult>;
};

export type CreateWorkerProcessLoopInput = {
  process: WorkerProcess;
  delay: WorkerProcessLoopDelay;
  observer: WorkerProcessLoopObserver;
  stopSignal: WorkerProcessLoopStopSignal;
  maxCycles?: number | undefined;
};

const WorkerProcessLoopConfigErrorMessage = {
  InvalidMaxCycles: "worker process loop maxCycles must be a positive safe integer when provided",
} as const;

export function createWorkerProcessLoop(input: CreateWorkerProcessLoopInput): WorkerProcessLoop {
  validateWorkerProcessLoopInput(input);

  return {
    run: async () => await runWorkerProcessLoop(input),
  };
}

function validateWorkerProcessLoopInput(input: CreateWorkerProcessLoopInput): void {
  if (
    input.maxCycles !== undefined &&
    (!Number.isSafeInteger(input.maxCycles) || input.maxCycles < 1)
  ) {
    throw new Error(WorkerProcessLoopConfigErrorMessage.InvalidMaxCycles);
  }
}

async function runWorkerProcessLoop(input: CreateWorkerProcessLoopInput): Promise<WorkerProcessLoopRunResult> {
  const iterations: WorkerProcessLoopIteration[] = [];
  const failures: WorkerProcessLoopFailure[] = [];
  let stoppedBySignal = input.stopSignal.isStopRequested();

  while (!stoppedBySignal && !hasReachedMaxCycles(iterations.length, input.maxCycles)) {
    const iteration = iterations.length + 1;
    const iterationResult = await runWorkerProcessIteration({
      input,
      iteration,
      failures,
    });
    iterations.push(iterationResult);

    stoppedBySignal = input.stopSignal.isStopRequested();

    if (stoppedBySignal || hasReachedMaxCycles(iterations.length, input.maxCycles)) {
      break;
    }

    const delaySucceeded = await waitAfterIteration({
      delay: input.delay,
      iterationResult,
      failures,
    });

    stoppedBySignal = input.stopSignal.isStopRequested();

    if (!delaySucceeded) {
      break;
    }
  }

  const shutdown = await shutdownWorkerProcess({
    process: input.process,
    observer: input.observer,
    failures,
  });

  return {
    status: resolveWorkerProcessLoopStatus({
      failures,
      iterations,
      shutdown,
      stoppedBySignal,
    }),
    iterations,
    shutdown,
    failures,
  };
}

type RunWorkerProcessIterationInput = {
  input: CreateWorkerProcessLoopInput;
  iteration: number;
  failures: WorkerProcessLoopFailure[];
};

async function runWorkerProcessIteration(
  runInput: RunWorkerProcessIterationInput,
): Promise<WorkerProcessLoopIteration> {
  try {
    const processResult = await runInput.input.process.runOnce();
    const iterationResult: WorkerProcessLoopIteration = {
      iteration: runInput.iteration,
      processResult,
      status: processResult.status,
    };
    await observeLoopRecord({
      observer: runInput.input.observer,
      failures: runInput.failures,
      iteration: runInput.iteration,
      record: {
        eventName: WorkerProcessLoopEventName.IterationCompleted,
        iteration: runInput.iteration,
        status: processResult.status,
      },
    });
    return iterationResult;
  } catch (error) {
    const message = extractLoopErrorMessage(error);
    runInput.failures.push({
      stage: WorkerProcessLoopFailureStage.Iteration,
      iteration: runInput.iteration,
      message,
    });
    await observeLoopRecord({
      observer: runInput.input.observer,
      failures: runInput.failures,
      iteration: runInput.iteration,
      record: {
        eventName: WorkerProcessLoopEventName.IterationFailed,
        iteration: runInput.iteration,
        message,
      },
    });

    return {
      iteration: runInput.iteration,
      processResult: undefined,
      status: WorkerRuntimeStatus.Degraded,
    };
  }
}

type WaitAfterIterationInput = {
  delay: WorkerProcessLoopDelay;
  iterationResult: WorkerProcessLoopIteration;
  failures: WorkerProcessLoopFailure[];
};

async function waitAfterIteration(input: WaitAfterIterationInput): Promise<boolean> {
  try {
    await input.delay.waitAfterIteration({
      iteration: input.iterationResult.iteration,
      lastResult: input.iterationResult,
    });
    return true;
  } catch (error) {
    input.failures.push({
      stage: WorkerProcessLoopFailureStage.Delay,
      iteration: input.iterationResult.iteration,
      message: extractLoopErrorMessage(error),
    });
    return false;
  }
}

type ShutdownWorkerProcessInput = {
  process: WorkerProcess;
  observer: WorkerProcessLoopObserver;
  failures: WorkerProcessLoopFailure[];
};

async function shutdownWorkerProcess(input: ShutdownWorkerProcessInput): Promise<WorkerProcessShutdownResult> {
  try {
    const shutdown = await input.process.shutdown();

    for (const failure of shutdown.failures) {
      input.failures.push({
        stage: WorkerProcessLoopFailureStage.Shutdown,
        iteration: undefined,
        message: failure.message,
      });
    }

    await observeLoopRecord({
      observer: input.observer,
      failures: input.failures,
      iteration: undefined,
      record: {
        eventName: WorkerProcessLoopEventName.ShutdownCompleted,
        status: shutdown.status,
      },
    });

    return shutdown;
  } catch (error) {
    const message = extractLoopErrorMessage(error);
    input.failures.push({
      stage: WorkerProcessLoopFailureStage.Shutdown,
      iteration: undefined,
      message,
    });

    return {
      status: WorkerProcessShutdownStatus.Degraded,
      closedPortNames: [],
      failures: [
        {
          stage: WorkerProcessLifecycleStage.Shutdown,
          name: WorkerProcessLifecycleStage.Shutdown,
          message,
        },
      ],
    };
  }
}

type ObserveLoopRecordInput = {
  observer: WorkerProcessLoopObserver;
  failures: WorkerProcessLoopFailure[];
  iteration: number | undefined;
  record: WorkerProcessLoopRecord;
};

async function observeLoopRecord(input: ObserveLoopRecordInput): Promise<void> {
  try {
    await input.observer.record(input.record);
  } catch (error) {
    input.failures.push({
      stage: WorkerProcessLoopFailureStage.Observer,
      iteration: input.iteration,
      message: extractLoopErrorMessage(error),
    });
  }
}

type ResolveWorkerProcessLoopStatusInput = {
  failures: readonly WorkerProcessLoopFailure[];
  iterations: readonly WorkerProcessLoopIteration[];
  shutdown: WorkerProcessShutdownResult;
  stoppedBySignal: boolean;
};

function resolveWorkerProcessLoopStatus(input: ResolveWorkerProcessLoopStatusInput): WorkerProcessLoopStatus {
  if (
    input.failures.length > 0 ||
    input.shutdown.status === WorkerProcessShutdownStatus.Degraded ||
    input.iterations.some((iteration) => iteration.status === WorkerRuntimeStatus.Degraded)
  ) {
    return WorkerProcessLoopStatus.Degraded;
  }

  if (input.stoppedBySignal) {
    return WorkerProcessLoopStatus.Stopped;
  }

  return WorkerProcessLoopStatus.Completed;
}

function hasReachedMaxCycles(completedCycleCount: number, maxCycles: number | undefined): boolean {
  return maxCycles !== undefined && completedCycleCount >= maxCycles;
}

function extractLoopErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
