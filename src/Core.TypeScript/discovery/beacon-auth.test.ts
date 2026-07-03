import { describe, expect, it } from "bun:test";
import { generateKeypair, publicKeyInfoFromPrivatePem } from "../ace/signing.ts";
import { observe, endpointKey, type DiscoveryMessage, type EndpointRef, type PeerTable, type RouteHint } from "./discovery-beacon.ts";
import { observeSigned, signMessage, type BeaconTrust, type BeaconTrustEntry } from "./beacon-auth.ts";

// Two travelers with keyring-shaped Ed25519 keys, one attacker with a key of their own.
const kOtto = generateKeypair();
const kAlexa = generateKeypair();
const kMallory = generateKeypair();

const OTTO: EndpointRef = { persona: "otto", surface: "hall", instance: "c1", node: "laptop" };
const ALEXA: EndpointRef = { persona: "alexa", surface: "zeta", instance: "c2", node: "laptop" };
const routes: RouteHint[] = [{ kind: "udp", addr: "239.7.7.7:9700" }];
const empty: PeerTable = new Map();

const entry = (k: { publicSpkiB64: string }, zid: string): BeaconTrustEntry => ({ public_key: k.publicSpkiB64, zid });
// The trust store: key_id → (public key, the zid it speaks for). Mallory is NOT in it.
const trust: BeaconTrust = new Map([
  [kOtto.keyId, entry(kOtto, "zid-otto")],
  [kAlexa.keyId, entry(kAlexa, "zid-alexa")],
]);

const helloAlexa: DiscoveryMessage = { t: "hello", ep: ALEXA, zid: "zid-alexa", routes, seq: 1 };

describe("signed fold (the happy path is unchanged discovery, now authenticated)", () => {
  it("a self-signed hello folds into the table exactly like the pure core", () => {
    const r = observeSigned(OTTO, empty, signMessage(helloAlexa, kAlexa.privatePem), 1000, trust);
    expect(r.verdict).toEqual({ ok: true, key_id: kAlexa.keyId, zid: "zid-alexa" });
    expect(r.table).toEqual(observe(OTTO, empty, helloAlexa, 1000).table);
  });

  it("a self-signed bye removes the peer (leave is the peer's own right)", () => {
    const withAlexa = observeSigned(OTTO, empty, signMessage(helloAlexa, kAlexa.privatePem), 1000, trust).table;
    const bye: DiscoveryMessage = { t: "bye", ep: ALEXA, seq: 2 };
    const r = observeSigned(OTTO, withAlexa, signMessage(bye, kAlexa.privatePem), 1001, trust);
    expect(r.verdict.ok).toBe(true);
    expect(r.table.has(endpointKey(ALEXA))).toBe(false);
  });

  it("any trusted traveler may probe; probeMatch binds the zid to the signer", () => {
    const probe: DiscoveryMessage = { t: "probe", matchId: "m1", scope: { persona: "otto" } };
    expect(observeSigned(OTTO, empty, signMessage(probe, kAlexa.privatePem), 1000, trust).verdict.ok).toBe(true);
    const pm: DiscoveryMessage = { t: "probeMatch", inReplyTo: "m1", ep: ALEXA, zid: "zid-alexa", routes };
    const r = observeSigned(OTTO, empty, signMessage(pm, kAlexa.privatePem), 1000, trust);
    expect(r.verdict.ok).toBe(true);
    expect(r.table.has(endpointKey(ALEXA))).toBe(true);
  });
});

