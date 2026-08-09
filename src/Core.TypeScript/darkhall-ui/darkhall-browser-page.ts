import { probeBrowserRuntime, type BrowserRuntimeProbeReadout } from "../browser-node/browser-runtime-probe";
import type { BrowserLifecycleHostReadout } from "../browser-node/browser-lifecycle-host";
import type { BrowserServiceWorkerRegistrationReadout } from "../browser-node/browser-service-worker-registration";
import type { BrowserTabTransportReadout } from "../browser-node/browser-tab-channel-selector";
import {
  startNativeDarkHallPwa,
  type DarkHallBrowserPwaOptions,
  type DarkHallBrowserPwaRuntime,
} from "./darkhall-browser-pwa";
import { renderDarkHallRoomHtml, type RoomRunTranscript } from "./darkhall-room";

export const DARK_HALL_BROWSER_PAGE_SCHEMA = "zeta.darkhall.browser-page.v1" as const;
export const DARK_HALL_BROWSER_PAGE_GLOBAL = "__zetaDarkHallPage" as const;
export const DARK_HALL_BROWSER_PAGE_MOUNT_ID = "darkhall-room" as const;

export type DarkHallBrowserPageStatus = "starting" | "live" | "stopped";

export interface DarkHallBrowserPageFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "page-root-invalid"
    | "page-document-unavailable"
    | "page-mount-unavailable"
    | "page-location-unavailable"
    | "page-identity-unavailable"
    | "page-configuration-invalid"
    | "page-status-update-failed"
    | "page-start-failed"
    | "page-stop-failed";
  readonly detail: string;
}

export type DarkHallBrowserPageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserPageFeedback };

export interface DarkHallBrowserPageReadout {
  readonly schema: typeof DARK_HALL_BROWSER_PAGE_SCHEMA;
  readonly status: DarkHallBrowserPageStatus;
  readonly nodeId: string;
  readonly tabId: string;
  readonly runtime: BrowserRuntimeProbeReadout;
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly transport: BrowserTabTransportReadout;
  readonly host: BrowserLifecycleHostReadout;
}

export interface DarkHallBrowserPageRuntime {
  read(): DarkHallBrowserPageReadout;
  stop(): DarkHallBrowserPageResult<DarkHallBrowserPageReadout>;
}

export interface NativeDarkHallBrowserPageOptions {
  readonly root?: unknown;
  readonly mountId?: string;
  readonly transcript?: RoomRunTranscript;
  readonly nodeId?: string;
  readonly channelName?: string;
  readonly serviceWorkerScriptUrl?: string;
  readonly serviceWorkerScope?: string;
  readonly maxTrackedTabs?: number;
  readonly maxFeedback?: number;
}

interface NativePageMount {
  readonly value: unknown;
  setStatus(status: DarkHallBrowserPageStatus | "backpressured" | "heat", detail?: string): boolean;
  setAttribute(name: string, value: string): boolean;
}

interface NativePageContext {
  readonly mount: NativePageMount;
  readonly parameters: URLSearchParams;
  readonly mintTabId: () => string | null;
}

export const DARK_HALL_BROWSER_PAGE_TRANSCRIPT: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "dark hall browser node",
  seed: "browser-page-v1",
  generatedBy: "darkhall-browser-page",
  controller: [
    { cell: 0, label: "observe", actionId: "darkhall.observe", actionClass: "read", selected: true },
    { cell: 1, label: "choose", actionId: "darkhall.choose", actionClass: "decide" },
    { cell: 2, label: "execute", actionId: "darkhall.execute", actionClass: "act" },
    { cell: 3, label: "measure", actionId: "darkhall.measure", actionClass: "commit" },
    { cell: 8, label: "emit", actionId: "darkhall.emit", actionClass: "plus" },
    { cell: 9, label: "retract", actionId: "darkhall.retract", actionClass: "minus" },
    { cell: 12, label: "checkpoint", actionId: "darkhall.checkpoint", actionClass: "harden" },
  ],
  ticks: [
    {
      tick: 0,
      phase: "observe",
      event: "await browser lifecycle evidence",
      outcome: "ok",
    },
  ],
  heatRows: [],
};

function succeeded<T>(value: T): DarkHallBrowserPageResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserPageFeedback["code"],
  detail: string,
  severity: DarkHallBrowserPageFeedback["severity"] = "heat",
): DarkHallBrowserPageResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function method(value: unknown, name: string): ((...arguments_: readonly unknown[]) => unknown) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...arguments_: readonly unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

