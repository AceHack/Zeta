/**
 * local-issuer.test.ts — issuance and federated verification.
 *
 * §"every rejection is reachable" is the anti-vacuity enumeration.
 */

import { describe, expect, test } from "bun:test";

import { createSoftwareWorkloadAttestor, validateSelectorRules } from "./workload-attestation.ts";
import {
  createLocalIssuer,
  spiffePathOf,
  svidSigningBytes,
  trustDomainOf,
  validatePeerSvid,
  MAX_SVID_LIFETIME_PHASES,
  type SignedSvid,
  type SvidRejection,
} from "./local-issuer.ts";
import { softwareEd25519Verifier, toyGenerateSigner } from "./software-adapters.ts";
import { type AcceptedBundles, type TrustBundle } from "./trust-bundle.ts";
import { type ObservedProcess } from "./ports.ts";

const V = softwareEd25519Verifier;
const rootB = toyGenerateSigner("root-b-1");
const otherRoot = toyGenerateSigner("root-x-1");
const workloadKey = toyGenerateSigner("workload-otto");

const BUNDLE_B: TrustBundle = {
  trustDomain: "node-b.zeta.local",
  sequence: 1,
  roots: [{ keyId: rootB.keyId, publicKey: rootB.publicKey(), notBeforePhase: 50, notAfterPhase: 5000 }],
  issuedAtPhase: 50,
  continuity: null,
};
const ACCEPTED: AcceptedBundles = new Map([["node-b.zeta.local", BUNDLE_B]]);

const BINARY = "a".repeat(64);
const OBSERVED: ObservedProcess = { pid: 42, uid: 501, binarySha256: BINARY };

const rules = validateSelectorRules([{ spiffePath: "/agent/otto", requireUid: 501, requireBinarySha256: BINARY }]);
if (!rules.ok) throw new Error("test fixture rules invalid");
const attestor = createSoftwareWorkloadAttestor(rules.value);
const issuer = createLocalIssuer({ trustDomain: "node-b.zeta.local", rootSigner: rootB });

function issueAt(phase: number, lifetime = 100): SignedSvid {
  const a = attestor.attest(OBSERVED, phase);
  if (!a.ok) throw new Error("attest failed in fixture");
  const s = issuer.issue({
    attested: a.value,
    subjectPublicKey: workloadKey.publicKey(),
    lifetimePhases: lifetime,
    currentPhase: phase,
  });
  if (!s.ok) throw new Error(`issue failed: ${JSON.stringify(s.error)}`);
  return s.value;
}

describe("SPIFFE ID parsing", () => {
  test("parses domain and path", () => {
    expect(trustDomainOf("spiffe://node-b.zeta.local/agent/otto")).toBe("node-b.zeta.local");
    expect(spiffePathOf("spiffe://node-b.zeta.local/agent/otto")).toBe("/agent/otto");
  });
  test("NEGATIVE: malformed ids yield undefined, not a guess", () => {
    expect(trustDomainOf("not-a-spiffe-id")).toBeUndefined();
    expect(spiffePathOf("spiffe://node-b.zeta.local")).toBeUndefined();
    expect(trustDomainOf("https://node-b.zeta.local/agent/otto")).toBeUndefined();
  });
});

