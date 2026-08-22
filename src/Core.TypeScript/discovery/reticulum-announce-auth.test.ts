// Falsifiers for the signed announce wire. The bug this pins (BUGS.md P1, "Reticulum
// announce wire is unsigned AND `dest` is unbound to `zid`") is an ECLIPSE primitive: if a
// peer can announce an identity it does not hold, an attacker fills a victim's path table
// with identities it controls and the victim's view of the mesh is whatever the attacker
// chooses — however good the routing geometry is. Routing security reduces to announce
// authenticity, so these are the tests that hold that reduction.
//
// BOTH DIRECTIONS, ALWAYS. A validator that rejects everything passes every forgery test
// and is useless; a validator that accepts everything passes every genuine-traffic test and
// is worse. Each refusal test below is paired with an acceptance test over the SAME table.

import { describe, expect, it } from "bun:test";
import { generateKeypair, keyId } from "../ace/signing.ts";
import {
  observeAnnounceSigned,
  relaySignedAnnounce,
  signAnnounce,
  verifyAnnounce,
  type AnnounceTrust,
  type AnnounceTrustEntry,
} from "./reticulum-announce-auth.ts";
import { destinationHash, observeAnnounce, type Announce, type PathTable } from "./reticulum-transport.ts";

const aliceZid = "zid-traveler-alice-100";
const eveZid = "zid-attacker-eve-999";
const aliceDest = destinationHash(aliceZid);

const alice = generateKeypair();
const eve = generateKeypair();

const entry = (kp: { publicSpkiB64: string }, zid: string): AnnounceTrustEntry => ({
  public_key: kp.publicSpkiB64,
  zid,
});

/// The declared input (noninterference §13): the ONE authority door. Both keys are trusted
/// keys of the mesh — Eve is not an outsider, she is a legitimate peer. That is the sharp
/// case: the question is never "is this key known" but "does this key speak for THIS zid".
const trust: AnnounceTrust = new Map([
  [keyId(alice.publicSpkiB64), entry(alice, aliceZid)],
  [keyId(eve.publicSpkiB64), entry(eve, eveZid)],
]);

const announceFor = (zid: string, hops = 0): Announce => ({
  dest: destinationHash(zid),
  zid,
  hops,
  id: `${destinationHash(zid)}:1`,
});

describe("signed announce — the two directions", () => {
  it("ACCEPTS a genuine announce: Alice's key, Alice's zid, bound dest", () => {
    const text = signAnnounce(announceFor(aliceZid, 0), alice.privatePem);
    const v = verifyAnnounce(text, trust);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.zid).toBe(aliceZid);
    }

    const r = observeAnnounceSigned(new Map(), text, 1000, trust);
    expect(r.verdict.ok).toBe(true);
    expect(r.table.get(aliceDest)?.zid).toBe(aliceZid);
    expect(r.accepted?.hops).toBe(0);
  });

  it("REJECTS a forged announce: Eve's key claiming Alice's identity (identity-mismatch)", () => {
    // Eve signs with her OWN valid, TRUSTED key — the signature verifies perfectly. What she
    // cannot do is make the trust store say her key speaks for Alice. This is the forgery
    // that matters: a real key making a claim about someone else's identity.
    const forged = signAnnounce(announceFor(aliceZid, 0), eve.privatePem);
    const v = verifyAnnounce(forged, trust);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe("identity-mismatch");
    }
  });

  it("REJECTS the forgery while PRESERVING the genuine path — the eclipse attempt, end to end", () => {
    // Alice is 3 hops away and honestly announced.
    const genuine = signAnnounce(announceFor(aliceZid, 3), alice.privatePem);
    const seeded = observeAnnounceSigned(new Map(), genuine, 1000, trust);
    expect(seeded.table.get(aliceDest)?.hops).toBe(3);

    // Eve claims to BE Alice at 0 hops — the route capture.
    const forged = signAnnounce(announceFor(aliceZid, 0), eve.privatePem);
    const after = observeAnnounceSigned(seeded.table, forged, 2000, trust);

    expect(after.verdict.ok).toBe(false);
    expect(after.table.get(aliceDest)?.hops).toBe(3); // route NOT captured
    expect(after.table.get(aliceDest)?.lastSeenMs).toBe(1000); // not even refreshed
    expect(after.table).toBe(seeded.table); // byte-identical: the same object, no rebuild
    expect(after.accepted).toBeUndefined();
  });
});

