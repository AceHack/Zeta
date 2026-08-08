import { describe, expect, test } from "bun:test";
import type { BrowserTabChannelMessage } from "../browser-node/browser-tab-coordinator";
import { startNativeDarkHallPwa } from "./darkhall-browser-pwa";
import type { RoomRunTranscript } from "./darkhall-room";

type NativeListener = (event?: unknown) => void;

class NativeBroadcastChannel {
  static instances: NativeBroadcastChannel[] = [];
  readonly listeners = new Set<NativeListener>();
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    NativeBroadcastChannel.instances.push(this);
  }

  postMessage(_message: BrowserTabChannelMessage): void {}
  addEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.delete(listener);
  }
  close(): void {}
}

class NativeServiceWorkerContainer {
  controller: { readonly postMessage: (message: unknown) => void } | null = {
    postMessage: (_message): void => undefined,
  };
  readonly ready = Promise.resolve({ active: true });
  readonly listeners = new Map<string, Set<NativeListener>>();
  rejectRegistration = false;

  async register(_scriptUrl: string, _options: unknown): Promise<unknown> {
    if (this.rejectRegistration) throw new Error("registration refused");
    return { active: true };
  }

  addEventListener(type: string, listener: NativeListener): void {
    const entries = this.listeners.get(type) ?? new Set();
    entries.add(listener);
    this.listeners.set(type, entries);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }
}

class NativeRoot {
  BroadcastChannel: typeof NativeBroadcastChannel = NativeBroadcastChannel;
  readonly serviceWorker = new NativeServiceWorkerContainer();
  readonly documentListeners = new Map<string, Set<NativeListener>>();
  readonly pageListeners = new Map<string, Set<NativeListener>>();
  readonly navigator = { serviceWorker: this.serviceWorker };
  readonly document = {
    visibilityState: "visible",
    addEventListener: (type: string, listener: NativeListener): void =>
      this.add(this.documentListeners, type, listener),
    removeEventListener: (type: string, listener: NativeListener): void => {
      this.documentListeners.get(type)?.delete(listener);
    },
  };

  addEventListener(type: string, listener: NativeListener): void {
    this.add(this.pageListeners, type, listener);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.pageListeners.get(type)?.delete(listener);
  }

  private add(entries: Map<string, Set<NativeListener>>, type: string, listener: NativeListener): void {
    const listeners = entries.get(type) ?? new Set();
    listeners.add(listener);
    entries.set(type, listeners);
  }
}

const transcript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "pwa-room",
  seed: "pwa",
  controller: [],
  ticks: [],
  heatRows: [],
};

function options(root: NativeRoot, mount: { innerHTML: string }) {
  return {
    root,
    mount,
    transcript,
    channelName: "zeta-pwa-tabs",
    nodeId: "pwa-node",
    tabId: "pwa-tab",
    initialSequence: 1,
    maxTrackedTabs: 4,
    maxFeedback: 8,
    capabilities: ["javascript", "service-worker", "broadcast-channel"] as const,
    checkpoint: "durable" as const,
    serviceWorker: { scriptUrl: "./sw.js", scope: "./" },
  };
}

describe("Dark Hall browser PWA bootstrap", () => {
  test("establishes worker control before starting the room", async () => {
    NativeBroadcastChannel.instances = [];
    const root = new NativeRoot();
    const mount = { innerHTML: "" };
    const result = await startNativeDarkHallPwa(options(root, mount));

    expect(result).toMatchObject({
      ok: true,
      value: {
        registration: { status: "controlled" },
        browser: { transport: { selected: "service-worker" } },
      },
    });
    expect(mount.innerHTML).toContain('data-browser-transport="service-worker"');
    expect(NativeBroadcastChannel.instances).toEqual([]);
    if (result.ok) expect(result.value.browser.host.stop().ok).toBe(true);
  });

  test("falls back to BroadcastChannel when registration is refused", async () => {
    NativeBroadcastChannel.instances = [];
    const root = new NativeRoot();
    root.serviceWorker.controller = null;
    root.serviceWorker.rejectRegistration = true;
    const mount = { innerHTML: "" };
    const result = await startNativeDarkHallPwa(options(root, mount));

    expect(result).toMatchObject({
      ok: true,
      value: {
        registration: {
          status: "fallback",
          feedback: { code: "service-worker-registration-failed" },
        },
        browser: {
          transport: {
            selected: "broadcast-channel",
            attempts: [
              { feedback: { code: "service-worker-controller-missing" } },
              { kind: "broadcast-channel", status: "selected" },
            ],
          },
        },
      },
    });
    expect(mount.innerHTML).toContain('data-browser-transport="broadcast-channel"');
    expect(NativeBroadcastChannel.instances).toHaveLength(1);
    if (result.ok) expect(result.value.browser.host.stop().ok).toBe(true);
  });
});
