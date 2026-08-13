import {
  createNativeBrowserDatabaseReceiptBroadcastReceiver,
  createNativeBrowserDatabaseReceiptBroadcastTransport,
  type BrowserDatabaseReceiptBroadcastLimits,
  type BrowserDatabaseReceiptBroadcastReadout,
  type BrowserDatabaseReceiptBroadcastReceiverHost,
  type BrowserDatabaseReceiptBroadcastTransport,
} from "./browser-database-receipt-broadcast-channel";
import {
  createBrowserDatabaseReceiptHandoffRuntime,
  type BrowserDatabaseReceiptArchiveMaintenancePort,
  type BrowserDatabaseReceiptBatchHasher,
  type BrowserDatabaseReceiptHandoffLimits,
  type BrowserDatabaseReceiptHandoffPort,
  type BrowserDatabaseReceiptHandoffReadout,
  type BrowserDatabaseReceiptHandoffRuntime,
} from "./browser-database-receipt-handoff";
import {
  createBrowserDatabaseReceiptPeerReceiver,
  createBrowserDatabaseReceiptPeerSender,
  type BrowserDatabaseReceiptPeerLimits,
  type BrowserDatabaseReceiptPeerReadout,
  type BrowserDatabaseReceiptPeerReceiver,
  type BrowserDatabaseReceiptPeerSender,
  type BrowserDatabaseReceiptPeerTransportFeedback,
  type BrowserDatabaseReceiptPeerTransportResult,
} from "./browser-database-receipt-peer-exchange";

export const BROWSER_DATABASE_RECEIPT_BROADCAST_PEER_LINK_SCHEMA =
  "zeta.browser-database-receipt-broadcast-peer-link.v1" as const;

export interface BrowserDatabaseReceiptBroadcastPeerLinkLimits {
  readonly handoff: BrowserDatabaseReceiptHandoffLimits;
  readonly peer: BrowserDatabaseReceiptPeerLimits;
  readonly broadcast: BrowserDatabaseReceiptBroadcastLimits;
}

export interface BrowserDatabaseReceiptBroadcastPeerLinkOptions {
  readonly root: unknown;
  readonly channelName: string;
  readonly localPeerId: string;
  readonly remotePeerId: string;
  readonly initialSequence: number;
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly targetNodeId: string;
  readonly archive: BrowserDatabaseReceiptArchiveMaintenancePort;
  readonly downstream: BrowserDatabaseReceiptHandoffPort;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly limits: BrowserDatabaseReceiptBroadcastPeerLinkLimits;
}

export interface BrowserDatabaseReceiptBroadcastPeerLinkReadout {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_BROADCAST_PEER_LINK_SCHEMA;
  readonly status: "idle" | "retained" | "waiting" | "complete" | "backpressured" | "heat" | "closed";
  readonly localPeerId: string;
  readonly remotePeerId: string;
  readonly handoff: BrowserDatabaseReceiptHandoffReadout;
  readonly outboundPeer: BrowserDatabaseReceiptPeerReadout;
  readonly outboundTransport: BrowserDatabaseReceiptBroadcastReadout;
  readonly inboundPeer: BrowserDatabaseReceiptPeerReadout;
  readonly inboundTransport: BrowserDatabaseReceiptBroadcastReadout;
  readonly feedback: BrowserDatabaseReceiptPeerTransportFeedback | null;
}

export interface BrowserDatabaseReceiptBroadcastPeerLinkRuntime {
  readonly handoff: BrowserDatabaseReceiptHandoffRuntime;
  read(): BrowserDatabaseReceiptBroadcastPeerLinkReadout;
  close(): BrowserDatabaseReceiptPeerTransportResult<null>;
}

export type BrowserDatabaseReceiptBroadcastPeerLinkResult<T> = BrowserDatabaseReceiptPeerTransportResult<T>;

function succeeded<T>(value: T): BrowserDatabaseReceiptBroadcastPeerLinkResult<T> {
  return { ok: true, value };
}

function failed(
  code: string,
  detail: string,
  severity: BrowserDatabaseReceiptPeerTransportFeedback["severity"] = "heat",
): BrowserDatabaseReceiptBroadcastPeerLinkResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function copyFeedback(
  feedback: BrowserDatabaseReceiptPeerTransportFeedback,
): BrowserDatabaseReceiptPeerTransportFeedback {
  return { ...feedback };
}

