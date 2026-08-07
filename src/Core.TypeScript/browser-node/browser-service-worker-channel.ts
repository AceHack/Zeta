import {
  decodeBrowserTabChannelMessage,
  type BrowserTabChannel,
  type BrowserTabCoordinatorFeedback,
  type BrowserTabOperationResult,
} from "./browser-tab-coordinator";

interface MessageEventLike {
  readonly data?: unknown;
  readonly source?: unknown;
}

interface ServiceWorkerControllerLike {
  postMessage(message: unknown): void;
}

interface ServiceWorkerContainerLike {
  readonly controller?: unknown;
  addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
}

interface ServiceWorkerClientLike {
  readonly id: string;
  postMessage(message: unknown): void;
}

interface ServiceWorkerClientsLike {
  matchAll(options: {
    readonly type: "window";
    readonly includeUncontrolled: true;
  }): Promise<readonly ServiceWorkerClientLike[]>;
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

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function serviceWorkerContainer(root: unknown): BrowserTabOperationResult<ServiceWorkerContainerLike> {
  if (!isRecord(root)) {
    return failed(
      "service-worker-unavailable",
      "This runtime does not expose a service-worker container.",
      "backpressure",
    );
  }

  let navigatorValue: unknown;
  let containerValue: unknown;
  try {
    navigatorValue = Reflect.get(root, "navigator");
    if (!isRecord(navigatorValue)) {
      return failed(
        "service-worker-unavailable",
        "This runtime does not expose a service-worker container.",
        "backpressure",
      );
    }
    containerValue = Reflect.get(navigatorValue, "serviceWorker");
  } catch {
    return failed("service-worker-blocked", "This runtime blocked access to the service-worker container.");
  }

  if (!isRecord(containerValue)) {
    return failed(
      "service-worker-unavailable",
      "This runtime does not expose a service-worker container.",
      "backpressure",
    );
  }
  try {
    if (
      typeof Reflect.get(containerValue, "addEventListener") !== "function" ||
      typeof Reflect.get(containerValue, "removeEventListener") !== "function"
    ) {
      return failed("service-worker-invalid", "The service-worker container does not satisfy the channel port.");
    }
  } catch {
    return failed("service-worker-blocked", "This runtime blocked inspection of the service-worker container.");
  }
  return succeeded(containerValue as unknown as ServiceWorkerContainerLike);
}

/** Use an already controlling service worker as a browser-tab message channel. */
export function createNativeServiceWorkerTabChannel(root: unknown): BrowserTabOperationResult<BrowserTabChannel> {
  const containerResult = serviceWorkerContainer(root);
  if (!containerResult.ok) return containerResult;
  const container = containerResult.value;

  let controllerValue: unknown;
  try {
    controllerValue = Reflect.get(container, "controller");
  } catch {
    return failed("service-worker-blocked", "This runtime blocked access to the controlling service worker.");
  }
  if (controllerValue === null || controllerValue === undefined) {
    return failed(
      "service-worker-controller-missing",
      "No active service worker controls this page; reload after registration or use another channel.",
      "backpressure",
    );
  }
  if (!isRecord(controllerValue)) {
    return failed("service-worker-invalid", "The controlling service worker does not satisfy the channel port.");
  }
  try {
    if (typeof Reflect.get(controllerValue, "postMessage") !== "function") {
      return failed("service-worker-invalid", "The controlling service worker does not satisfy the channel port.");
    }
  } catch {
    return failed("service-worker-blocked", "This runtime blocked inspection of the controlling service worker.");
  }
  const controller = controllerValue as unknown as ServiceWorkerControllerLike;

  let closed = false;
  const listeners = new Set<(event: MessageEventLike) => void>();
  return succeeded({
    publish: (message) => {
      if (closed) return failed("service-worker-channel-closed", "The service-worker channel is already closed.");
      try {
        controller.postMessage(message);
        return succeeded(null);
      } catch {
        return failed("service-worker-publish-failed", "The controlling service worker rejected a tab message.");
      }
    },
    subscribe: (listener) => {
      if (closed) return failed("service-worker-channel-closed", "The service-worker channel is already closed.");
      const nativeListener = (event: MessageEventLike): void => listener(event.data);
      try {
        container.addEventListener("message", nativeListener);
        listeners.add(nativeListener);
      } catch {
        return failed("service-worker-subscribe-failed", "The service-worker container rejected a message listener.");
      }
      let active = true;
      return succeeded({
        unsubscribe: () => {
          if (!active) return succeeded(null);
          try {
            container.removeEventListener("message", nativeListener);
            listeners.delete(nativeListener);
            active = false;
            return succeeded(null);
          } catch {
            return failed(
              "service-worker-unsubscribe-failed",
              "The service-worker container rejected listener removal.",
            );
          }
        },
      });
    },
    close: () => {
      if (closed) return succeeded(null);
      let removalFailed = false;
      for (const listener of listeners) {
        try {
          container.removeEventListener("message", listener);
        } catch {
          removalFailed = true;
        }
      }
      listeners.clear();
      closed = true;
      return removalFailed
        ? failed(
            "service-worker-unsubscribe-failed",
            "The service-worker channel failed to remove one or more listeners.",
          )
        : succeeded(null);
    },
  });
}

function sourceClientId(event: unknown): BrowserTabOperationResult<string> {
  if (!isRecord(event)) {
    return failed("service-worker-relay-source-missing", "A service-worker relay event has no source client.");
  }
  let source: unknown;
  try {
    source = Reflect.get(event, "source");
  } catch {
    return failed("service-worker-blocked", "The service worker blocked access to the message source.");
  }
  if (!isRecord(source)) {
    return failed("service-worker-relay-source-missing", "A service-worker relay event has no source client.");
  }
  let id: unknown;
  try {
    id = Reflect.get(source, "id");
  } catch {
    return failed("service-worker-blocked", "The service worker blocked access to the source client identity.");
  }
  return isIdentifier(id)
    ? succeeded(id)
    : failed("service-worker-relay-source-missing", "A service-worker relay event has no source client identity.");
}

function clientsPort(root: unknown): BrowserTabOperationResult<ServiceWorkerClientsLike> {
  if (!isRecord(root)) {
    return failed("service-worker-unavailable", "This worker runtime does not expose window clients.", "backpressure");
  }
  let clients: unknown;
  try {
    clients = Reflect.get(root, "clients");
  } catch {
    return failed("service-worker-blocked", "This worker runtime blocked access to window clients.");
  }
  if (!isRecord(clients)) {
    return failed("service-worker-unavailable", "This worker runtime does not expose window clients.", "backpressure");
  }
  try {
    if (typeof Reflect.get(clients, "matchAll") !== "function") {
      return failed("service-worker-invalid", "The worker client registry does not satisfy the relay port.");
    }
  } catch {
    return failed("service-worker-blocked", "This worker runtime blocked inspection of window clients.");
  }
  return succeeded(clients as unknown as ServiceWorkerClientsLike);
}

/**
 * Relay one validated tab message to every other window client.
 * The message remains evidence only; recipients reread their own storage port.
 */
export async function relayBrowserServiceWorkerTabMessage(
  root: unknown,
  event: unknown,
  maxClients: number,
): Promise<BrowserTabOperationResult<number>> {
  if (!Number.isSafeInteger(maxClients) || maxClients < 1) {
    return failed(
      "service-worker-relay-capacity-exhausted",
      "The service-worker relay requires a positive safe client capacity.",
      "backpressure",
    );
  }
  if (!isRecord(event)) {
    return failed("tab-message-invalid", "A service-worker relay event did not carry a tab message.");
  }
  let data: unknown;
  try {
    data = Reflect.get(event, "data");
  } catch {
    return failed("service-worker-blocked", "The service worker blocked access to the message payload.");
  }
  const decoded = decodeBrowserTabChannelMessage(data);
  if (!decoded.ok) return decoded;
  const sourceId = sourceClientId(event);
  if (!sourceId.ok) return sourceId;
  const clientsResult = clientsPort(root);
  if (!clientsResult.ok) return clientsResult;

  let clientValues: unknown;
  try {
    clientValues = await clientsResult.value.matchAll({ type: "window", includeUncontrolled: true });
  } catch {
    return failed("service-worker-relay-clients-failed", "The service worker failed to enumerate window clients.");
  }
  if (!Array.isArray(clientValues)) {
    return failed("service-worker-invalid", "The worker client registry returned an invalid client collection.");
  }
  if (clientValues.length > maxClients) {
    return failed(
      "service-worker-relay-capacity-exhausted",
      `The service worker observed ${String(clientValues.length)} clients, above its ${String(maxClients)}-client capacity.`,
      "backpressure",
    );
  }

  const clients: ServiceWorkerClientLike[] = [];
  for (const clientValue of clientValues) {
    if (!isRecord(clientValue)) {
      return failed("service-worker-invalid", "The worker client registry returned an invalid window client.");
    }
    let id: unknown;
    let postMessage: unknown;
    try {
      id = Reflect.get(clientValue, "id");
      postMessage = Reflect.get(clientValue, "postMessage");
    } catch {
      return failed("service-worker-blocked", "The service worker blocked inspection of a window client.");
    }
    if (!isIdentifier(id) || typeof postMessage !== "function") {
      return failed("service-worker-invalid", "The worker client registry returned an invalid window client.");
    }
    clients.push({
      id,
      postMessage: (message) =>
        Reflect.apply(postMessage as (...arguments_: unknown[]) => unknown, clientValue, [message]),
    });
  }

  const recipients = clients.filter((client) => client.id !== sourceId.value);
  let delivered = 0;
  for (const client of recipients) {
    try {
      client.postMessage(decoded.value);
      delivered += 1;
    } catch {
      return failed(
        "service-worker-relay-client-post-failed",
        `The service worker delivered to ${String(delivered)} clients before a window rejected the message.`,
      );
    }
  }
  return succeeded(delivered);
}
