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

export interface DarkHallBrowserPwaOptions extends DarkHallBrowserBootstrapOptions {
  readonly serviceWorker: NativeServiceWorkerRegistrationOptions;
}

export interface DarkHallBrowserPwaRuntime {
  readonly schema: typeof DARK_HALL_BROWSER_PWA_SCHEMA;
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly browser: DarkHallBrowserRuntime;
}

export type DarkHallBrowserPwaResult =
  | { readonly ok: true; readonly value: DarkHallBrowserPwaRuntime }
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback };

/** Establish worker control first, then start the room over worker or explicit fallback. */
export async function startNativeDarkHallPwa(options: DarkHallBrowserPwaOptions): Promise<DarkHallBrowserPwaResult> {
  const { serviceWorker, root: suppliedRoot, ...browserOptions } = options;
  const root = suppliedRoot === undefined ? globalThis : suppliedRoot;
  const registration = await prepareNativeServiceWorkerControl(root, serviceWorker);
  if (!registration.ok) {
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
