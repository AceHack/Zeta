import {
  createNativeBrowserDatabaseReceiptBroadcastPeerLink,
  type BrowserDatabaseReceiptBroadcastPeerLinkOptions,
  type BrowserDatabaseReceiptBroadcastPeerLinkReadout,
} from "./browser-database-receipt-broadcast-peer-link";
import type {
  BrowserDatabaseReceiptHandoffReadout,
  BrowserDatabaseReceiptHandoffResult,
} from "./browser-database-receipt-handoff";
import type {
  BrowserDatabaseReceiptPeerTransportFeedback,
  BrowserDatabaseReceiptPeerTransportResult,
} from "./browser-database-receipt-peer-exchange";
import {
  selectBrowserDatabaseReceiptPeer,
  type BrowserDatabaseReceiptPeerSelectionReadout,
} from "./browser-database-receipt-peer-selection";
import type { BrowserTabCoordinatorReadout } from "./browser-tab-coordinator";
import type { BrowserTabReadoutSink } from "./browser-lifecycle-host";

export const BROWSER_DATABASE_RECEIPT_PEER_HOST_SCHEMA = "zeta.browser-database-receipt-peer-host.v1" as const;

export interface BrowserDatabaseReceiptPeerLinkPort {
  readonly handoff: {
    handoff(): Promise<BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffReadout>>;
  };
  read(): Pick<BrowserDatabaseReceiptBroadcastPeerLinkReadout, "status" | "feedback">;
  close(): BrowserDatabaseReceiptPeerTransportResult<null>;
}

export interface BrowserDatabaseReceiptPeerLinkFactory {
  open(remotePeerId: string): BrowserDatabaseReceiptPeerTransportResult<BrowserDatabaseReceiptPeerLinkPort>;
}

export interface BrowserDatabaseReceiptPeerHostOptions {
  readonly nodeId: string;
  readonly localPeerId: string;
  readonly maxTrackedTabs: number;
}

export interface NativeBrowserDatabaseReceiptPeerHostOptions
  extends Omit<BrowserDatabaseReceiptBroadcastPeerLinkOptions, "remotePeerId">, BrowserDatabaseReceiptPeerHostOptions {}

export interface BrowserDatabaseReceiptPeerHostFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "receipt-peer-host-configuration-invalid"
    | "receipt-peer-host-readout-mismatch"
    | "receipt-peer-host-selection-failed"
    | "receipt-peer-host-link-open-failed"
    | "receipt-peer-host-link-close-failed"
    | "receipt-peer-host-link-read-failed"
    | "receipt-peer-host-handoff-failed"
    | "receipt-peer-host-closed";
  readonly detail: string;
  readonly causeCode?: string;
}

export type BrowserDatabaseReceiptPeerHostResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptPeerHostFeedback };

export interface BrowserDatabaseReceiptPeerHostReadout {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PEER_HOST_SCHEMA;
  readonly status: "idle" | "alone" | "dormant" | "linked" | "backpressured" | "heat" | "closed";
  readonly nodeId: string;
  readonly localPeerId: string;
  readonly activePeerId: string | null;
  readonly selection: BrowserDatabaseReceiptPeerSelectionReadout | null;
  readonly linkStatus: BrowserDatabaseReceiptBroadcastPeerLinkReadout["status"] | null;
  readonly feedback: BrowserDatabaseReceiptPeerHostFeedback | null;
}

export interface BrowserDatabaseReceiptPeerHost {
  readonly sink: BrowserTabReadoutSink;
  read(): BrowserDatabaseReceiptPeerHostReadout;
  observe(
    readout: BrowserTabCoordinatorReadout,
  ): BrowserDatabaseReceiptPeerHostResult<BrowserDatabaseReceiptPeerHostReadout>;
  handoff(): Promise<BrowserDatabaseReceiptPeerHostResult<BrowserDatabaseReceiptPeerHostReadout>>;
  close(): BrowserDatabaseReceiptPeerHostResult<BrowserDatabaseReceiptPeerHostReadout>;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptPeerHostResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserDatabaseReceiptPeerHostFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptPeerHostFeedback["severity"] = "heat",
  causeCode?: string,
): { readonly ok: false; readonly feedback: BrowserDatabaseReceiptPeerHostFeedback } {
  return {
    ok: false,
    feedback: causeCode === undefined ? { severity, code, detail } : { severity, code, detail, causeCode },
  };
}

