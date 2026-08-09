import { describe, expect, test } from "bun:test";
import { BROWSER_TAB_COORDINATOR_SCHEMA, type BrowserTabChannelMessage } from "../browser-node/browser-tab-coordinator";
import {
  DARK_HALL_BROWSER_PAGE_SCHEMA,
  renderDarkHallBrowserNodeDocument,
  startNativeDarkHallBrowserPage,
} from "./darkhall-browser-page";

type NativeListener = (event?: unknown) => void;

class NativeMount {
  innerHTML = "standing room";
  readonly attributes = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

class NativeServiceWorkerContainer {
  readonly messages: BrowserTabChannelMessage[] = [];
  readonly listeners = new Map<string, Set<NativeListener>>();
  readonly controller = {
    postMessage: (message: BrowserTabChannelMessage): void => {
      this.messages.push(message);
    },
  };
  readonly ready = Promise.resolve({ active: true });
  readonly registrations: { readonly scriptUrl: string; readonly options: unknown }[] = [];

  register(scriptUrl: string, options: unknown): Promise<unknown> {
    this.registrations.push({ scriptUrl, options });
    return Promise.resolve({ active: true });
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

class NativeBrowserRoot {
  readonly mount = new NativeMount();
  readonly serviceWorker = new NativeServiceWorkerContainer();
  readonly navigator = { serviceWorker: this.serviceWorker };
  readonly location = { search: "?tab=tab-a&sequence=12" };
  readonly crypto = { randomUUID: (): string => "minted-tab" };
  readonly documentListeners = new Map<string, Set<NativeListener>>();
  readonly pageListeners = new Map<string, Set<NativeListener>>();
  readonly document = {
    visibilityState: "visible",
    getElementById: (id: string): NativeMount | null => (id === "darkhall-room" ? this.mount : null),
    addEventListener: (type: string, listener: NativeListener): void => {
      this.add(this.documentListeners, type, listener);
    },
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

describe("Dark Hall active browser page", () => {
  test("owns explicit startup and projects its live worker-backed tab", async () => {
    const root = new NativeBrowserRoot();
    const started = await startNativeDarkHallBrowserPage({ root });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.read()).toMatchObject({
      schema: DARK_HALL_BROWSER_PAGE_SCHEMA,
      status: "live",
      nodeId: "zeta-darkhall-browser-node",
      tabId: "tab-a",
      registration: { status: "controlled" },
      transport: { selected: "service-worker" },
      host: { state: "foreground", stopped: false },
    });
    expect(root.serviceWorker.registrations).toHaveLength(1);
    expect(root.serviceWorker.messages.filter((message) => message.kind === "presence")).toContainEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "presence",
      presence: { tabId: "tab-a", sequence: 12, state: "foreground" },
    });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("live");
    expect(root.mount.attributes.get("data-pwa-registration")).toBe("controlled");
    expect(root.mount.attributes.get("data-browser-transport")).toBe("service-worker");
    expect(root.mount.attributes.get("data-browser-tab")).toBe("tab-a");
    expect(root.mount.innerHTML).toContain('data-browser-local-tab="tab-a"');

    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("stopped");
  });

  test("mints a per-tab identity when the active URL does not provide one", async () => {
    const root = new NativeBrowserRoot();
    root.location.search = "";
    const started = await startNativeDarkHallBrowserPage({ root });

    expect(started).toMatchObject({ ok: true, value: {} });
    if (started.ok) {
      expect(started.value.read().tabId).toBe("tab-minted-tab");
      expect(started.value.stop().ok).toBe(true);
    }
  });

  test("refuses invalid page configuration before registering a worker", async () => {
    const root = new NativeBrowserRoot();
    root.location.search = "?tab=tab-a&sequence=-1";

    const result = await startNativeDarkHallBrowserPage({ root });
    expect(result).toMatchObject({
      ok: false,
      feedback: { code: "page-configuration-invalid" },
    });
    expect(root.serviceWorker.registrations).toHaveLength(0);
    expect(root.mount.innerHTML).toBe("standing room");
  });

  test("refuses a missing mount without touching the worker edge", async () => {
    const root = new NativeBrowserRoot();

    const result = await startNativeDarkHallBrowserPage({ root, mountId: "missing" });
    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "page-mount-unavailable",
        detail: "The active browser page is missing mount #missing.",
      },
    });
    expect(root.serviceWorker.registrations).toHaveLength(0);
  });

  test("renders a manifest-owned active document with only an external module", () => {
    const document = renderDarkHallBrowserNodeDocument();

    expect(document).toContain('<link rel="manifest" href="./manifest.webmanifest">');
    expect(document).toContain('<main id="darkhall-room" data-pwa-status="starting"');
    expect(document).toContain('class="zeta-room-heat" data-empty="true"');
    expect(document).toContain('<p class="zeta-room-cold">cold</p>');
    expect(document).toContain('<script type="module" src="./darkhall-browser-page.js"></script>');
    expect(document).toContain('href="./">&larr; static room</a>');
    expect(document).not.toMatch(/<script(?! type="module" src="\.\/darkhall-browser-page\.js")/u);
    expect(document).not.toMatch(/setInterval|requestAnimationFrame|performance\.now|Date\./u);
  });
});
