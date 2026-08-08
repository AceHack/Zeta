import { describe, expect, test } from "bun:test";
import { installBrowserServiceWorkerRuntime } from "./browser-service-worker-runtime";
import type { BrowserTabChannelMessage } from "./browser-tab-coordinator";

type NativeListener = (event: unknown) => void;

class ExtendableEvent {
  readonly promises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.promises.push(promise);
  }

  async drain(): Promise<void> {
    await Promise.all(this.promises);
  }
}

class WorkerRoot {
  readonly listeners = new Map<string, Set<NativeListener>>();
  readonly deliveries: unknown[] = [];
  skipWaitingCount = 0;
  claimCount = 0;
  readonly clients = {
    claim: (): void => {
      this.claimCount += 1;
    },
    matchAll: async (): Promise<readonly { readonly id: string; postMessage(message: unknown): void }[]> => [
      { id: "client-a", postMessage: (): void => undefined },
      {
        id: "client-b",
        postMessage: (message: unknown): void => {
          this.deliveries.push(message);
        },
      },
    ],
  };

  skipWaiting(): void {
    this.skipWaitingCount += 1;
  }

  addEventListener(type: string, listener: NativeListener): void {
    const entries = this.listeners.get(type) ?? new Set();
    entries.add(listener);
    this.listeners.set(type, entries);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

function invalidation(): BrowserTabChannelMessage {
  return {
    schema: "zeta.browser-tab-coordinator.v2",
    nodeId: "darkhall",
    kind: "checkpoint-invalidated",
    invalidation: { sourceTabId: "tab-a", operation: "saved", revision: 4 },
  };
}

function messageEvent(data: unknown, sourceId = "client-a"): ExtendableEvent & { data: unknown; source: unknown } {
  return Object.assign(new ExtendableEvent(), { data, source: { id: sourceId } });
}

describe("browser service-worker runtime", () => {
  test("claims clients and relays validated evidence to peers", async () => {
    const root = new WorkerRoot();
    const installed = installBrowserServiceWorkerRuntime(root, { maxClients: 4, maxFeedback: 4 });
    expect(installed.ok).toBe(true);
    if (!installed.ok) return;

    const install = new ExtendableEvent();
    root.emit("install", install);
    await install.drain();
    const activate = new ExtendableEvent();
    root.emit("activate", activate);
    await activate.drain();
    const message = messageEvent(invalidation());
    root.emit("message", message);
    await message.drain();

    expect(root.skipWaitingCount).toBe(1);
    expect(root.claimCount).toBe(1);
    expect(root.deliveries).toEqual([invalidation()]);
    expect(installed.value.read()).toMatchObject({ admission: "open", stopped: false, feedback: [] });
    expect(installed.value.stop()).toMatchObject({ ok: true, value: { stopped: true } });
    expect([...root.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });

  test("retains relay failures and backpressures instead of erasing old evidence", async () => {
    const root = new WorkerRoot();
    const installed = installBrowserServiceWorkerRuntime(root, { maxClients: 4, maxFeedback: 2 });
    expect(installed.ok).toBe(true);
    if (!installed.ok) return;

    const first = messageEvent({ kind: "invalid" });
    root.emit("message", first);
    await first.drain();
    const second = messageEvent({ kind: "still-invalid" });
    root.emit("message", second);
    await second.drain();

    expect(installed.value.read()).toMatchObject({
      admission: "backpressured",
      feedback: [
        { code: "tab-message-invalid" },
        {
          code: "service-worker-relay-capacity-exhausted",
          detail: expect.stringContaining("refused to erase") as unknown as string,
        },
      ],
    });
  });

  test("rejects invalid capacities and worker globals as typed feedback", () => {
    expect(installBrowserServiceWorkerRuntime({}, { maxClients: 4, maxFeedback: 4 })).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-invalid" },
    });
    expect(installBrowserServiceWorkerRuntime(new WorkerRoot(), { maxClients: 0, maxFeedback: 4 })).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-relay-capacity-exhausted", severity: "backpressure" },
    });
  });
});