function failureFrom(
  prefix: string,
  feedback: BrowserDatabaseReceiptPeerTransportFeedback,
): BrowserDatabaseReceiptBroadcastPeerLinkResult<never> {
  return failed(`${prefix}-${feedback.code}`, feedback.detail, feedback.severity);
}

function closeQuietly(port: { close(): BrowserDatabaseReceiptPeerTransportResult<null> }): void {
  try {
    port.close();
  } catch {
    // The construction failure remains the primary typed result.
  }
}

function firstFeedback(
  handoff: BrowserDatabaseReceiptHandoffReadout,
  outboundPeer: BrowserDatabaseReceiptPeerReadout,
  outboundTransport: BrowserDatabaseReceiptBroadcastReadout,
  inboundPeer: BrowserDatabaseReceiptPeerReadout,
  inboundTransport: BrowserDatabaseReceiptBroadcastReadout,
): BrowserDatabaseReceiptPeerTransportFeedback | null {
  return (
    handoff.feedback ??
    outboundPeer.feedback ??
    outboundTransport.feedback ??
    inboundPeer.feedback ??
    inboundTransport.feedback
  );
}

function statusFrom(
  closed: boolean,
  handoff: BrowserDatabaseReceiptHandoffReadout,
  outboundPeer: BrowserDatabaseReceiptPeerReadout,
  outboundTransport: BrowserDatabaseReceiptBroadcastReadout,
  inboundPeer: BrowserDatabaseReceiptPeerReadout,
  inboundTransport: BrowserDatabaseReceiptBroadcastReadout,
): BrowserDatabaseReceiptBroadcastPeerLinkReadout["status"] {
  if (closed) return "closed";
  const statuses = [
    handoff.status,
    outboundPeer.status,
    outboundTransport.status,
    inboundPeer.status,
    inboundTransport.status,
  ] as const;
  if (statuses.includes("heat")) return "heat";
  if (statuses.includes("backpressured")) return "backpressured";
  if (statuses.includes("waiting")) return "waiting";
  if (handoff.status === "complete" || outboundPeer.status === "complete" || inboundPeer.status === "complete") {
    return "complete";
  }
  return handoff.status;
}

function linkReadout(
  options: BrowserDatabaseReceiptBroadcastPeerLinkOptions,
  closed: boolean,
  handoffRuntime: BrowserDatabaseReceiptHandoffRuntime,
  outboundPeerRuntime: BrowserDatabaseReceiptPeerSender,
  outboundTransportRuntime: BrowserDatabaseReceiptBroadcastTransport,
  inboundPeerRuntime: BrowserDatabaseReceiptPeerReceiver,
  inboundTransportRuntime: BrowserDatabaseReceiptBroadcastReceiverHost,
  closeFeedback: BrowserDatabaseReceiptPeerTransportFeedback | null,
): BrowserDatabaseReceiptBroadcastPeerLinkReadout {
  const handoff = handoffRuntime.read();
  const outboundPeer = outboundPeerRuntime.read();
  const outboundTransport = outboundTransportRuntime.read();
  const inboundPeer = inboundPeerRuntime.read();
  const inboundTransport = inboundTransportRuntime.read();
  const feedback = closeFeedback ?? firstFeedback(handoff, outboundPeer, outboundTransport, inboundPeer, inboundTransport);
  return {
    schema: BROWSER_DATABASE_RECEIPT_BROADCAST_PEER_LINK_SCHEMA,
    status: statusFrom(
      closed,
      handoff,
      outboundPeer,
      outboundTransport,
      inboundPeer,
      inboundTransport,
    ),
    localPeerId: options.localPeerId,
    remotePeerId: options.remotePeerId,
    handoff,
    outboundPeer,
    outboundTransport,
    inboundPeer,
    inboundTransport,
    feedback: feedback === null ? null : copyFeedback(feedback),
  };
}

/**
 * Compose one full-duplex same-origin receipt link from the source-owned ports.
 * The returned handoff runtime is driven by the tab runtime's existing finite boundaries;
 * this link introduces no clock, polling loop, or timeout.
 */
