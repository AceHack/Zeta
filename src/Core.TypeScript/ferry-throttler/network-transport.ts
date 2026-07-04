/**
 * network-transport.ts — bridge the ferry-throttler to real network transports.
 *
 * The anti-Nagle in practice: the ferry-throttler batches items (branches) and
 * flushes them on schedule (the ferry commit). This adapter takes that batch
 * output and sends it over a real network transport — Reticulum mesh (local/global),
 * NATS JetStream (cluster), or a multiplexed WebSocket (browser/edge).
 *
 * The key insight (operator 2026-07-03): the ferry-batched throttler IS the anti-Nagle.
 * Nagle batches small packets into one large one on a timer — our ferry does the same
 * with events. Anti-Nagle is: "batch aggressively when you can predict the next flush,
 * flush immediately when latency matters." The throttler already handles that via
 * priority lanes (high-priority = immediate flush, low-priority = batch to window).
 *
 * This adapter is the LAST MILE: throttler-batch → wire. It maps:
 *   - FerryThrottler.processBatch → transport.send (one network frame per batch)
 *   - Transport.onMessage → inbound batches folded into the local event log
 *   - Priority lanes → QoS levels on the transport (if supported)
 *
 * Transport backends (all satisfy the same interface):
 *   - ReticulumTransport (mesh, self-certifying, hop-by-hop relay)
 *   - NATS JetStream (cluster, durable, exactly-once via consumer ack)
 *   - WebSocket/Channel (multiplexed, David Fowler pipelines pattern)
 *
 * The transport is INJECTED (same DI pattern as EventSink, WorkspacePort,
 * EntropyTracker) — swap the transport, keep the batching logic. Tests inject
 * a fake transport; prod wires the real one.
 *
 * Composes with:
 *   - src/Core.TypeScript/ferry-throttler/ferry-throttler.ts (the batch producer)
 *   - src/Core.TypeScript/discovery/reticulum-transport.ts (the mesh transport)
 *   - src/Core.TypeScript/algebra/physics-traits.ts (FerryQueue = this pattern)
 *   - src/Core.TypeScript/algebra/entropy-tracker.ts (heat accounting per batch)
 *   - src/Core.TypeScript/observe/event-sink-folder.ts (the local durable sink)
 *   - agentic-organization/packages/messaging/ (NATS subject builder)
 */

import type { EntropyTracker } from "../algebra/entropy-tracker";

// ═══ Transport Interface (the injected network port) ════════════════════════════

/**
 * A network transport — the minimal interface any wire protocol must satisfy.
 * Deliberately thin: send bytes, receive bytes, report connectivity.
 * Same shape as PacketTransport in reticulum-transport.ts but with batch semantics.
 */
export interface NetworkTransport {
  /** Send a batch frame over the wire. Returns when the transport has accepted it
   *  (not necessarily when the remote has acked — that's transport-specific). */
  send(frame: BatchFrame): Promise<SendOutcome>;
  /** Register a handler for inbound batch frames from the network. */
  onBatch(handler: (frame: BatchFrame, from: string) => void): void;
  /** Whether the transport is currently connected (for backpressure decisions). */
  readonly connected: boolean;
}

/** A batch frame on the wire: the serialized ferry commit. */
export interface BatchFrame {
  /** Unique frame id (ZetaId or sequence number — dedup on the receiver). */
  readonly id: string;
  /** The batch payload: serialized events (JSON array of event envelopes). */
  readonly payload: string;
  /** Number of events in this batch (metadata for the receiver's entropy accounting). */
  readonly count: number;
  /** Priority level (maps to QoS / lane on transports that support it). */
  readonly priority: number;
  /** Timestamp of the batch flush (ISO-8601). */
  readonly flushedAt: string;
  /** Entropy snapshot at flush time (the thermodynamic cost of this commit). */
  readonly entropy?: { state: number; heat: number };
}

/** The transport's send outcome (never throws — Result discipline). */
export type SendOutcome =
  | { readonly ok: true; readonly acked: boolean }
  | { readonly ok: false; readonly reason: string };

// ═══ Ferry-to-Network Adapter ══════════════════════════════════════════════════

