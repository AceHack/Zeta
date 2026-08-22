import { describe, expect, test } from "bun:test";
import {
  BROWSER_TAB_TRANSPORT_READOUT_SCHEMA,
  injectedBrowserTabChannelSelection,
  selectNativeBrowserTabChannel,
} from "./browser-tab-channel-selector";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
  type BrowserTabChannel,
  type BrowserTabChannelMessage,
} from "./browser-tab-coordinator";

type NativeListener = (event: { readonly data?: unknown }) => void;

class NativeBroadcastChannel {
  static instances: NativeBroadcastChannel[] = [];

  readonly messages: unknown[] = [];
  readonly listeners = new Set<NativeListener>();
  closed = false;

  readonly name: string;

  constructor(name: string) {
    this.name = name;
    NativeBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  addEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.delete(listener);
  }

  close(): void {
    this.closed = true;
  }
}

class NativeServiceWorkerContainer {
  readonly posted: unknown[] = [];
  readonly listeners = new Set<NativeListener>();
  controller: { readonly postMessage: (message: unknown) => void } | null = {
    postMessage: (message): void => {
      this.posted.push(message);
    },
  };

  addEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: NativeListener): void {
    this.listeners.delete(listener);
  }
}

function message(): BrowserTabChannelMessage {
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeId: "darkhall",
    kind: "probe",
    requesterTabId: "tab-a",
    sequence: 1,
  };
}

describe("native browser tab channel selection", () => {
  test("prefers an already controlling service worker", () => {
    NativeBroadcastChannel.instances = [];
    const worker = new NativeServiceWorkerContainer();
    const result = selectNativeBrowserTabChannel(
      { navigator: { serviceWorker: worker }, BroadcastChannel: NativeBroadcastChannel },
      "zeta-tabs",
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        readout: {
          schema: BROWSER_TAB_TRANSPORT_READOUT_SCHEMA,
          selected: "service-worker",
          attempts: [{ kind: "service-worker", status: "selected" }],
        },
      },
    });
    if (!result.ok) return;
    expect(result.value.channel.publish(message()).ok).toBe(true);
    expect(worker.posted).toEqual([message()]);
    expect(NativeBroadcastChannel.instances).toEqual([]);
  });

  test("falls back to BroadcastChannel and retains the worker refusal", () => {
    NativeBroadcastChannel.instances = [];
    const worker = new NativeServiceWorkerContainer();
    worker.controller = null;
    const result = selectNativeBrowserTabChannel(
      { navigator: { serviceWorker: worker }, BroadcastChannel: NativeBroadcastChannel },
      "zeta-tabs",
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        readout: {
          selected: "broadcast-channel",
          attempts: [
            {
              kind: "service-worker",
              status: "refused",
              feedback: { code: "service-worker-controller-missing", severity: "backpressure" },
            },
            { kind: "broadcast-channel", status: "selected" },
          ],
        },
      },
    });
    expect(NativeBroadcastChannel.instances).toHaveLength(1);
  });

  test("returns both typed refusals when no native transport can start", () => {
    const result = selectNativeBrowserTabChannel({}, "zeta-tabs");

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        code: "browser-tab-transport-unavailable",
        severity: "backpressure",
        attempts: [
          { kind: "service-worker", feedback: { code: "service-worker-unavailable" } },
          { kind: "broadcast-channel", feedback: { code: "broadcast-channel-unavailable" } },
        ],
      },
    });
  });

  test("marks caller-owned channels as injected without probing native APIs", () => {
    const channel: BrowserTabChannel = {
      publish: () => ({ ok: true, value: null }),
      subscribe: () => ({ ok: true, value: { unsubscribe: () => ({ ok: true, value: null }) } }),
      close: () => ({ ok: true, value: null }),
    };

    expect(injectedBrowserTabChannelSelection(channel)).toEqual({
      channel,
      readout: {
        schema: BROWSER_TAB_TRANSPORT_READOUT_SCHEMA,
        selected: "injected",
        attempts: [{ kind: "injected", status: "selected" }],
      },
    });
  });
});