export function createNativeBrowserDatabaseReceiptBroadcastPeerLink(
  options: BrowserDatabaseReceiptBroadcastPeerLinkOptions,
): BrowserDatabaseReceiptBroadcastPeerLinkResult<BrowserDatabaseReceiptBroadcastPeerLinkRuntime> {
  const outboundTransport = createNativeBrowserDatabaseReceiptBroadcastTransport({
    root: options.root,
    channelName: options.channelName,
    sourcePeerId: options.localPeerId,
    targetPeerId: options.remotePeerId,
    initialSequence: options.initialSequence,
    limits: options.limits.broadcast,
  });
  if (!outboundTransport.ok) return failureFrom("receipt-peer-link-outbound", outboundTransport.feedback);

  const outboundPeer = createBrowserDatabaseReceiptPeerSender({
    sourcePeerId: options.localPeerId,
    targetPeerId: options.remotePeerId,
    targetNodeId: options.targetNodeId,
    transport: outboundTransport.value,
    limits: options.limits.peer,
  });
  if (!outboundPeer.ok) {
    closeQuietly(outboundTransport.value);
    return failureFrom("receipt-peer-link-outbound", outboundPeer.feedback);
  }

  const handoff = createBrowserDatabaseReceiptHandoffRuntime({
    databaseNodeId: options.databaseNodeId,
    archiveNodeId: options.archiveNodeId,
    targetNodeId: options.targetNodeId,
    archive: options.archive,
    downstream: outboundPeer.value,
    hasher: options.hasher,
    limits: options.limits.handoff,
  });
  if (!handoff.ok) {
    closeQuietly(outboundTransport.value);
    return failureFrom("receipt-peer-link-handoff", handoff.feedback);
  }

  const inboundPeer = createBrowserDatabaseReceiptPeerReceiver({
    peerId: options.localPeerId,
    sourcePeerId: options.remotePeerId,
    targetNodeId: options.targetNodeId,
    downstream: options.downstream,
    hasher: options.hasher,
    limits: options.limits.peer,
  });
  if (!inboundPeer.ok) {
    closeQuietly(outboundTransport.value);
    return failureFrom("receipt-peer-link-inbound", inboundPeer.feedback);
  }

  const inboundTransport = createNativeBrowserDatabaseReceiptBroadcastReceiver({
    root: options.root,
    channelName: options.channelName,
    peerId: options.localPeerId,
    sourcePeerId: options.remotePeerId,
    receiver: inboundPeer.value,
    limits: options.limits.broadcast,
  });
  if (!inboundTransport.ok) {
    closeQuietly(outboundTransport.value);
    return failureFrom("receipt-peer-link-inbound", inboundTransport.feedback);
  }

  let closed = false;
  let closeFeedback: BrowserDatabaseReceiptPeerTransportFeedback | null = null;
  return succeeded({
    handoff: handoff.value,
    read: () =>
      linkReadout(
        options,
        closed,
        handoff.value,
        outboundPeer.value,
        outboundTransport.value,
        inboundPeer.value,
        inboundTransport.value,
        closeFeedback,
      ),
    close: () => {
      if (closed) return closeFeedback === null ? succeeded(null) : { ok: false, feedback: copyFeedback(closeFeedback) };
      closed = true;
      let first: BrowserDatabaseReceiptPeerTransportFeedback | null = null;
      try {
        const inboundClosed = inboundTransport.value.close();
        if (!inboundClosed.ok) first = inboundClosed.feedback;
      } catch {
        first = {
          severity: "heat",
          code: "receipt-peer-link-inbound-close-failed",
          detail: "The inbound receipt BroadcastChannel threw while closing.",
        };
      }
      try {
        const outboundClosed = outboundTransport.value.close();
        if (!outboundClosed.ok) first ??= outboundClosed.feedback;
      } catch {
        first ??= {
          severity: "heat",
          code: "receipt-peer-link-outbound-close-failed",
          detail: "The outbound receipt BroadcastChannel threw while closing.",
        };
      }
      closeFeedback = first === null ? null : copyFeedback(first);
      return first === null ? succeeded(null) : { ok: false, feedback: copyFeedback(first) };
    },
  });
}
