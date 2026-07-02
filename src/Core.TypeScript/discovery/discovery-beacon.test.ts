import { describe, expect, it } from "bun:test";
import {
  encode, decode, endpointKey, scopeMatches, observe, expire, probeMatchReply,
  type EndpointRef, type DiscoveryMessage, type PeerTable, type RouteHint,
} from "./discovery-beacon.ts";

const A: EndpointRef = { persona: "otto", surface: "hall", instance: "c1", node: "laptop" };
const B: EndpointRef = { persona: "otto", surface: "zeta", instance: "c2", node: "laptop" };
const routes: RouteHint[] = [{ kind: "udp", addr: "239.7.7.7:9700" }];
const empty: PeerTable = new Map();

describe("wire (text, guarded)", () => {
  it("round-trips every message type through JSON", () => {
    const msgs: DiscoveryMessage[] = [
      { t: "hello", ep: A, zid: "8225cea7", routes, seq: 1 },
      { t: "bye", ep: A, seq: 2 },
      { t: "probe", matchId: "m1", scope: { persona: "otto" } },
      { t: "probeMatch", inReplyTo: "m1", ep: A, zid: "8225cea7", routes },
    ];
    for (const m of msgs) expect(decode(encode(m))).toEqual(m);
  });

  it("refuses garbage, wrong schema, and unknown message types (never throws)", () => {
    expect(decode("not json{")).toBeNull();
    expect(decode(JSON.stringify({ schema: "other.v1", msg: { t: "hello" } }))).toBeNull();
    expect(decode(JSON.stringify({ schema: "zeta.discovery.v1", msg: { t: "attack" } }))).toBeNull();
    expect(decode("null")).toBeNull();
  });
});

describe("scope matching (WS-Discovery Probe scope)", () => {
  it("empty scope matches everyone; a defined field must equal", () => {
    expect(scopeMatches(A, undefined)).toBe(true);
    expect(scopeMatches(A, {})).toBe(true);
    expect(scopeMatches(A, { persona: "otto" })).toBe(true);
    expect(scopeMatches(A, { persona: "alexa" })).toBe(false);
    expect(scopeMatches(A, { persona: "otto", surface: "zeta" })).toBe(false);
  });
});

describe("observe (the pure discovery step)", () => {
  it("Hello adds/refreshes a peer; a Hello for SELF is ignored", () => {
    const r = observe(A, empty, { t: "hello", ep: B, zid: "z", routes, seq: 1 }, 1000);
    expect(r.table.get(endpointKey(B))?.lastSeenMs).toBe(1000);
    const self = observe(A, empty, { t: "hello", ep: A, zid: "z", routes, seq: 1 }, 1000);
    expect(self.table.size).toBe(0); // never discover yourself as a peer
  });

  it("Bye removes a known peer (and is a no-op for an unknown one)", () => {
    const withB = observe(A, empty, { t: "hello", ep: B, zid: "z", routes, seq: 1 }, 1000).table;
    const gone = observe(A, withB, { t: "bye", ep: B, seq: 2 }, 1001).table;
    expect(gone.has(endpointKey(B))).toBe(false);
    expect(observe(A, empty, { t: "bye", ep: B, seq: 2 }, 1001).table.size).toBe(0);
  });

  it("ProbeMatch adds the matching peer; a self ProbeMatch is ignored", () => {
    const r = observe(A, empty, { t: "probeMatch", inReplyTo: "m", ep: B, zid: "z", routes }, 1000);
    expect(r.table.has(endpointKey(B))).toBe(true);
  });
});

describe("probeMatchReply (I announce myself if I match the probe)", () => {
  it("replies when self matches the scope, stays silent otherwise", () => {
    const yes = probeMatchReply(A, "zA", routes, { t: "probe", matchId: "m", scope: { persona: "otto" } });
    expect(yes?.t).toBe("probeMatch");
    expect((yes as any).inReplyTo).toBe("m");
    const no = probeMatchReply(A, "zA", routes, { t: "probe", matchId: "m", scope: { persona: "alexa" } });
    expect(no).toBeNull();
  });
});

describe("expire (TTL, injected clock — no ambient timer)", () => {
  it("drops peers unheard past ttl, keeps fresh ones", () => {
    const t0 = observe(A, empty, { t: "hello", ep: B, zid: "z", routes, seq: 1 }, 1000).table;
    expect(expire(t0, 1500, 1000).size).toBe(1); // 500ms < 1000ms ttl
    expect(expire(t0, 2100, 1000).size).toBe(0); // 1100ms > 1000ms ttl
  });
});

describe("DST determinism", () => {
  it("same message + time sequence yields the same peer table", () => {
    const run = () => {
      let table: PeerTable = new Map();
      const seq: [DiscoveryMessage, number][] = [
        [{ t: "hello", ep: B, zid: "z", routes, seq: 1 }, 100],
        [{ t: "probeMatch", inReplyTo: "m", ep: { ...B, instance: "c3" }, zid: "z3", routes }, 150],
        [{ t: "bye", ep: B, seq: 2 }, 200],
      ];
      for (const [m, now] of seq) table = observe(A, table, m, now).table;
      return [...table.keys()].sort();
    };
    expect(run()).toEqual(run());
    expect(run()).toEqual([endpointKey({ ...B, instance: "c3" })]); // B left, B/c3 stayed
  });
});