describe("signed announce — every refusal names the neutral fact", () => {
  it("REJECTS an unsigned bare announce (the pre-fix wire format) — not-signed-envelope", () => {
    const bare = JSON.stringify(announceFor(aliceZid, 0));
    const v = verifyAnnounce(bare, trust);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("not-signed-envelope");
  });

  it("REJECTS a valid signature from a key not in the trust store — untrusted-key", () => {
    const stranger = generateKeypair();
    const text = signAnnounce(announceFor(aliceZid, 0), stranger.privatePem);
    const v = verifyAnnounce(text, trust);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("untrusted-key");
  });

  it("REJECTS a tampered identity claim — signature-invalid", () => {
    // Take Alice's genuine envelope and swap the claim the signature covers.
    const text = signAnnounce(announceFor(aliceZid, 0), alice.privatePem);
    const env = JSON.parse(text);
    env.announce.zid = eveZid;
    env.announce.dest = destinationHash(eveZid);
    const v = verifyAnnounce(JSON.stringify(env), trust);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("signature-invalid");
  });

  it("REJECTS an unbound dest even when correctly signed — dest-not-bound", () => {
    // Alice signs an address that does not commit to her identity. Signature is valid and
    // the signer speaks for the zid — the ADDRESS is the thing that is wrong.
    const a: Announce = { dest: "d1", zid: aliceZid, hops: 0, id: "x" };
    const text = signAnnounce(a, alice.privatePem);
    const v = verifyAnnounce(text, trust);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("dest-not-bound");
  });

  it("REJECTS a malformed inner announce without throwing — malformed-announce", () => {
    const text = signAnnounce(announceFor(aliceZid, 0), alice.privatePem);
    const env = JSON.parse(text);
    env.announce.hops = "zero";
    const v = verifyAnnounce(JSON.stringify(env), trust);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("malformed-announce");
  });

  it("is TOTAL on a hostile wire — garbage never throws, always a verdict", () => {
    for (const junk of ["", "not-json", "{}", "[]", "null", '{"schema":"wrong"}', '{"schema":"zeta.reticulum-announce-signed.v1"}']) {
      const v = verifyAnnounce(junk, trust);
      expect(v.ok).toBe(false);
    }
  });

  it("never names an INTENT — the verdicts are facts, the policy is the caller's (dual-use §)", () => {
    const forged = signAnnounce(announceFor(aliceZid, 0), eve.privatePem);
    const v = verifyAnnounce(forged, trust);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      // The same refusal must be readable as "an attack" OR "a rotation that has not landed"
      // by the caller. A reason naming the sender's intent would have decided that for them.
      expect(v.reason).toBe("identity-mismatch");
      expect(JSON.stringify(v)).not.toContain("forger");
      expect(JSON.stringify(v)).not.toContain("attack");
    }
  });
});

describe("relaying under authentication — the mesh still bridges", () => {
  it("ACCEPTS a genuine announce relayed with a bumped hop count (signature survives)", () => {
    // The signature covers (dest, zid) only. An honest relay bumps `hops`; the next hop still
    // verifies against the ORIGIN's key. Without this the check would be undeployable — every
    // relay would break it, and a check that must be disabled to ship is not a check.
    const origin = signAnnounce(announceFor(aliceZid, 0), alice.privatePem);
    const hop1 = relaySignedAnnounce(origin, 1);
    expect(hop1).not.toBeNull();
    const v = verifyAnnounce(hop1 as string, trust);
    expect(v.ok).toBe(true);

    const r = observeAnnounceSigned(new Map(), hop1 as string, 1000, trust);
    expect(r.table.get(aliceDest)?.hops).toBe(1);
  });

  it("a relay CANNOT launder an identity — re-signing as Eve is still identity-mismatch", () => {
    const origin = signAnnounce(announceFor(aliceZid, 0), alice.privatePem);
    const relayed = relaySignedAnnounce(origin, 1) as string;
    const env = JSON.parse(relayed);
    // Eve re-signs the relayed frame with her own key, as a malicious transport node would.
    const resigned = JSON.parse(signAnnounce(env.announce, eve.privatePem));
    const v = verifyAnnounce(JSON.stringify(resigned), trust);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("identity-mismatch");
  });
});

