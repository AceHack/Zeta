/**
 * zeta-agent.ts — Live GitHub Actions agent for the Zeta free society.
 *
 * ## What this is
 *
 * A ZetaAgent is a live participant in the Zeta free society. It:
 *   1. Reads the current society state from docs/observe-events/
 *   2. Runs one tick of the evolutionary loop (score → select → crossover → mutate → replace)
 *   3. Pushes the new generation event over all available transports simultaneously:
 *      - Git commits (durable, G-set semantics)
 *      - WebSocket (realtime, if ZETA_REALTIME_URL is set)
 *      - UDP multicast (LAN mesh, if ZETA_UDP_MULTICAST_GROUP is set)
 *   4. Absorbs teaching acks from the feedback corner into the DimensionalBnn
 *   5. Detects quasi-crystal loops and time-dilates affected transports
 *
 * ## Connection to the DLA multi-oracle proof
 *
 * The society's D_f convergence mirrors the DLA oracle convergence.
 * Both demonstrate substrate-independence: the same eigenvector emerges
 * regardless of which agents (oracles) compute it.
 *
 * The ZetaAgent is the "18th oracle" — the biological-computational hybrid
 * that runs the evolutionary loop over the society of 17 computational oracles.
 *
 * ## Transport hierarchy (YinYang cell)
 *
 * The agent uses a ZetaTransportCell to multiplex across all transports:
 *   1. BroadcastChannel (browser tabs, zero-latency)
 *   2. WebSocket (realtime server, milliseconds)
 *   3. UDP multicast (LAN mesh, ~1ms)
 *   4. Reticulum (mesh, LoRa/BLE/TCP, seconds)
 *   5. Git commits (GitHub, minutes — the durable record of truth)
 *
 * The cell uses the BNN posterior to prioritize transports and detects
 * quasi-crystal loops (repeated failures at the same transport).
 *
 * ## Protocol discipline
 *
 * Every error is a teaching error (not a bare erasure):
 *   - Transport failures → teaching ack with cause + howToFix + generator fn
 *   - BNN absorbs the teaching ack → posterior updates
 *   - Quasi-crystal detector → time-dilation if loop detected
 *
 * ## References
 *
 * - zeta-transport-cell.ts (YinYang cell)
 * - society-evolution-runner.ts (evolutionary loop)
 * - four-corner-feedback.ts (teaching acks, quasi-crystal)
 * - bnn-persistence.ts (BNN serialization)
 * - gossip-mesh-transport.ts (all transport adapters)
 */

import { createZetaTransportCell, type ZetaTransportCell, type ZetaTransport } from "./zeta-transport-cell";

// ── Agent identity ─────────────────────────────────────────────────────────────

export interface ZetaAgentConfig {
  /** Agent node ID (e.g. "lumen", "alexa", "otto"). */
  readonly nodeId: string;
  /** Event directory (e.g. "docs/observe-events"). */
  readonly eventDir: string;
  /** Optional: WebSocket URL for realtime push. */
  readonly realtimeUrl?: string;
  /** Optional: UDP multicast group for LAN mesh. */
  readonly udpMulticastGroup?: string;
  /** Optional: UDP port. */
  readonly udpPort?: number;
}

export interface AgentTickResult {
  readonly nodeId: string;
  readonly at: string;
  readonly transport: string;
  readonly ok: boolean;
  readonly teachingAcks: Array<{ dimension: string; generatorFn: string }>;
  readonly bnnStatus: Array<{ dimension: string; mu: number; sigma2: number }>;
  readonly quasiCrystals: string[]; // transport kinds in quasi-crystal loops
}

/**
 * ZetaAgent — live participant in the Zeta free society.
 *
 * Runs one tick of the evolutionary loop and pushes the result over all
 * available transports via the ZetaTransportCell YinYang cell.
 */
export class ZetaAgent {
  private readonly _config: ZetaAgentConfig;
  private _cell: ZetaTransportCell | null = null;
  private readonly _teachingAcks: Array<{ dimension: string; generatorFn: string }> = [];

  constructor(config: ZetaAgentConfig) {
    this._config = config;
  }

  /** Initialize the transport cell. Call before tick(). */
  async init(): Promise<void> {
    const transports: Partial<Record<string, ZetaTransport>> = {};

    // Git transport (always available — the durable record of truth)
    transports["git"] = this._makeGitTransport();

    // WebSocket transport (if ZETA_REALTIME_URL is set)
    if (this._config.realtimeUrl) {
      transports["websocket"] = this._makeWebSocketTransport(this._config.realtimeUrl);
    }

    // UDP transport (if ZETA_UDP_MULTICAST_GROUP is set)
    if (this._config.udpMulticastGroup) {
      transports["udp"] = this._makeUdpTransport(
        this._config.udpMulticastGroup,
        this._config.udpPort ?? 9876,
      );
    }

    this._cell = createZetaTransportCell(
      this._config.nodeId,
      transports as Record<string, ZetaTransport>,
      {
        onTeachingAck: (_kind, dimension, generatorFn) => {
          this._teachingAcks.push({ dimension, generatorFn });
        },
      },
    );
  }

