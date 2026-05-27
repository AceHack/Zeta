export const WorkerDependencyName = {
  Cockroach: "cockroach",
  Nats: "nats",
  Telemetry: "telemetry",
} as const;

export type WorkerDependencyName = (typeof WorkerDependencyName)[keyof typeof WorkerDependencyName];

export const WorkerDependencyReadinessStatus = {
  NotReady: "not_ready",
  Ready: "ready",
} as const;

export type WorkerDependencyReadinessStatus =
  (typeof WorkerDependencyReadinessStatus)[keyof typeof WorkerDependencyReadinessStatus];

export const WorkerReadinessStatus = {
  Degraded: "degraded",
  Ready: "ready",
} as const;

export type WorkerReadinessStatus = (typeof WorkerReadinessStatus)[keyof typeof WorkerReadinessStatus];

export type WorkerDependencyReadinessCheck = {
  message?: string;
  name: WorkerDependencyName;
  status: WorkerDependencyReadinessStatus;
};

export type WorkerDependencyReadinessProbe = {
  name: WorkerDependencyName;
  check: () => Promise<WorkerDependencyReadinessCheck>;
};

export type WorkerProcessReadiness = {
  checks: readonly WorkerDependencyReadinessCheck[];
  status: WorkerReadinessStatus;
};

export type CheckWorkerProcessReadinessInput = {
  probes: readonly WorkerDependencyReadinessProbe[];
};

export async function checkWorkerProcessReadiness(
  input: CheckWorkerProcessReadinessInput,
): Promise<WorkerProcessReadiness> {
  const checks = await Promise.all(input.probes.map((probe) => checkDependencyReadiness(probe)));

  return {
    checks,
    status: checks.every((check) => check.status === WorkerDependencyReadinessStatus.Ready)
      ? WorkerReadinessStatus.Ready
      : WorkerReadinessStatus.Degraded,
  };
}

async function checkDependencyReadiness(probe: WorkerDependencyReadinessProbe): Promise<WorkerDependencyReadinessCheck> {
  try {
    return await probe.check();
  } catch (error) {
    return {
      name: probe.name,
      status: WorkerDependencyReadinessStatus.NotReady,
      message: extractReadinessErrorMessage(error),
    };
  }
}

function extractReadinessErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
