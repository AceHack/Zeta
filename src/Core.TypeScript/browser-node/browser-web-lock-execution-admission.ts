import {
  browserExecutionAdmissionFailed,
  browserExecutionAdmitted,
  browserExecutionBusy,
  isBrowserExecutionResourceId,
  type BrowserExecutionAdmissionPortResult,
  type BrowserExecutionAdmissionResult,
} from "./browser-execution-admission";

type UnknownMethod = (...arguments_: readonly unknown[]) => unknown;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function method(value: unknown, name: string): UnknownMethod | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as UnknownMethod) : null;
  } catch {
    return null;
  }
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function lockMatches(value: unknown, expectedName: string): boolean {
  if (!isRecord(value)) return false;
  try {
    return Reflect.get(value, "name") === expectedName && Reflect.get(value, "mode") === "exclusive";
  } catch {
    return false;
  }
}

function admissionMatches<T>(value: unknown, resourceId: string): value is BrowserExecutionAdmissionResult<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (!value.ok) return isRecord(value.feedback);
  if (!isRecord(value.value)) return false;
  return (
    value.value.schema === "zeta.browser-execution-admission.v1" &&
    value.value.resourceId === resourceId &&
    (value.value.status === "admitted" || value.value.status === "busy")
  );
}

/** Build the native cross-tab adapter without exposing Web Locks to the database core. */
export function createNativeBrowserExecutionAdmission(root: unknown): BrowserExecutionAdmissionPortResult {
  if (!isRecord(root)) {
    return browserExecutionAdmissionFailed(
      "execution-admission-invalid",
      "The browser execution admission host must be object-like.",
    );
  }

  let navigatorValue: unknown;
  let lockManager: unknown;
  try {
    navigatorValue = Reflect.get(root, "navigator");
    lockManager = isRecord(navigatorValue) ? Reflect.get(navigatorValue, "locks") : undefined;
  } catch {
    return browserExecutionAdmissionFailed(
      "execution-admission-blocked",
      "The browser blocked inspection of navigator.locks.",
    );
  }
  if (lockManager === undefined || lockManager === null) {
    return browserExecutionAdmissionFailed(
      "execution-admission-unavailable",
      "This runtime does not expose navigator.locks.",
      "backpressure",
    );
  }

  const request = method(lockManager, "request");
  if (request === null) {
    return browserExecutionAdmissionFailed(
      "execution-admission-invalid",
      "The browser lock manager does not satisfy the execution admission port.",
    );
  }

  return {
    ok: true,
    value: {
      tryRun: async <T>(
        resourceId: string,
        operation: () => Promise<T>,
      ): Promise<BrowserExecutionAdmissionResult<T>> => {
        if (!isBrowserExecutionResourceId(resourceId)) {
          return browserExecutionAdmissionFailed(
            "execution-admission-configuration-invalid",
            "Execution admission resource identifiers must contain 1 to 1024 printable characters.",
          );
        }

        const lockName = `zeta:${resourceId}`;
        try {
          const requested = Reflect.apply(request, lockManager, [
            lockName,
            { ifAvailable: true, mode: "exclusive" },
            async (lock: unknown): Promise<BrowserExecutionAdmissionResult<T>> => {
              if (lock === null) return browserExecutionBusy(resourceId);
              if (!lockMatches(lock, lockName)) {
                return browserExecutionAdmissionFailed(
                  "execution-admission-invalid",
                  `The browser returned invalid lock evidence for ${resourceId}.`,
                );
              }
              return browserExecutionAdmitted(resourceId, await operation());
            },
          ]);
          const result = await Promise.resolve(requested);
          return admissionMatches<T>(result, resourceId)
            ? result
            : browserExecutionAdmissionFailed(
                "execution-admission-invalid",
                `The browser returned an invalid admission result for ${resourceId}.`,
              );
        } catch (error) {
          return browserExecutionAdmissionFailed(
            "execution-admission-request-failed",
            `The browser lock request for ${resourceId} failed: ${errorDetail(error)}`,
          );
        }
      },
    },
  };
}