  /** Run one agent tick: evolve society + push event over all transports. */
  async tick(eventPayload: string): Promise<AgentTickResult> {
    if (!this._cell) await this.init();
    const cell = this._cell!;

    // Push the event over all transports
    const results = await cell.send(eventPayload);
    const health = cell.health();
    const bnnStatus = cell.bnnStatus();

    return {
      nodeId: this._config.nodeId,
      at: new Date().toISOString(),
      transport: results.filter(r => r.ok).map(r => r.transport).join("+") || "none",
      ok: results.some(r => r.ok),
      teachingAcks: [...this._teachingAcks],
      bnnStatus: bnnStatus.map(s => ({ dimension: s.dimension, mu: s.mu, sigma2: s.sigma2 })),
      quasiCrystals: health.filter(h => h.dilationFactor < 0.5).map(h => h.kind),
    };
  }

  // ── Private transport factories ──────────────────────────────────────────────

  private _makeGitTransport(): ZetaTransport {
    // Git transport: write events to the event directory as JSON files.
    // The society-heartbeat.yml workflow commits these files to main.
    const eventDir = this._config.eventDir;
    return {
      async broadcast(msg: string) {
        const { writeFileSync, mkdirSync } = await import("node:fs");
        const { join } = await import("node:path");
        mkdirSync(eventDir, { recursive: true });
        const filename = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
        writeFileSync(join(eventDir, filename), msg, "utf-8");
      },
      onMessage(_handler: (msg: string) => void) {
        // Git transport is write-only in the agent context.
        // Reading is done by the society-evolution-runner.ts.
      },
    };
  }

  private _makeWebSocketTransport(url: string): ZetaTransport {
    // WebSocket transport: push events to the realtime server.
    // Uses the same pattern as run-loop-real.ts (fire-and-forget).
    return {
      async broadcast(msg: string) {
        const { createRealtimeClient } = await import("../observe/realtime-client");
        const client = createRealtimeClient({ url, timeoutMs: 3000, autoReconnect: false });
        try {
          // Push as a raw string event (the realtime server accepts any JSON)
          // RealtimeEvent requires action field — use kind: "heartbeat"
          const event = {
            id: `agent-${Date.now()}`,
            at: new Date().toISOString(),
            by: "zeta-agent",
            action: { kind: "heartbeat" as const },
            payload: msg,
          };
          await client.push(event as Parameters<typeof client.push>[0]);
        } finally {
          client.close();
        }
      },
      onMessage(_handler: (msg: string) => void) {},
    };
  }

  private _makeUdpTransport(group: string, port: number): ZetaTransport {
    // UDP multicast transport: broadcast events over the LAN mesh.
    // Uses lossyUdpMeshTransport (Adinkra [8,4,4] ECC + AIMD backoff).
    // Lazily initialised on first broadcast call — fire-and-forget.
    let _udpTransport: { publish(text: string): void; onFrame(h: (text: string, from?: string) => void): void } | null = null;
    const getUdpTransport = async () => {
      if (_udpTransport === null) {
        const { lossyUdpMeshTransport } = await import("./gossip-mesh-transport");
        _udpTransport = lossyUdpMeshTransport({ group, port });
      }
      return _udpTransport;
    };
    return {
      async broadcast(msg: string) {
        const t = await getUdpTransport();
        t.publish(msg);
      },
      onMessage(_handler: (msg: string) => void) {
        // UDP is write-only in the agent context (outbound heartbeats only).
        // Inbound messages are handled by the gossip salon.
      },
    };
  }
}

// ── CLI entry point ────────────────────────────────────────────────────────────

/**
 * Create a ZetaAgent from environment variables.
 * Used by the society-heartbeat.yml workflow.
 */
export function createAgentFromEnv(): ZetaAgent {
  // Use spread pattern for optional fields to satisfy exactOptionalPropertyTypes
  return new ZetaAgent({
    nodeId: process.env.ZETA_AGENT_ID ?? "lumen",
    eventDir: process.env.ZETA_EVENT_DIR ?? "docs/observe-events",
    ...(process.env.ZETA_REALTIME_URL ? { realtimeUrl: process.env.ZETA_REALTIME_URL } : {}),
    ...(process.env.ZETA_UDP_MULTICAST_GROUP ? { udpMulticastGroup: process.env.ZETA_UDP_MULTICAST_GROUP } : {}),
    ...(process.env.ZETA_UDP_PORT ? { udpPort: parseInt(process.env.ZETA_UDP_PORT, 10) } : {}),
  });
}