export interface FerryNetworkAdapterOptions {
  /** The network transport to send batches over. */
  readonly transport: NetworkTransport;
  /** Optional entropy tracker (stamps each batch frame with thermodynamic cost). */
  readonly entropy?: EntropyTracker;
  /** Agent/node identity (stamped on outgoing frames). */
  readonly nodeId: string;
  /** Frame id generator (default: monotone counter). */
  readonly mintFrameId?: () => string;
}

/**
 * The ProcessBatch function that the FerryThrottler calls on each flush.
 * This is what you wire as the `processBatch` parameter to `new FerryThrottler(config, processBatch)`.
 *
 * It serializes the batch, stamps entropy, and sends it over the network transport.
 */
export function createNetworkProcessBatch<T>(
  opts: FerryNetworkAdapterOptions,
  serialize: (items: readonly T[]) => string,
  priority: number = 0,
): (items: readonly T[]) => Promise<void> {
  let seq = 0;
  const mintId = opts.mintFrameId ?? (() => `${opts.nodeId}:${++seq}`);

  return async (items: readonly T[]): Promise<void> => {
    if (items.length === 0) return;

    // Build the batch frame
    const entropySnapshot = opts.entropy
      ? { state: opts.entropy.state.entropy_state, heat: opts.entropy.state.entropy_heat }
      : undefined;

    const frame: BatchFrame = {
      id: mintId(),
      payload: serialize(items),
      count: items.length,
      priority,
      flushedAt: new Date().toISOString(),
      ...(entropySnapshot ? { entropy: entropySnapshot } : {}),
    };

    // Send over the wire (the anti-Nagle moment: one frame per batch, not per item)
    const outcome = await opts.transport.send(frame);
    if (!outcome.ok) {
      // Transport failure is logged but does NOT throw — the ferry-throttler's
      // contract is fire-and-forget for the basic arity. The event is still in
      // the local durable log (event-sink-folder); the network send is best-effort
      // replication, not the source of truth.
      console.error(`[ferry-network] send failed: ${outcome.reason} (batch ${frame.id}, ${frame.count} items)`);
    }
  };
}

// ═══ Fake Transport (for tests — same pattern as fakeOperatorPort) ══════════════

/** A fake network transport that records sent frames. No I/O. */
export function fakeNetworkTransport(
  outcome: SendOutcome = { ok: true, acked: true },
): NetworkTransport & { sent: BatchFrame[]; handlers: Array<(frame: BatchFrame, from: string) => void> } {
  const sent: BatchFrame[] = [];
  const handlers: Array<(frame: BatchFrame, from: string) => void> = [];
  return {
    sent,
    handlers,
    connected: true,
    send: async (frame) => { sent.push(frame); return outcome; },
    onBatch: (h) => handlers.push(h),
  };
}

// ═══ Reticulum Adapter (bridges ferry → mesh) ═══════════════════════════════════

/**
 * Create a ProcessBatch that sends each ferry flush as a Reticulum broadcast.
 * The batch is encoded as a single text frame on the mesh — all peers in broadcast
 * range (including relay-bridged remote meshes) receive it.
 *
 * This is the anti-Nagle over Reticulum: instead of sending one event per packet
 * (Nagle-off, high overhead), we send one batch per flush (ferry-scheduled, low
 * overhead, predictive window).
 */
export function createReticulumProcessBatch<T>(
  transport: { broadcast(text: string): void },
  opts: { nodeId: string; entropy?: EntropyTracker; serialize?: (items: readonly T[]) => string },
): (items: readonly T[]) => Promise<void> {
  let seq = 0;
  const serialize = opts.serialize ?? ((items: readonly T[]) => JSON.stringify(items));

  return async (items: readonly T[]): Promise<void> => {
    if (items.length === 0) return;

    const entropySnapshot = opts.entropy
      ? { state: opts.entropy.state.entropy_state, heat: opts.entropy.state.entropy_heat }
      : undefined;

    const frame: BatchFrame = {
      id: `${opts.nodeId}:${++seq}`,
      payload: serialize(items),
      count: items.length,
      priority: 0,
      flushedAt: new Date().toISOString(),
      ...(entropySnapshot ? { entropy: entropySnapshot } : {}),
    };

    // One broadcast per batch — the anti-Nagle over mesh
    transport.broadcast(JSON.stringify(frame));
  };
}