describe("the attacks the unsigned wire allowed are now refused (BUGS.md P1)", () => {
  it("SPOOF: an untrusted key cannot fold anything (unsigned wire is dead)", () => {
    const r = observeSigned(OTTO, empty, signMessage(helloAlexa, kMallory.privatePem), 1000, trust);
    expect(r.verdict).toEqual({ ok: false, reason: "untrusted-key" });
    expect(r.table.size).toBe(0);
  });

  it("POISON: a trusted key cannot announce someone ELSE's zid (zid-mismatch)", () => {
    // Otto's key is trusted — but it does not own zid-alexa.
    const r = observeSigned(OTTO, empty, signMessage(helloAlexa, kOtto.privatePem), 1000, trust);
    expect(r.verdict).toEqual({ ok: false, reason: "zid-mismatch" });
    expect(r.table.size).toBe(0);
  });

  it("FORGED EVICT: a bye not signed by the leaving peer is refused (forged Z-set retraction)", () => {
    const withAlexa = observeSigned(OTTO, empty, signMessage(helloAlexa, kAlexa.privatePem), 1000, trust).table;
    const bye: DiscoveryMessage = { t: "bye", ep: ALEXA, seq: 9 };
    const r = observeSigned(OTTO, withAlexa, signMessage(bye, kOtto.privatePem), 1001, trust);
    expect(r.verdict).toEqual({ ok: false, reason: "bye-not-self-signed" });
    expect(r.table.has(endpointKey(ALEXA))).toBe(true); // Alexa is still there
  });

  it("TAMPER: altering the signed message breaks the signature", () => {
    const text = signMessage(helloAlexa, kAlexa.privatePem);
    const tampered = JSON.stringify({ ...JSON.parse(text), msg: { ...helloAlexa, routes: [{ kind: "udp", addr: "6.6.6.6:666" }] } });
    const r = observeSigned(OTTO, empty, tampered, 1000, trust);
    expect(r.verdict).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("hostile wire never throws and never writes: garbage, unsigned legacy, unknown-peer bye", () => {
    expect(observeSigned(OTTO, empty, "not json{", 1000, trust).verdict).toEqual({ ok: false, reason: "not-signed-envelope" });
    // A LEGACY unsigned discovery message (the old wire) is refused — the membrane is total.
    const legacy = JSON.stringify({ schema: "zeta.discovery.v1", msg: helloAlexa });
    expect(observeSigned(OTTO, empty, legacy, 1000, trust).verdict).toEqual({ ok: false, reason: "not-signed-envelope" });
    const bye: DiscoveryMessage = { t: "bye", ep: ALEXA, seq: 1 };
    expect(observeSigned(OTTO, empty, signMessage(bye, kAlexa.privatePem), 1000, trust).verdict).toEqual({ ok: false, reason: "bye-unknown-peer" });
    // An envelope whose inner message is not discovery vocabulary is refused.
    const smuggled = signMessage({ t: "attack" } as unknown as DiscoveryMessage, kAlexa.privatePem);
    expect(observeSigned(OTTO, empty, smuggled, 1000, trust).verdict).toEqual({ ok: false, reason: "bad-inner-message" });
  });
});

describe("dual-key overlap rotation (ADR 2026-06-15) — two keys, one zid, both accepted", () => {
  it("old + new key both speak for the zid during the window; drop = revoke", () => {
    const kNew = generateKeypair();
    const rotating: BeaconTrust = new Map([
      [kAlexa.keyId, entry(kAlexa, "zid-alexa")], // old key (phase 2: readers accept both)
      [kNew.keyId, entry(kNew, "zid-alexa")], // new key
    ]);
    for (const k of [kAlexa, kNew]) {
      const r = observeSigned(OTTO, empty, signMessage(helloAlexa, k.privatePem), 1000, rotating);
      expect(r.verdict.ok).toBe(true);
    }
    // Phase 3 — the old key is dropped from trust: it can no longer speak.
    const closed: BeaconTrust = new Map([[kNew.keyId, entry(kNew, "zid-alexa")]]);
    const stale = observeSigned(OTTO, empty, signMessage(helloAlexa, kAlexa.privatePem), 1000, closed);
    expect(stale.verdict).toEqual({ ok: false, reason: "untrusted-key" });
  });
});

describe("keyring interop + DST determinism", () => {
  it("publicKeyInfoFromPrivatePem derives the same key_id the envelope carries", () => {
    const info = publicKeyInfoFromPrivatePem(kOtto.privatePem);
    expect(info.keyId).toBe(kOtto.keyId);
    const env = JSON.parse(signMessage(helloAlexa, kOtto.privatePem)) as { key_id: string };
    expect(env.key_id).toBe(kOtto.keyId);
  });

  it("same envelopes + times + trust replay to the same table (DST)", () => {
    const bye: DiscoveryMessage = { t: "bye", ep: ALEXA, seq: 2 };
    const wire = [
      [signMessage(helloAlexa, kAlexa.privatePem), 100],
      [signMessage(helloAlexa, kMallory.privatePem), 150], // refused, must not perturb replay
      [signMessage(bye, kAlexa.privatePem), 200],
    ] as const;
    const run = () => {
      let table: PeerTable = new Map();
      for (const [text, now] of wire) table = observeSigned(OTTO, table, text, now, trust).table;
      // Ordinal comparator (NOT localeCompare — culture-invariant-by-default rule).
      const ordinal = (a: string, b: string): number => {
        if (a < b) return -1;
        return a > b ? 1 : 0;
      };
      return [...table.keys()].sort(ordinal);
    };
    expect(run()).toEqual(run());
    expect(run()).toEqual([]); // Alexa joined and left, Mallory never got in
  });
});
