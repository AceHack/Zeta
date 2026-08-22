/**
 * zeta-transport-cell.ts — YinYang cell that unifies all Zeta transports.
 *
 * ## The YinYang cell model
 *
 * A YinYang cell has two corners (the yin and the yang):
 *   Execution corner (yang): send events outward to the network
 *   Feedback corner (yin):   receive teaching acks from the network
 *
 * This is the operational implementation of the Vision Monad:
 *   - The yang corner is the "I" (the agent's action)
 *   - The yin corner is the "Eye" (the agent's self-observation)
 *   - The BNN posterior is the agent's model of its own future spacetimes
 *   - The quasi-crystal detector prunes branches that are too costly
 *
 * ## Transport unification
 *
 * The cell multiplexes across all available transports simultaneously:
 *   - UDP multicast (LAN/WiFi mesh 802.11s) — fastest, lossy, Adinkra ECC
 *   - Reticulum (mesh, LoRa/BLE/TCP) — medium range, self-certifying addresses
 *   - WebSocket (realtime server) — lowest latency for online agents
 *   - Git commits (GitHub) — durable, foldable, G-set semantics
 *   - BroadcastChannel (browser tabs) — zero-latency for same-origin agents
 *
 * ## Online BNN learning
 *
 * Every teaching ack from the feedback corner is absorbed by the DimensionalBnn:
 *   - Congestion acks → transport dimension
 *   - Schema acks → schema dimension
 *   - Auth acks → auth dimension
 *   - etc.
 *
 * The BNN posterior predicts which transport will succeed for the next event.
 * The cell uses this prediction to prioritize transports (highest posterior μ first).
 *
 * ## Quasi-time-crystal detection
 *
 * The quasi-crystal detector watches the rejection pattern per transport.
 * If a transport is in a quasi-crystal loop (period ≤ 4, autocorrelation ≥ 0.8),
 * the cell time-dilates it (reduces its priority to near-zero) and routes to
 * other transports until the loop breaks.
 *
 * ## Homoiconicity
 *
 * The YinYang cell is homoiconic with:
 *   - The Adinkra [8,4,4] ECC (execution = data, feedback = parity)
 *   - The BipartiteMachZehnder (execution = path 0, feedback = path 1)
 *   - The FrequencyMachZehnder (execution = DC bin, feedback = AC bins)
 *   - The FigureEightEnsemble (execution = body A, feedback = body B)
 *   - The Friedkin-Johnsen model (execution = influence, feedback = stubbornness)
 *
 * All five are the same knob: the external observer that prevents groupthink.
 *
 * ## References
 *
 * - mux-transport-bridge.ts (four-corner MuxChannel adapter)
 * - four-corner-feedback.ts (teaching BatchAck, quasi-crystal detector)
 * - gossip-mesh-transport.ts (all transport adapters)
 * - udp-lossy-transport.ts (Adinkra ECC over UDP)
 * - sensor-fusion-oracle.ts (BNN+Worm fusion)
 * - bnn-persistence.ts (DimensionalBnn serialization)
 * - yin-yang-composition-probe.ts (YinYang composition probe)
 */

import type { SalonTransport } from "./gossip-salon";
import { envelopeId, type ErrorDimension, type ErrorEnvelope } from "../protocol/error-envelope";
import { mergePriorHint, type PriorHint } from "../protocol/batch-teaching-envelope";
import {
  makeQuasiState,
  updateQuasiState,
  makeLaneFeedbackTracker,
  updateLaneFeedback,
  upgradeAck,
  dominantDimension,
  type LaneFeedbackTracker,
  type QuasiCrystalState,
} from "../ferry-throttler/four-corner-feedback";
import {
  createHeatAwareScheduler,
  createStrictPriorityScheduler,
  type HeatAwareScheduler,
} from "../ferry-throttler";
import { batchTemperatureBand } from "../protocol/batch-heat-bridge";
import {
  createDimensionalBnn,
  absorbError,
  replaceDimensionPosterior,
  ALL_DIMENSIONS,
  dimensionPosterior,
  type DimensionalBnn,
} from "../planning/error-bnn-bridge";
// ── Transport descriptor ───────────────────────────────────────────────────────