function nativePageContext(root: unknown, mountId: string): DarkHallBrowserPageResult<NativePageContext> {
  if (!isRecord(root)) return failed("page-root-invalid", "The active browser page requires an object-like host.");

  let documentValue: unknown;
  let locationValue: unknown;
  let cryptoValue: unknown;
  try {
    documentValue = Reflect.get(root, "document");
    locationValue = Reflect.get(root, "location");
    cryptoValue = Reflect.get(root, "crypto");
  } catch {
    return failed("page-root-invalid", "The browser blocked inspection of the active page host.");
  }

  const getElementById = method(documentValue, "getElementById");
  if (getElementById === null) {
    return failed("page-document-unavailable", "The active browser page does not expose document.getElementById.");
  }

  let mountValue: unknown;
  try {
    mountValue = Reflect.apply(getElementById, documentValue, [mountId]);
  } catch {
    return failed("page-document-unavailable", "The browser threw while locating the active room mount.");
  }
  const setAttribute = method(mountValue, "setAttribute");
  const removeAttribute = method(mountValue, "removeAttribute");
  if (
    !isRecord(mountValue) ||
    !Reflect.has(mountValue, "innerHTML") ||
    setAttribute === null ||
    removeAttribute === null
  ) {
    return failed("page-mount-unavailable", `The active browser page is missing mount #${mountId}.`);
  }

  let search: unknown;
  try {
    search = isRecord(locationValue) ? Reflect.get(locationValue, "search") : undefined;
  } catch {
    return failed("page-location-unavailable", "The browser blocked inspection of the active page URL.");
  }
  if (typeof search !== "string") {
    return failed("page-location-unavailable", "The active browser page does not expose a URL query string.");
  }

  const randomUuid = method(cryptoValue, "randomUUID");
  const mount: NativePageMount = {
    value: mountValue,
    setAttribute: (name, value) => {
      try {
        Reflect.apply(setAttribute, mountValue, [name, value]);
        return true;
      } catch {
        return false;
      }
    },
    setStatus: (status, detail) => {
      try {
        Reflect.apply(setAttribute, mountValue, ["data-pwa-status", status]);
        if (detail === undefined) Reflect.apply(removeAttribute, mountValue, ["data-pwa-detail"]);
        else Reflect.apply(setAttribute, mountValue, ["data-pwa-detail", detail]);
        return true;
      } catch {
        return false;
      }
    },
  };

  return succeeded({
    mount,
    parameters: new URLSearchParams(search),
    mintTabId: () => {
      if (randomUuid === null) return null;
      try {
        const value = Reflect.apply(randomUuid, cryptoValue, []);
        return typeof value === "string" && value.length > 0 ? `tab-${value}` : null;
      } catch {
        return null;
      }
    },
  });
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) return true;
  }
  return false;
}

function identifier(value: string | null, fallback: string): DarkHallBrowserPageResult<string> {
  const selected = value ?? fallback;
  if (selected.length === 0 || selected.length > 256 || hasControlCharacter(selected)) {
    return failed("page-configuration-invalid", "Browser page identifiers must contain 1 to 256 printable characters.");
  }
  return succeeded(selected);
}

function initialSequence(value: string | null): DarkHallBrowserPageResult<number> {
  if (value === null) return succeeded(0);
  const sequence = Number(value);
  return Number.isSafeInteger(sequence) && sequence >= 0
    ? succeeded(sequence)
    : failed("page-configuration-invalid", "The browser page sequence must be a non-negative safe integer.");
}

function pageStatusFromSeverity(severity: DarkHallBrowserPageFeedback["severity"]): "backpressured" | "heat" {
  return severity === "backpressure" ? "backpressured" : "heat";
}

function pwaOptions(
  options: NativeDarkHallBrowserPageOptions,
  root: unknown,
  context: NativePageContext,
  runtime: BrowserRuntimeProbeReadout,
  nodeId: string,
  tabId: string,
  sequence: number,
): DarkHallBrowserPwaOptions {
  const scope = options.serviceWorkerScope ?? "./";
  return {
    root,
    mount: context.mount.value,
    transcript: options.transcript ?? DARK_HALL_BROWSER_PAGE_TRANSCRIPT,
    channelName: options.channelName ?? "zeta-darkhall-browser-page",
    nodeId,
    tabId,
    initialSequence: sequence,
    maxTrackedTabs: options.maxTrackedTabs ?? 32,
    maxFeedback: options.maxFeedback ?? 32,
    capabilities: runtime.capabilities,
    checkpoint: "none",
    serviceWorker: {
      scriptUrl: options.serviceWorkerScriptUrl ?? "./sw.js",
      scope,
    },
  };
}

