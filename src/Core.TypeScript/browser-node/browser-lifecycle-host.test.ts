import { describe, expect, test } from "bun:test";
import {
  BROWSER_LIFECYCLE_HOST_SCHEMA,
  createBrowserSequenceCounter,
  createNativeBrowserLifecyclePort,
  startBrowserLifecycleHost,
  type BrowserLifecycleEvent,
  type BrowserLifecycleEventType,
  type BrowserLifecycleHost,
  type BrowserLifecycleHostOptions,
  type BrowserLifecyclePort,
  type BrowserLifecycleResult,
  type BrowserLifecycleSubscription,
  type BrowserTabReadoutSink,
} from "./browser-lifecycle-host";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
  type BrowserTabChannel,
  type BrowserTabChannelMessage,
  type BrowserTabChannelSubscription,
  type BrowserTabOperationResult,
} from "./browser-tab-coordinator";

function tabOk<T>(value: T): BrowserTabOperationResult<T> {
  return { ok: true, value };
}

function lifecycleOk<T>(value: T): BrowserLifecycleResult<T> {
  return { ok: true, value };
}

class FakeChannel implements BrowserTabChannel {
  readonly published: BrowserTabChannelMessage[] = [];
  closed = false;
  private listener: ((message: unknown) => void) | null = null;

  publish(message: BrowserTabChannelMessage): BrowserTabOperationResult<null> {
    this.published.push(message);
    return tabOk(null);
  }

  subscribe(listener: (message: unknown) => void): BrowserTabOperationResult<BrowserTabChannelSubscription> {
    this.listener = listener;
    return tabOk({
      unsubscribe: () => {
        this.listener = null;
        return tabOk(null);
      },
    });
  }

  close(): BrowserTabOperationResult<null> {
    this.closed = true;
    return tabOk(null);
  }

  emit(message: unknown): void {
    this.listener?.(message);
  }
}

class FakeLifecycle implements BrowserLifecyclePort {
  visibilityState: "visible" | "hidden" | "prerender" = "visible";
  failOn: BrowserLifecycleEventType | null = null;
  private readonly listeners = new Map<BrowserLifecycleEventType, Set<(event: BrowserLifecycleEvent) => void>>();

  visibility(): BrowserLifecycleResult<"visible" | "hidden" | "prerender"> {
    return lifecycleOk(this.visibilityState);
  }

  subscribe(
    eventType: BrowserLifecycleEventType,
    listener: (event: BrowserLifecycleEvent) => void,
  ): BrowserLifecycleResult<BrowserLifecycleSubscription> {
    if (eventType === this.failOn) {
      return {
        ok: false,
        feedback: {
          severity: "heat",
          code: "lifecycle-subscribe-failed",
          detail: `injected ${eventType} failure`,
        },
      };
    }
    const listeners = this.listeners.get(eventType) ?? new Set();
    listeners.add(listener);
    this.listeners.set(eventType, listeners);
    return lifecycleOk({
      unsubscribe: () => {
        listeners.delete(listener);
        return lifecycleOk(null);
      },
    });
  }

  emit(eventType: BrowserLifecycleEventType, persisted = false): void {
    for (const listener of [...(this.listeners.get(eventType) ?? [])]) listener({ persisted });
  }

  listenerCount(): number {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }
}

function options(initialSequence = 10, maxFeedback = 8): BrowserLifecycleHostOptions {
  return {
    nodeId: "llmtv-room-a",
    tabId: "tab-a",
    initialSequence,
    initialState: "foreground",
    maxTrackedTabs: 4,
    maxFeedback,
    capabilities: ["css", "javascript", "broadcast-channel"],
    checkpoint: "durable",
  };
}

function unwrap<T>(result: BrowserLifecycleResult<T>): T {
  if (!result.ok) throw new Error(`${result.feedback.code}: ${result.feedback.detail}`);
  return result.value;
}

function start(
  lifecycle: FakeLifecycle,
  channel: FakeChannel,
  sink: BrowserTabReadoutSink,
  initialSequence = 10,
  maxFeedback = 8,
): BrowserLifecycleHost {
  const sequence = unwrap(createBrowserSequenceCounter(initialSequence));
  return unwrap(startBrowserLifecycleHost(options(initialSequence, maxFeedback), channel, lifecycle, sequence, sink));
}

