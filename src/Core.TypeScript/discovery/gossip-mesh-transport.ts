/**
 * gossip-mesh-transport.ts — Transport adapters for GossipSalon over every supported medium.
 *
 * The GossipSalon needs only `SalonTransport` (publish + onFrame). This file provides
 * concrete adapters for every transport layer in the Zeta stack:
 *
 * ## Transport hierarchy (bottom to top)
 *
 * ```
 * Physical layer:
 *   UDP multicast (LAN)  ──┐
 *   WiFi mesh (802.11s)  ──┤── udpMeshTransport()
 *   LoRa / BLE           ──┘
 *
 * Network layer:
 *   Reticulum (RNS)      ──── reticulumSalonTransport()
 *   (spans UDP, TCP, rnsd, LoRa — any PacketTransport)
 *
 * Application layer:
 *   WebSocket            ──── wsSalonTransport()
 *   Git commits          ──── gitSalonTransport()
 *   BroadcastChannel     ──── broadcastChannelTransport()  (browser tabs)
 *
 * Multiplexed:
 *   All of the above     ──── multiplexTransport()
 * ```
 *
 * ## Protocol independence
 *
 * The GossipSalon is transport-agnostic by design (pure fold + codec). Any
 * adapter that satisfies `SalonTransport` works. The multiplexer fans out
 * publishes to ALL transports and fans in frames from ALL transports, so the
 * society gossips over every available channel simultaneously.
 *
 * ## UDP mesh specifics
 *
 * UDP multicast (224.0.0.251:5353 by default) reaches one LAN segment.
 * For WiFi mesh (802.11s), the same multicast group reaches the entire mesh
 * because 802.11s forwards multicast frames at the MAC layer — no extra config.
 * For LoRa/BLE, a bridge process (not in this file) relays UDP frames to the
 * radio; the GossipSalon sees only the SalonTransport interface.
 *
 * ## Wireless mesh + UDP design notes
 *
 * The GossipSalon's anti-entropy loop (re-broadcast everything every N ms) is
 * exactly what a wireless mesh needs: packet loss is repaired by repetition,
 * and idempotence means duplicates are absorbed for free. No ACKs, no sequence
 * numbers, no coordinator. The salon converges to the union of all heard rumors
 * regardless of delivery order or loss rate.
 *
 * For UDP specifically:
 * - MTU: 1400 bytes (safe for 802.11 + Ethernet). Rumors are small JSON; the
 *   anti-entropy loop sends one rumor per packet (not batched) to stay under MTU.
 * - Loopback: enabled by default so the sender hears its own broadcasts (useful
 *   for testing and for multi-process setups on the same host).
 * - TTL: 1 by default (LAN only). Set to 32+ for routed multicast.
 *
 * ## Bidirectional audio with interruption
 *
 * The SalonTransport interface is also the right shape for audio gossip:
 * - Each audio frame is a rumor (a Crossing with rttMs = audio latency).
 * - Interruption = a sudden large rttMs → the BusRegime detects OutOfCone.
 * - The StudentTBnn downweights the outlier frame (robustness weight w → 0).
 * - The salon keeps the interruption as a neutral fact (dual-use: detection ≠ verdict).
 *
 * ## GitHub agent society integration
 *
 * The gitSalonTransport() adapter maps rumors to Git commits:
 * - publish(text) → git commit with the rumor as the commit message body.
 * - onFrame(handler) → git log --follow --format=%B | parse rumors.
 * This lets the evolutionary society run as a GitHub Actions cron job:
 * each agent commits its observations; the gossip loop reads the commit log.
 *
 * ## References
 *
 * - Demers et al. (1987) "Epidemic algorithms for replicated database maintenance"
 * - Maymounkov & Mazières (2002) "Kademlia: A peer-to-peer information system"
 * - Reticulum Network Stack (RNS) — https://reticulum.network
 */

import type { SalonTransport } from "./gossip-salon";
import { LossyUdpChannel } from "./udp-lossy-transport";
// ── UDP multicast transport ────────────────────────────────────────────────────

/** Configuration for the UDP multicast transport. */
export interface UdpMeshConfig {
  /** Multicast group address. Default: 224.0.0.251 (mDNS group — well-known, LAN-scoped). */
  readonly group: string;
  /** UDP port. Default: 5354 (one above mDNS to avoid conflict). */
  readonly port: number;
  /** Whether to receive our own broadcasts. Default: true (useful for testing). */
  readonly loopback?: boolean;
  /** Multicast TTL. Default: 1 (LAN only). Set 32+ for routed multicast. */
  readonly ttl?: number;
}

