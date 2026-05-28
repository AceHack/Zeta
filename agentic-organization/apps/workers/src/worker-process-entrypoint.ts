import {
  WorkerProcessLoopStatus,
  createWorkerProcessLoop,
  type WorkerProcessLoopDelay,
  type WorkerProcessLoopObserver,
  type WorkerProcessLoopRunResult,
  type WorkerProcessLoopStopSignal,
} from "./worker-process-loop.ts";
import type { WorkerProcess } from "./worker-process.ts";

export const WorkerEntrypointSignalName = {
  Sigint: "SIGINT",
  Sigterm: "SIGTERM",
} as const;

export type WorkerEntrypointSignalName =
  (typeof WorkerEntrypointSignalName)[keyof typeof WorkerEntrypointSignalName];

export const WorkerEntrypointExitCode = {
  Success: 0,
  Degraded: 1,
} as const;

export type WorkerEntrypointExitCode =
  (typeof WorkerEntrypointExitCode)[keyof typeof WorkerEntrypointExitCode];

export const WorkerEntrypointConfigErrorMessage = {
  InvalidIterationDelayMs: "worker entrypoint iterationDelayMs must be a positive safe integer",
} as const;

export type WorkerEntrypointSignalListener = (signal: WorkerEntrypointSignalName) => void;

export type WorkerEntrypointSignalSubscription = {
  dispose: () => void;
};

export type WorkerEntrypointSignalSource = {
  subscribe: (
    signal: WorkerEntrypointSignalName,
    listener: WorkerEntrypointSignalListener,
  ) => WorkerEntrypointSignalSubscription;
};

export type WorkerEntrypointSleepInput = {
  durationMs: number;
  stopSignal: WorkerProcessLoopStopSignal;
};

export type WorkerEntrypointSleeper = {
  sleep: (input: WorkerEntrypointSleepInput) => Promise<void>;
};

export type WorkerProcessEntrypoint = {
  run: () => Promise<WorkerProcessEntrypointResult>;
};

export type WorkerProcessEntrypointResult = {
  exitCode: WorkerEntrypointExitCode;
  loopResult: WorkerProcessLoopRunResult;
  receivedSignals: readonly WorkerEntrypointSignalName[];
};

export type CreateWorkerProcessEntrypointInput = {
  process: WorkerProcess;
  observer: WorkerProcessLoopObserver;
  signalSource: WorkerEntrypointSignalSource;
  sleeper: WorkerEntrypointSleeper;
  iterationDelayMs: number;
  maxCycles?: number | undefined;
  signals?: readonly WorkerEntrypointSignalName[] | undefined;
};

const defaultWorkerEntrypointSignals = [
  WorkerEntrypointSignalName.Sigint,
  WorkerEntrypointSignalName.Sigterm,
] as const;

export function createWorkerProcessEntrypoint(
  input: CreateWorkerProcessEntrypointInput,
): WorkerProcessEntrypoint {
  validateEntrypointInput(input);

  return {
    run: async () => await runWorkerProcessEntrypoint(input),
  };
}

function validateEntrypointInput(input: CreateWorkerProcessEntrypointInput): void {
  if (!Number.isSafeInteger(input.iterationDelayMs) || input.iterationDelayMs < 1) {
    throw new Error(WorkerEntrypointConfigErrorMessage.InvalidIterationDelayMs);
  }
}

async function runWorkerProcessEntrypoint(
  input: CreateWorkerProcessEntrypointInput,
): Promise<WorkerProcessEntrypointResult> {
  const signalRegistration = createEntrypointStopSignalRegistration({
    signalSource: input.signalSource,
    signals: input.signals ?? defaultWorkerEntrypointSignals,
  });

  try {
    const loopResult = await createWorkerProcessLoop({
      process: input.process,
      delay: createEntrypointLoopDelay({
        iterationDelayMs: input.iterationDelayMs,
        sleeper: input.sleeper,
        stopSignal: signalRegistration.stopSignal,
      }),
      observer: input.observer,
      stopSignal: signalRegistration.stopSignal,
      maxCycles: input.maxCycles,
    }).run();

    return {
      exitCode: resolveEntrypointExitCode(loopResult.status),
      loopResult,
      receivedSignals: signalRegistration.receivedSignals,
    };
  } finally {
    signalRegistration.dispose();
  }
}

type EntrypointStopSignalRegistration = {
  stopSignal: WorkerProcessLoopStopSignal;
  receivedSignals: readonly WorkerEntrypointSignalName[];
  dispose: () => void;
};

type CreateEntrypointStopSignalRegistrationInput = {
  signalSource: WorkerEntrypointSignalSource;
  signals: readonly WorkerEntrypointSignalName[];
};

function createEntrypointStopSignalRegistration(
  input: CreateEntrypointStopSignalRegistrationInput,
): EntrypointStopSignalRegistration {
  const receivedSignals: WorkerEntrypointSignalName[] = [];
  const subscriptions = input.signals.map((signal) =>
    input.signalSource.subscribe(signal, (receivedSignal) => {
      receivedSignals.push(receivedSignal);
    }),
  );

  return {
    stopSignal: {
      isStopRequested: () => receivedSignals.length > 0,
    },
    receivedSignals,
    dispose: () => {
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    },
  };
}

type CreateEntrypointLoopDelayInput = {
  iterationDelayMs: number;
  sleeper: WorkerEntrypointSleeper;
  stopSignal: WorkerProcessLoopStopSignal;
};

function createEntrypointLoopDelay(input: CreateEntrypointLoopDelayInput): WorkerProcessLoopDelay {
  return {
    waitAfterIteration: async () => {
      if (input.stopSignal.isStopRequested()) {
        return;
      }

      await input.sleeper.sleep({
        durationMs: input.iterationDelayMs,
        stopSignal: input.stopSignal,
      });
    },
  };
}

function resolveEntrypointExitCode(status: WorkerProcessLoopStatus): WorkerEntrypointExitCode {
  if (status === WorkerProcessLoopStatus.Degraded) {
    return WorkerEntrypointExitCode.Degraded;
  }

  return WorkerEntrypointExitCode.Success;
}
