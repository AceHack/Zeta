import {
  prepareNativeServiceWorkerControl,
  type BrowserServiceWorkerRegistrationReadout,
  type NativeServiceWorkerRegistrationOptions,
} from "../browser-node/browser-service-worker-registration";
import {
  startNativeDarkHallBrowser,
  type DarkHallBrowserBootstrapFeedback,
  type DarkHallBrowserBootstrapOptions,
  type DarkHallBrowserRuntime,
} from "./darkhall-browser-bootstrap";
import type { BrowserCheckpointPort } from "../browser-node/browser-checkpoint-port";
import {
  startDurableDarkHallBrowser,
  startNativeDurableDarkHallBrowser,
  type DarkHallBrowserDurableFeedback,
  type DarkHallBrowserDurableOptions,
  type DarkHallBrowserDurableRuntime,
  type NativeDarkHallBrowserDurableOptions,
} from "./darkhall-browser-durable-runtime";

export {
  createNativeBrowserDatabaseReceiptBroadcastReceiver,
  createNativeBrowserDatabaseReceiptBroadcastTransport,
  type BrowserDatabaseReceiptBroadcastReadout,
  type BrowserDatabaseReceiptBroadcastReceiverHost,
  type BrowserDatabaseReceiptBroadcastTransport,
} from "../browser-node/browser-database-receipt-broadcast-channel";

export {
  createNativeBrowserDatabaseReceiptBroadcastPeerLink,
  type BrowserDatabaseReceiptBroadcastPeerLinkReadout,
  type BrowserDatabaseReceiptBroadcastPeerLinkRuntime,
} from "../browser-node/browser-database-receipt-broadcast-peer-link";

export const DARK_HALL_BROWSER_PWA_SCHEMA = "zeta.darkhall.browser-pwa.v1" as const;
export const DARK_HALL_BROWSER_DURABLE_PWA_SCHEMA = "zeta.darkhall.browser-durable-pwa.v1" as const;

export interface DarkHallBrowserPwaOptions extends DarkHallBrowserBootstrapOptions {
  readonly serviceWorker: NativeServiceWorkerRegistrationOptions;
}

export interface DarkHallBrowserDurablePwaOptions extends DarkHallBrowserDurableOptions {
  readonly serviceWorker: NativeServiceWorkerRegistrationOptions;
}

export interface NativeDarkHallBrowserDurablePwaOptions extends NativeDarkHallBrowserDurableOptions {
  readonly serviceWorker: NativeServiceWorkerRegistrationOptions;
}

export interface DarkHallBrowserPwaRuntime {
  readonly schema: typeof DARK_HALL_BROWSER_PWA_SCHEMA;
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly browser: DarkHallBrowserRuntime;
}

export interface DarkHallBrowserDurablePwaRuntime {
  readonly schema: typeof DARK_HALL_BROWSER_DURABLE_PWA_SCHEMA;
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly browser: DarkHallBrowserDurableRuntime;
}

export type DarkHallBrowserPwaResult =
  | { readonly ok: true; readonly value: DarkHallBrowserPwaRuntime }
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback };

export type DarkHallBrowserDurablePwaResult =
  | { readonly ok: true; readonly value: DarkHallBrowserDurablePwaRuntime }
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback | DarkHallBrowserDurableFeedback };

async function preparePwaRegistration(
  root: unknown,
  serviceWorker: NativeServiceWorkerRegistrationOptions,
): Promise<
  | { readonly ok: true; readonly value: BrowserServiceWorkerRegistrationReadout }
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback }
> {
  const registration = await prepareNativeServiceWorkerControl(root, serviceWorker);
  if (registration.ok) return registration;
  return {
    ok: false,
    feedback: {
      severity: registration.feedback.severity,
      code: "channel-start-failed",
      detail: `${registration.feedback.code}: ${registration.feedback.detail}`,
      cleanup: [],
    },
  };
}

/** Establish worker control first, then start the room over worker or explicit fallback. */
export async function startNativeDarkHallPwa(options: DarkHallBrowserPwaOptions): Promise<DarkHallBrowserPwaResult> {
  const { serviceWorker, root: suppliedRoot, ...browserOptions } = options;
  const root = suppliedRoot === undefined ? globalThis : suppliedRoot;
  const registration = await preparePwaRegistration(root, serviceWorker);
  if (!registration.ok) return registration;

  const browser = startNativeDarkHallBrowser({ ...browserOptions, root });
  if (!browser.ok) return browser;
  return {
    ok: true,
    value: {
      schema: DARK_HALL_BROWSER_PWA_SCHEMA,
      registration: registration.value,
      browser: browser.value,
    },
  };
}

/** Establish worker control, then compose the room with an injected checkpoint port. */
export async function startDurableDarkHallPwa(
  options: DarkHallBrowserDurablePwaOptions,
  checkpointPort: BrowserCheckpointPort,
): Promise<DarkHallBrowserDurablePwaResult> {
  const { serviceWorker, root: suppliedRoot, ...browserOptions } = options;
  const root = suppliedRoot === undefined ? globalThis : suppliedRoot;
  const registration = await preparePwaRegistration(root, serviceWorker);
  if (!registration.ok) {
    try {
      const closed = checkpointPort.close();
      return closed.ok
        ? registration
        : {
            ...registration,
            feedback: {
              ...registration.feedback,
              cleanup: [`${closed.feedback.code}: ${closed.feedback.detail}`],
            },
          };
    } catch {
      return {
        ...registration,
        feedback: {
          ...registration.feedback,
          cleanup: ["checkpoint-close-failed: The injected checkpoint port threw while cleaning up startup."],
        },
      };
    }
  }

  const browser = await startDurableDarkHallBrowser({ ...browserOptions, root }, checkpointPort);
  return browser.ok
    ? {
        ok: true,
        value: {
          schema: DARK_HALL_BROWSER_DURABLE_PWA_SCHEMA,
          registration: registration.value,
          browser: browser.value,
        },
      }
    : browser;
}

/** Establish worker control, open IndexedDB, and start the durable room. */
export async function startNativeDurableDarkHallPwa(
  options: NativeDarkHallBrowserDurablePwaOptions,
): Promise<DarkHallBrowserDurablePwaResult> {
  const { serviceWorker, root: suppliedRoot, ...browserOptions } = options;
  const root = suppliedRoot === undefined ? globalThis : suppliedRoot;
  const registration = await preparePwaRegistration(root, serviceWorker);
  if (!registration.ok) return registration;

  const browser = await startNativeDurableDarkHallBrowser({ ...browserOptions, root });
  return browser.ok
    ? {
        ok: true,
        value: {
          schema: DARK_HALL_BROWSER_DURABLE_PWA_SCHEMA,
          registration: registration.value,
          browser: browser.value,
        },
      }
    : browser;
}
