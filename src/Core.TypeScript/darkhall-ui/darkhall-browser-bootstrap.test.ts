import { beforeEach, describe, expect, test } from "bun:test";
import type { BrowserLifecycleEventType } from "../browser-node/browser-lifecycle-host";
import type { BrowserTabChannelMessage } from "../browser-node/browser-tab-coordinator";
import {
  DARK_HALL_BROWSER_BOOTSTRAP_SCHEMA,
  startNativeDarkHallBrowser,
  type DarkHallBrowserBootstrapOptions,
  type DarkHallBrowserRuntime,
} from "./darkhall-browser-bootstrap";
import type { RoomRunTranscript } from "./darkhall-room";

type NativeListener = (event: unknown) => void;

const transcript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "darkhall",
  seed: "native-browser-bootstrap",
  controller: [],
  ticks: [],
  heatRows: [],
};

class NativeChannel {
  static instances: NativeChannel[] = [];

  readonly name: string;
  readonly messages: BrowserTabChannelMessage[] = [];
  readonly listeners = new Set<NativeListener>();
  closed = false;
  failClose = false;

  constructor(name: string) {
    this.name = name;
    NativeChannel.instances.push(this);
  }

  postMessage(message: BrowserTabChannelMessage): void {
    this.messages.push(message);
  }

  addEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.delete(listener);
  }

  close(): void {
    if (this.failClose) throw new Error("injected close failure");
    this.closed = true;
  }
}

class NativeBrowserRoot {
  BroadcastChannel: typeof NativeChannel = NativeChannel;
  readonly documentListeners = new Map<string, Set<NativeListener>>();
  readonly pageListeners = new Map<string, Set<NativeListener>>();
  readonly document = {
    visibilityState: "visible" as "visible" | "hidden" | "prerender" | "unsupported",
    addEventListener: (type: string, listener: NativeListener): void => {
      this.add(this.documentListeners, type, listener);
    },
    removeEventListener: (type: string, listener: NativeListener): void => {
      this.remove(this.documentListeners, type, listener);
    },
  };

  addEventListener(type: string, listener: NativeListener): void {
    this.add(this.pageListeners, type, listener);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.remove(this.pageListeners, type, listener);
  }

  emit(type: BrowserLifecycleEventType, persisted = false): void {
    const listeners = type === "visibilitychange" ? this.documentListeners : this.pageListeners;
    for (const listener of [...(listeners.get(type) ?? [])]) listener({ persisted });
  }

  listenerCount(): number {
    const count = (listeners: Map<string, Set<NativeListener>>): number =>
      [...listeners.values()].reduce((total, entries) => total + entries.size, 0);
    return count(this.documentListeners) + count(this.pageListeners);
  }

  private add(listeners: Map<string, Set<NativeListener>>, type: string, listener: NativeListener): void {
    const entries = listeners.get(type) ?? new Set();
    entries.add(listener);
    listeners.set(type, entries);
  }

  private remove(listeners: Map<string, Set<NativeListener>>, type: string, listener: NativeListener): void {
    listeners.get(type)?.delete(listener);
  }
}

function options(root: NativeBrowserRoot, mount: unknown = { innerHTML: "" }): DarkHallBrowserBootstrapOptions {
  return {
    root,
    mount,
    channelName: "zeta-darkhall-tabs",
    transcript,
    nodeId: "llmtv-room-a",
    tabId: "tab-a",
    initialSequence: 40,
    maxTrackedTabs: 4,
    maxFeedback: 8,
    capabilities: ["css", "javascript", "broadcast-channel"],
    checkpoint: "durable",
  };
}

function unwrap(result: ReturnType<typeof startNativeDarkHallBrowser>): DarkHallBrowserRuntime {
  if (!result.ok) throw new Error(`${result.feedback.code}: ${result.feedback.detail}`);
  return result.value;
}

