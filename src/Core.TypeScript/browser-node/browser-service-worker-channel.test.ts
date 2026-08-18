import { describe, expect, test } from "bun:test";
import {
  createNativeServiceWorkerTabChannel,
  relayBrowserServiceWorkerTabMessage,
} from "./browser-service-worker-channel";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
  startBrowserTabCoordinator,
  type BrowserCausalCorrectionNotice,
  type BrowserCausalCorrectionReplayAcknowledgement,
  type BrowserCausalCorrectionReplayAdmission,
  type BrowserCausalCorrectionReplayNotice,
  type BrowserCheckpointInvalidation,
  type BrowserDatabaseInvalidation,
  type BrowserTabChannel,
  type BrowserTabChannelMessage,
  type BrowserTabCoordinator,
} from "./browser-tab-coordinator";

type NativeListener = (event: { readonly data?: unknown }) => void;

function admitted(admittedCorrections: number): BrowserCausalCorrectionReplayAdmission {
  return { disposition: "admitted", admittedCorrections, feedback: null };
}

function invalidation(sourceTabId = "tab-a", revision = 9): BrowserTabChannelMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId: "llmtv-room-a",
    kind: "checkpoint-invalidated",
    invalidation: { sourceTabId, operation: "saved", revision },
  };
}

class FakeServiceWorkerContainer {
  readonly listeners = new Set<NativeListener>();
  readonly posted: unknown[] = [];
  readonly controller: { readonly postMessage: (message: unknown) => void };

  constructor(publish: (message: unknown) => void = () => undefined) {
    this.controller = {
      postMessage: (message: unknown): void => {
        this.posted.push(message);
        publish(message);
      },
    };
  }

  addEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.delete(listener);
  }

  emit(data: unknown): void {
    for (const listener of this.listeners) listener({ data });
  }
}

class FakeServiceWorkerMesh {
  private readonly containers = new Map<string, FakeServiceWorkerContainer>();
  private readonly pending = new Set<Promise<unknown>>();
  private readonly workerRoot = {
    clients: {
      matchAll: async (): Promise<readonly { readonly id: string; postMessage(message: unknown): void }[]> =>
        [...this.containers].map(([id, container]) => ({
          id,
          postMessage: (message: unknown): void => container.emit(message),
        })),
    },
  };

  page(clientId: string): { readonly navigator: { readonly serviceWorker: FakeServiceWorkerContainer } } {
    const container = new FakeServiceWorkerContainer((message) => {
      const pending = relayBrowserServiceWorkerTabMessage(
        this.workerRoot,
        { data: message, source: { id: clientId } },
        8,
      );
      this.pending.add(pending);
      void pending.finally(() => this.pending.delete(pending));
    });
    this.containers.set(clientId, container);
    return { navigator: { serviceWorker: container } };
  }

  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }
}

function unwrapChannel(result: ReturnType<typeof createNativeServiceWorkerTabChannel>): BrowserTabChannel {
  if (!result.ok) throw new Error(`${result.feedback.code}: ${result.feedback.detail}`);
  return result.value;
}

function unwrapCoordinator(result: ReturnType<typeof startBrowserTabCoordinator>): BrowserTabCoordinator {
  if (!result.ok) throw new Error(`${result.feedback.code}: ${result.feedback.detail}`);
  return result.value;
}