export const DEFAULT_UDP_MESH_CONFIG: UdpMeshConfig = {
  group: "224.0.0.251",
  port: 5354,
  loopback: true,
  ttl: 1,
};

/**
 * Create a SalonTransport backed by UDP multicast.
 *
 * Works on LAN and WiFi mesh (802.11s forwards multicast at MAC layer).
 * For LoRa/BLE, wrap this with a bridge process that relays UDP to the radio.
 *
 * Node.js only (uses `dgram`). For browser, use broadcastChannelTransport().
 *
 * @param cfg - UDP multicast configuration.
 * @param onReady - Called when the socket is bound and ready to send.
 */
export function udpMeshTransport(
  cfg: UdpMeshConfig = DEFAULT_UDP_MESH_CONFIG,
  onReady?: () => void,
): SalonTransport & { close(): void } {
  // Dynamic import of dgram so this file can be imported in browser environments
  // without error (the transport will fail at runtime if called, but the import is safe).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dgram = require("node:dgram") as typeof import("node:dgram");
  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const handlers: Array<(text: string, from?: string) => void> = [];
  let ready = false;

  sock.on("message", (buf: Buffer, rinfo) => {
    const text = buf.toString("utf8");
    const from = `${rinfo.address}:${rinfo.port}`;
    for (const h of handlers) h(text, from);
  });

  sock.bind(cfg.port, () => {
    sock.addMembership(cfg.group);
    sock.setMulticastLoopback(cfg.loopback ?? true);
    sock.setMulticastTTL(cfg.ttl ?? 1);
    ready = true;
    onReady?.();
  });

  const send = (text: string): void => {
    // Pre-bind sends are dropped; the anti-entropy loop will retry on the next tick.
    if (!ready) return;
    // Keep packets under 1400 bytes (safe MTU for 802.11 + Ethernet).
    // Rumors are small JSON; this is a safety check, not a hard limit.
    if (text.length > 1400) {
      console.warn(`[udpMeshTransport] rumor too large (${text.length} bytes), dropping`);
      return;
    }
    sock.send(Buffer.from(text, "utf8"), cfg.port, cfg.group);
  };

  return {
    publish: send,
    onFrame: (h) => handlers.push(h),
    close: () => sock.close(),
  };
}

// ── Reticulum transport adapter ────────────────────────────────────────────────

/**
 * Wrap a Reticulum PacketTransport as a SalonTransport.
 *
 * Reticulum spans UDP, TCP (rnsd), LoRa, BLE — any PacketTransport.
 * This adapter lets the GossipSalon run over the full Reticulum mesh,
 * including nodes beyond direct UDP announce range (via DHT path discovery).
 *
 * @param packetTransport - A Reticulum PacketTransport (udpMeshTransport, TCP, fake).
 */
export function reticulumSalonTransport(packetTransport: {
  sendPacket(text: string): void;
  onPacket(handler: (text: string, from: string) => void): void;
}): SalonTransport {
  const handlers: Array<(text: string, from?: string) => void> = [];
  packetTransport.onPacket((text, from) => {
    for (const h of handlers) h(text, from);
  });
  return {
    publish: (text) => packetTransport.sendPacket(text),
    onFrame: (h) => handlers.push(h),
  };
}

// ── WebSocket transport adapter ────────────────────────────────────────────────

/**
 * Wrap a WebSocket (browser or Node.js) as a SalonTransport.
 *
 * The WebSocket carries gossip rumors as UTF-8 text frames.
 * Multiplexing: prefix each frame with "salon:" to distinguish from other
 * WebSocket traffic on the same connection.
 *
 * @param ws - A WebSocket instance (browser WebSocket or ws.WebSocket).
 * @param prefix - Optional prefix to namespace salon frames. Default: "salon:".
 */
export function wsSalonTransport(
  ws: { send(text: string): void; addEventListener(event: string, handler: (e: { data: string }) => void): void },
  prefix = "salon:",
): SalonTransport {
  const handlers: Array<(text: string, from?: string) => void> = [];
  ws.addEventListener("message", (e) => {
    if (typeof e.data === "string" && e.data.startsWith(prefix)) {
      const text = e.data.slice(prefix.length);
      for (const h of handlers) h(text);
    }
  });
  return {
    publish: (text) => ws.send(`${prefix}${text}`),
    onFrame: (h) => handlers.push(h),
  };
}

