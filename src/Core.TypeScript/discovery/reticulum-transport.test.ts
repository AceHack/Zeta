import { describe, it, expect } from "bun:test";
import {
  destinationHash,
  observeAnnounce,
  expirePaths,
  encode,
  decode,
  createReticulumTransport,
  type PacketTransport,
  type PathTable,
  type Announce,
} from "./reticulum-transport";
import { createLlmtvNode, type Scheduler, type LlmtvNodeConfig } from "./llmtv-node";
import type { SourceMind } from "./llmtv-broadcast";
import { renderLlmtvGrid } from "../darkhall-ui/darkhall-tv";

// ── A topology-aware fake physical layer ──────────────────────────────────────
// A packet from `id` reaches only its neighbours (bidirectional adjacency). This lets us
// build a LINE A—B—C where A and C are NOT directly connected, so multi-hop routing and
// transport-node relay are actually exercised — not hidden by a full-broadcast hub.

function createFakePacketMesh() {
  const nodes = new Map<string, { neighbours: Set<string>; handlers: Array<(t: string, f: string) => void> }>();
  const adjacent = (a: string, b: string): boolean => Boolean(nodes.get(a)?.neighbours.has(b) || nodes.get(b)?.neighbours.has(a));
  return {
    attach(id: string, neighbours: readonly string[]): PacketTransport {
      nodes.set(id, { neighbours: new Set(neighbours), handlers: [] });
      return {
        sendPacket: (text) => {
          for (const [nid, n] of nodes) if (nid !== id && adjacent(id, nid)) for (const h of n.handlers) h(text, id);
        },
        onPacket: (h) => nodes.get(id)!.handlers.push(h),
      };
    },
  };
}

const clock = () => {
  let t = 0;
  return { now: () => t, set: (v: number) => (t = v), advance: (d: number) => (t += d) };
};

describe("destinationHash — self-certifying address from the ZetaId", () => {
  it("is deterministic (same zid → same dest) and 16 bytes of hex", () => {
    expect(destinationHash("zid-alexa")).toBe(destinationHash("zid-alexa"));
    expect(destinationHash("zid-alexa")).toHaveLength(32);
    expect(destinationHash("zid-alexa")).not.toBe(destinationHash("zid-soraya"));
  });
});

describe("observeAnnounce — best-hop path fold (idempotent, order-independent)", () => {
  const a0: Announce = { dest: "d1", zid: "z1", hops: 0, id: "a" };
  const a2: Announce = { dest: "d1", zid: "z1", hops: 2, id: "b" };

  it("keeps the lowest hop count; a worse path only refreshes liveness", () => {
    let t: PathTable = new Map();
    t = observeAnnounce(t, a2, 100); // learn at 2 hops
    expect(t.get("d1")!.hops).toBe(2);
    t = observeAnnounce(t, a0, 200); // better: 0 hops
    expect(t.get("d1")!.hops).toBe(0);
    t = observeAnnounce(t, a2, 300); // worse — hop stays 0 but liveness refreshes
    expect(t.get("d1")!.hops).toBe(0);
    expect(t.get("d1")!.lastSeenMs).toBe(300);
  });

  it("expirePaths drops routes unheard past the TTL", () => {
    let t: PathTable = new Map();
    t = observeAnnounce(t, a0, 1000);
    expect(expirePaths(t, 1500, 1000).size).toBe(1);
    expect(expirePaths(t, 3000, 1000).size).toBe(0);
  });
});

describe("decode — guarded; foreign / malformed input returns null", () => {
  it("round-trips a real frame and rejects junk", () => {
    const frame = { src: "d1", fid: "d1:1", announce: { dest: "d1", zid: "z1", hops: 0, id: "d1:1" } };
    expect(decode(encode(frame))).toEqual(frame);
    expect(decode("not json")).toBeNull();
    expect(decode(JSON.stringify({ schema: "other", frame }))).toBeNull();
    expect(decode(JSON.stringify({ schema: "zeta.reticulum.v1", frame: { src: "d" } }))).toBeNull();
  });
});

describe("two nodes — announces build each other's path tables", () => {
  it("each learns the other's destination at 0 hops (direct)", () => {
    const mesh = createFakePacketMesh();
    const c = clock();
    const ra = createReticulumTransport({ zid: "zid-a" }, mesh.attach("a", ["b"]), c);
    const rb = createReticulumTransport({ zid: "zid-b" }, mesh.attach("b", ["a"]), c);
    ra.onMessage(() => {}); // register so delivery path runs
    rb.onMessage(() => {});
    ra.broadcast("hi from a");
    rb.broadcast("hi from b");
    expect(ra.paths().get(rb.dest)!.hops).toBe(0);
    expect(rb.paths().get(ra.dest)!.hops).toBe(0);
  });
});

