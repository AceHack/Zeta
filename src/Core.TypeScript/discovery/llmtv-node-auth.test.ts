import { describe, it, expect } from "bun:test";
import { createLlmtvNode, type Scheduler, type LlmtvNodeConfig } from "./llmtv-node";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";
import { generateKeypair } from "../ace/signing";
import { signMessage, type BeaconTrust, type BeaconSigner } from "./beacon-auth";

// BEACON-AUTH ADOPTION as a windowed migration (BUGS.md P1 #9304; Aaron 2026-07-03: greenfield,
// public API change OK, route to the team). The membrane (beacon-auth.ts) now actually runs at the
// node: outbound hello/probeMatch are signed, inbound is verified per `beaconMode`. Proofs:
//   1. REQUIRED ↔ REQUIRED — two signed nodes discover each other (the post-cutover steady state).
//   2. REQUIRED rejects legacy UNSIGNED — the flag-day breakage that motivates the window.
//   3. DUAL accepts signed AND legacy-unsigned (fires onUnsignedBeacon) — the overlap window.
//   4. DUAL still REJECTS a signed-but-UNTRUSTED beacon — no silent downgrade to the unsigned path.
//   5. REQUIRED without a signing key fails closed at construction.

// ── minimal fake mesh (synchronous multicast minus self-loopback) ──
function createFakeMesh() {
  const nodes: { id: string; handlers: ((t: string, f: string) => void)[] }[] = [];
  let clock = 0;
  const intervals: { ms: number; fn: () => void; last: number }[] = [];
  return {
    attach(id: string): DiscoveryTransport & BroadcastTransport {
      const self = { id, handlers: [] as ((t: string, f: string) => void)[] };
      nodes.push(self);
      const send = (text: string): void => {
        for (const n of nodes) if (n.id !== id) for (const h of n.handlers) h(text, id);
      };
      return { broadcast: send, publish: send, onMessage: (h) => self.handlers.push(h), onFrame: (h) => self.handlers.push(h) };
    },
    scheduler(): Scheduler {
      return {
        now: () => clock,
        setInterval: (ms, fn) => {
          const iv = { ms, fn, last: clock };
          intervals.push(iv);
          return () => {
            const i = intervals.indexOf(iv);
            if (i >= 0) intervals.splice(i, 1);
          };
        },
      };
    },
    advance(ms: number): void {
      const target = clock + ms;
      let guard = 0;
      for (;;) {
        let next = Infinity;
        for (const iv of intervals) {
          const t = iv.last + iv.ms;
          if (t <= target && t < next) next = t;
        }
        if (next === Infinity) break;
        clock = next;
        const firing = intervals.filter((iv) => iv.last + iv.ms === next);
        for (const iv of firing) iv.last = next;
        for (const iv of firing) iv.fn();
        if (++guard > 100000) throw new Error("interval storm");
      }
      clock = target;
    },
  };
}

const mind = (label: string): (() => SourceMind) => () => ({ role: "r", hat: "h", required: [{ label, temp: "hot", valueMilli: 500, epsilonMilli: 100 }] });

// A keyed persona: keypair + an OPAQUE signer (the node never sees the raw key) + the trust entry
// that says "this key speaks for zid-<name>". The default signer just composes signMessage.
const persona = (name: string) => {
  const kp = generateKeypair();
  const signer: BeaconSigner = (msg) => signMessage(msg, kp.privatePem);
  return { name, kp, signer, entry: { public_key: kp.publicSpkiB64, zid: `zid-${name}` } };
};

const cfg = (name: string, extra: Partial<LlmtvNodeConfig>): LlmtvNodeConfig => ({
  self: { persona: name, surface: "llmtv", instance: "0", node: "test" },
  zid: `zid-${name}`,
  routes: [{ kind: "udp", addr: `239.0.0.1:4200#${name}` }],
  source: { zid: `zid-${name}`, name },
  mind: mind(`${name} tick`),
  ttlMs: 10_000,
  helloEveryMs: 1_000,
  publishEveryMs: 1_000,
  ...extra,
});