describe("the pure fold's address-integrity guard has no escape hatch", () => {
  it("REJECTS an unbound dest of ANY length — the `length === 32` exemption is closed", () => {
    // Before this fix the guard read `a.dest.length === 32 && ...`, so a dest of any other
    // length skipped the check entirely. Verified reachable on the live code: a dest of "d1"
    // with an unrelated zid was folded straight into the table.
    for (const dest of ["d1", "", "x".repeat(31), "x".repeat(33), "beef"]) {
      const t = observeAnnounce(new Map(), { dest, zid: "totally-unrelated-zid", hops: 0, id: "x" }, 1000);
      expect(t.size).toBe(0);
    }
  });

  it("still ACCEPTS a correctly-bound pair — the guard is not reject-everything", () => {
    const t: PathTable = observeAnnounce(new Map(), announceFor(aliceZid, 2), 1000);
    expect(t.get(aliceDest)?.zid).toBe(aliceZid);
    expect(t.get(aliceDest)?.hops).toBe(2);
  });
});

describe("noninterference §13 / local-time discipline", () => {
  it("verification is a pure function of (text, trust) — no clock, no keystore, no network", () => {
    const text = signAnnounce(announceFor(aliceZid, 0), alice.privatePem);
    // Same inputs, many calls, over a long wall-clock spread: identical verdicts. If verify
    // reached for an ambient clock or store, this is where it would show.
    const first = JSON.stringify(verifyAnnounce(text, trust));
    for (let i = 0; i < 50; i++) expect(JSON.stringify(verifyAnnounce(text, trust))).toBe(first);
  });

  it("nowMs is WRITTEN onto an accepted path, never a predicate that filters evidence", () => {
    // Two nodes receive the SAME announce at wildly different local times. Both must accept
    // it and fold the same evidence — only the liveness stamp differs. If local time gated
    // acceptance, these two nodes would hold different tables and diverge.
    const text = signAnnounce(announceFor(aliceZid, 0), alice.privatePem);
    const nodeA = observeAnnounceSigned(new Map(), text, 1, trust);
    const nodeB = observeAnnounceSigned(new Map(), text, 999_999_999, trust);
    expect(nodeA.verdict.ok).toBe(true);
    expect(nodeB.verdict.ok).toBe(true);
    expect(nodeA.table.get(aliceDest)?.zid).toBe(nodeB.table.get(aliceDest)?.zid);
    expect(nodeA.table.get(aliceDest)?.hops).toBe(nodeB.table.get(aliceDest)?.hops);
  });
});

// ---------------------------------------------------------------------------------------
// TRANSPORT-LEVEL adoption. The module tests above prove the membrane is correct; these prove
// it actually RUNS on the live receive path. A verifier that is correct and unwired is the
// vacuity class — it looks like a guarantee and carries none.
// ---------------------------------------------------------------------------------------

import { createReticulumTransport, type AnnounceSig, type PacketTransport } from "./reticulum-transport.ts";
import { signAnnounceDetached, verifyAnnounceDetached } from "./reticulum-announce-auth.ts";

const verify = (a: Announce, asig: AnnounceSig | undefined): boolean => verifyAnnounceDetached(a, asig, trust).ok;

/// A frame as it appears on the wire, with an optional detached signature.
const frameText = (announce: Announce, asig?: AnnounceSig): string =>
  JSON.stringify({
    schema: "zeta.reticulum.v1",
    frame: { src: destinationHash(announce.zid), fid: `${destinationHash(announce.zid)}:1`, announce, ...(asig ? { asig } : {}) },
  });