describe("native service-worker browser channel", () => {
  test("returns typed backpressure when the container or controller is unavailable", () => {
    expect(createNativeServiceWorkerTabChannel({})).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-unavailable", severity: "backpressure" },
    });
    expect(createNativeServiceWorkerTabChannel({ navigator: { serviceWorker: { controller: null } } })).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-invalid", severity: "heat" },
    });

    const container = new FakeServiceWorkerContainer();
    Object.defineProperty(container, "controller", { value: null });
    expect(createNativeServiceWorkerTabChannel({ navigator: { serviceWorker: container } })).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-controller-missing", severity: "backpressure" },
    });
  });

  test("publishes, receives, unsubscribes, and closes without owning worker lifetime", () => {
    const container = new FakeServiceWorkerContainer();
    const created = createNativeServiceWorkerTabChannel({ navigator: { serviceWorker: container } });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const received: unknown[] = [];
    const subscription = created.value.subscribe((message) => received.push(message));
    expect(subscription.ok).toBe(true);
    const message = invalidation();
    expect(created.value.publish(message).ok).toBe(true);
    container.emit(invalidation("tab-b", 10));

    expect(container.posted).toEqual([message]);
    expect(received).toEqual([invalidation("tab-b", 10)]);
    if (subscription.ok) expect(subscription.value.unsubscribe().ok).toBe(true);
    expect(created.value.close().ok).toBe(true);
    expect(container.listeners.size).toBe(0);
    expect(created.value.publish(message)).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-channel-closed" },
    });
  });

  test("converges two coordinators and forwards checkpoint evidence end to end", async () => {
    const mesh = new FakeServiceWorkerMesh();
    const channelA = unwrapChannel(createNativeServiceWorkerTabChannel(mesh.page("client-a")));
    const channelB = unwrapChannel(createNativeServiceWorkerTabChannel(mesh.page("client-b")));
    const invalidationsA: BrowserCheckpointInvalidation[] = [];
    const invalidationsB: BrowserCheckpointInvalidation[] = [];
    const databaseInvalidationsA: BrowserDatabaseInvalidation[] = [];
    const databaseInvalidationsB: BrowserDatabaseInvalidation[] = [];
    const causalCorrectionsA: BrowserCausalCorrectionNotice[] = [];
    const causalCorrectionsB: BrowserCausalCorrectionNotice[] = [];
    const causalReplaysA: BrowserCausalCorrectionReplayNotice[] = [];
    const causalReplaysB: BrowserCausalCorrectionReplayNotice[] = [];
    const causalAcknowledgementsA: BrowserCausalCorrectionReplayAcknowledgement[] = [];
    const retainedCorrections: readonly BrowserCausalCorrectionNotice[] = [
      { sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 },
    ];
    const options = {
      nodeId: "llmtv-room-service-worker",
      initialState: "foreground" as const,
      maxTrackedTabs: 4,
      capabilities: ["javascript", "service-worker"] as const,
      checkpoint: "durable" as const,
    };
    const coordinatorA = unwrapCoordinator(
      startBrowserTabCoordinator(
        {
          ...options,
          tabId: "tab-a",
          initialSequence: 1,
          onCheckpointInvalidated: (value) => invalidationsA.push(value),
          onDatabaseInvalidated: (value) => databaseInvalidationsA.push(value),
          onCausalCorrection: (value) => causalCorrectionsA.push(value),
          causalCorrectionReplay: {
            maxCorrections: 2,
            snapshot: () => ({ handoffId: "handoff/service-worker", corrections: retainedCorrections }),
            receive: (value) => {
              causalReplaysA.push(value);
              return admitted(value.corrections.length);
            },
            acknowledge: (value) => causalAcknowledgementsA.push(value),
          },
        },
        channelA,
      ),
    );
    const coordinatorB = unwrapCoordinator(
      startBrowserTabCoordinator(
        {
          ...options,
          tabId: "tab-b",
          initialSequence: 2,
          onCheckpointInvalidated: (value) => invalidationsB.push(value),
          onDatabaseInvalidated: (value) => databaseInvalidationsB.push(value),
          onCausalCorrection: (value) => causalCorrectionsB.push(value),
          causalCorrectionReplay: {
            maxCorrections: 2,
            snapshot: () => ({ handoffId: "handoff/empty", corrections: [] }),
            receive: (value) => {
              causalReplaysB.push(value);
              return admitted(value.corrections.length);
            },
            acknowledge: () => undefined,
          },
        },
        channelB,
      ),
    );

    await mesh.drain();
    expect(coordinatorA.read().liveness.liveTabIds).toEqual(["tab-a", "tab-b"]);
    expect(coordinatorB.read().liveness.liveTabIds).toEqual(["tab-a", "tab-b"]);
    expect(causalReplaysA).toEqual([]);
    expect(causalReplaysB).toEqual([
      {
        handoffId: "handoff/service-worker",
        sourceTabId: "tab-a",
        targetTabId: "tab-b",
        maxCorrections: 2,
        corrections: retainedCorrections,
      },
    ]);
    expect(causalAcknowledgementsA).toEqual([
      {
        handoffId: "handoff/service-worker",
        sourceTabId: "tab-b",
        targetTabId: "tab-a",
        correctionCount: 1,
        disposition: "admitted",
        admittedCorrections: 1,
        feedback: null,
      },
    ]);

    expect(coordinatorA.publishCheckpointInvalidation("saved", 42).ok).toBe(true);
    await mesh.drain();
    expect(invalidationsA).toEqual([]);
    expect(invalidationsB).toEqual([{ sourceTabId: "tab-a", operation: "saved", revision: 42 }]);

    expect(coordinatorB.publishDatabaseInvalidation("llmtv-room-service-worker:database", 7).ok).toBe(true);
    await mesh.drain();
    expect(databaseInvalidationsA).toEqual([
      { sourceTabId: "tab-b", databaseNodeId: "llmtv-room-service-worker:database", revision: 7 },
    ]);
    expect(databaseInvalidationsB).toEqual([]);

    expect(
      coordinatorA.publishCausalCorrection({
        sequence: "9007199254740994",
        reinterpretsThrough: "9007199254740993",
        deltaRows: 2,
      }).ok,
    ).toBe(true);
    await mesh.drain();
    expect(causalCorrectionsA).toEqual([]);
    expect(causalCorrectionsB).toEqual([
      {
        sourceTabId: "tab-a",
        sequence: "9007199254740994",
        reinterpretsThrough: "9007199254740993",
        deltaRows: 2,
      },
    ]);

    expect(coordinatorB.stop(3).ok).toBe(true);
    await mesh.drain();
    expect(coordinatorA.read().liveness.liveTabIds).toEqual(["tab-a"]);
    expect(coordinatorA.stop(4).ok).toBe(true);
    await mesh.drain();
  });
});