/** Start only from the explicit active page; the standing room never imports this module. */
export async function startNativeDarkHallBrowserPage(
  options: NativeDarkHallBrowserPageOptions = {},
): Promise<DarkHallBrowserPageResult<DarkHallBrowserPageRuntime>> {
  const root = options.root ?? globalThis;
  const contextResult = nativePageContext(root, options.mountId ?? DARK_HALL_BROWSER_PAGE_MOUNT_ID);
  if (!contextResult.ok) return contextResult;
  const context = contextResult.value;

  const nodeId = identifier(context.parameters.get("node"), options.nodeId ?? "zeta-darkhall-browser-node");
  if (!nodeId.ok) return nodeId;
  const explicitTabId = context.parameters.get("tab");
  const mintedTabId = explicitTabId ?? context.mintTabId();
  if (mintedTabId === null) {
    return failed(
      "page-identity-unavailable",
      "The active browser page needs an explicit tab query parameter or crypto.randomUUID.",
      "backpressure",
    );
  }
  const tabId = identifier(mintedTabId, "");
  if (!tabId.ok) return tabId;
  const sequence = initialSequence(context.parameters.get("sequence"));
  if (!sequence.ok) return sequence;

  if (!context.mount.setStatus("starting")) {
    return failed("page-status-update-failed", "The browser refused the active page startup readout.");
  }

  const runtimeProbe = probeBrowserRuntime(root);
  let pwaResult;
  try {
    pwaResult = await startNativeDarkHallPwa(
      pwaOptions(options, root, context, runtimeProbe, nodeId.value, tabId.value, sequence.value),
    );
  } catch {
    context.mount.setStatus("heat", "page-start-threw");
    return failed("page-start-failed", "The active browser page threw while starting its PWA runtime.");
  }
  if (!pwaResult.ok) {
    context.mount.setStatus(pageStatusFromSeverity(pwaResult.feedback.severity), pwaResult.feedback.code);
    return failed(
      "page-start-failed",
      `${pwaResult.feedback.code}: ${pwaResult.feedback.detail}`,
      pwaResult.feedback.severity,
    );
  }

  const pwa: DarkHallBrowserPwaRuntime = pwaResult.value;
  let status: DarkHallBrowserPageStatus = "live";
  if (
    !context.mount.setStatus("live") ||
    !context.mount.setAttribute("data-pwa-registration", pwa.registration.status) ||
    !context.mount.setAttribute("data-browser-transport", pwa.browser.transport.selected) ||
    !context.mount.setAttribute("data-browser-tab", tabId.value)
  ) {
    pwa.browser.host.stop();
    return failed("page-status-update-failed", "The browser refused the active page live readout.");
  }

  const read = (): DarkHallBrowserPageReadout => ({
    schema: DARK_HALL_BROWSER_PAGE_SCHEMA,
    status,
    nodeId: nodeId.value,
    tabId: tabId.value,
    runtime: runtimeProbe,
    registration: pwa.registration,
    transport: pwa.browser.transport,
    host: pwa.browser.host.read(),
  });

  return succeeded({
    read,
    stop: () => {
      const stopped = pwa.browser.host.stop();
      if (!stopped.ok) {
        context.mount.setStatus(pageStatusFromSeverity(stopped.feedback.severity), stopped.feedback.code);
        return failed(
          "page-stop-failed",
          `${stopped.feedback.code}: ${stopped.feedback.detail}`,
          stopped.feedback.severity,
        );
      }
      status = "stopped";
      if (!context.mount.setStatus("stopped")) {
        return failed("page-status-update-failed", "The browser refused the active page stopped readout.");
      }
      return succeeded(read());
    },
  });
}

export function renderDarkHallBrowserNodeDocument(): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="theme-color" content="#11110f">',
    "<title>Zeta - Dark Hall Browser Node</title>",
    '<link rel="manifest" href="./manifest.webmanifest">',
    '<link rel="stylesheet" href="./room.css">',
    "</head>",
    '<body data-browser-page="active">',
    '<nav class="zeta-room-nav"><a href="./">&larr; static room</a><span>active browser node</span></nav>',
    `<main id="${DARK_HALL_BROWSER_PAGE_MOUNT_ID}" data-pwa-status="starting" aria-live="polite">`,
    renderDarkHallRoomHtml(DARK_HALL_BROWSER_PAGE_TRANSCRIPT),
    "</main>",
    '<noscript><nav class="zeta-room-nav"><a href="./">static room</a></nav></noscript>',
    '<script type="module" src="./darkhall-browser-page.js"></script>',
    "</body>",
    "</html>",
  ].join("\n");
}
