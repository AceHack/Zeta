import type { ZetaDbResult, ZetaDbTickReadout, ZetaDbTickRequest } from "../zetadb/zeta-db-node";

export const BROWSER_ZETA_DB_WAKE_SCHEMA = "zeta.browser-db-wake.v1" as const;
export const BROWSER_ZETA_DB_WAKE_RESPONSE_SCHEMA = "zeta.browser-db-wake-response.v1" as const;

export interface BrowserZetaDbWakeMessage {
  readonly schema: typeof BROWSER_ZETA_DB_WAKE_SCHEMA;
  readonly request: ZetaDbTickRequest;
}

export interface BrowserZetaDbWakeResponse {
  readonly schema: typeof BROWSER_ZETA_DB_WAKE_RESPONSE_SCHEMA;
  readonly result: ZetaDbResult<ZetaDbTickReadout>;
}

export interface BrowserZetaDbWakeFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code: "database-wake-endpoint-invalid" | "database-wake-listener-failed";
  readonly detail: string;
}

export type BrowserZetaDbWakeRuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserZetaDbWakeFeedback };

export interface BrowserZetaDbWakeRuntime {
  stop(): BrowserZetaDbWakeRuntimeResult<null>;
}

export type BrowserZetaDbWakeExecutor = (request: ZetaDbTickRequest) => Promise<ZetaDbResult<ZetaDbTickReadout>>;

interface MessageEndpointLike {
  addEventListener(type: "message", listener: (event: unknown) => void): void;
  removeEventListener(type: "message", listener: (event: unknown) => void): void;
  postMessage?(message: BrowserZetaDbWakeResponse): void;
}

function succeeded<T>(value: T): BrowserZetaDbWakeRuntimeResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserZetaDbWakeFeedback["code"],
  detail: string,
): { readonly ok: false; readonly feedback: BrowserZetaDbWakeFeedback } {
  return { ok: false, feedback: { severity: "heat", code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function method(value: unknown, name: string): ((...args: readonly unknown[]) => unknown) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...args: readonly unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

function decodeMessage(value: unknown): ZetaDbResult<ZetaDbTickRequest> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_ZETA_DB_WAKE_SCHEMA ||
    !isRecord(value.request) ||
    !Array.isArray(value.request.deltas) ||
    !isRecord(value.request.limits)
  ) {
    return {
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-request-invalid",
        detail: "A browser database wake message must carry the current schema and one bounded tick request.",
      },
    };
  }
  return { ok: true, value: value.request as unknown as ZetaDbTickRequest };
}

/** Decode and execute one message without retaining state between calls. */
export async function handleBrowserZetaDbWakeMessage(
  value: unknown,
  execute: BrowserZetaDbWakeExecutor,
): Promise<BrowserZetaDbWakeResponse> {
  const decoded = decodeMessage(value);
  return {
    schema: BROWSER_ZETA_DB_WAKE_RESPONSE_SCHEMA,
    result: decoded.ok ? await execute(decoded.value) : decoded,
  };
}

function postResponse(root: MessageEndpointLike, event: unknown, response: BrowserZetaDbWakeResponse): void {
  if (isRecord(event)) {
    const source = event.source;
    const sourcePost = method(source, "postMessage");
    if (sourcePost !== null) {
      Reflect.apply(sourcePost, source, [response]);
      return;
    }
  }
  if (root.postMessage !== undefined) root.postMessage(response);
}

/**
 * Install the same finite wake protocol on a dedicated worker, MessagePort, or service worker.
 * waitUntil is used when present, but correctness depends only on the persisted tick result.
 */
export function installBrowserZetaDbWakeRuntime(
  endpointValue: unknown,
  execute: BrowserZetaDbWakeExecutor,
): BrowserZetaDbWakeRuntimeResult<BrowserZetaDbWakeRuntime> {
  const add = method(endpointValue, "addEventListener");
  const remove = method(endpointValue, "removeEventListener");
  if (!isRecord(endpointValue) || add === null || remove === null) {
    return failed("database-wake-endpoint-invalid", "The database wake endpoint does not expose message listeners.");
  }
  const endpoint = endpointValue as unknown as MessageEndpointLike;
  let stopped = false;
  const listener = (event: unknown): void => {
    let data: unknown = null;
    if (isRecord(event)) {
      try {
        data = Reflect.get(event, "data");
      } catch {
        data = null;
      }
    }
    if (!isRecord(data) || data.schema !== BROWSER_ZETA_DB_WAKE_SCHEMA) return;
    const handled = handleBrowserZetaDbWakeMessage(data, execute).then((response) => {
      postResponse(endpoint, event, response);
    });
    const waitUntil = method(event, "waitUntil");
    if (waitUntil !== null) Reflect.apply(waitUntil, event, [handled]);
  };

  try {
    Reflect.apply(add, endpointValue, ["message", listener]);
  } catch {
    return failed("database-wake-listener-failed", "The database wake endpoint rejected listener installation.");
  }
  return succeeded({
    stop: () => {
      if (stopped) return succeeded(null);
      try {
        Reflect.apply(remove, endpointValue, ["message", listener]);
      } catch {
        return failed("database-wake-listener-failed", "The database wake endpoint rejected listener removal.");
      }
      stopped = true;
      return succeeded(null);
    },
  });
}