describe("three-node line A—B—C — multi-hop routing + transport-node relay, no storm", () => {
  it("C learns A only via B's relay (hops=1); dedup stops the frame there", () => {
    const mesh = createFakePacketMesh();
    const c = clock();
    const ra = createReticulumTransport({ zid: "zid-a" }, mesh.attach("a", ["b"]), c);
    // B is the transport node between A and C — created for its relay side-effect (its internal
    // onPacket forwards A's frame to C); the handle itself is unused.
    createReticulumTransport({ zid: "zid-b" }, mesh.attach("b", ["a", "c"]), c);
    const rc = createReticulumTransport({ zid: "zid-c" }, mesh.attach("c", ["b"]), c);
    const cReceived: string[] = [];
    rc.onFrame((t) => cReceived.push(t));

    ra.broadcast("payload-from-a");

    // C is not A's neighbour — it only heard A because B relayed
    expect(rc.paths().get(ra.dest)!.hops).toBe(1);
    // and it got the payload exactly once (fid dedup — no relay storm)
    expect(cReceived.filter((t) => t.includes("payload-from-a"))).toHaveLength(1);
  });
});

// ── Integration: the real llmtv-node running over the Reticulum transport ──────

const mindOf = (role: string, hat: string, label: string, secret?: string): (() => SourceMind) => () => ({
  role,
  hat,
  required: [{ label, temp: "hot", valueMilli: 800, epsilonMilli: 100 }],
  ...(secret ? { personal: { frosted: true, veilLabel: `${hat} veil`, predictions: [{ label: secret, temp: "warm", valueMilli: 500, epsilonMilli: 300 }] } } : {}),
});

const nodeCfg = (name: string, mind: () => SourceMind): LlmtvNodeConfig => ({
  self: { persona: name, surface: "llmtv", instance: "0", node: "rns" },
  zid: `zid-${name}`,
  routes: [{ kind: "reticulum", addr: destinationHash(`zid-${name}`) }],
  source: { zid: `zid-${name}`, name },
  mind,
  ttlMs: 10_000,
  helloEveryMs: 1_000,
  publishEveryMs: 1_000,
});

function fakeScheduler(c: ReturnType<typeof clock>): { sched: Scheduler; fire: (ms: number) => void } {
  const intervals: Array<{ ms: number; fn: () => void; last: number }> = [];
  const sched: Scheduler = {
    now: () => c.now(),
    setInterval: (ms, fn) => {
      const iv = { ms, fn, last: c.now() };
      intervals.push(iv);
      return () => {
        const i = intervals.indexOf(iv);
        if (i >= 0) intervals.splice(i, 1);
      };
    },
  };
  const fire = (ms: number): void => {
    const target = c.now() + ms;
    for (;;) {
      let next = Infinity;
      for (const iv of intervals) next = Math.min(next, iv.last + iv.ms);
      if (next === Infinity || next > target) break;
      c.set(next);
      const firing = intervals.filter((iv) => iv.last + iv.ms === next);
      for (const iv of firing) iv.last = next;
      for (const iv of firing) iv.fn();
    }
    c.set(target);
  };
  return { sched, fire };
}

describe("integration — llmtv-nodes converge over the Reticulum transport, frost intact", () => {
  it("two nodes tile each other; frosted content never crosses the mesh", () => {
    const mesh = createFakePacketMesh();
    const c = clock();
    const { sched, fire } = fakeScheduler(c);
    const ra = createReticulumTransport({ zid: "zid-alexa" }, mesh.attach("a", ["b"]), c);
    const rb = createReticulumTransport({ zid: "zid-otto" }, mesh.attach("b", ["a"]), c);
    const na = createLlmtvNode(nodeCfg("alexa", mindOf("coding", "coder hat", "green", "SECRET hope")), ra, ra, sched);
    const nb = createLlmtvNode(nodeCfg("otto", mindOf("shadow", "shadow hat", "ferry")), rb, rb, sched);

    na.start();
    nb.start();
    fire(2_000);

    expect(na.society("S4").dwellers.map((d) => d.name)).toEqual(["otto"]);
    const html = renderLlmtvGrid(nb.society("S4"));
    expect(html).toContain('data-dweller="alexa"');
    expect(html).toContain("coder hat veil"); // public veil label crossed the mesh
    expect(html).not.toContain("SECRET hope"); // frosted content did not
  });
});