describe("native Dark Hall browser bootstrap", () => {
  beforeEach(() => {
    NativeChannel.instances = [];
  });

  test("composes native edges, derives visibility, and renders the first room frame", () => {
    const root = new NativeBrowserRoot();
    root.document.visibilityState = "hidden";
    const mount = { innerHTML: "" };
    const runtime = unwrap(startNativeDarkHallBrowser(options(root, mount)));

    expect(runtime.schema).toBe(DARK_HALL_BROWSER_BOOTSTRAP_SCHEMA);
    expect(runtime.channelName).toBe("zeta-darkhall-tabs");
    expect(runtime.host.read()).toMatchObject({ state: "background", stopped: false, admission: "open" });
    expect(mount.innerHTML).toContain('data-browser-node="llmtv-room-a"');
    expect(mount.innerHTML).toContain('data-browser-local-tab="tab-a"');
    expect(mount.innerHTML).not.toContain("<script");

    const channel = NativeChannel.instances[0];
    expect(channel?.name).toBe("zeta-darkhall-tabs");
    expect(channel?.messages.find((message) => message.kind === "presence")).toMatchObject({
      kind: "presence",
      presence: { tabId: "tab-a", sequence: 40, state: "background" },
    });
    expect(root.listenerCount()).toBe(3);

    root.document.visibilityState = "visible";
    root.emit("visibilitychange");
    expect(runtime.host.read().state).toBe("foreground");
    expect(channel?.messages.at(-1)).toMatchObject({ presence: { sequence: 41, state: "foreground" } });

    expect(runtime.host.stop().ok).toBe(true);
    expect(channel?.closed).toBe(true);
    expect(root.listenerCount()).toBe(0);
  });

  test("does not allocate a channel when a preflight native edge is unavailable", () => {
    const lifecycle = startNativeDarkHallBrowser({
      ...options(new NativeBrowserRoot()),
      root: { BroadcastChannel: NativeChannel },
    });
    expect(lifecycle).toMatchObject({
      ok: false,
      feedback: { code: "lifecycle-start-failed", cleanup: [] },
    });
    expect(NativeChannel.instances).toHaveLength(0);

    const root = new NativeBrowserRoot();
    const mount = startNativeDarkHallBrowser(options(root, {}));
    expect(mount).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "mount-start-failed",
        detail: "The supplied Dark Hall room mount does not expose innerHTML.",
        cleanup: [],
      },
    });
    expect(NativeChannel.instances).toHaveLength(0);
  });

  test("reports unsupported visibility before allocating a channel", () => {
    const root = new NativeBrowserRoot();
    root.document.visibilityState = "unsupported";

    expect(startNativeDarkHallBrowser(options(root))).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "visibility-start-failed", cleanup: [] },
    });
    expect(NativeChannel.instances).toHaveLength(0);
  });

  test("maps prerendered documents to suspended tabs", () => {
    const root = new NativeBrowserRoot();
    root.document.visibilityState = "prerender";
    const runtime = unwrap(startNativeDarkHallBrowser(options(root)));

    expect(runtime.host.read().state).toBe("suspended");
    expect(NativeChannel.instances[0]?.messages.find((message) => message.kind === "presence")).toMatchObject({
      presence: { tabId: "tab-a", sequence: 40, state: "suspended" },
    });
    expect(runtime.host.stop().ok).toBe(true);
  });

  test("reports invalid sequence before allocating a channel", () => {
    const root = new NativeBrowserRoot();
    const result = startNativeDarkHallBrowser({ ...options(root), initialSequence: -1 });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        severity: "heat",
        code: "sequence-start-failed",
        detail: "sequence-invalid: The browser lifecycle sequence must start at a non-negative safe integer.",
        cleanup: [],
      },
    });
    expect(NativeChannel.instances).toHaveLength(0);
  });

  test("reports channel setup failure without installing lifecycle listeners", () => {
    const root = new NativeBrowserRoot();
    const result = startNativeDarkHallBrowser({ ...options(root), channelName: "" });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        severity: "heat",
        code: "channel-start-failed",
        detail: "broadcast-channel-invalid: A broadcast channel name must be a non-empty string.",
        cleanup: [],
      },
    });
    expect(NativeChannel.instances).toHaveLength(0);
    expect(root.listenerCount()).toBe(0);
  });

  test("closes the native channel when host validation rejects startup", () => {
    const root = new NativeBrowserRoot();
    const result = startNativeDarkHallBrowser({ ...options(root), maxFeedback: 1 });

    expect(result).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "host-start-failed", cleanup: [] },
    });
    expect(NativeChannel.instances).toHaveLength(1);
    expect(NativeChannel.instances[0]?.closed).toBe(true);
    expect(root.listenerCount()).toBe(0);
  });

  test("preserves cleanup feedback when an allocated channel refuses to close", () => {
    class RefusingChannel extends NativeChannel {
      constructor(name: string) {
        super(name);
        this.failClose = true;
      }
    }
    const root = new NativeBrowserRoot();
    root.BroadcastChannel = RefusingChannel;
    const result = startNativeDarkHallBrowser({
      ...options(root),
      maxFeedback: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        code: "host-start-failed",
        cleanup: ["broadcast-channel-close-failed: BroadcastChannel failed to close."],
      },
    });
  });
});
