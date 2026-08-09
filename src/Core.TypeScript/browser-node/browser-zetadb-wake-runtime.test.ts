import { describe, expect, test } from "bun:test";
import { BROWSER_TAB_COORDINATOR_SCHEMA } from "./browser-tab-coordinator";
import { createInMemoryZetaDbImagePort, runZetaDbNodeTick } from "../zetadb/zeta-db-node";
import {
  handleBrowserZetaDbWakeMessage,
  installBrowserZetaDbWakeRuntime,
  type BrowserZetaDbWakeResponse,
} from "./browser-zetadb-wake-runtime";

const request = {
  nodeId: "browser/global",
  executorId: "tab/1",
  executorKind: "browser-tab" as const,
  deltas: [{ eventId: "event/1", rowKey: "row/1", payload: "one", weight: 1 }],
  limits: { maxDeltas: 8, maxEntries: 16, maxCheckpointBytes: 16 * 1024 },
};

describe("browser ZetaDB wake runtime", () => {
  test("executes one serializable database wake", async () => {
    const port = createInMemoryZetaDbImagePort();
    const response = await handleBrowserZetaDbWakeMessage({ schema: "zeta.browser-db-wake.v1", request }, (tick) =>
      runZetaDbNodeTick(port, tick),
    );

    expect(response).toMatchObject({
      schema: "zeta.browser-db-wake-response.v1",
      result: { ok: true, value: { revision: 1, accepted: 1 } },
    });
  });

  test("rejects malformed messages before invoking the database", async () => {
    let called = false;
    const response = await handleBrowserZetaDbWakeMessage({}, () => {
      called = true;
      return Promise.resolve({ ok: true, value: {} as never });
    });

    expect(called).toBe(false);
    expect(response.result).toMatchObject({
      ok: false,
      feedback: { code: "database-request-invalid" },
    });
  });

  test("uses service-worker event lifetime only for the current tick", async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const responses: BrowserZetaDbWakeResponse[] = [];
    const waits: Promise<unknown>[] = [];
    const endpoint = {
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    const runtime = installBrowserZetaDbWakeRuntime(endpoint, (tick) =>
      runZetaDbNodeTick(createInMemoryZetaDbImagePort(), tick),
    );
    expect(runtime.ok).toBe(true);

    listeners.get("message")?.({
      data: { schema: "zeta.browser-db-wake.v1", request: { ...request, executorKind: "service-worker-event" } },
      source: { postMessage: (response: BrowserZetaDbWakeResponse) => responses.push(response) },
      waitUntil: (promise: Promise<unknown>) => {
        waits.push(promise);
      },
    });
    await Promise.all(waits);

    expect(responses).toHaveLength(1);
    expect(responses[0]?.result).toMatchObject({ ok: true, value: { executorKind: "service-worker-event" } });
    expect(runtime.ok && runtime.value.stop()).toEqual({ ok: true, value: null });
    expect(listeners.has("message")).toBe(false);
  });

  test("ignores messages owned by another service-worker protocol", () => {
    const listeners = new Map<string, (event: unknown) => void>();
    let called = false;
    const installed = installBrowserZetaDbWakeRuntime(
      {
        addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
        removeEventListener: (type: string) => listeners.delete(type),
      },
      () => {
        called = true;
        return Promise.resolve({ ok: true, value: {} as never });
      },
    );

    listeners.get("message")?.({ data: { schema: BROWSER_TAB_COORDINATOR_SCHEMA } });
    expect(installed.ok).toBe(true);
    expect(called).toBe(false);
  });
});