describe("issuance", () => {
  test("an SVID carries the subject PUBLIC key and no private field exists on it", () => {
    const svid = issueAt(100);
    expect(svid.claim.subjectPublicKey).toBe(workloadKey.publicKey());
    // Structural: enumerate the claim's own keys and assert nothing private-shaped.
    const keys = Object.keys(svid.claim);
    expect(keys.some((k) => /private|secret|seed|mnemonic/i.test(k))).toBe(false);
  });

  test("NEGATIVE: a lifetime over the ceiling is refused at issuance", () => {
    const a = attestor.attest(OBSERVED, 100);
    if (!a.ok) throw new Error("unreachable");
    const r = issuer.issue({
      attested: a.value,
      subjectPublicKey: workloadKey.publicKey(),
      lifetimePhases: MAX_SVID_LIFETIME_PHASES + 1,
      currentPhase: 100,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error.kind).toBe("lifetime-exceeds-ceiling");
  });

  test("NEGATIVE: a non-positive lifetime and an empty subject key are both refused", () => {
    const a = attestor.attest(OBSERVED, 100);
    if (!a.ok) throw new Error("unreachable");
    expect(
      issuer.issue({
        attested: a.value,
        subjectPublicKey: workloadKey.publicKey(),
        lifetimePhases: 0,
        currentPhase: 100,
      }).ok,
    ).toBe(false);
    expect(issuer.issue({ attested: a.value, subjectPublicKey: "", lifetimePhases: 10, currentPhase: 100 }).ok).toBe(
      false,
    );
  });
});

describe("federated verification", () => {
  test("a peer's SVID verifies under an ACCEPTED bundle", () => {
    const v = validatePeerSvid({ accepted: ACCEPTED, signed: issueAt(100), currentPhase: 150, verifier: V });
    expect(v.allowed).toBe(true);
    expect(v.spiffeId).toBe("spiffe://node-b.zeta.local/agent/otto");
  });

  test("NEGATIVE: the SAME SVID is rejected by a node that accepts no bundle for that domain", () => {
    const v = validatePeerSvid({ accepted: new Map(), signed: issueAt(100), currentPhase: 150, verifier: V });
    expect(v.allowed).toBe(false);
    expect(v.rejection).toBe("no-accepted-bundle-for-domain");
  });

  test("NEGATIVE: expiry is decided by AGREED PHASE, not a wall clock", () => {
    const svid = issueAt(100, 50); // valid [100, 150)
    expect(validatePeerSvid({ accepted: ACCEPTED, signed: svid, currentPhase: 149, verifier: V }).allowed).toBe(true);
    const late = validatePeerSvid({ accepted: ACCEPTED, signed: svid, currentPhase: 150, verifier: V });
    expect(late.allowed).toBe(false);
    expect(late.rejection).toBe("svid-expired");
  });

  test("NEGATIVE: a tampered claim breaks the signature", () => {
    const svid = issueAt(100);
    const tampered: SignedSvid = {
      ...svid,
      claim: { ...svid.claim, spiffeId: "spiffe://node-b.zeta.local/agent/root" },
    };
    const v = validatePeerSvid({ accepted: ACCEPTED, signed: tampered, currentPhase: 150, verifier: V });
    expect(v.allowed).toBe(false);
    expect(v.rejection).toBe("signature-invalid");
  });

  test("NEGATIVE: an SVID minted by a root outside the bundle is rejected even though its signature is genuine", () => {
    const rogue = createLocalIssuer({ trustDomain: "node-b.zeta.local", rootSigner: otherRoot });
    const a = attestor.attest(OBSERVED, 100);
    if (!a.ok) throw new Error("unreachable");
    const s = rogue.issue({
      attested: a.value,
      subjectPublicKey: workloadKey.publicKey(),
      lifetimePhases: 100,
      currentPhase: 100,
    });
    if (!s.ok) throw new Error("unreachable");
    // The signature is real. What fails is that the key is not a root we accept.
    expect(V.verify(otherRoot.publicKey(), svidSigningBytes(s.value.claim), s.value.signature)).toBe(true);
    const v = validatePeerSvid({ accepted: ACCEPTED, signed: s.value, currentPhase: 150, verifier: V });
    expect(v.allowed).toBe(false);
    expect(v.rejection).toBe("issuer-key-not-in-bundle");
  });

  test("NEGATIVE: a root that was not live AT ISSUANCE cannot mint into the past", () => {
    const svid = issueAt(10); // before the root's notBefore of 50
    const v = validatePeerSvid({ accepted: ACCEPTED, signed: svid, currentPhase: 60, verifier: V });
    expect(v.allowed).toBe(false);
    expect(v.rejection).toBe("issuer-root-not-live-at-issuance");
  });

  test("audience scoping allows the named audience and refuses another", () => {
    const a = attestor.attest(OBSERVED, 100);
    if (!a.ok) throw new Error("unreachable");
    const s = issuer.issue({
      attested: a.value,
      subjectPublicKey: workloadKey.publicKey(),
      lifetimePhases: 100,
      currentPhase: 100,
      audience: ["ledger"],
    });
    if (!s.ok) throw new Error("unreachable");
    expect(
      validatePeerSvid({
        accepted: ACCEPTED,
        signed: s.value,
        currentPhase: 150,
        verifier: V,
        requiredAudience: "ledger",
      }).allowed,
    ).toBe(true);
    const wrong = validatePeerSvid({
      accepted: ACCEPTED,
      signed: s.value,
      currentPhase: 150,
      verifier: V,
      requiredAudience: "payments",
    });
    expect(wrong.allowed).toBe(false);
    expect(wrong.rejection).toBe("audience-mismatch");
  });
});

describe("every rejection is reachable", () => {
  test("no rejection branch is dead code", () => {
    const seen = new Set<SvidRejection>();
    const rec = (v: ReturnType<typeof validatePeerSvid>) => {
      if (v.rejection) seen.add(v.rejection);
    };
    const base = issueAt(100, 50);

    rec(
      validatePeerSvid({
        accepted: ACCEPTED,
        signed: { ...base, claim: { ...base.claim, spiffeId: "nope" } },
        currentPhase: 120,
        verifier: V,
      }),
    );
    rec(
      validatePeerSvid({
        accepted: ACCEPTED,
        signed: { ...base, claim: { ...base.claim, trustDomain: "elsewhere" } },
        currentPhase: 120,
        verifier: V,
      }),
    );
    rec(validatePeerSvid({ accepted: new Map(), signed: base, currentPhase: 120, verifier: V }));
    rec(
      validatePeerSvid({
        accepted: ACCEPTED,
        signed: { ...base, claim: { ...base.claim, issuerKeyId: "ghost" } },
        currentPhase: 120,
        verifier: V,
      }),
    );
    rec(validatePeerSvid({ accepted: ACCEPTED, signed: issueAt(10), currentPhase: 60, verifier: V }));
    rec(
      validatePeerSvid({ accepted: ACCEPTED, signed: { ...base, signature: "AAAA" }, currentPhase: 120, verifier: V }),
    );
    rec(validatePeerSvid({ accepted: ACCEPTED, signed: base, currentPhase: 99, verifier: V }));
    rec(validatePeerSvid({ accepted: ACCEPTED, signed: base, currentPhase: 200, verifier: V }));
    rec(
      validatePeerSvid({
        accepted: ACCEPTED,
        signed: {
          ...base,
          claim: { ...base.claim, expiresAtPhase: base.claim.issuedAtPhase + MAX_SVID_LIFETIME_PHASES + 1 },
        },
        currentPhase: 120,
        verifier: V,
      }),
    );
    const scoped = (() => {
      const a = attestor.attest(OBSERVED, 100);
      if (!a.ok) throw new Error("unreachable");
      const s = issuer.issue({
        attested: a.value,
        subjectPublicKey: workloadKey.publicKey(),
        lifetimePhases: 50,
        currentPhase: 100,
        audience: ["ledger"],
      });
      if (!s.ok) throw new Error("unreachable");
      return s.value;
    })();
    rec(
      validatePeerSvid({
        accepted: ACCEPTED,
        signed: scoped,
        currentPhase: 120,
        verifier: V,
        requiredAudience: "payments",
      }),
    );

    const all: readonly SvidRejection[] = [
      "malformed-spiffe-id",
      "spiffe-id-domain-mismatch",
      "no-accepted-bundle-for-domain",
      "issuer-key-not-in-bundle",
      "issuer-root-not-live-at-issuance",
      "signature-invalid",
      "svid-not-yet-valid",
      "svid-expired",
      "lifetime-exceeds-ceiling",
      "audience-mismatch",
    ];
    expect(all.filter((r) => !seen.has(r))).toEqual([]);
  });
});