function fromCause(
  code: BrowserDatabaseReceiptPeerHostFeedback["code"],
  prefix: string,
  cause: BrowserDatabaseReceiptPeerTransportFeedback,
): { readonly ok: false; readonly feedback: BrowserDatabaseReceiptPeerHostFeedback } {
  return failed(code, `${prefix}: ${cause.detail}`, cause.severity, cause.code);
}

function isIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 1024;
}

/**
 * Reconcile one deterministic receipt peer link from lifecycle coordinator readouts.
 * Readouts provide cadence; the host owns no clock, polling loop, or timeout.
 */
export function startBrowserDatabaseReceiptPeerHost(
  options: BrowserDatabaseReceiptPeerHostOptions,
  factory: BrowserDatabaseReceiptPeerLinkFactory,
): BrowserDatabaseReceiptPeerHostResult<BrowserDatabaseReceiptPeerHost> {
  if (
    !isIdentifier(options.nodeId) ||
    !isIdentifier(options.localPeerId) ||
    !Number.isSafeInteger(options.maxTrackedTabs) ||
    options.maxTrackedTabs < 1 ||
    factory === null ||
    typeof factory !== "object" ||
    typeof factory.open !== "function"
  ) {
    return failed(
      "receipt-peer-host-configuration-invalid",
      "A receipt peer host requires node and local peer identities, a positive safe tab capacity, and a link factory.",
    );
  }

  let active: { readonly peerId: string; readonly port: BrowserDatabaseReceiptPeerLinkPort } | null = null;
  let selection: BrowserDatabaseReceiptPeerSelectionReadout | null = null;
  let linkStatus: BrowserDatabaseReceiptBroadcastPeerLinkReadout["status"] | null = null;
  let feedback: BrowserDatabaseReceiptPeerHostFeedback | null = null;
  let closeFeedback: BrowserDatabaseReceiptPeerHostFeedback | null = null;
  let closed = false;

  const setFailure = (next: BrowserDatabaseReceiptPeerHostFeedback): BrowserDatabaseReceiptPeerHostFeedback => {
    feedback = next;
    return next;
  };

  const refreshLink = (): void => {
    if (active === null) {
      linkStatus = null;
      return;
    }
    try {
      const readout = active.port.read();
      linkStatus = readout.status;
      if (readout.feedback !== null) {
        const result = fromCause(
          "receipt-peer-host-link-read-failed",
          `The active link to ${active.peerId} reported feedback`,
          readout.feedback,
        );
        setFailure(result.feedback);
      }
    } catch {
      linkStatus = "heat";
      setFailure(
        failed(
          "receipt-peer-host-link-read-failed",
          `The active link to ${active.peerId} threw while producing its readout.`,
        ).feedback,
      );
    }
  };

  const project = (): BrowserDatabaseReceiptPeerHostReadout => {
    refreshLink();
    let status: BrowserDatabaseReceiptPeerHostReadout["status"] = "idle";
    if (closed) status = "closed";
    else if (feedback?.severity === "backpressure" || linkStatus === "backpressured") status = "backpressured";
    else if (feedback?.severity === "heat" || linkStatus === "heat") status = "heat";
    else if (active !== null) status = "linked";
    else if (selection?.status === "alone") status = "alone";
    else if (selection?.status === "dormant") status = "dormant";
    return {
      schema: BROWSER_DATABASE_RECEIPT_PEER_HOST_SCHEMA,
      status,
      nodeId: options.nodeId,
      localPeerId: options.localPeerId,
      activePeerId: active?.peerId ?? null,
      selection,
      linkStatus,
      feedback,
    };
  };

  const releaseActive = (): BrowserDatabaseReceiptPeerHostFeedback | null => {
    if (active === null) {
      linkStatus = null;
      return null;
    }
    const releasing = active;
    active = null;
    linkStatus = null;
    try {
      const released = releasing.port.close();
      if (released.ok) return null;
      return setFailure(
        fromCause(
          "receipt-peer-host-link-close-failed",
          `The receipt link to ${releasing.peerId} failed while closing`,
          released.feedback,
        ).feedback,
      );
    } catch {
      return setFailure(
        failed("receipt-peer-host-link-close-failed", `The receipt link to ${releasing.peerId} threw while closing.`)
          .feedback,
      );
    }
  };

  const observe = (
    readout: BrowserTabCoordinatorReadout,
  ): BrowserDatabaseReceiptPeerHostResult<BrowserDatabaseReceiptPeerHostReadout> => {
    if (closed) {
      return failed("receipt-peer-host-closed", "The receipt peer host has already closed.", "backpressure");
    }
    if (readout.nodeId !== options.nodeId || readout.localTabId !== options.localPeerId) {
      const mismatch = failed(
        "receipt-peer-host-readout-mismatch",
        "The coordinator readout does not bind the configured node and local peer identities.",
      );
      setFailure(mismatch.feedback);
      return mismatch;
    }

    const selected = selectBrowserDatabaseReceiptPeer({
      localPeerId: options.localPeerId,
      maxTrackedTabs: options.maxTrackedTabs,
      tabs: readout.tabs,
    });
    if (!selected.ok) {
      selection = null;
      const released = releaseActive();
      if (released !== null) return { ok: false, feedback: released };
      const selectionFailure = failed(
        "receipt-peer-host-selection-failed",
        selected.feedback.detail,
        selected.feedback.severity,
        selected.feedback.code,
      );
      setFailure(selectionFailure.feedback);
      return selectionFailure;
    }

    selection = selected.value;
    const nextPeerId = selected.value.selectedPeerId;
    if (active?.peerId === nextPeerId) {
      feedback = null;
      return succeeded(project());
    }

    const released = releaseActive();
    if (released !== null) return { ok: false, feedback: released };
    feedback = null;
    if (nextPeerId === null) return succeeded(project());

    let opened: BrowserDatabaseReceiptPeerTransportResult<BrowserDatabaseReceiptPeerLinkPort>;
    try {
      opened = factory.open(nextPeerId);
    } catch {
      const openFailure = failed(
        "receipt-peer-host-link-open-failed",
        `The receipt link factory threw while opening peer ${nextPeerId}.`,
      );
      setFailure(openFailure.feedback);
      return openFailure;
    }
    if (!opened.ok) {
      const openFailure = fromCause(
        "receipt-peer-host-link-open-failed",
        `The receipt link to ${nextPeerId} could not open`,
        opened.feedback,
      );
      setFailure(openFailure.feedback);
      return openFailure;
    }
    active = { peerId: nextPeerId, port: opened.value };
    return succeeded(project());
  };

  const host: BrowserDatabaseReceiptPeerHost = {
    sink: {
      write: (readout) => {
        const observed = observe(readout);
        return observed.ok
          ? { ok: true, value: null }
          : { ok: false, detail: `${observed.feedback.code}: ${observed.feedback.detail}` };
      },
    },
    read: project,
    observe,
    handoff: async () => {
      if (closed) {
        return failed("receipt-peer-host-closed", "The receipt peer host has already closed.", "backpressure");
      }
      if (active === null) {
        return feedback === null ? succeeded(project()) : { ok: false, feedback };
      }
      const peerId = active.peerId;
      try {
        const handed = await active.port.handoff.handoff();
        if (!handed.ok) {
          const handoffFailure = failed(
            "receipt-peer-host-handoff-failed",
            `The receipt handoff to ${peerId} failed: ${handed.feedback.detail}`,
            handed.feedback.severity,
            handed.feedback.code,
          );
          setFailure(handoffFailure.feedback);
          return handoffFailure;
        }
      } catch {
        const handoffFailure = failed(
          "receipt-peer-host-handoff-failed",
          `The receipt handoff to ${peerId} threw before returning bounded feedback.`,
        );
        setFailure(handoffFailure.feedback);
        return handoffFailure;
      }
      feedback = null;
      return succeeded(project());
    },
    close: () => {
      if (closed) {
        return closeFeedback === null ? succeeded(project()) : { ok: false, feedback: closeFeedback };
      }
      closeFeedback = releaseActive();
      selection = null;
      closed = true;
      feedback = closeFeedback;
      return closeFeedback === null ? succeeded(project()) : { ok: false, feedback: closeFeedback };
    },
  };

  return succeeded(host);
}

/** Bind the peer host to the existing same-origin BroadcastChannel link adapter. */
export function startNativeBrowserDatabaseReceiptPeerHost(
  options: NativeBrowserDatabaseReceiptPeerHostOptions,
): BrowserDatabaseReceiptPeerHostResult<BrowserDatabaseReceiptPeerHost> {
  const { nodeId, maxTrackedTabs, ...linkOptions } = options;
  return startBrowserDatabaseReceiptPeerHost(
    { nodeId, localPeerId: options.localPeerId, maxTrackedTabs },
    {
      open: (remotePeerId) => createNativeBrowserDatabaseReceiptBroadcastPeerLink({ ...linkOptions, remotePeerId }),
    },
  );
}