describe("beacon-auth adoption — windowed migration at the live node", () => {
  it("REQUIRED ↔ REQUIRED: two signed nodes discover each other", () => {
    const a = persona("alexa");
    const b = persona("soraya");
    const trust: BeaconTrust = new Map([[a.kp.keyId, a.entry], [b.kp.keyId, b.entry]]);
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const tb = m.attach("soraya");
    const na = createLlmtvNode(cfg("alexa", { beacon: { mode: "required", signer: a.signer, trust } }), ta, ta, m.scheduler());
    const nb = createLlmtvNode(cfg("soraya", { beacon: { mode: "required", signer: b.signer, trust } }), tb, tb, m.scheduler());
    na.start();
    nb.start();
    m.advance(2_500);
    expect(na.peers().size).toBe(1);
    expect(nb.peers().size).toBe(1);
  });

  it("REQUIRED rejects a legacy UNSIGNED beacon (the flag-day breakage the window exists to avoid)", () => {
    const a = persona("alexa");
    const trust: BeaconTrust = new Map([[a.kp.keyId, a.entry]]);
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const tm = m.attach("mallory");
    const na = createLlmtvNode(cfg("alexa", { beacon: { mode: "required", signer: a.signer, trust } }), ta, ta, m.scheduler());
    const nm = createLlmtvNode(cfg("mallory", { beacon: { mode: "off" } }), tm, tm, m.scheduler()); // legacy unsigned
    na.start();
    nm.start();
    m.advance(2_500);
    expect(na.peers().size).toBe(0); // alexa refuses the unsigned hello
  });

  it("DUAL accepts BOTH a signed peer and a legacy-unsigned one (fires onUnsignedBeacon)", () => {
    const a = persona("alexa");
    const b = persona("soraya");
    const trust: BeaconTrust = new Map([[a.kp.keyId, a.entry], [b.kp.keyId, b.entry]]);
    let unsignedSeen = 0;
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const tb = m.attach("soraya");
    const tl = m.attach("legacy");
    const na = createLlmtvNode(cfg("alexa", { beacon: { mode: "dual", signer: a.signer, trust, onUnsigned: () => { unsignedSeen += 1; } } }), ta, ta, m.scheduler());
    const nb = createLlmtvNode(cfg("soraya", { beacon: { mode: "dual", signer: b.signer, trust } }), tb, tb, m.scheduler());
    const nl = createLlmtvNode(cfg("legacy", { beacon: { mode: "off" } }), tl, tl, m.scheduler());
    na.start();
    nb.start();
    nl.start();
    m.advance(2_500);
    expect(na.peers().size).toBe(2); // both the signed soraya and the unsigned legacy node
    expect(unsignedSeen).toBeGreaterThan(0); // the migration signal fired
  });

  it("DUAL still REJECTS a signed-but-UNTRUSTED beacon — no silent downgrade to unsigned", () => {
    const a = persona("alexa");
    const evil = persona("mallory"); // signs, but her key is NOT in alexa's trust store
    const trust: BeaconTrust = new Map([[a.kp.keyId, a.entry]]); // only alexa
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    const te = m.attach("mallory");
    const na = createLlmtvNode(cfg("alexa", { beacon: { mode: "dual", signer: a.signer, trust } }), ta, ta, m.scheduler());
    const ne = createLlmtvNode(cfg("mallory", { beacon: { mode: "required", signer: evil.signer, trust } }), te, te, m.scheduler());
    na.start();
    ne.start();
    m.advance(2_500);
    expect(na.peers().size).toBe(0); // untrusted-key ≠ not-signed-envelope, so no fallback
  });

  it("REQUIRED without a signer fails closed (JS-boundary backstop; the union blocks it in TS)", () => {
    const m = createFakeMesh();
    const ta = m.attach("alexa");
    // Cast past the discriminated union to simulate a plain-JS caller that omits the signer.
    const bad = { mode: "required" } as unknown as NonNullable<LlmtvNodeConfig["beacon"]>;
    expect(() => createLlmtvNode(cfg("alexa", { beacon: bad }), ta, ta, m.scheduler())).toThrow(/fail-closed/);
  });
});