describe("browser lifecycle host", () => {
  test("maps visibility events to ordered tab announcements without a clock", () => {
    const lifecycle = new FakeLifecycle();
    const channel = new FakeChannel();
    const readouts: string[] = [];
    const host = start(lifecycle, channel, {
      write: (readout) => {
        readouts.push(readout.tabs.find((tab) => tab.tabId === readout.localTabId)?.state ?? "missing");
        return { ok: true, value: null };
      },
    });

    expect(host.read()).toMatchObject({ schema: BROWSER_LIFECYCLE_HOST_SCHEMA, state: "foreground", stopped: false });
    expect(readouts).toEqual(["foreground"]);

    lifecycle.visibilityState = "hidden";
    lifecycle.emit("visibilitychange");
    lifecycle.visibilityState = "visible";
    lifecycle.emit("pageshow", true);

    expect(host.read()).toMatchObject({ state: "foreground", admission: "open", feedback: [] });
    expect(readouts).toEqual(["foreground", "background", "foreground"]);
    expect(
      channel.published
        .filter((message) => message.kind === "presence")
        .map((message) => [message.presence.sequence, message.presence.state]),
    ).toEqual([
      [10, "foreground"],
      [11, "background"],
      [12, "foreground"],
    ]);
  });

  test("suspends persisted page hides and closes terminal page hides", () => {
    const lifecycle = new FakeLifecycle();
    const channel = new FakeChannel();
    const states: string[] = [];
    const host = start(lifecycle, channel, {
      write: (readout) => {
        states.push(readout.tabs.find((tab) => tab.tabId === readout.localTabId)?.state ?? "missing");
        return { ok: true, value: null };
      },
    });

    lifecycle.emit("pagehide", true);
    expect(host.read()).toMatchObject({ state: "suspended", stopped: false });

    lifecycle.visibilityState = "visible";
    lifecycle.emit("pageshow", true);
    lifecycle.emit("pagehide", false);

    expect(host.read()).toMatchObject({ state: "dark", stopped: true });
    expect(channel.closed).toBe(true);
    expect(lifecycle.listenerCount()).toBe(0);
    expect(states).toEqual(["foreground", "suspended", "foreground", "dark"]);

    lifecycle.emit("pageshow");
    expect(states).toHaveLength(4);
  });

  test("writes remote coordinator observations through the same sink", () => {
    const lifecycle = new FakeLifecycle();
    const channel = new FakeChannel();
    const tabSets: string[][] = [];
    start(lifecycle, channel, {
      write: (readout) => {
        tabSets.push(readout.tabs.map((tab) => tab.tabId));
        return { ok: true, value: null };
      },
    });

    channel.emit({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "llmtv-room-a",
      kind: "presence",
      presence: { tabId: "tab-b", sequence: 7, state: "background" },
    });

    expect(tabSets).toEqual([["tab-a"], ["tab-a", "tab-b"]]);
  });

  test("projects checkpoint changes through the lifecycle sink immediately", () => {
    const lifecycle = new FakeLifecycle();
    const channel = new FakeChannel();
    const checkpoints: string[] = [];
    const host = start(lifecycle, channel, {
      write: (readout) => {
        checkpoints.push(readout.liveness.checkpoint);
        return { ok: true, value: null };
      },
    });

    expect(host.updateCheckpoint("none")).toMatchObject({
      ok: true,
      value: { coordinator: { liveness: { checkpoint: "none" } } },
    });
    expect(checkpoints).toEqual(["durable", "none"]);
    expect(host.stop().ok).toBe(true);
    expect(host.updateCheckpoint("durable")).toMatchObject({
      ok: false,
      feedback: { code: "host-stopped" },
    });
  });

  test("publishes checkpoint invalidation evidence without changing local liveness", () => {
    const lifecycle = new FakeLifecycle();
    const channel = new FakeChannel();
    const host = start(lifecycle, channel, { write: () => ({ ok: true, value: null }) });

    expect(host.publishCheckpointInvalidation("saved", 21)).toMatchObject({
      ok: true,
      value: { coordinator: { liveness: { checkpoint: "durable" } } },
    });
    expect(channel.published.at(-1)).toEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "llmtv-room-a",
      kind: "checkpoint-invalidated",
      invalidation: { sourceTabId: "tab-a", operation: "saved", revision: 21 },
    });

    expect(host.publishDatabaseInvalidation("llmtv-room-a:database", 22)).toMatchObject({
      ok: true,
      value: { coordinator: { liveness: { checkpoint: "durable" } } },
    });
    expect(channel.published.at(-1)).toEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "llmtv-room-a",
      kind: "database-invalidated",
      invalidation: { sourceTabId: "tab-a", databaseNodeId: "llmtv-room-a:database", revision: 22 },
    });

    expect(
      host.publishDatabaseExecutionReceipt({
        databaseNodeId: "llmtv-room-a:database",
        intentId: "event/score",
        sequence: 3,
        status: "settled",
        revision: 22,
        accepted: 1,
        duplicates: 0,
      }),
    ).toMatchObject({ ok: true });
    expect(channel.published.at(-1)).toEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "llmtv-room-a",
      kind: "database-execution-receipt",
      receipt: {
        sourceTabId: "tab-a",
        databaseNodeId: "llmtv-room-a:database",
        intentId: "event/score",
        sequence: 3,
        status: "settled",
        revision: 22,
        accepted: 1,
        duplicates: 0,
      },
    });

    expect(
      host.publishCausalCorrection({
        sequence: "9007199254740994",
        reinterpretsThrough: "9007199254740993",
        deltaRows: 2,
      }),
    ).toMatchObject({ ok: true });
    expect(channel.published.at(-1)).toEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "llmtv-room-a",
      kind: "causal-correction",
      correction: {
        sourceTabId: "tab-a",
        sequence: "9007199254740994",
        reinterpretsThrough: "9007199254740993",
        deltaRows: 2,
      },
    });

    expect(host.stop().ok).toBe(true);
    expect(host.publishCheckpointInvalidation("removed", 21)).toMatchObject({
      ok: false,
      feedback: { code: "host-stopped" },
    });
    expect(host.publishDatabaseInvalidation("llmtv-room-a:database", 22)).toMatchObject({
      ok: false,
      feedback: { code: "host-stopped" },
    });
    expect(
      host.publishDatabaseExecutionReceipt({
        databaseNodeId: "llmtv-room-a:database",
        intentId: "event/score",
        sequence: 3,
        status: "settled",
        revision: 22,
        accepted: 1,
        duplicates: 0,
      }),
    ).toMatchObject({ ok: false, feedback: { code: "host-stopped" } });
    expect(host.publishCausalCorrection({ sequence: "23", reinterpretsThrough: "22", deltaRows: 1 })).toMatchObject({
      ok: false,
      feedback: { code: "host-stopped" },
    });
  });

  test("backpressures rather than wrapping an exhausted sequence", () => {
    const lifecycle = new FakeLifecycle();
    const channel = new FakeChannel();
    const sequence = unwrap(createBrowserSequenceCounter(Number.MAX_SAFE_INTEGER));
    const host = unwrap(
      startBrowserLifecycleHost(options(Number.MAX_SAFE_INTEGER), channel, lifecycle, sequence, {
        write: () => ({ ok: true, value: null }),
      }),
    );

    lifecycle.visibilityState = "hidden";
    lifecycle.emit("visibilitychange");

    expect(host.read().state).toBe("foreground");
    expect(host.read().feedback).toContainEqual({
      severity: "backpressure",
      code: "sequence-exhausted",
      detail: "The browser lifecycle sequence reached Number.MAX_SAFE_INTEGER and will not wrap.",
    });
    expect(host.stop()).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "sequence-exhausted",
        detail: "The browser lifecycle sequence reached Number.MAX_SAFE_INTEGER and will not wrap.",
      },
    });
    expect(host.read().stopped).toBe(false);
  });

  test("bounds sink failures and stops admitting lifecycle work at capacity", () => {
    const lifecycle = new FakeLifecycle();
    const channel = new FakeChannel();
    const host = start(lifecycle, channel, { write: () => ({ ok: false, detail: "mount unavailable" }) }, 10, 2);

    lifecycle.visibilityState = "hidden";
    lifecycle.emit("visibilitychange");
    expect(host.read()).toMatchObject({ state: "background", admission: "backpressured" });
    expect(host.read().feedback.map((entry) => entry.code)).toEqual([
      "readout-sink-failed",
      "feedback-capacity-exhausted",
    ]);

    lifecycle.visibilityState = "visible";
    lifecycle.emit("visibilitychange");
    expect(host.read().state).toBe("background");

    lifecycle.emit("pagehide", false);
    expect(host.read()).toMatchObject({ state: "dark", stopped: true, admission: "backpressured" });
    expect(channel.closed).toBe(true);
    expect(lifecycle.listenerCount()).toBe(0);
  });

  test("adapts native lifecycle targets and removes listeners idempotently", () => {
    const documentListeners = new Map<string, (event: unknown) => void>();
    const pageListeners = new Map<string, (event: unknown) => void>();
    const documentRoot = {
      visibilityState: "hidden",
      addEventListener: (type: string, listener: (event: unknown) => void): void => {
        documentListeners.set(type, listener);
      },
      removeEventListener: (type: string): void => {
        documentListeners.delete(type);
      },
    };
    const root = {
      document: documentRoot,
      addEventListener: (type: string, listener: (event: unknown) => void): void => {
        pageListeners.set(type, listener);
      },
      removeEventListener: (type: string): void => {
        pageListeners.delete(type);
      },
    };
    const port = unwrap(createNativeBrowserLifecyclePort(root));

    expect(port.visibility()).toEqual({ ok: true, value: "hidden" });
    const observed: BrowserLifecycleEvent[] = [];
    const pagehide = unwrap(port.subscribe("pagehide", (event) => observed.push(event)));
    pageListeners.get("pagehide")?.({ persisted: true });
    expect(observed).toEqual([{ persisted: true }]);
    expect(pagehide.unsubscribe()).toEqual({ ok: true, value: null });
    expect(pagehide.unsubscribe()).toEqual({ ok: true, value: null });
    expect(pageListeners.has("pagehide")).toBe(false);
  });

  test("cleans up the coordinator when lifecycle subscription fails during startup", () => {
    const lifecycle = new FakeLifecycle();
    lifecycle.failOn = "pageshow";
    const channel = new FakeChannel();
    const sequence = unwrap(createBrowserSequenceCounter(10));
    const result = startBrowserLifecycleHost(options(), channel, lifecycle, sequence, {
      write: () => ({ ok: true, value: null }),
    });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "lifecycle-subscribe-failed",
        detail: "injected pageshow failure",
      },
    });
    expect(channel.closed).toBe(true);
    expect(lifecycle.listenerCount()).toBe(0);
  });
});
