import {
  WorkerDependencyReadinessStatus,
  WorkerReadinessStatus,
  checkWorkerProcessReadiness,
  type WorkerDependencyReadinessProbe,
  type WorkerProcessReadiness,
} from "./worker-readiness.ts";
import { WorkerRuntimeStatus, type WorkerRuntime, type WorkerRuntimeRunResult } from "./worker-runtime.ts";

export const WorkerProcessLifecycleStage = {
  Bootstrap: "bootstrap",
  Readiness: "readiness",
  Runtime: "runtime",
  Shutdown: "shutdown",
} as const;

export type WorkerProcessLifecycleStage =
  (typeof WorkerProcessLifecycleStage)[keyof typeof WorkerProcessLifecycleStage];

export const WorkerProcessShutdownStatus = {
  Completed: "completed",
  Degraded: "degraded",
} as const;

export type WorkerProcessShutdownStatus =
  (typeof WorkerProcessShutdownStatus)[keyof typeof WorkerProcessShutdownStatus];

const WorkerProcessFailureMessage = {
  DependencyNotReady: "dependency not ready",
} as const;

export type WorkerProcessBootstrapper = {
  name: string;
  bootstrap: () => Promise<void>;
};

export type WorkerProcessShutdownPort = {
  name: string;
  shutdown: () => Promise<void>;
};

export type WorkerProcessFailure = {
  stage: WorkerProcessLifecycleStage;
  name: string;
  message: string;
};

export type WorkerProcessRunResult = {
  status: WorkerRuntimeStatus;
  readiness: WorkerProcessReadiness | undefined;
  runtimeResult: WorkerRuntimeRunResult | undefined;
  failures: readonly WorkerProcessFailure[];
};

export type WorkerProcessShutdownResult = {
  status: WorkerProcessShutdownStatus;
  closedPortNames: readonly string[];
  failures: readonly WorkerProcessFailure[];
};

export type WorkerProcess = {
  runOnce: () => Promise<WorkerProcessRunResult>;
  shutdown: () => Promise<WorkerProcessShutdownResult>;
};

export type CreateWorkerProcessInput = {
  bootstrappers: readonly WorkerProcessBootstrapper[];
  readinessProbes: readonly WorkerDependencyReadinessProbe[];
  runtime: WorkerRuntime;
  shutdownPorts: readonly WorkerProcessShutdownPort[];
};

export function createWorkerProcess(input: CreateWorkerProcessInput): WorkerProcess {
  const bootstrapState: WorkerProcessBootstrapState = {
    failures: [],
    status: WorkerProcessBootstrapStatus.NotStarted,
  };

  return {
    runOnce: async () =>
      await runWorkerProcessOnce({
        ...input,
        bootstrapState,
      }),
    shutdown: async () => await shutdownWorkerProcess(input.shutdownPorts),
  };
}

type RunWorkerProcessOnceInput = CreateWorkerProcessInput & {
  bootstrapState: WorkerProcessBootstrapState;
};

const WorkerProcessBootstrapStatus = {
  Failed: "failed",
  NotStarted: "not_started",
  Succeeded: "succeeded",
} as const;

type WorkerProcessBootstrapStatus =
  (typeof WorkerProcessBootstrapStatus)[keyof typeof WorkerProcessBootstrapStatus];

type WorkerProcessBootstrapState = {
  failures: readonly WorkerProcessFailure[];
  status: WorkerProcessBootstrapStatus;
};

async function runWorkerProcessOnce(input: RunWorkerProcessOnceInput): Promise<WorkerProcessRunResult> {
  const bootstrapFailures = await ensureProcessBootstrapped(input);

  if (bootstrapFailures.length > 0) {
    return createSkippedWorkerProcessResult(bootstrapFailures);
  }

  const readiness = await checkWorkerProcessReadiness({
    probes: input.readinessProbes,
  });
  const readinessFailures = collectReadinessFailures(readiness);

  if (readinessFailures.length > 0) {
    return {
      status: WorkerRuntimeStatus.Degraded,
      readiness,
      runtimeResult: undefined,
      failures: readinessFailures,
    };
  }

  try {
    const runtimeResult = await input.runtime.runOnce();

    return {
      status: runtimeResult.status,
      readiness,
      runtimeResult,
      failures: [],
    };
  } catch (error) {
    return {
      status: WorkerRuntimeStatus.Degraded,
      readiness,
      runtimeResult: undefined,
      failures: [
        {
          stage: WorkerProcessLifecycleStage.Runtime,
          name: WorkerProcessLifecycleStage.Runtime,
          message: extractProcessErrorMessage(error),
        },
      ],
    };
  }
}

async function ensureProcessBootstrapped(input: RunWorkerProcessOnceInput): Promise<readonly WorkerProcessFailure[]> {
  if (input.bootstrapState.status !== WorkerProcessBootstrapStatus.NotStarted) {
    return input.bootstrapState.failures;
  }

  const failures = await applyBootstrappers(input.bootstrappers);

  input.bootstrapState.failures = failures;
  input.bootstrapState.status =
    failures.length === 0 ? WorkerProcessBootstrapStatus.Succeeded : WorkerProcessBootstrapStatus.Failed;

  return failures;
}

async function applyBootstrappers(
  bootstrappers: readonly WorkerProcessBootstrapper[],
): Promise<readonly WorkerProcessFailure[]> {
  const failures: WorkerProcessFailure[] = [];

  for (const bootstrapper of bootstrappers) {
    try {
      await bootstrapper.bootstrap();
    } catch (error) {
      failures.push({
        stage: WorkerProcessLifecycleStage.Bootstrap,
        name: bootstrapper.name,
        message: extractProcessErrorMessage(error),
      });
      break;
    }
  }

  return failures;
}

function createSkippedWorkerProcessResult(failures: readonly WorkerProcessFailure[]): WorkerProcessRunResult {
  return {
    status: WorkerRuntimeStatus.Degraded,
    readiness: undefined,
    runtimeResult: undefined,
    failures,
  };
}

function collectReadinessFailures(readiness: WorkerProcessReadiness): readonly WorkerProcessFailure[] {
  if (readiness.status === WorkerReadinessStatus.Ready) {
    return [];
  }

  return readiness.checks
    .filter((check) => check.status !== WorkerDependencyReadinessStatus.Ready)
    .map((check) => ({
      stage: WorkerProcessLifecycleStage.Readiness,
      name: check.name,
      message: check.message ?? WorkerProcessFailureMessage.DependencyNotReady,
    }));
}

async function shutdownWorkerProcess(
  shutdownPorts: readonly WorkerProcessShutdownPort[],
): Promise<WorkerProcessShutdownResult> {
  const closedPortNames: string[] = [];
  const failures: WorkerProcessFailure[] = [];

  for (const port of shutdownPorts) {
    try {
      await port.shutdown();
      closedPortNames.push(port.name);
    } catch (error) {
      failures.push({
        stage: WorkerProcessLifecycleStage.Shutdown,
        name: port.name,
        message: extractProcessErrorMessage(error),
      });
    }
  }

  return {
    status: failures.length === 0 ? WorkerProcessShutdownStatus.Completed : WorkerProcessShutdownStatus.Degraded,
    closedPortNames,
    failures,
  };
}

function extractProcessErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