export type TransportKind = "udp" | "reticulum" | "websocket" | "git" | "broadcast";

export interface TransportDescriptor {
  readonly kind: TransportKind;
  readonly transport: SalonTransport;
  /** Priority (0 = highest). Updated by BNN posterior. */
  priority: number;
  /** Quasi-crystal state for this transport. */
  quasiState: QuasiCrystalState;
  /** Lane feedback tracker for this transport. */
  feedback: LaneFeedbackTracker;
  /** Time-dilation factor (1 = normal, 0 = fully dilated). */
  dilationFactor: number;
}

// ── ZetaTransportCell ──────────────────────────────────────────────────────────

export interface ZetaTransportCellOptions {
  /** Available transports (at least one required). */
  readonly transports: readonly TransportDescriptor[];
  /** DimensionalBnn for online learning (shared across all transports). */
  readonly bnn?: DimensionalBnn;
  /** Node identity (stamped on outgoing events). */
  readonly nodeId: string;
  /** Callback when a teaching ack is received. */
  readonly onTeachingAck?: (kind: TransportKind, dimension: ErrorDimension, generatorFn: string) => void;
  /**
   * Optional HeatAwareScheduler for per-transport heat throttling.
   * When provided, failed sends signal recordHeat(laneIndex, band) and
   * successful sends signal recordDrain(laneIndex, items, bytes).
   * The lane index maps to the transport order in `transports`.
   * Defaults to a new HeatAwareScheduler wrapping StrictPriorityScheduler.
   */
  readonly heatScheduler?: HeatAwareScheduler;
}

export interface SendResult {
  readonly ok: boolean;
  readonly transport: TransportKind;
  readonly reason?: string;
  readonly teachingAck?: { dimension: ErrorDimension; generatorFn: string };
}

/**
 * ZetaTransportCell — the YinYang cell that unifies all transports.
 *
 * Multiplexes across all available transports simultaneously (fan-out).
 * Uses the BNN posterior to prioritize transports.
 * Detects quasi-crystal loops and time-dilates affected transports.
 */
export class ZetaTransportCell {
  private readonly _transports: TransportDescriptor[];
  private readonly _bnn: DimensionalBnn;
  private readonly _nodeId: string;
  private readonly _onTeachingAck:
    | ((kind: TransportKind, dimension: ErrorDimension, generatorFn: string) => void)
    | undefined;
  /** Per-transport heat scheduler — throttles hot transports via AIMD backpressure. */
  private readonly _heatScheduler: HeatAwareScheduler;

  constructor(opts: ZetaTransportCellOptions) {
    this._transports = [...opts.transports];
    this._bnn = opts.bnn ?? createDimensionalBnn();
    this._nodeId = opts.nodeId;
    this._onTeachingAck = opts.onTeachingAck;
    this._heatScheduler = opts.heatScheduler
      ?? createHeatAwareScheduler(createStrictPriorityScheduler(), opts.transports.length);
  }

