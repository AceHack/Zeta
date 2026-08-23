// udp-transport — the first physical transport for the mesh: UDP multicast (shadow*).
//
// The thin IMPURE EDGE. discovery-beacon.ts and llmtv-broadcast.ts are pure; this is the
// one place a real socket lives — the injected port the node's entropy actually crosses
// (noninterference §13: metered at the membrane, nowhere else). Per the beacon's design,
// UDP multicast is the FIRST transport, not the only one — a Reticulum announce or a DHT
// ping plugs into the same DiscoveryTransport/BroadcastTransport shape later, no core change.
//
// One udp4 multicast socket carries BOTH message families: `broadcast` (discovery) and
// `publish` (frames) are the same send; `onMessage` and `onFrame` both receive every
// packet, and the guarded decoders keep only their own schema (a frame arriving at
// onMessage decodes to null and is dropped, and vice versa). The wire is TEXT (JSON) — no
// binary in the proof lineage.

import type * as dgramTypes from "node:dgram";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport } from "./llmtv-broadcast";

let dgram: any = null;
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    const dgramName = "node:dgram";
    dgram = await import(/* @vite-ignore */ dgramName);
  } catch(e) {}
}

export interface UdpMeshConfig {
  /// The multicast group (e.g. "239.255.42.99" — an admin-scoped IPv4 multicast address).
  readonly group: string;
  readonly port: number;
  /// Receive our own sent packets back (needed to run several nodes on one host in a demo;
  /// the node filters its own echo by zid). Default true.
  readonly loopback?: boolean;
}

export interface UdpMeshTransport extends DiscoveryTransport, BroadcastTransport {
  close(): void;
}

/// Open a UDP multicast socket and expose it as the mesh transport. `onReady` (if given)
/// fires once the socket has joined the group and is sending. The core never sees any of
/// this — it only holds the DiscoveryTransport/BroadcastTransport interface.
export function createUdpMeshTransport(cfg: UdpMeshConfig, onReady?: () => void): UdpMeshTransport {
  if (typeof dgram === 'undefined' || !dgram || typeof dgram.createSocket !== 'function') {
    console.warn("[udp-transport] dgram.createSocket is not supported. Using mock transport.");
    const send = (_text: string) => {};
    if (onReady) setTimeout(onReady, 0);
    return {
      broadcast: send,
      publish: send,
      onMessage: () => {},
      onFrame: () => {},
      close: () => {}
    };
  }

  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const handlers: Array<(text: string, from: string) => void> = [];
  let ready = false;

  sock.on("message", (buf: Buffer, rinfo: dgramTypes.RemoteInfo) => {
    const text = buf.toString("utf8");
    const from = `${rinfo.address}:${rinfo.port}`;
    for (const h of handlers) h(text, from);
  });

  sock.bind(cfg.port, () => {
    sock.addMembership(cfg.group);
    sock.setMulticastLoopback(cfg.loopback ?? true);
    ready = true;
    if (onReady) onReady();
  });

  const send = (text: string): void => {
    if (!ready) return; // pre-bind sends are dropped; the node re-announces on its hello timer
    sock.send(Buffer.from(text, "utf8"), cfg.port, cfg.group);
  };

  return {
    broadcast: send,
    publish: send,
    onMessage: (h) => handlers.push(h),
    onFrame: (h) => handlers.push(h),
    close: () => sock.close(),
  };
}

/// The real scheduler — wraps the platform clock + timers. This is the impure twin of the
/// fake scheduler the tests drive by hand; both satisfy the node's injected `Scheduler`.
export function systemScheduler(): { now(): number; setInterval(ms: number, fn: () => void): () => void } {
  return {
    now: () => Date.now(),
    setInterval: (ms, fn) => {
      const handle = setInterval(fn, ms);
      return () => clearInterval(handle);
    },
  };
}