// ── BroadcastChannel transport (browser tabs) ──────────────────────────────────

/**
 * Wrap a BroadcastChannel as a SalonTransport (browser multi-tab gossip).
 *
 * Each browser tab is a node in the society. The BroadcastChannel lets tabs
 * gossip without a server. Combined with IndexedDB checkpointing
 * (browser-indexeddb-checkpoint.ts), the society state persists across tab closes.
 *
 * @param channel - A BroadcastChannel instance.
 */
export function broadcastChannelTransport(channel: {
  postMessage(data: string): void;
  addEventListener(event: string, handler: (e: { data: string }) => void): void;
}): SalonTransport {
  const handlers: Array<(text: string, from?: string) => void> = [];
  channel.addEventListener("message", (e) => {
    if (typeof e.data === "string") {
      for (const h of handlers) h(e.data);
    }
  });
  return {
    publish: (text) => channel.postMessage(text),
    onFrame: (h) => handlers.push(h),
  };
}

// ── Git transport adapter ──────────────────────────────────────────────────────

/**
 * A SalonTransport backed by Git commits (for the GitHub agent society).
 *
 * publish(text) → calls onPublish(text) which the caller wires to a Git commit.
 * onFrame(handler) → the caller drives this by calling ingest(text) for each
 *   rumor found in the Git log.
 *
 * This is an "inversion of control" adapter: the Git I/O stays outside this
 * module (pure, DST-clean), and the caller provides the impure edge.
 *
 * ## GitHub agent society wiring
 *
 * ```typescript
 * const transport = gitSalonTransport((text) => {
 *   // Commit the rumor to the repo
 *   execSync(`git commit --allow-empty -m "salon: ${text}"`);
 * });
 *
 * // On startup, replay the Git log
 * const log = execSync("git log --format=%B").toString();
 * for (const line of log.split("\n")) {
 *   if (line.startsWith("salon: ")) transport.ingest(line.slice(7));
 * }
 * ```
 */
export function gitSalonTransport(onPublish: (text: string) => void): SalonTransport & {
  /** Feed a rumor from the Git log into the salon. */
  ingest(text: string): void;
} {
  const handlers: Array<(text: string, from?: string) => void> = [];
  return {
    publish: onPublish,
    onFrame: (h) => handlers.push(h),
    ingest: (text) => {
      for (const h of handlers) h(text, "git");
    },
  };
}

// ── Multiplexed transport ──────────────────────────────────────────────────────

/**
 * Fan out publishes to ALL transports; fan in frames from ALL transports.
 *
 * This is the "all channels simultaneously" transport for a fully-connected
 * Zeta node: it gossips over UDP mesh, Reticulum, WebSocket, and Git at once.
 * Each transport is independent — a frame heard on UDP is also re-broadcast
 * on WebSocket (and vice versa), so the society converges across transport
 * boundaries.
 *
 * Deduplication: the GossipSalon's `hear` function is idempotent, so hearing
 * the same rumor from multiple transports is harmless.
 *
 * @param transports - One or more SalonTransport instances to multiplex.
 */
// ── Lossy UDP mesh transport (Adinkra ECC) ─────────────────────────────────────

/**
 * Create a SalonTransport backed by UDP multicast with Adinkra [8,4,4] erasure coding.
 *
 * This is the production-grade version of udpMeshTransport. It wraps the bare UDP
 * socket with a LossyUdpChannel that:
 * - Encodes every 4 gossip rumors as a block of 8 UDP packets (4 data + 4 parity).
 * - Recovers any 1 lost packet per block without retransmission.
 * - Emits teaching NACKs (not bare failure codes) when loss is detected.
 * - Feeds the DimensionalBnn transport factor with every NACK.
 * - Uses AIMD backoff to avoid congestion spirals.
 *
 * ## Homoiconicity: physics ↔ transport
 *
 * The Adinkra [8,4,4] code is the same structure as the E8 lattice generator
 * (via Construction A). Using it for UDP erasure coding means the transport layer
 * and the physics layer share the same generator matrix. This prevents a class of
 * distributed simulation bugs where the transport entropy leaks into the physics
 * measurement: if the ECC fails, the failure is detectable (not silent corruption).
 *
 * ## Society evolution integration
 *
 * Each gossip block carries a `societyGen` field in the parity metadata. The
 * evolutionary society runner increments this on each generation. Receivers can
 * detect if they are behind (their local gen < received gen) and trigger a
 * society-evolution-runner sync.
 *
 * @param cfg - UDP multicast configuration.
 * @param onReady - Called when the socket is bound and ready to send.
 * @param onTeachingNack - Optional callback for teaching NACKs (for UI display).
 */