  /** Send an event over all non-dilated transports (fan-out). */
  async send(event: string): Promise<SendResult[]> {
    // Sort by priority (lowest number = highest priority), skip fully dilated
    const active = this._transports
      .filter(t => t.dilationFactor > 0.05)
      .sort((a, b) => a.priority - b.priority);

    const results: SendResult[] = [];
    for (const desc of active) {
      try {
        // Attach current BNN posteriors as PriorHints in the event payload
        // This closes the bidirectional EP loop: receiver can merge our posterior
        const priorHints: PriorHint[] = ALL_DIMENSIONS.map((d): PriorHint => {
          const p = dimensionPosterior(this._bnn, d);
          return {
            dimension: d,
            mu: p.mu,
            sigma2: p.sigma2,
            robustnessWeight: p.robustnessWeight,
            obsCount: 0,
            senderZid: this._nodeId,
          };
        });
        // Embed prior hints as a JSON annotation in the event (non-breaking: receivers that
        // don't understand it will ignore the __priorHints field)
        let eventWithHints = event;
        try {
          const parsed = JSON.parse(event) as Record<string, unknown>;
          parsed.__priorHints = priorHints;
          eventWithHints = JSON.stringify(parsed);
        } catch { /* not JSON — send as-is */ }
        await desc.transport.publish(eventWithHints);
        // Successful send → update quasi-crystal state (not rejected)
        desc.quasiState = updateQuasiState(desc.quasiState, false);
        desc.feedback = updateLaneFeedback(desc.feedback, { kind: "received", frameId: event.slice(0, 16) });
        // Heat recovery: successful send → additive weight recovery for this lane
        const laneIdx = this._transports.indexOf(desc);
        if (laneIdx >= 0) this._heatScheduler.recordDrain(laneIdx, 1, event.length);
        results.push({ ok: true, transport: desc.kind });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        // Failed send → upgrade to teaching ack, update BNN and quasi-crystal state
        const rawAck = { kind: "rejected" as const, frameId: event.slice(0, 16), reason };
        const teachingAck = upgradeAck(rawAck, desc.priority);
        if (teachingAck.kind === "rejected") {
        // Absorb into BNN
          const corrId = `${desc.kind}:${event.slice(0, 8)}`;
          const envelope: ErrorEnvelope = {
            envelopeId: envelopeId(corrId, teachingAck.dimension, `transport ${desc.kind} rejected event`, reason),
            correlationId: corrId,
            beacon: `Transport ${desc.kind} rejected event: ${reason}. Fix: ${teachingAck.generatorFn}`,
            mirror: {
              what: `transport ${desc.kind} rejected event`,
              why: reason,
              howToFix: teachingAck.generatorFn,
              dimension: teachingAck.dimension,
              severity: "error",
              ...(teachingAck.retractableBeliefId === undefined
                ? {}
                : { retractableBeliefId: teachingAck.retractableBeliefId }),
            },
            emittedAt: new Date().toISOString(),
          };
          absorbError(this._bnn, envelope);
          // Update quasi-crystal state (rejected)
          desc.quasiState = updateQuasiState(desc.quasiState, true);
          desc.feedback = updateLaneFeedback(desc.feedback, teachingAck);
          // Update dilation factor
          desc.dilationFactor = desc.quasiState.dilationFactor;
          // Update priority from BNN posterior
          const status = ALL_DIMENSIONS.map(d => ({ dimension: d, ...dimensionPosterior(this._bnn, d) }));
          const transportStatus = status.find(s => s.dimension === teachingAck.dimension);
          if (transportStatus) {
            desc.priority = Math.round((1 - transportStatus.mu) * 10);
          }
          this._onTeachingAck?.(desc.kind, teachingAck.dimension, teachingAck.generatorFn);
          // Heat backpressure: failed send → throttle this lane based on BNN posterior
          // The transport dimension posterior gives the unaccounted error ratio → band
          const laneIdx = this._transports.indexOf(desc);
          if (laneIdx >= 0) {
            const transportStatus = ALL_DIMENSIONS.map(d => ({ dimension: d, ...dimensionPosterior(this._bnn, d) }))
              .find(s => s.dimension === "transport");
            // mu > 0.5 = more failures than successes → hot; > 0.67 → critical
            const band = transportStatus
              ? batchTemperatureBand({ unaccountedHeat: Math.round(transportStatus.mu * 10), failedItems: 10 })
              : "hot";
            this._heatScheduler.recordHeat(laneIdx, band);
          }
          results.push({ ok: false, transport: desc.kind, reason, teachingAck: { dimension: teachingAck.dimension, generatorFn: teachingAck.generatorFn } });
        }
      }
    }
    return results;
  }

