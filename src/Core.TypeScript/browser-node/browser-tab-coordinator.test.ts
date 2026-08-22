import { describe, expect, test } from "bun:test";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
  startBrowserTabCoordinator,
  type BrowserTabChannel,
  type BrowserTabChannelMessage,
  type BrowserCheckpointInvalidation,
  type BrowserDatabaseExecutionReceiptNotice,
  type BrowserDatabaseInvalidation,
  type BrowserTabCoordinator,
  type BrowserTabCoordinatorOptions,
  type BrowserTabCoordinatorReadout,
  type BrowserTabOperationResult,
} from "./browser-tab-coordinator";

function ok<T>(value: T): BrowserTabOperationResult<T> {
  return { ok: true, value };
}

class FakeBus {
  private readonly channels = new Set<FakeChannel>();

  connect(): FakeChannel {
    const channel = new FakeChannel(this);
    this.channels.add(channel);
    return channel;
  }

  emit(message: unknown, sender: FakeChannel | null = null): void {
    for (const channel of this.channels) {
      if (channel !== sender) channel.deliver(message);
    }
  }

  disconnect(channel: FakeChannel): void {
    this.channels.delete(channel);
  }
}

class FakeChannel implements BrowserTabChannel {
  private readonly bus: FakeBus;
  private listener: ((message: unknown) => void) | null = null;
  private closed = false;

  constructor(bus: FakeBus) {
    this.bus = bus;
  }

  publish(message: BrowserTabChannelMessage): BrowserTabOperationResult<null> {
    if (this.closed) {
      return { ok: false, feedback: { severity: "heat", code: "broadcast-channel-closed", detail: "closed" } };
    }
    this.bus.emit(message, this);
    return ok(null);
  }

  subscribe(
    listener: (message: unknown) => void,
  ): BrowserTabOperationResult<{ unsubscribe(): BrowserTabOperationResult<null> }> {
    this.listener = listener;
    return ok({
      unsubscribe: () => {
        this.listener = null;
        return ok(null);
      },
    });
  }

  close(): BrowserTabOperationResult<null> {
    this.closed = true;
    this.listener = null;
    this.bus.disconnect(this);
    return ok(null);
  }

  deliver(message: unknown): void {
    this.listener?.(message);
  }
}

function options(
  tabId: string,
  onReadout?: (readout: BrowserTabCoordinatorReadout) => void,
  onCheckpointInvalidated?: (invalidation: BrowserCheckpointInvalidation) => void,
  onDatabaseInvalidated?: (invalidation: BrowserDatabaseInvalidation) => void,
  onDatabaseExecutionReceipt?: (receipt: BrowserDatabaseExecutionReceiptNotice) => void,
): BrowserTabCoordinatorOptions {
  return {
    nodeId: "llmtv-room-a",
    tabId,
    initialSequence: 1,
    initialState: "foreground",
    maxTrackedTabs: 8,
    capabilities: ["css", "javascript", "broadcast-channel"],
    checkpoint: "volatile",
    ...(onReadout === undefined ? {} : { onReadout }),
    ...(onCheckpointInvalidated === undefined ? {} : { onCheckpointInvalidated }),
    ...(onDatabaseInvalidated === undefined ? {} : { onDatabaseInvalidated }),
    ...(onDatabaseExecutionReceipt === undefined ? {} : { onDatabaseExecutionReceipt }),
  };
}

function started(result: BrowserTabOperationResult<BrowserTabCoordinator>): BrowserTabCoordinator {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.feedback.detail);
  return result.value;
}

function presence(tabId: string, sequence: number, state: "foreground" | "background" | "suspended" | "dark") {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId: "llmtv-room-a",
    kind: "presence" as const,
    presence: { tabId, sequence, state },
  };
}

