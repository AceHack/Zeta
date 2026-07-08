/**
 * mux-transport-bridge.ts — composes FerryThrottler → MultiplexedDuplexTransport.
 *
 * The full pipeline:
 *   FerryThrottler (batches items, anti-Nagle scheduling)
 *     → NetworkTransport (our batch-frame wire protocol)
 *       → MultiplexedDuplexTransport (ZetaId-keyed four-corner channels)
 *         → WebSocketEndpoint (real ws:// wire)
 *           → Peer's observe loop
 *
 * This bridge adapts the `NetworkTransport` interface (fire-and-forget batch frames)
 * to ride a MuxChannel (four-corner duplex with feedback). The batch frame goes on
 * the normal corner; the peer's acknowledgement comes on the feedback corner.
 *
 * The four-corner model applied to batch transport:
 *   Normal (TN):    BatchFrame (the batch payload, producer → consumer)
 *   Feedback (TF):  BatchAck (consumer signals: received/rejected/backpressure)
 *
 * This is the David Fowler MultiplexedWebSockets pattern (AceHack/MultiplexedWebSockets)
 * meeting the ferry-throttler: N logical batch streams over one physical socket, each
 * on its own ZetaId-keyed channel, with bidirectional flow control.
 *
 * Composes with:
 *   - src/Core.TypeScript/ferry-throttler/network-transport.ts (NetworkTransport interface)
 *   - src/Core.TypeScript/model-backend/multiplexed-duplex-transport.ts (the mux layer)
 *   - src/Core.TypeScript/model-backend/web-socket-endpoint.ts (ws:// physical layer)
 *   - src/Core.TypeScript/discovery/reticulum-transport.ts (mesh discovery)
 *   - The entropy tracker (stamps each batch with thermodynamic cost)
 */

import type { NetworkTransport, BatchFrame, SendOutcome } from "./network-transport";
import type { MuxChannel } from "../model-backend/multiplexed-duplex-transport";

// ═══ Feedback Types (consumer → producer, on the feedback corner) ═══════════════

/** Consumer acknowledges receipt of a batch (or signals backpressure). */
export type BatchAck =
  | { readonly kind: "received"; readonly frameId: string }
  | { readonly kind: "rejected"; readonly frameId: string; readonly reason: string }
  | { readonly kind: "backpressure"; readonly maxPending: number };

// ═══ The Bridge: MuxChannel → NetworkTransport ══════════════════════════════════

/**
 * Adapt a MuxChannel (four-corner duplex) into the NetworkTransport interface
 * that the ferry-throttler's processBatch function expects.
 *
 * Normal corner: send BatchFrames (producer → consumer)
 * Feedback corner: receive BatchAcks (consumer → producer)
 *
 * Usage:
 *   const mux = multiplexedDuplexTransport(webSocketEndpoint(sock));
 *   const channel = mux.open();
 *   const transport = muxChannelAsNetworkTransport(channel);
 *   const processBatch = createNetworkProcessBatch({ transport, nodeId, entropy });
 *   const throttler = new FerryThrottler(config, processBatch);
 */
export function muxChannelAsNetworkTransport(
  channel: MuxChannel<BatchFrame, BatchAck>,
): NetworkTransport {
  const handlers: Array<(frame: BatchFrame, from: string) => void> = [];
  let connected = true;

  // Listen for inbound batch frames (from the peer — we're also a consumer)
  void (async () => {
    try {
      for await (const frame of channel.wire.normalIn) {
        for (const h of handlers) h(frame, "mux-peer");
      }
    } finally {
      connected = false;
    }
  })();

  return {
    get connected() { return connected; },

    async send(frame: BatchFrame): Promise<SendOutcome> {
      try {
        await channel.wire.sendNormal(frame);
        return { ok: true, acked: false }; // sent, ack comes on feedback corner
      } catch (err) {
        return { ok: false, reason: `mux send failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    },

    onBatch(handler: (frame: BatchFrame, from: string) => void): void {
      handlers.push(handler);
    },
  };
}

// ═══ The Peer Side: consume batches and send acks ═══════════════════════════════

/**
 * Serve the consumer side of a batch channel: receive BatchFrames on the normal
 * corner, process them, and send BatchAcks on the feedback corner.
 *
 * Usage (on the receiving peer):
 *   for await (const channel of mux.accepted) {
 *     serveBatchConsumer(channel, async (frame) => {
 *       // fold the batch into local event log
 *       await localSink.appendBatch(frame.payload);
 *     });
 *   }
 */
export async function serveBatchConsumer(
  channel: MuxChannel<BatchFrame, BatchAck>,
  process: (frame: BatchFrame) => Promise<void>,
): Promise<void> {
  for await (const frame of channel.wire.normalIn) {
    try {
      await process(frame);
      await channel.wire.feedbackOut.push({ kind: "received", frameId: frame.id });
    } catch (err) {
      await channel.wire.feedbackOut.push({
        kind: "rejected",
        frameId: frame.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ═══ Composition Helper: one-call setup ═════════════════════════════════════════

export interface MuxBatchTransportOptions {
  /** The mux channel to use for batch transport. */
  readonly channel: MuxChannel<BatchFrame, BatchAck>;
  /** Callback when a batch ack is received (for monitoring/metrics). */
  readonly onAck?: (ack: BatchAck) => void;
}

/**
 * One-call composition: MuxChannel → NetworkTransport with ack monitoring.
 *
 * The full pipeline in one call:
 *   const transport = composeMuxBatchTransport({ channel, onAck });
 *   const processBatch = createNetworkProcessBatch({ transport, nodeId, entropy });
 *   const throttler = new FerryThrottler(config, processBatch);
 *   // throttler batches → transport sends over mux → peer receives
 */
export function composeMuxBatchTransport(opts: MuxBatchTransportOptions): NetworkTransport {
  const transport = muxChannelAsNetworkTransport(opts.channel);

  // Listen for acks on the feedback corner (monitoring)
  if (opts.onAck) {
    const onAck = opts.onAck;
    void (async () => {
      for await (const ack of opts.channel.wire.feedbackIn) {
        onAck(ack);
      }
    })();
  }

  return transport;
}