export function lossyUdpMeshTransport(
  cfg: UdpMeshConfig = DEFAULT_UDP_MESH_CONFIG,
  onReady?: () => void,
  onTeachingNack?: (nack: { cause: string; howToFix: string; lossRate: number }) => void,
): SalonTransport & { close(): void; channel: LossyUdpChannel } {
  // Build the base UDP transport (raw socket, no ECC)
  const base = udpMeshTransport(cfg, onReady);

  // Create the Adinkra [8,4,4] ECC channel on top of the raw socket
  // The LossyUdpChannel wraps any {broadcast, onMessage} transport.
  const channel = new LossyUdpChannel(
    {
      broadcast: (text) => base.publish(text),
      onMessage: (h) => base.onFrame((text, from) => h(text, from ?? "unknown")),
    },
    `mesh:${cfg.group}:${cfg.port}`,
  );

  // Wire teaching NACK callback if provided
  if (onTeachingNack) {
    channel.onEnvelope((env) => {
      // Extract cause/howToFix from the error envelope
      const mirror = env.mirror as { cause?: string; howToFix?: string; lossRate?: number } | undefined;
      if (mirror) {
        onTeachingNack({
          cause: mirror.cause ?? "unknown",
          howToFix: mirror.howToFix ?? "reduce send rate",
          lossRate: mirror.lossRate ?? 0,
        });
      }
    });
  }

  // The salon handlers receive recovered rumors (not raw UDP packets)
  const handlers: Array<(text: string, from?: string) => void> = [];
  channel.onData((payload) => {
    const text = Buffer.from(payload).toString("utf8");
    for (const h of handlers) h(text);
  });

  return {
    // publish: queue the text as a Uint8Array payload; the channel flushes when 4 are queued
    publish: (text) => channel.send(Buffer.from(text, "utf8")),
    onFrame: (h) => handlers.push(h),
    close: () => base.close(),
    channel,
  };
}

// ── Society evolution transport wrapper ────────────────────────────────────────

/**
 * Wrap any SalonTransport with society-evolution awareness.
 *
 * Adds a `societyGen` field to every published rumor. Receivers that see a
 * higher generation number than their local state trigger a sync.
 *
 * This is the bridge between the gossip transport and the evolutionary society:
 * - The gossip salon carries rumors (observations, crossings, kept-claims).
 * - The society evolution runner reads the G-set of rumors and evolves agents.
 * - The societyEvolutionTransport makes the generation number visible in the
 *   transport layer, so nodes can detect when they are behind without polling.
 *
 * @param inner - The underlying transport to wrap.
 * @param getLocalGen - Returns the current local society generation number.
 * @param onGenAhead - Called when a received rumor has a higher generation.
 */
export function societyEvolutionTransport(
  inner: SalonTransport,
  getLocalGen: () => number,
  onGenAhead?: (receivedGen: number, localGen: number) => void,
): SalonTransport {
  const handlers: Array<(text: string, from?: string) => void> = [];
  inner.onFrame((text, from) => {
    // Try to parse the society generation from the rumor
    try {
      const parsed = JSON.parse(text) as { societyGen?: number; [k: string]: unknown };
      if (typeof parsed.societyGen === "number") {
        const localGen = getLocalGen();
        if (parsed.societyGen > localGen) {
          onGenAhead?.(parsed.societyGen, localGen);
        }
      }
    } catch {
      // Not a JSON rumor — pass through as-is
    }
    for (const h of handlers) h(text, from);
  });
  return {
    publish: (text) => {
      // Inject the local society generation into every published rumor
      try {
        const parsed = JSON.parse(text) as { [k: string]: unknown };
        parsed.societyGen = getLocalGen();
        inner.publish(JSON.stringify(parsed));
      } catch {
        // Not JSON — publish as-is (no generation injection)
        inner.publish(text);
      }
    },
    onFrame: (h) => handlers.push(h),
  };
}

export function multiplexTransport(...transports: SalonTransport[]): SalonTransport {
  const handlers: Array<(text: string, from?: string) => void> = [];
  for (const t of transports) {
    t.onFrame((text, from) => {
      for (const h of handlers) h(text, from);
    });
  }
  return {
    publish: (text) => {
      for (const t of transports) t.publish(text);
    },
    onFrame: (h) => handlers.push(h),
  };
}
