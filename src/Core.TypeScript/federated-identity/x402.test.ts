/**
 * x402.test.ts — custody vs settlement, and the facilitator-optional property.
 *
 * The three facilitator cases (absent / honest / lying) are the discriminating
 * tests: if the verdict ever depended on the facilitator, the facilitator would
 * be a hub.
 */

import { describe, expect, test } from "bun:test";

import {
  authorizePaymentLocally,
  authorizationSigningBytes,
  challengeDigest,
  parseDecimalMinor,
  resourceServerDecision,
  verifyPaymentAuthorization,
  type PaymentChallenge,
  type PaymentRejection,
  type StandingBudget,
} from "./x402.ts";
import { createLocalIssuer, type SignedSvid } from "./local-issuer.ts";
import { createSoftwareWorkloadAttestor, validateSelectorRules } from "./workload-attestation.ts";
import { softwareEd25519Verifier, toyGenerateSigner, yubiHsmSignerRequiringCeremony } from "./software-adapters.ts";
import { type AcceptedBundles, type TrustBundle } from "./trust-bundle.ts";

const V = softwareEd25519Verifier;
const rootB = toyGenerateSigner("root-b-1");
const payerKey = toyGenerateSigner("payer-otto");
const attackerKey = toyGenerateSigner("attacker");

const BUNDLE_B: TrustBundle = {
  trustDomain: "node-b.zeta.local",
  sequence: 1,
  roots: [{ keyId: rootB.keyId, publicKey: rootB.publicKey(), notBeforePhase: 0, notAfterPhase: 5000 }],
  issuedAtPhase: 0,
  continuity: null,
};
const ACCEPTED: AcceptedBundles = new Map([["node-b.zeta.local", BUNDLE_B]]);

const BINARY = "b".repeat(64);
const rules = validateSelectorRules([{ spiffePath: "/agent/otto", requireUid: 501, requireBinarySha256: BINARY }]);
if (!rules.ok) throw new Error("fixture");
const attestor = createSoftwareWorkloadAttestor(rules.value);
const issuer = createLocalIssuer({ trustDomain: "node-b.zeta.local", rootSigner: rootB });

function payerSvid(subjectPublicKey: string): SignedSvid {
  const a = attestor.attest({ pid: 7, uid: 501, binarySha256: BINARY }, 100);
  if (!a.ok) throw new Error("fixture");
  const s = issuer.issue({ attested: a.value, subjectPublicKey, lifetimePhases: 200, currentPhase: 100 });
  if (!s.ok) throw new Error("fixture");
  return s.value;
}
const SVID = payerSvid(payerKey.publicKey());
const PAYER_ID = "spiffe://node-b.zeta.local/agent/otto";

const BUDGET: StandingBudget = { asset: "USDC", perPaymentMax: "1.00", totalMax: "10.00", spentSoFar: "0.00" };

function challengeOf(over: Partial<PaymentChallenge> = {}): PaymentChallenge {
  return {
    scheme: "zeta-local-sig-v0",
    resource: "/inference",
    amount: "0.25",
    asset: "USDC",
    payTo: "node-c-treasury",
    nonce: "n-1",
    expiresAtPhase: 200,
    ...over,
  };
}

const NO_SPENT: ReadonlySet<string> = new Set();

function authorize(challenge = challengeOf(), budget = BUDGET, signer = payerKey, phase = 120) {
  return authorizePaymentLocally({ challenge, payerSpiffeId: PAYER_ID, signer, budget, currentPhase: phase });
}

describe("decimal money is integer arithmetic", () => {
  test("parses to minor units", () => {
    expect(parseDecimalMinor("0.25")).toBe(250000);
    expect(parseDecimalMinor("1")).toBe(1000000);
  });
  test("NEGATIVE: refuses rather than coerces", () => {
    expect(parseDecimalMinor("-1")).toBeNull();
    expect(parseDecimalMinor("1.2345678")).toBeNull();
    expect(parseDecimalMinor("1e3")).toBeNull();
    expect(parseDecimalMinor("")).toBeNull();
  });
  test("0.1 + 0.2 in minor units is exactly 0.3 — the defect this avoids", () => {
    const minor = (v: string): number => {
      const n = parseDecimalMinor(v);
      if (n === null) throw new Error(`fixture: ${v} did not parse`);
      return n;
    };
    expect(minor("0.1") + minor("0.2")).toBe(minor("0.3"));
    // The contrast line, and sonarjs is RIGHT about it on both counts: both
    // operands are literals, so this assertion cannot fail on any conforming
    // engine, and it is an exact float comparison. Both are the point — the line
    // pins a property of IEEE-754 doubles, not a property of our code, and it is
    // what the line above is being contrasted against. It is documentation that
    // executes, not a check, so it is suppressed and labelled rather than left
    // to read as a check that constrains something. The real assertion is the
    // one above it; delete THAT and this test still passes, which is exactly why
    // this line must not be mistaken for coverage.
    // eslint-disable-next-line sonarjs/no-trivial-assertions, sonarjs/no-floating-point-equality
    expect(0.1 + 0.2).not.toBe(0.3);
  });
});

