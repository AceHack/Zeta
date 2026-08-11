export const BROWSER_EXECUTION_ADMISSION_SCHEMA = "zeta.browser-execution-admission.v1" as const;

export interface BrowserExecutionAdmissionFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "execution-admission-configuration-invalid"
    | "execution-admission-unavailable"
    | "execution-admission-blocked"
    | "execution-admission-invalid"
    | "execution-admission-request-failed";
  readonly detail: string;
}

export type BrowserExecutionAdmissionReadout<T> =
  | {
      readonly schema: typeof BROWSER_EXECUTION_ADMISSION_SCHEMA;
      readonly resourceId: string;
      readonly status: "admitted";
      readonly value: T;
    }
  | {
      readonly schema: typeof BROWSER_EXECUTION_ADMISSION_SCHEMA;
      readonly resourceId: string;
      readonly status: "busy";
    };

export type BrowserExecutionAdmissionResult<T> =
  | { readonly ok: true; readonly value: BrowserExecutionAdmissionReadout<T> }
  | { readonly ok: false; readonly feedback: BrowserExecutionAdmissionFeedback };

/** Admit at most one finite operation for a resource without waiting for another owner. */
export interface BrowserExecutionAdmissionPort {
  tryRun<T>(resourceId: string, operation: () => Promise<T>): Promise<BrowserExecutionAdmissionResult<T>>;
  /** Queue recovery work until the current finite owner releases; no clock or timeout is introduced. */
  runWhenAvailable?<T>(resourceId: string, operation: () => Promise<T>): Promise<BrowserExecutionAdmissionResult<T>>;
}

export type BrowserExecutionAdmissionPortResult =
  | { readonly ok: true; readonly value: BrowserExecutionAdmissionPort }
  | { readonly ok: false; readonly feedback: BrowserExecutionAdmissionFeedback };

export function browserExecutionAdmitted<T>(resourceId: string, value: T): BrowserExecutionAdmissionResult<T> {
  return {
    ok: true,
    value: { schema: BROWSER_EXECUTION_ADMISSION_SCHEMA, resourceId, status: "admitted", value },
  };
}

export function browserExecutionBusy(resourceId: string): BrowserExecutionAdmissionResult<never> {
  return {
    ok: true,
    value: { schema: BROWSER_EXECUTION_ADMISSION_SCHEMA, resourceId, status: "busy" },
  };
}

export function browserExecutionAdmissionFailed(
  code: BrowserExecutionAdmissionFeedback["code"],
  detail: string,
  severity: BrowserExecutionAdmissionFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserExecutionAdmissionFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

export function isBrowserExecutionResourceId(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) return false;
  }
  return true;
}

/** Deterministic single-realm adapter used by tests and hosts without cross-context locking. */
export function createInMemoryBrowserExecutionAdmission(): BrowserExecutionAdmissionPort {
  const active = new Set<string>();
  const waiters = new Map<string, (() => void)[]>();

  const release = (resourceId: string): void => {
    const queued = waiters.get(resourceId);
    const next = queued?.shift();
    if (next !== undefined) {
      next();
      if (queued?.length === 0) waiters.delete(resourceId);
      return;
    }
    active.delete(resourceId);
  };
  const acquire = (resourceId: string): Promise<void> => {
    if (!active.has(resourceId)) {
      active.add(resourceId);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const queued = waiters.get(resourceId) ?? [];
      queued.push(resolve);
      waiters.set(resourceId, queued);
    });
  };
  const invalidResource = <T>(resourceId: string): BrowserExecutionAdmissionResult<T> | null =>
    isBrowserExecutionResourceId(resourceId)
      ? null
      : browserExecutionAdmissionFailed(
          "execution-admission-configuration-invalid",
          "Execution admission resource identifiers must contain 1 to 1024 printable characters.",
        );

  return {
    tryRun: async <T>(resourceId: string, operation: () => Promise<T>): Promise<BrowserExecutionAdmissionResult<T>> => {
      const invalid = invalidResource<T>(resourceId);
      if (invalid !== null) return invalid;
      if (active.has(resourceId)) return browserExecutionBusy(resourceId);

      active.add(resourceId);
      try {
        return browserExecutionAdmitted(resourceId, await operation());
      } catch {
        return browserExecutionAdmissionFailed(
          "execution-admission-request-failed",
          `The admitted operation for ${resourceId} rejected.`,
        );
      } finally {
        release(resourceId);
      }
    },
    runWhenAvailable: async <T>(
      resourceId: string,
      operation: () => Promise<T>,
    ): Promise<BrowserExecutionAdmissionResult<T>> => {
      const invalid = invalidResource<T>(resourceId);
      if (invalid !== null) return invalid;
      await acquire(resourceId);
      try {
        return browserExecutionAdmitted(resourceId, await operation());
      } catch {
        return browserExecutionAdmissionFailed(
          "execution-admission-request-failed",
          `The admitted operation for ${resourceId} rejected.`,
        );
      } finally {
        release(resourceId);
      }
    },
  };
}
