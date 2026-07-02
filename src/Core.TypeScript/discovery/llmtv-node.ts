// llmtv-node — where the two halves of the bus meet: discovery + broadcast, live (shadow*).
//
// Aaron 2026-07-02: "lets make it live." A node ANNOUNCES itself on the mesh (the
// discovery beacon), DISCOVERS its peers, and PUBLISHES its LLMTV frames to whoever it
// found — folding everyone else's frames into a live society grid. This is the runner
// that ties discovery-beacon.ts + llmtv-broadcast.ts together.
//
// The runner is PURE OVER INJECTED PORTS: the transports (a socket) and the scheduler (a
// clock + timers) are handed in. So the same node logic runs deterministically under a
// fake in-memory bus (DST §7 — replay two nodes converging with no real socket) and
// physically over UDP multicast (udp-transport.ts) with zero code change. Entropy crosses
// only through the injected ports (noninterference §13); the internal counters are
// deterministic. Scale-free (§1): one node and N nodes run the same path.
//
// The publish/hello cadences are single dial-able parameters (the DoP=1 cooperative-loop
// form of async-all-the-way — one metered timer each, cancellable, no un-knobbed spawn).

import {
  observe,
  expire,
  probeMatchReply,
  encode as encodeDiscovery,
  decode as decodeDiscovery,
  type EndpointRef,
  type RouteHint,
  type PeerTable,
  type DiscoveryTransport,
} from "./discovery-beacon";
import {
  publishFrame,
  observeBroadcast,
  expireChannels,
  encode as encodeBroadcast,
  decode as decodeBroadcast,
  toLlmtvTranscript,
  type BroadcastSource,
  type SourceMind,
  type ChannelTable,
  type BroadcastTransport,
} from "./llmtv-broadcast";
import type { LlmtvTranscript } from "../darkhall-ui/darkhall-tv";

/// The injected time port — the ONLY clock/timer the node sees (no ambient `Date.now` /
/// `setInterval` in the core). `now` reads the tick; `setInterval` registers a cadence and
/// returns its canceller. The real impl wraps the platform; the fake drives it by hand.
export interface Scheduler {
  now(): number;
  setInterval(ms: number, fn: () => void): () => void;
}

export interface LlmtvNodeConfig {
  readonly self: EndpointRef;
  readonly zid: string;
  readonly routes: readonly RouteHint[];
  readonly source: BroadcastSource;
  /// The node's current mind, sampled at each publish tick (may vary over time). It is
  /// projected through the frost membrane by publishFrame — frosted content never crosses.
  readonly mind: () => SourceMind;
  readonly ttlMs: number;
  readonly helloEveryMs: number;
  readonly publishEveryMs: number;
}

export interface LlmtvNodeHandle {
  start(): void;
  stop(): void;
  peers(): PeerTable;
  channels(): ChannelTable;
  /// The live society grid folded from every source heard — the same transcript shape the
  /// still-frame generator renders (one IR).
  society(seed: string): LlmtvTranscript;
  onUpdate(fn: () => void): void;
}

/// Build a live LLMTV node over injected transports + scheduler. `disco` and `bcast` may be
/// the SAME object (one socket carrying both message families — the schema tag disambiguates
/// on decode), or two. Nothing here imports a socket or a clock.
export function createLlmtvNode(
  config: LlmtvNodeConfig,
  disco: DiscoveryTransport,
  bcast: BroadcastTransport,
  sched: Scheduler,
): LlmtvNodeHandle {
  let peers: PeerTable = new Map();
  let channels: ChannelTable = new Map();
  let tick = 0; // monotonic seq/frame counter for this node's own frames
  const cancels: Array<() => void> = [];
  const updateHandlers: Array<() => void> = [];
  const fireUpdate = (): void => {
    for (const h of updateHandlers) h();
  };

  // Inbound discovery: fold peers, answer a probe that matches us.
  disco.onMessage((text) => {
    const msg = decodeDiscovery(text);
    if (!msg) return; // not a discovery packet (or garbage) — ignore
    const result = observe(config.self, peers, msg, sched.now());
    peers = result.table;
    if (msg.t === "probe") {
      const reply = probeMatchReply(config.self, config.zid, config.routes, msg);
      if (reply) disco.broadcast(encodeDiscovery(reply));
    }
    for (const r of result.replies) disco.broadcast(encodeDiscovery(r));
  });

  // Inbound frames: fold into the channel table (LWW-by-seq); ignore our own loopback echo.
  bcast.onFrame((text) => {
    const msg = decodeBroadcast(text);
    if (!msg) return; // not a broadcast packet (or garbage) — ignore
    if (msg.source.zid === config.source.zid) return; // our own echo off the multicast group
    const next = observeBroadcast(channels, msg, sched.now());
    if (next !== channels) {
      channels = next;
      fireUpdate();
    }
  });

  const announce = (): void => {
    disco.broadcast(encodeDiscovery({ t: "hello", ep: config.self, zid: config.zid, routes: config.routes, seq: tick }));
  };

  const publish = (): void => {
    tick += 1;
    bcast.publish(encodeBroadcast(publishFrame(config.source, tick, tick, config.mind())));
  };

  const gc = (): void => {
    peers = expire(peers, sched.now(), config.ttlMs);
    const next = expireChannels(channels, sched.now(), config.ttlMs);
    if (next !== channels) {
      channels = next;
      fireUpdate();
    }
  };

  return {
    start() {
      announce();
      publish();
      cancels.push(
        sched.setInterval(config.helloEveryMs, () => {
          announce();
          gc();
        }),
      );
      cancels.push(sched.setInterval(config.publishEveryMs, publish));
    },
    stop() {
      // going dark — tell the mesh this source is off-air (one-way, like the frames)
      bcast.publish(encodeBroadcast({ t: "dark", source: config.source, seq: tick + 1 }));
      for (const c of cancels) c();
      cancels.length = 0;
    },
    peers: () => peers,
    channels: () => channels,
    society: (seed) => toLlmtvTranscript(channels, seed),
    onUpdate: (fn) => {
      updateHandlers.push(fn);
    },
  };
}