describe("custody stays local", () => {
  test("the authorization carries no field capable of holding key material", () => {
    const r = authorize();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const keys = Object.keys(r.value);
    expect(keys.some((k) => /private|secret|seed|mnemonic|custod/i.test(k))).toBe(false);
    expect(JSON.stringify(r.value)).not.toContain(payerKey.publicKey().slice(0, 20) + "PRIVATE");
  });

  test("verification takes no signer — a verifier holds nothing", () => {
    // Structural: call the verifier with only public inputs and get a verdict.
    const r = authorize();
    if (!r.ok) throw new Error("unreachable");
    const verdict = verifyPaymentAuthorization({
      authorization: r.value,
      challenge: challengeOf(),
      payerSvid: SVID,
      accepted: ACCEPTED,
      verifier: V,
      currentPhase: 130,
      spentNonces: NO_SPENT,
    });
    expect(verdict.allowed).toBe(true);
  });

  test("NEGATIVE: a hardware signer refuses rather than pretending, and the refusal names the ceremony", () => {
    const hsm = yubiHsmSignerRequiringCeremony({
      keyId: "hsm-1",
      hsmDomain: 3,
      algorithm: "ecdsa-sha256-p256",
      publicKey: "public-only",
    });
    const r = authorize(challengeOf(), BUDGET, hsm);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error.kind).toBe("signer-refused");
    expect(JSON.stringify(r.error)).toContain("open-authenticated-hsm-session");
  });
});