describe("service-worker browser relay", () => {
  test("validates once and fans evidence to every window except its source", async () => {
    const deliveries = new Map<string, unknown[]>();
    const clients = ["client-a", "client-b", "client-c"].map((id) => ({
      id,
      postMessage: (message: unknown): void => {
        const received = deliveries.get(id) ?? [];
        received.push(message);
        deliveries.set(id, received);
      },
    }));
    const message = invalidation();
    const relayed = await relayBrowserServiceWorkerTabMessage(
      { clients: { matchAll: async () => clients } },
      { data: message, source: { id: "client-a" } },
      8,
    );

    expect(relayed).toEqual({ ok: true, value: 2 });
    expect(deliveries.get("client-a")).toBeUndefined();
    expect(deliveries.get("client-b")).toEqual([message]);
    expect(deliveries.get("client-c")).toEqual([message]);
  });

  test("rejects malformed evidence and over-capacity fanout before posting", async () => {
    const posted: unknown[] = [];
    const clients = ["client-a", "client-b"].map((id) => ({
      id,
      postMessage: (message: unknown): void => {
        posted.push(message);
      },
    }));
    const root = { clients: { matchAll: async () => clients } };

    expect(
      await relayBrowserServiceWorkerTabMessage(
        root,
        { data: { kind: "checkpoint-invalidated" }, source: { id: "client-a" } },
        8,
      ),
    ).toMatchObject({ ok: false, feedback: { code: "tab-message-invalid" } });
    expect(
      await relayBrowserServiceWorkerTabMessage(root, { data: invalidation(), source: { id: "client-a" } }, 1),
    ).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-relay-capacity-exhausted", severity: "backpressure" },
    });
    expect(posted).toEqual([]);
  });

  test("requires source identity so the sender never receives its own invalidation", async () => {
    const result = await relayBrowserServiceWorkerTabMessage(
      { clients: { matchAll: async () => [] } },
      { data: invalidation(), source: null },
      8,
    );
    expect(result).toMatchObject({
      ok: false,
      feedback: { code: "service-worker-relay-source-missing", severity: "heat" },
    });
  });

  test("reports exactly how far a rejected fanout progressed", async () => {
    const delivered: unknown[] = [];
    const result = await relayBrowserServiceWorkerTabMessage(
      {
        clients: {
          matchAll: async () => [
            { id: "client-a", postMessage: () => undefined },
            { id: "client-b", postMessage: (message: unknown) => delivered.push(message) },
            {
              id: "client-c",
              postMessage: () => {
                throw new Error("closed");
              },
            },
          ],
        },
      },
      { data: invalidation(), source: { id: "client-a" } },
      8,
    );

    expect(delivered).toEqual([invalidation()]);
    expect(result).toMatchObject({
      ok: false,
      feedback: {
        code: "service-worker-relay-client-post-failed",
        detail: "The service worker delivered to 1 clients before a window rejected the message.",
      },
    });
  });
});
