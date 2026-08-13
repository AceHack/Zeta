import {
  foldBrowserTabPresence,
  type BrowserTabPresence,
  type BrowserTabState,
} from "./browser-node";

export const BROWSER_DATABASE_RECEIPT_PEER_SELECTION_SCHEMA =
  "zeta.browser-database-receipt-peer-selection.v1" as const;

export interface BrowserDatabaseReceiptPeerSelectionOptions {
  readonly localPeerId: string;
  readonly maxTrackedTabs: number;
  readonly tabs: readonly BrowserTabPresence[];
}

export interface BrowserDatabaseReceiptPeerSelectionFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "receipt-peer-selection-configuration-invalid"
    | "receipt-peer-selection-presence-invalid"
    | "receipt-peer-selection-capacity-exhausted"
    | "receipt-peer-selection-local-peer-missing";
  readonly detail: string;
}

export interface BrowserDatabaseReceiptPeerSelectionReadout {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PEER_SELECTION_SCHEMA;
  readonly policy: "ordinal-successor";
  readonly status: "selected" | "alone" | "dormant";
  readonly localPeerId: string;
  readonly localState: BrowserTabState;
  readonly ringPeerIds: readonly string[];
  readonly selectedPeerId: string | null;
}

export type BrowserDatabaseReceiptPeerSelectionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptPeerSelectionFeedback };

const TAB_STATES: ReadonlySet<string> = new Set(["foreground", "background", "suspended", "dark"]);

function succeeded<T>(value: T): BrowserDatabaseReceiptPeerSelectionResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserDatabaseReceiptPeerSelectionFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptPeerSelectionFeedback["severity"] = "heat",
): BrowserDatabaseReceiptPeerSelectionResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isPresenceValid(presence: BrowserTabPresence): boolean {
  return (
    typeof presence.tabId === "string" &&
    presence.tabId.length > 0 &&
    Number.isSafeInteger(presence.sequence) &&
    presence.sequence >= 0 &&
    TAB_STATES.has(presence.state)
  );
}

function isActive(state: BrowserTabState): boolean {
  return state === "foreground" || state === "background";
}

/**
 * Select one live receipt peer from a bounded, converged tab snapshot.
 * Sorted ordinal successors form one deterministic ring without clocks or ambient entropy.
 */
export function selectBrowserDatabaseReceiptPeer(
  options: BrowserDatabaseReceiptPeerSelectionOptions,
): BrowserDatabaseReceiptPeerSelectionResult<BrowserDatabaseReceiptPeerSelectionReadout> {
  if (
    typeof options.localPeerId !== "string" ||
    options.localPeerId.length === 0 ||
    !Number.isSafeInteger(options.maxTrackedTabs) ||
    options.maxTrackedTabs < 1
  ) {
    return failed(
      "receipt-peer-selection-configuration-invalid",
      "Receipt peer selection requires a local peer identity and a positive safe tab capacity.",
    );
  }
  if (options.tabs.length > options.maxTrackedTabs) {
    return failed(
      "receipt-peer-selection-capacity-exhausted",
      `The receipt peer snapshot carried ${String(options.tabs.length)} tabs but the bounded capacity is ${String(options.maxTrackedTabs)}.`,
      "backpressure",
    );
  }
  if (!options.tabs.every(isPresenceValid)) {
    return failed(
      "receipt-peer-selection-presence-invalid",
      "A receipt peer presence entry carried an invalid identity, sequence, or state.",
    );
  }

  const tabs = foldBrowserTabPresence(options.tabs);
  const local = tabs.find((tab) => tab.tabId === options.localPeerId);
  if (local === undefined) {
    return failed(
      "receipt-peer-selection-local-peer-missing",
      "The bounded receipt peer snapshot did not contain the local peer identity.",
    );
  }

  const ringPeerIds = tabs.filter((tab) => isActive(tab.state)).map((tab) => tab.tabId);
  if (!isActive(local.state)) {
    return succeeded({
      schema: BROWSER_DATABASE_RECEIPT_PEER_SELECTION_SCHEMA,
      policy: "ordinal-successor",
      status: "dormant",
      localPeerId: options.localPeerId,
      localState: local.state,
      ringPeerIds,
      selectedPeerId: null,
    });
  }
  if (ringPeerIds.length === 1) {
    return succeeded({
      schema: BROWSER_DATABASE_RECEIPT_PEER_SELECTION_SCHEMA,
      policy: "ordinal-successor",
      status: "alone",
      localPeerId: options.localPeerId,
      localState: local.state,
      ringPeerIds,
      selectedPeerId: null,
    });
  }

  const localIndex = ringPeerIds.indexOf(options.localPeerId);
  const selectedPeerId = ringPeerIds[(localIndex + 1) % ringPeerIds.length] ?? null;
  return succeeded({
    schema: BROWSER_DATABASE_RECEIPT_PEER_SELECTION_SCHEMA,
    policy: "ordinal-successor",
    status: "selected",
    localPeerId: options.localPeerId,
    localState: local.state,
    ringPeerIds,
    selectedPeerId,
  });
}