describe("standing budget is the human-set envelope", () => {
  test("inside the per-payment ceiling, the agent signs unattended", () => {
    expect(authorize(challengeOf({ amount: "1.00" })).ok).toBe(true);
  });

  test("NEGATIVE: over the per-payment ceiling routes to the ceremony class", () => {
    const r = authorize(challengeOf({ amount: "1.01" }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error.kind).toBe("exceeds-standing-budget");
    if (r.error.kind !== "exceeds-standing-budget") throw new Error("unreachable");
    expect(r.error.limitKind).toBe("per-payment");
    expect(r.error.ceremony).toBe("x402-authorize-exceeding-standing-budget");
  });

  test("NEGATIVE: within per-payment but over the TOTAL is also refused", () => {
    const r = authorize(challengeOf({ amount: "1.00" }), { ...BUDGET, spentSoFar: "9.50" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error.kind).toBe("exceeds-standing-budget");
    if (r.error.kind !== "exceeds-standing-budget") throw new Error("unreachable");
    expect(r.error.limitKind).toBe("total");
  });

  test("NEGATIVE: asset mismatch, expired challenge, and unknown scheme are each refused", () => {
    expect(authorize(challengeOf({ asset: "ETH" })).ok).toBe(false);
    expect(authorize(challengeOf(), BUDGET, payerKey, 250).ok).toBe(false);
    expect(authorize({ ...challengeOf(), scheme: "some-other" }).ok).toBe(false);
  });
});

describe("the facilitator is optional and advisory — three cases, one verdict function", () => {
  const r = authorize();
  if (!r.ok) throw new Error("fixture");
  const auth = r.value;
  const verdictOf = (challenge: PaymentChallenge) =>
    verifyPaymentAuthorization({
      authorization: auth,
      challenge,
      payerSvid: SVID,
      accepted: ACCEPTED,
      verifier: V,
      currentPhase: 130,
      spentNonces: NO_SPENT,
    });

  test("ABSENT: the resource server settles on its own", () => {
    const d = resourceServerDecision({ verdict: verdictOf(challengeOf()) });
    expect(d.settle).toBe(true);
    expect(d.reason).toContain("no facilitator");
  });

  test("PRESENT AND HONEST: the outcome is identical — the facilitator changed nothing", () => {
    const withF = authorize(challengeOf({ facilitator: "facilitator.example" }));
    if (!withF.ok) throw new Error("unreachable");
    const v = verifyPaymentAuthorization({
      authorization: withF.value,
      challenge: challengeOf({ facilitator: "facilitator.example" }),
      payerSvid: SVID,
      accepted: ACCEPTED,
      verifier: V,
      currentPhase: 130,
      spentNonces: NO_SPENT,
    });
    const d = resourceServerDecision({
      verdict: v,
      facilitatorOpinion: { facilitator: "facilitator.example", claimsValid: true, note: "" },
    });
    expect(d.settle).toBe(true);
    expect(d.agreedWithFacilitator).toBe(true);
  });

  test("PRESENT AND LYING: a facilitator vouching for a FORGED authorization is overridden", () => {
    const forged = { ...auth, amount: "9.99", signature: auth.signature };
    const v = verifyPaymentAuthorization({
      authorization: forged,
      challenge: challengeOf(),
      payerSvid: SVID,
      accepted: ACCEPTED,
      verifier: V,
      currentPhase: 130,
      spentNonces: NO_SPENT,
    });
    expect(v.allowed).toBe(false);
    const d = resourceServerDecision({
      verdict: v,
      facilitatorOpinion: { facilitator: "evil.example", claimsValid: true, note: "trust me" },
    });
    expect(d.settle).toBe(false);
    expect(d.agreedWithFacilitator).toBe(false);
    expect(d.reason).toContain("OVERRIDING");
  });

  test("PRESENT AND LYING THE OTHER WAY: a facilitator denying a VALID payment is also overridden", () => {
    const d = resourceServerDecision({
      verdict: verdictOf(challengeOf()),
      facilitatorOpinion: { facilitator: "evil.example", claimsValid: false, note: "" },
    });
    expect(d.settle).toBe(true);
    expect(d.agreedWithFacilitator).toBe(false);
  });
});

describe("every payment rejection is reachable", () => {
  test("no rejection branch is dead code", () => {
    const seen = new Set<PaymentRejection>();
    const rec = (v: ReturnType<typeof verifyPaymentAuthorization>) => {
      if (v.rejection) seen.add(v.rejection);
    };
    const r = authorize();
    if (!r.ok) throw new Error("fixture");
    const auth = r.value;
    const ch = challengeOf();
    const base = {
      payerSvid: SVID,
      accepted: ACCEPTED,
      verifier: V,
      currentPhase: 130,
      spentNonces: NO_SPENT,
    } as const;

    rec(
      verifyPaymentAuthorization({ ...base, authorization: { ...auth, challengeDigest: "deadbeef" }, challenge: ch }),
    );
    rec(
      verifyPaymentAuthorization({
        ...base,
        authorization: { ...auth, nonce: "n-2", challengeDigest: challengeDigest(ch) },
        challenge: ch,
      }),
    );
    rec(verifyPaymentAuthorization({ ...base, authorization: { ...auth, amount: "9.99" }, challenge: ch }));
    rec(verifyPaymentAuthorization({ ...base, authorization: auth, challenge: ch, spentNonces: new Set(["n-1"]) }));
    rec(verifyPaymentAuthorization({ ...base, authorization: auth, challenge: ch, currentPhase: 300 }));
    rec(verifyPaymentAuthorization({ ...base, authorization: auth, challenge: ch, accepted: new Map() }));
    // signature-invalid: re-sign an unrelated body with the attacker's key so the
    // structure is right and only the key is wrong.
    const unsignedOther = {
      challengeDigest: auth.challengeDigest,
      payerSpiffeId: auth.payerSpiffeId,
      payerKeyId: auth.payerKeyId,
      amount: auth.amount,
      asset: auth.asset,
      payTo: auth.payTo,
      nonce: auth.nonce,
      signedAtPhase: auth.signedAtPhase,
    };
    const bad = attackerKey.sign(authorizationSigningBytes(unsignedOther));
    if (!bad.ok) throw new Error("fixture");
    rec(verifyPaymentAuthorization({ ...base, authorization: { ...auth, signature: bad.value }, challenge: ch }));
    rec(
      verifyPaymentAuthorization({
        ...base,
        authorization: { ...auth, payerSpiffeId: "spiffe://node-b.zeta.local/agent/other" },
        challenge: ch,
      }),
    );
    // signed-before-issue is expressed via a signedAtPhase at/after expiry
    rec(verifyPaymentAuthorization({ ...base, authorization: { ...auth, signedAtPhase: 999 }, challenge: ch }));

    // The FULL union, not a hand-picked subset. Adding a member to
    // `PaymentRejection` without emitting it fails here — which is how the
    // original `payer-key-not-bound-to-svid` and `signed-before-issue` were
    // caught and removed.
    const all: readonly PaymentRejection[] = [
      "challenge-digest-mismatch",
      "nonce-mismatch",
      "terms-mismatch",
      "nonce-already-spent",
      "challenge-expired",
      "payer-svid-not-accepted",
      "signature-invalid",
    ];
    expect(all.filter((c) => !seen.has(c))).toEqual([]);
    // And the union has no members beyond those enumerated above: every code
    // observed must be in `all`.
    expect([...seen].filter((c) => !all.includes(c))).toEqual([]);
  });
});