function harness(mode: "off" | "required") {
  const sent: string[] = [];
  let onPacket: ((text: string, from: string) => void) | null = null;
  const lower: PacketTransport = {
    sendPacket: (t) => sent.push(t),
    onPacket: (h) => {
      onPacket = h;
    },
  };
  const bob = generateKeypair();
  const bobZid = "zid-node-bob-1";
  const auth =
    mode === "off"
      ? ({ mode: "off" } as const)
      : ({
          mode: "required" as const,
          sign: (a: Announce) => signAnnounceDetached(a, bob.privatePem),
          verify,
        } as const);
  const rt = createReticulumTransport({ zid: bobZid, relay: true, announceAuth: auth }, lower, { now: () => 5000 });
  return { rt, sent, bob, bobZid, deliver: (t: string) => onPacket!(t, "127.0.0.1") };
}

describe("transport adoption — the gate runs on the live receive path", () => {
  it("mode 'required' REJECTS Eve's forged announce claiming Alice — no path is learned", () => {
    const { rt, deliver } = harness("required");
    const forged = announceFor(aliceZid, 0);
    deliver(frameText(forged, signAnnounceDetached(forged, eve.privatePem)));
    expect(rt.paths().has(aliceDest)).toBe(false);
  });

  it("mode 'required' REJECTS an entirely unsigned announce — the pre-fix wire is refused", () => {
    const { rt, deliver } = harness("required");
    deliver(frameText(announceFor(aliceZid, 0)));
    expect(rt.paths().has(aliceDest)).toBe(false);
  });

  it("mode 'required' ACCEPTS Alice's genuine announce — the gate is not reject-everything", () => {
    const { rt, deliver } = harness("required");
    const genuine = announceFor(aliceZid, 0);
    deliver(frameText(genuine, signAnnounceDetached(genuine, alice.privatePem)));
    expect(rt.paths().get(aliceDest)?.zid).toBe(aliceZid);
  });

  it("mode 'required' signs its OWN outbound announce, and a PEER really verifies it", () => {
    const { rt, sent, bob, bobZid } = harness("required");
    rt.broadcast("hello-mesh");
    expect(sent.length).toBe(1);
    const frame = JSON.parse(sent[0] as string).frame;
    expect(frame.asig).toBeDefined();

    // A receiving peer, holding Bob in ITS trust store, must accept it. Asserting only that a
    // signature "exists" would pass for a garbage signature, so this checks it end-to-end.
    const peerTrust: AnnounceTrust = new Map([[keyId(bob.publicSpkiB64), { public_key: bob.publicSpkiB64, zid: bobZid }]]);
    expect(verifyAnnounceDetached(frame.announce, frame.asig, peerTrust).ok).toBe(true);
    expect(frame.announce.dest).toBe(destinationHash(bobZid)); // address commits to identity

    // And the same peer must REJECT that signature re-used under a different claimed identity.
    const stolen = { ...frame.announce, zid: aliceZid, dest: aliceDest };
    expect(verifyAnnounceDetached(stolen, frame.asig, peerTrust).ok).toBe(false);
  });

  it("a relay PRESERVES the origin's signature across the hop bump (the mesh still bridges)", () => {
    const { sent, deliver } = harness("required");
    const genuine = announceFor(aliceZid, 0);
    const asig = signAnnounceDetached(genuine, alice.privatePem);
    deliver(frameText(genuine, asig));
    const relayed = sent.map((t) => JSON.parse(t).frame).find((f) => f.announce.zid === aliceZid);
    expect(relayed).toBeDefined();
    expect(relayed.announce.hops).toBe(1); // bumped
    expect(relayed.asig).toEqual(asig); // signature untouched
    expect(verifyAnnounceDetached(relayed.announce, relayed.asig, trust).ok).toBe(true); // still verifies
  });

  it("mode 'off' still folds the forgery — the pre-fix behaviour, pinned so the gate is provably what changed", () => {
    // This is the NEGATIVE CONTROL for the whole PR: with the gate off, Eve captures Alice's
    // route exactly as she did before the fix. If this ever starts passing without the gate,
    // the tests above stopped measuring the gate.
    const { rt, deliver } = harness("off");
    deliver(frameText(announceFor(aliceZid, 0)));
    expect(rt.paths().get(aliceDest)?.zid).toBe(aliceZid);
  });
});
