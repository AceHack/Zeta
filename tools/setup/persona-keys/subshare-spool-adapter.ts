// subshare-spool-adapter.ts — ADAPTER 1. A spool of text files, carried by
// whatever you have: a WireGuard/headscale mesh, scp, a courier, a USB stick.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// WHAT THIS IS AND WHAT IT DELIBERATELY IS NOT
// ============================================================================
//
// This is the smallest thing that satisfies SubshareTransportPort and unblocks a
// three-house ceremony today. It is a directory:
//
//     <spool>/<ceremonyId>/<toX>/<fromX>-<digest>.json
//
// `offer` writes one file. `collect` reads the directory. That is the entire
// adapter, and its smallness is the point: the ceremony's security is in
// subshare-envelope.ts, above the port, so an adapter has nothing to get wrong.
//
// It is NOT a VPN and it does not want to be. Whatever moves the directory is
// the carrier, and every carrier below works because the port's baseline is
// store-and-forward:
//
//   * tailscale / headscale (WireGuard): `tailscale file cp`, or scp over the
//     mesh IP, or a syncthing share pinned to the mesh. Adds metadata
//     concealment and coarse admission. Adds NO property the ceremony depends on.
//   * sneakernet: copy the directory to a USB stick and drive it. Works because
//     nothing here needs a session.
//   * Reticulum / LoRa: each file is text, so it rides
//     src/Core.TypeScript/discovery/reticulum-transport.ts's
//     PacketTransport.sendPacket(text: string) with no re-encoding. ~1.5KB per
//     datagram is several LoRa frames, so this is slow, not impossible.
//   * the planned TCP-hole-punch / websocket-reverse-tunnel / DHT adapter: it
//     replaces THIS FILE and nothing else. No security code moves.
//
// ============================================================================
// WHY THE FILENAME CARRIES THE DIGEST
// ============================================================================
//
// `offer` must be idempotent (port contract). Content-addressing the filename
// makes re-offering the identical datagram a no-op write of identical bytes, and
// makes a CONFLICTING datagram from the same holder land as a SECOND file rather
// than silently overwriting the first -- so the recipient sees both and the
// replay guard rejects the pair, instead of the last writer quietly winning.
// Idempotency (§12) as a filename, not as a lock (§2 lock-free).
//
// Two honest limits: a spool leaks who-sent-to-whom to anyone who can read the
// directory (P1 is about CONTENT, and the envelope holds it), and a spool cannot
// promise durability -- a carrier that loses the directory loses datagrams, and
// the answer is to re-offer, which the contract makes safe.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { datagramDigest } from "./subshare-envelope.ts";
import {
  SUBSHARE_DATAGRAM_SCHEMA,
  ordinalCompare,
  type AdapterCapabilities,
  type CeremonyAddress,
  type SealedDatagram,
  type SubshareTransportPort,
} from "./subshare-transport-port.ts";

/** Path-safe, and it rejects rather than sanitising -- a mangled id is a bug. */
function safeSegment(s: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(s)) {
    throw new Error(`subshare-spool: unsafe path segment ${JSON.stringify(s)}`);
  }
  return s;
}

function parseDatagram(text: string): SealedDatagram | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof raw !== "object" || raw === null) return undefined;
  const d = raw as Record<string, unknown>;
  if (d.schema !== SUBSHARE_DATAGRAM_SCHEMA) return undefined;
  if (typeof d.ceremonyId !== "string" || typeof d.body !== "string") return undefined;
  if (typeof d.fromX !== "number" || typeof d.toX !== "number") return undefined;
  return d as unknown as SealedDatagram;
}

const SPOOL_CAPABILITIES: AdapterCapabilities = {
  // A spool has no session at all -- that is what makes it the honest baseline.
  liveSession: false,
  orderedDelivery: false,
  deduplicates: false,
  // The CARRIER may conceal metadata (a WireGuard mesh does). The spool does not.
  metadataConcealment: false,
  offlineCapable: true,
};

/**
 * Filesystem spool. `root` is a directory you can copy by any means.
 *
 * Genuinely async I/O throughout (no Task.Run-shaped sync-in-async), so a
 * single-threaded ceremony driver yields rather than blocks.
 */
export function createSpoolTransport(root: string): SubshareTransportPort {
  return {
    adapterName: `spool:${root}`,
    capabilities: SPOOL_CAPABILITIES,

    async offer(datagram: SealedDatagram): Promise<void> {
      const dir = join(root, safeSegment(datagram.ceremonyId), safeSegment(String(datagram.toX)));
      await mkdir(dir, { recursive: true });
      const name = `${String(datagram.fromX)}-${datagramDigest(datagram.body).slice(0, 16)}.json`;
      // Same datagram -> same filename -> same bytes. Re-offer is a no-op.
      await writeFile(join(dir, name), `${JSON.stringify(datagram, null, 2)}\n`, "utf8");
    },

    async collect(address: CeremonyAddress): Promise<readonly SealedDatagram[]> {
      const dir = join(root, safeSegment(address.ceremonyId), safeSegment(String(address.toX)));
      let names: string[];
      try {
        names = await readdir(dir);
      } catch {
        // Nothing has arrived. That is not an error -- the contract says [].
        return [];
      }
      const out: SealedDatagram[] = [];
      // Ordinal, never localeCompare: readdir order varies by filesystem, and the
      // recipient must see the same set on every host. (The ORDER does not matter
      // to the ceremony -- the fold commutes -- but reproducibility does, for DST.)
      const ordered = names.filter((n) => n.endsWith(".json")).sort(ordinalCompare);
      for (const n of ordered) {
        const text = await readFile(join(dir, n), "utf8");
        const d = parseDatagram(text);
        // A junk file in the spool is a carrier problem, not a ceremony problem:
        // drop it here and let the recipient's completeness check notice a gap.
        if (d !== undefined) out.push(d);
      }
      return out;
    },
  };
}

/**
 * In-memory spool with the SAME semantics, for DST and conformance runs.
 *
 * `snapshot`/`restore` exist to prove the sessionless claim in a test: a
 * transport can be serialised to text, the instance thrown away, and a fresh
 * instance built from the text -- which is what "the sender process and the
 * recipient process never ran at the same time" looks like in a unit test.
 */
export function createMemoryTransport(initial?: Record<string, string>): SubshareTransportPort & {
  snapshot: () => Record<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  const keyOf = (d: SealedDatagram): string =>
    `${d.ceremonyId}/${String(d.toX)}/${String(d.fromX)}-${datagramDigest(d.body)}`;

  return {
    adapterName: "memory-spool",
    capabilities: SPOOL_CAPABILITIES,
    offer: (datagram) => {
      store.set(keyOf(datagram), JSON.stringify(datagram));
      return Promise.resolve();
    },
    collect: (address) => {
      const prefix = `${address.ceremonyId}/${String(address.toX)}/`;
      const out: SealedDatagram[] = [];
      for (const [k, v] of store) {
        if (!k.startsWith(prefix)) continue;
        const d = parseDatagram(v);
        if (d !== undefined) out.push(d);
      }
      return Promise.resolve(out);
    },
    snapshot: () => Object.fromEntries([...store.entries()].sort((a, b) => ordinalCompare(a[0], b[0]))),
  };
}
