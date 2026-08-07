import { relayBrowserServiceWorkerTabMessage } from "./browser-service-worker-channel";

interface WorkerEventLike {
  readonly data?: unknown;
  readonly source?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rootMethod(name: string): ((...arguments_: unknown[]) => unknown) | null {
  try {
    const method = Reflect.get(globalThis, name);
    return typeof method === "function" ? (method as (...arguments_: unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

function clientMethod(
  name: string,
): { readonly owner: object; readonly method: (...arguments_: unknown[]) => unknown } | null {
  try {
    const clients = Reflect.get(globalThis, "clients");
    if (!isRecord(clients)) return null;
    const method = Reflect.get(clients, name);
    return typeof method === "function"
      ? { owner: clients, method: method as (...arguments_: unknown[]) => unknown }
      : null;
  } catch {
    return null;
  }
}

function extendLifetime(event: unknown, promise: Promise<unknown>): void {
  if (!isRecord(event)) return;
  try {
    const waitUntil = Reflect.get(event, "waitUntil");
    if (typeof waitUntil === "function") Reflect.apply(waitUntil, event, [promise]);
  } catch {
    // The real-browser smoke will fail to converge if lifetime extension is unavailable.
  }
}

const addEventListener = rootMethod("addEventListener");
if (addEventListener !== null) {
  Reflect.apply(addEventListener, globalThis, [
    "install",
    (event: unknown) => {
      const skipWaiting = rootMethod("skipWaiting");
      const pending =
        skipWaiting === null
          ? Promise.reject(new Error("service-worker skipWaiting is unavailable"))
          : Promise.resolve(Reflect.apply(skipWaiting, globalThis, []));
      extendLifetime(event, pending);
    },
  ]);

  Reflect.apply(addEventListener, globalThis, [
    "activate",
    (event: unknown) => {
      const claim = clientMethod("claim");
      const pending =
        claim === null
          ? Promise.reject(new Error("service-worker clients.claim is unavailable"))
          : Promise.resolve(Reflect.apply(claim.method, claim.owner, []));
      extendLifetime(event, pending);
    },
  ]);

  Reflect.apply(addEventListener, globalThis, [
    "message",
    (event: WorkerEventLike) => {
      const pending = relayBrowserServiceWorkerTabMessage(globalThis, event, 16).then((result) => {
        if (!result.ok) throw new Error(`${result.feedback.code}: ${result.feedback.detail}`);
      });
      extendLifetime(event, pending);
    },
  ]);
}