describe("browser tab coordinator", () => {
  test("uses a probe handshake so both tabs converge before one leaves", () => {
    const bus = new FakeBus();
    const tabA = started(startBrowserTabCoordinator(options("tab-a"), bus.connect()));
    const tabB = started(startBrowserTabCoordinator(options("tab-b"), bus.connect()));

    expect(tabA.read().localTabId).toBe("tab-a");
    expect(tabB.read().localTabId).toBe("tab-b");
    expect(tabA.read().liveness).toMatchObject({ continuity: "multi-tab", liveTabIds: ["tab-a", "tab-b"] });
    expect(tabB.read().liveness).toMatchObject({ continuity: "multi-tab", liveTabIds: ["tab-a", "tab-b"] });

    expect(tabB.stop(2).ok).toBe(true);
    expect(tabA.read().liveness).toMatchObject({
      continuity: "single-tab",
      liveTabIds: ["tab-a"],
      darkTabIds: ["tab-b"],
    });
    expect(tabA.stop(2).ok).toBe(true);
  });

  test("probes before publishing presence so failed startup cannot leave a false live peer", () => {
    const publishedKinds: string[] = [];
    let closed = false;
    const channel: BrowserTabChannel = {
      subscribe: () => ok({ unsubscribe: () => ok(null) }),
      publish: (message) => {
        publishedKinds.push(message.kind);
        return message.kind === "probe"
          ? ok(null)
          : {
              ok: false,
              feedback: {
                severity: "heat",
                code: "broadcast-channel-publish-failed",
                detail: "injected failure",
              },
            };
      },
      close: () => {
        closed = true;
        return ok(null);
      },
    };

    expect(startBrowserTabCoordinator(options("tab-a"), channel)).toMatchObject({
      ok: false,
      feedback: { code: "broadcast-channel-publish-failed" },
    });
    expect(publishedKinds).toEqual(["probe", "presence"]);
    expect(closed).toBe(true);
  });

  test("converges under stale and equal-sequence events without reading a clock", () => {
    const bus = new FakeBus();
    const tabA = started(startBrowserTabCoordinator(options("tab-a"), bus.connect()));

    bus.emit(presence("tab-b", 4, "background"));
    bus.emit(presence("tab-b", 3, "foreground"));
    bus.emit(presence("tab-b", 4, "foreground"));

    expect(tabA.read().tabs).toContainEqual({ tabId: "tab-b", sequence: 4, state: "background" });
    expect(tabA.stop(5).ok).toBe(true);
  });

  test("rejects a stale local sequence without changing the presence sent to peers", () => {
    const bus = new FakeBus();
    const tabA = started(startBrowserTabCoordinator(options("tab-a"), bus.connect()));
    expect(tabA.announce(5, "background").ok).toBe(true);

    expect(tabA.announce(4, "foreground")).toMatchObject({
      ok: false,
      feedback: { code: "tab-sequence-stale", severity: "backpressure" },
    });
    expect(tabA.read().tabs).toContainEqual({ tabId: "tab-a", sequence: 5, state: "background" });
    expect(tabA.stop(4)).toMatchObject({ ok: false, feedback: { code: "tab-sequence-stale" } });
    expect(tabA.probe(5).ok).toBe(true);
    expect(tabA.stop(6).ok).toBe(true);
  });

  test("backpressures at capacity instead of forgetting an existing tab", () => {
    const bus = new FakeBus();
    const readouts: BrowserTabCoordinatorReadout[] = [];
    const tabA = started(
      startBrowserTabCoordinator(
        { ...options("tab-a", (readout) => readouts.push(readout)), maxTrackedTabs: 1 },
        bus.connect(),
      ),
    );

    bus.emit(presence("tab-b", 1, "foreground"));

    expect(tabA.read().tabs).toEqual([{ tabId: "tab-a", sequence: 1, state: "foreground" }]);
    expect(readouts.at(-1)?.feedback).toContainEqual({
      severity: "backpressure",
      code: "tab-capacity-exhausted",
      detail: "The coordinator retained 1 tabs and will not discard one to admit tab-b.",
    });
    expect(tabA.stop(2).ok).toBe(true);
  });

  test("updates the local checkpoint projection without claiming a channel mutation", () => {
    const bus = new FakeBus();
    const readouts: BrowserTabCoordinatorReadout[] = [];
    const tabA = started(
      startBrowserTabCoordinator(
        options("tab-a", (readout) => readouts.push(readout)),
        bus.connect(),
      ),
    );

    expect(tabA.updateCheckpoint("durable")).toMatchObject({
      ok: true,
      value: { liveness: { checkpoint: "durable" } },
    });
    expect(tabA.read().liveness.checkpoint).toBe("durable");
    expect(readouts.at(-1)?.liveness.checkpoint).toBe("durable");
    expect(tabA.updateCheckpoint("invalid" as never)).toMatchObject({
      ok: false,
      feedback: { code: "coordinator-configuration-invalid" },
    });
    expect(tabA.stop(2).ok).toBe(true);
    expect(tabA.updateCheckpoint("none")).toMatchObject({
      ok: false,
      feedback: { code: "coordinator-stopped" },
    });
  });

  test("broadcasts only checkpoint invalidation evidence to peer observers", () => {
    const bus = new FakeBus();
    const localInvalidations: BrowserCheckpointInvalidation[] = [];
    const peerInvalidations: BrowserCheckpointInvalidation[] = [];
    const tabA = started(
      startBrowserTabCoordinator(
        options("tab-a", undefined, (value) => localInvalidations.push(value)),
        bus.connect(),
      ),
    );
    const tabB = started(
      startBrowserTabCoordinator(
        options("tab-b", undefined, (value) => peerInvalidations.push(value)),
        bus.connect(),
      ),
    );

    expect(tabA.publishCheckpointInvalidation("saved", 12).ok).toBe(true);
    expect(localInvalidations).toEqual([]);
    expect(peerInvalidations).toEqual([{ sourceTabId: "tab-a", operation: "saved", revision: 12 }]);
    expect(tabB.read().liveness.checkpoint).toBe("volatile");

    expect(tabA.publishCheckpointInvalidation("invalid" as never, 13)).toMatchObject({
      ok: false,
      feedback: { code: "coordinator-configuration-invalid" },
    });
    expect(tabA.stop(2).ok).toBe(true);
    expect(tabB.stop(2).ok).toBe(true);
  });

  test("broadcasts database revision evidence without carrying image bytes", () => {
    const bus = new FakeBus();
    const localInvalidations: BrowserDatabaseInvalidation[] = [];
    const peerInvalidations: BrowserDatabaseInvalidation[] = [];
    const tabA = started(
      startBrowserTabCoordinator(
        options("tab-a", undefined, undefined, (value) => localInvalidations.push(value)),
        bus.connect(),
      ),
    );
    const tabB = started(
      startBrowserTabCoordinator(
        options("tab-b", undefined, undefined, (value) => peerInvalidations.push(value)),
        bus.connect(),
      ),
    );

    expect(tabA.publishDatabaseInvalidation("llmtv-room-a:database", 12).ok).toBe(true);
    expect(localInvalidations).toEqual([]);
    expect(peerInvalidations).toEqual([
      { sourceTabId: "tab-a", databaseNodeId: "llmtv-room-a:database", revision: 12 },
    ]);
    expect(tabA.publishDatabaseInvalidation("", 13)).toMatchObject({
      ok: false,
      feedback: { code: "coordinator-configuration-invalid" },
    });
    expect(tabA.stop(2).ok).toBe(true);
    expect(tabB.stop(2).ok).toBe(true);
  });

  test("broadcasts compact settled receipts without database rows", () => {
    const bus = new FakeBus();
    const localReceipts: BrowserDatabaseExecutionReceiptNotice[] = [];
    const peerReceipts: BrowserDatabaseExecutionReceiptNotice[] = [];
    const tabA = started(
      startBrowserTabCoordinator(
        options("tab-a", undefined, undefined, undefined, (value) => localReceipts.push(value)),
        bus.connect(),
      ),
    );
    const tabB = started(
      startBrowserTabCoordinator(
        options("tab-b", undefined, undefined, undefined, (value) => peerReceipts.push(value)),
        bus.connect(),
      ),
    );

    const callerReceipt = {
      sourceTabId: "spoofed-tab",
      databaseNodeId: "llmtv-room-a:database",
      intentId: "event/score",
      sequence: 4,
      status: "settled" as const,
      revision: 12,
      accepted: 1,
      duplicates: 0,
    };
    expect(tabA.publishDatabaseExecutionReceipt(callerReceipt).ok).toBe(true);
    expect(localReceipts).toEqual([]);
    expect(peerReceipts).toEqual([
      {
        sourceTabId: "tab-a",
        databaseNodeId: "llmtv-room-a:database",
        intentId: "event/score",
        sequence: 4,
        status: "settled",
        revision: 12,
        accepted: 1,
        duplicates: 0,
      },
    ]);
    expect(JSON.stringify(peerReceipts)).not.toContain("rows");
    expect(tabA.stop(2).ok).toBe(true);
    expect(tabB.stop(2).ok).toBe(true);
  });

  test("reports malformed messages and local tab-id collisions as heat", () => {
    const bus = new FakeBus();
    const readouts: BrowserTabCoordinatorReadout[] = [];
    const tabA = started(
      startBrowserTabCoordinator(
        options("tab-a", (readout) => readouts.push(readout)),
        bus.connect(),
      ),
    );

    bus.emit({ schema: BROWSER_TAB_COORDINATOR_SCHEMA, kind: "presence" });
    bus.emit(presence("tab-a", 9, "dark"));

    expect(readouts.flatMap((readout) => readout.feedback).map((feedback) => feedback.code)).toContain(
      "tab-message-invalid",
    );
    expect(readouts.flatMap((readout) => readout.feedback).map((feedback) => feedback.code)).toContain(
      "tab-id-collision",
    );
    expect(tabA.read().tabs).toEqual([{ tabId: "tab-a", sequence: 1, state: "foreground" }]);
    expect(tabA.stop(2).ok).toBe(true);
  });

  test("records an observer exception as heat without interrupting coordination", () => {
    const bus = new FakeBus();
    const tabA = started(
      startBrowserTabCoordinator(
        options("tab-a", () => {
          throw new Error("observer failed");
        }),
        bus.connect(),
      ),
    );

    expect(tabA.read().feedback).toContainEqual({
      severity: "heat",
      code: "readout-observer-failed",
      detail: "The injected readout observer threw; coordinator state and channel delivery continued.",
    });
    expect(tabA.stop(2).ok).toBe(true);
  });
});