  /** Register a message handler on all transports. */
  onMessage(handler: (msg: string, from: TransportKind) => void): void {
    for (const desc of this._transports) {
      desc.transport.onFrame((msg) => handler(msg, desc.kind));
    }
  }

  /**
   * Merge incoming PriorHints from a received event into the local BNN.
   * Call this when receiving an event that has __priorHints attached.
   * This is the yin corner: the receiver learns from the sender's posterior.
   */
  mergePriorHints(hints: PriorHint[], trustWeight = 0.5): void {
    for (const hint of hints) {
      const local = dimensionPosterior(this._bnn, hint.dimension);
      const merged = mergePriorHint(
        { mu: local.mu, sigma2: local.sigma2 },
        hint,
        trustWeight,
      );
      // A peer belief is not an error. absorbError mapped every hint to
      // severity "info" → z = 0.5, so mu=4 and mu=0 were indistinguishable
      // (081M005CBQ6087G0R003N21Z9J). Write the merged posterior directly.
      replaceDimensionPosterior(this._bnn, hint.dimension, merged);
    }
  }

  /** Get the current BNN status (per-dimension posteriors). */
  bnnStatus() {
    return ALL_DIMENSIONS.map(d => ({
      dimension: d,
      ...dimensionPosterior(this._bnn, d),
    }));
  }

  /** Get the current transport health summary. */
  health(): Array<{ kind: TransportKind; priority: number; dilationFactor: number; quasiPeriod: number; dominantError: ErrorDimension; heatWeight: number }> {
    return this._transports.map((t, i) => ({
      kind: t.kind,
      priority: t.priority,
      dilationFactor: t.dilationFactor,
      quasiPeriod: t.quasiState.period,
      dominantError: dominantDimension(t.feedback),
      heatWeight: this._heatScheduler.heatWeights[i] ?? 1.0,
    }));
  }
  /** Get the current heat weights for all transports (1.0 = full, 0.05 = near-stall). */
  heatWeights(): readonly number[] {
    return this._heatScheduler.heatWeights;
  }

  /**
   * Reset all transport heat weights to 1.0 (full throughput) and skip counters to 0.
   * Call after a transport outage clears, or in tests to start from a known state.
   */
  resetHeat(): void {
    this._heatScheduler.resetHeat();
  }

  /** Serialize BNN state for persistence. */
  serializeBnn(): string {
    return JSON.stringify(this.bnnStatus());
  }
}

// ── Factory helpers ────────────────────────────────────────────────────────────

/** Create a TransportDescriptor from a SalonTransport. */
export function makeTransportDescriptor(
  kind: TransportKind,
  transport: SalonTransport,
  priority = 0,
): TransportDescriptor {
  return {
    kind,
    transport,
    priority,
    quasiState: makeQuasiState(),
    feedback: makeLaneFeedbackTracker(priority),
    dilationFactor: 1,
  };
}

/** Create a ZetaTransportCell from a map of transport kinds to SalonTransports. */
export function createZetaTransportCell(
  nodeId: string,
  transports: Partial<Record<TransportKind, SalonTransport>>,
  opts?: Partial<Omit<ZetaTransportCellOptions, "nodeId" | "transports">>,
): ZetaTransportCell {
  const descs: TransportDescriptor[] = [];
  const order: TransportKind[] = ["broadcast", "websocket", "udp", "reticulum", "git"];
  for (let i = 0; i < order.length; i++) {
    const kind = order[i]!;
    const t = transports[kind];
    if (t) descs.push(makeTransportDescriptor(kind, t, i));
  }
  if (descs.length === 0) throw new RangeError("ZetaTransportCell: at least one transport required");
  return new ZetaTransportCell({ nodeId, transports: descs, ...opts });
}
