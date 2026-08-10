import { describe, expect, test } from "bun:test";
import { BROWSER_TAB_COORDINATOR_SCHEMA, type BrowserTabChannelMessage } from "../browser-node/browser-tab-coordinator";
import { SLOT } from "../observe/grammar-16";
import type { ZetaDbTickReadout, ZetaDbTickRequest } from "../zetadb/zeta-db-node";
import {
  DARK_HALL_BROWSER_PAGE_SCHEMA,
  renderDarkHallBrowserNodeDocument,
  startNativeDarkHallBrowserPage,
} from "./darkhall-browser-page";
import { DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA } from "./darkhall-browser-controller-input";

type NativeListener = (event?: unknown) => void;

class NativeMount {
  innerHTML = "standing room";
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<NativeListener>>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
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
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class NativeControllerCell {
  readonly cell: number;

  constructor(cell: number) {
    this.cell = cell;
  }

  closest(selector: string): NativeControllerCell | null {
    return selector === "[data-controller-cell]" ? this : null;
  }

  getAttribute(name: string): string | null {
    return name === "data-controller-cell" ? this.cell.toString() : null;
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

  dispatch(message: BrowserTabChannelMessage): void {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: message });
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

  emitDocument(type: string, event: unknown): void {
    for (const listener of this.documentListeners.get(type) ?? []) listener(event);
  }

  private add(entries: Map<string, Set<NativeListener>>, type: string, listener: NativeListener): void {
    const listeners = entries.get(type) ?? new Set();
    listeners.add(listener);
    entries.set(type, listeners);
  }
}

function databaseReadout(
  request: ZetaDbTickRequest,
  revision = request.deltas.length > 0 ? 8 : 7,
  payload = request.deltas.length > 0 ? "9001" : "9000",
): ZetaDbTickReadout {
  return {
    schema: "zeta.db.tick.v1",
    nodeId: request.nodeId,
    executorId: request.executorId,
    executorKind: request.executorKind,
    revision,
    admission: "complete",
    accepted: request.deltas.length,
    duplicates: 0,
    nextDeltaIndex: request.deltas.length,
    rows: [{ rowKey: "game/score", payload, weight: 1 }],
    feedback: [],
  };
}

function databaseExecutor(
  request: ZetaDbTickRequest,
): Promise<{ readonly ok: true; readonly value: ZetaDbTickReadout }> {
  return Promise.resolve({ ok: true, value: databaseReadout(request) });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for the browser page readout.");
}

describe("Dark Hall active browser page", () => {
  test("hydrates before live, publishes bounded writes, and projects the database readout", async () => {
    const root = new NativeBrowserRoot();
    const requests: ZetaDbTickRequest[] = [];
    const started = await startNativeDarkHallBrowserPage({
      root,
      databaseExecutor: (request) => {
        requests.push(request);
        return databaseExecutor(request);
      },
    });

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
      database: {
        nodeId: "zeta-darkhall-browser-node:database",
        executorId: "tab-a",
        revision: 7,
        accepted: 0,
        rows: [{ rowKey: "game/score", payload: "9000", weight: 1 }],
      },
      controller: null,
      input: {
        schema: DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA,
        status: "live",
        accepted: 0,
        refused: 0,
        backpressured: 0,
        last: null,
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      nodeId: "zeta-darkhall-browser-node:database",
      executorId: "tab-a",
      executorKind: "browser-tab",
      deltas: [],
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
    expect(root.mount.innerHTML).toContain('data-database-revision="7"');
    expect(root.mount.innerHTML).toContain("game/score");
    expect(root.mount.attributes.get("data-controller-input-status")).toBe("live");
    expect(root.mount.attributes.get("data-controller-input-source")).toBe("none");

    root.mount.emit("click", {
      button: 0,
      detail: 1,
      target: new NativeControllerCell(SLOT.INSPECT),
      preventDefault: () => undefined,
    });
    await waitFor(() => started.value.read().input.accepted === 1);
    root.emitDocument("keydown", {
      code: "KeyC",
      target: { tagName: "DIV" },
      preventDefault: () => undefined,
    });
    await waitFor(() => started.value.read().input.accepted === 2);
    expect(started.value.read().input.last).toMatchObject({
      source: "keyboard",
      cell: SLOT.REFRESH,
      actionId: "darkhall.database.refresh",
      outcome: "accepted",
    });
    expect(root.mount.attributes.get("data-controller-input-cell")).toBe(SLOT.REFRESH.toString());
    expect(root.mount.attributes.get("data-controller-input-outcome")).toBe("accepted");
    expect(requests).toHaveLength(3);

    expect(
      await started.value.dispatchController({
        kind: "emit",
        eventId: "score-9001",
        rowKey: "game/score",
        payload: "9001",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        kind: "emit",
        cell: SLOT.ACCEPT,
        actionId: "darkhall.database.emit",
        signedWeight: 1,
        database: { revision: 8, accepted: 1 },
      },
    });
    expect(started.value.read().database).toMatchObject({ revision: 8, accepted: 1 });
    expect(started.value.read().controller).toMatchObject({ kind: "emit", cell: SLOT.ACCEPT, signedWeight: 1 });
    expect(root.mount.attributes.get("data-controller-cell")).toBe(SLOT.ACCEPT.toString());
    expect(root.mount.innerHTML).toContain(`data-cell="${SLOT.ACCEPT.toString()}"`);
    expect(root.mount.innerHTML).toContain('data-selected="true"');
    expect(root.serviceWorker.messages).toContainEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "database-invalidated",
      invalidation: {
        sourceTabId: "tab-a",
        databaseNodeId: "zeta-darkhall-browser-node:database",
        revision: 8,
      },
    });

    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("stopped");
    expect(root.mount.attributes.get("data-controller-input-status")).toBe("stopped");
    expect(root.mount.listeners.get("click")?.size ?? 0).toBe(0);
    expect(root.documentListeners.get("keydown")?.size ?? 0).toBe(0);
  });

  test("mints a per-tab identity when the active URL does not provide one", async () => {
    const root = new NativeBrowserRoot();
    root.location.search = "";
    const started = await startNativeDarkHallBrowserPage({ root, databaseExecutor });

    expect(started).toMatchObject({ ok: true, value: {} });
    if (started.ok) {
      expect(started.value.read().tabId).toBe("tab-minted-tab");
      expect(started.value.stop().ok).toBe(true);
    }
  });

  test("refuses live status when the finite database hydration is backpressured", async () => {
    const root = new NativeBrowserRoot();
    const result = await startNativeDarkHallBrowserPage({
      root,
      databaseExecutor: () =>
        Promise.resolve({
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "database-read-failed",
            detail: "The persisted image is temporarily unavailable.",
          },
        }),
    });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "page-database-hydration-failed",
      },
    });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("backpressured");
    expect(root.mount.attributes.get("data-pwa-detail")).toBe("page-database-hydration-failed");
  });

  test("drains a peer invalidation queued while startup hydration is still running", async () => {
    const root = new NativeBrowserRoot();
    const requests: ZetaDbTickRequest[] = [];
    const hydrationGate: { release?: () => void } = {};
    const starting = startNativeDarkHallBrowserPage({
      root,
      databaseExecutor: (request) => {
        requests.push(request);
        if (requests.length > 1) {
          return Promise.resolve({ ok: true, value: databaseReadout(request, 9, "9010") });
        }
        return new Promise((resolve) => {
          hydrationGate.release = () => resolve({ ok: true, value: databaseReadout(request) });
        });
      },
    });
    while (hydrationGate.release === undefined) await Promise.resolve();

    root.serviceWorker.dispatch({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "database-invalidated",
      invalidation: {
        sourceTabId: "tab-b",
        databaseNodeId: "zeta-darkhall-browser-node:database",
        revision: 9,
      },
    });
    hydrationGate.release?.();

    const started = await starting;
    expect(started).toMatchObject({ ok: true, value: {} });
    expect(requests).toHaveLength(2);
    expect(requests[1]?.deltas).toEqual([]);
    if (started.ok) {
      expect(started.value.read()).toMatchObject({
        status: "live",
        database: { revision: 9, executorId: "tab-a", rows: [{ payload: "9010" }] },
      });
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

  test("renders database actions in the canonical universal controller slots", () => {
    const document = renderDarkHallBrowserNodeDocument();

    expect(document).toContain(`data-cell="${SLOT.ACCEPT.toString()}"`);
    expect(document).toContain("darkhall.database.emit");
    expect(document).toContain(`data-cell="${SLOT.INSPECT.toString()}"`);
    expect(document).toContain("darkhall.database.inspect");
    expect(document).toContain(`data-cell="${SLOT.UNDO_RETRACT.toString()}"`);
    expect(document).toContain("darkhall.database.retract");
    expect(document).toContain(`data-cell="${SLOT.REFRESH.toString()}"`);
    expect(document).toContain("darkhall.database.refresh");
    expect(document).toContain('class="zeta-room-cell-input"');
    expect(document).toContain('data-controller-cell="6"');
    expect(document).toContain('aria-keyshortcuts="C"');
  });
});
