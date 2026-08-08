import { relayBrowserServiceWorkerTabMessage } from "./browser-service-worker-channel";
import type { BrowserTabCoordinatorFeedback, BrowserTabOperationResult } from "./browser-tab-coordinator";

export const BROWSER_SERVICE_WORKER_RUNTIME_SCHEMA = "zeta.browser-service-worker-runtime.v1" as const;

export interface BrowserServiceWorkerRuntimeOptions {
  readonly maxClients: number;
  readonly maxFeedback: number;
}

export interface BrowserServiceWorkerRuntimeReadout {
  readonly schema: typeof BROWSER_SERVICE_WORKER_RUNTIME_SCHEMA;
  readonly admission: "open" | "backpressured";
  readonly stopped: boolean;
  readonly feedback: readonly BrowserTabCoordinatorFeedback[];
}

export interface BrowserServiceWorkerRuntime {
  read(): BrowserServiceWorkerRuntimeReadout;
  stop(): BrowserTabOperationResult<BrowserServiceWorkerRuntimeReadout>;
}

interface WorkerClientsLike {
  claim(): Promise<unknown> | unknown;
}

interface WorkerRootLike {
  readonly clients: WorkerClientsLike;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
  skipWaiting(): Promise<unknown> | unknown;
}

function succeeded<T>(value: T): BrowserTabOperationResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserTabCoordinatorFeedback["code"],
  detail: string,
  severity: BrowserTabCoordinatorFeedback["severity"] = "heat",
): BrowserTabOperationResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function workerRoot(value: unknown): BrowserTabOperationResult<WorkerRootLike> {
  if (!isRecord(value)) {
    return failed(
      "service-worker-unavailable",
      "This runtime does not expose a service-worker global.",
      "backpressure",
    );
  }
  try {
    const clients = Reflect.get(value, "clients");
    if (
      !isRecord(clients) ||
      typeof Reflect.get(clients, "claim") !== "function" ||
      typeof Reflect.get(value, "addEventListener") !== "function" ||
      typeof Reflect.get(value, "removeEventListener") !== "function" ||
      typeof Reflect.get(value, "skipWaiting") !== "function"
    ) {
      return failed("service-worker-invalid", "The service-worker global does not satisfy the relay runtime port.");
    }
    return succeeded(value as unknown as WorkerRootLike);
  } catch {
    return failed("service-worker-blocked", "The service-worker global blocked runtime inspection.");
  }
}

function waitUntil(event: unknown, promise: Promise<unknown>): BrowserTabOperationResult<null> {
  if (!isRecord(event)) {
    return failed("service-worker-invalid", "A service-worker lifecycle event does not expose waitUntil.");
  }
  try {
    const wait = Reflect.get(event, "waitUntil");
    if (typeof wait !== "function") {
      return failed("service-worker-invalid", "A service-worker lifecycle event does not expose waitUntil.");
    }
    Reflect.apply(wait as (...arguments_: unknown[]) => unknown, event, [promise]);
    return succeeded(null);
  } catch {
    return failed("service-worker-blocked", "The service worker rejected lifecycle extension with waitUntil.");
  }
}

/** Install the bounded relay into a service-worker global without throwing. */
export function installBrowserServiceWorkerRuntime(
  rootValue: unknown,
  options: BrowserServiceWorkerRuntimeOptions,
): BrowserTabOperationResult<BrowserServiceWorkerRuntime> {
  if (!Number.isSafeInteger(options.maxClients) || options.maxClients < 1) {
    return failed(
      "service-worker-relay-capacity-exhausted",
      "The service-worker runtime requires a positive safe client capacity.",
      "backpressure",
    );
  }
  if (!Number.isSafeInteger(options.maxFeedback) || options.maxFeedback < 2) {
    return failed(
      "service-worker-relay-capacity-exhausted",
      "The service-worker runtime requires feedback capacity for at least two entries.",
      "backpressure",
    );
  }
  const rootResult = workerRoot(rootValue);
  if (!rootResult.ok) return rootResult;
  const root = rootResult.value;

  let feedback: readonly BrowserTabCoordinatorFeedback[] = [];
  let admission: BrowserServiceWorkerRuntimeReadout["admission"] = "open";
  let stopped = false;

  const record = (entry: BrowserTabCoordinatorFeedback): void => {
    if (admission === "backpressured") return;
    if (feedback.length + 1 < options.maxFeedback) {
      feedback = [...feedback, entry];
      return;
    }
    feedback = [
      ...feedback,
      {
        severity: "backpressure",
        code: "service-worker-relay-capacity-exhausted",
        detail: `The worker retained ${String(feedback.length)} feedback entries and refused to erase one for new evidence.`,
      },
    ];
    admission = "backpressured";
  };

  const extend = (event: unknown, promise: Promise<unknown>): void => {
    const extended = waitUntil(event, promise);
    if (!extended.ok) record(extended.feedback);
  };
  const installed = (event: unknown): void => {
    extend(
      event,
      Promise.resolve().then(() => root.skipWaiting()),
    );
  };
  const activated = (event: unknown): void => {
    extend(
      event,
      Promise.resolve().then(() => root.clients.claim()),
    );
  };
  const messaged = (event: unknown): void => {
    const relayed = relayBrowserServiceWorkerTabMessage(rootValue, event, options.maxClients).then((result) => {
      if (!result.ok) record(result.feedback);
    });
    extend(event, relayed);
  };

  try {
    root.addEventListener("install", installed);
    root.addEventListener("activate", activated);
    root.addEventListener("message", messaged);
  } catch {
    try {
      root.removeEventListener("install", installed);
      root.removeEventListener("activate", activated);
      root.removeEventListener("message", messaged);
    } catch {
      // No listener was admitted as live, so cleanup cannot alter the returned refusal.
    }
    return failed("service-worker-blocked", "The service worker rejected relay listener installation.");
  }

  const read = (): BrowserServiceWorkerRuntimeReadout => ({
    schema: BROWSER_SERVICE_WORKER_RUNTIME_SCHEMA,
    admission,
    stopped,
    feedback,
  });
  return succeeded({
    read,
    stop: () => {
      if (stopped) return succeeded(read());
      try {
        root.removeEventListener("install", installed);
        root.removeEventListener("activate", activated);
        root.removeEventListener("message", messaged);
      } catch {
        return failed("service-worker-blocked", "The service worker rejected relay listener removal.");
      }
      stopped = true;
      return succeeded(read());
    },
  });
}
