/**
 * trust-bundle.test.ts
 *
 * Discipline: every positive assertion is paired with a negative computed by the
 * SAME code path, and §"every refusal code is reachable" enumerates the refusal
 * union so a branch no input can reach fails the suite. A check that cannot fail
 * is not a check.
 *
 * No wall clock anywhere — every phase is a literal.
 */

import { describe, expect, test } from "bun:test";

import {
  accepts,
  applyVerdict,
  bundleDigest,
  bundleSigningBytes,
  evaluateBundleOffer,
  witnessDomainsFromAccepted,
  witnessSigningBytes,
  type AcceptedBundles,
  type BundleRefusalCode,
  type BundleWitness,
  type FederationPolicy,
  type TrustBundle,
} from "./trust-bundle.ts";
import { softwareEd25519Verifier, toyGenerateSigner } from "./software-adapters.ts";
import { type SeedVerdict } from "./seed-bootstrap.ts";

const V = softwareEd25519Verifier;

const rootA = toyGenerateSigner("root-a-1");
const rootA2 = toyGenerateSigner("root-a-2");
const rootB = toyGenerateSigner("root-b-1");
const witnessC = toyGenerateSigner("root-c-1");
const witnessD = toyGenerateSigner("root-d-1");

function bundleOf(
  domain: string,
  sequence: number,
  signer: { keyId: string; publicKey(): string },
  issuedAtPhase = 100,
): TrustBundle {
  return {
    trustDomain: domain,
    sequence,
    roots: [{ keyId: signer.keyId, publicKey: signer.publicKey(), notBeforePhase: 0, notAfterPhase: 5000 }],
    issuedAtPhase,
    continuity: null,
  };
}

const BUNDLE_A = bundleOf("node-a.zeta.local", 1, rootA);
const BUNDLE_B = bundleOf("node-b.zeta.local", 1, rootB);

function policyOf(over: Partial<FederationPolicy> = {}): FederationPolicy {
  return {
    localTrustDomain: "node-a.zeta.local",
    admissibleDomains: ["node-b.zeta.local", "node-c.zeta.local"],
    firstContact: "trust-on-first-use",
    witnessQuorum: 2,
    recognizedWitnesses: ["node-c.zeta.local", "node-d.zeta.local"],
    maxBundleAgePhases: 500,
    maxRootLifetimePhases: 10000,
    ...over,
  };
}

const NO_BUNDLES: AcceptedBundles = new Map();

function offer(over: Parameters<typeof evaluateBundleOffer>[0] extends infer T ? Partial<T> : never = {}) {
  return evaluateBundleOffer({
    policy: policyOf(),
    accepted: NO_BUNDLES,
    offered: BUNDLE_B,
    witnesses: [],
    currentPhase: 100,
    verifier: V,
    ...over,
  });
}

// ── first contact ────────────────────────────────────────────────────────────

describe("first contact", () => {
  test("trust-on-first-use accepts a stranger, and says loudly that it has no evidence", () => {
    const v = offer();
    expect(v.kind).toBe("accept");
    if (v.kind !== "accept") throw new Error("unreachable");
    expect(v.via).toBe("trust-on-first-use");
    expect(v.reason).toContain("NO evidence");
  });

  test("NEGATIVE: operator-ceremony refuses the identical offer and names the ceremony", () => {
    const v = offer({ policy: policyOf({ firstContact: "operator-ceremony" }) });
    expect(v.kind).toBe("ceremony-required");
    if (v.kind !== "ceremony-required") throw new Error("unreachable");
    expect(v.operation).toBe("accept-new-trust-domain-first-contact");
  });

  test("seed-reconstruction accepts on a passing proof", () => {
    const proof: SeedVerdict = { code: "matches", sharesGenerator: true, reason: "ok" };
    const v = offer({ policy: policyOf({ firstContact: "seed-reconstruction" }), seedProof: proof });
    expect(v.kind).toBe("accept");
    if (v.kind !== "accept") throw new Error("unreachable");
    expect(v.via).toBe("seed-reconstruction");
    // The scope disclosure must travel with the acceptance, not only in a doc.
    expect(v.reason).toContain("not who the peer is");
  });

  test("NEGATIVE: seed-reconstruction refuses a FAILING proof", () => {
    const proof: SeedVerdict = { code: "answer-mismatch", sharesGenerator: false, reason: "no" };
    const v = offer({ policy: policyOf({ firstContact: "seed-reconstruction" }), seedProof: proof });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("seed-proof-failed");
  });

  test("NEGATIVE: seed-reconstruction refuses an ABSENT proof — evidence is not optional", () => {
    const v = offer({ policy: policyOf({ firstContact: "seed-reconstruction" }) });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("seed-proof-absent");
  });
});

// ── witness quorum ───────────────────────────────────────────────────────────

function witnessFor(
  bundle: TrustBundle,
  domain: string,
  signer: { publicKey(): string; sign(m: Uint8Array): { ok: boolean } },
  over: Partial<BundleWitness> = {},
): BundleWitness {
  const base: Omit<BundleWitness, "signature"> = {
    witnessTrustDomain: domain,
    bundleDigest: bundleDigest(bundle),
    attestedAtPhase: 90,
    expiresAtPhase: 400,
    voluntary: true,
    witnessPublicKey: signer.publicKey(),
    ...over,
  };
  const signed = (signer as ReturnType<typeof toyGenerateSigner>).sign(witnessSigningBytes({ ...base, signature: "" }));
  if (!signed.ok) throw new Error("test signer failed");
  return { ...base, signature: signed.value };
}

describe("witness quorum", () => {
  const policy = policyOf({ firstContact: "witness-quorum" });

  test("two distinct recognized witnesses meet a quorum of 2", () => {
    const ws = [
      witnessFor(BUNDLE_B, "node-c.zeta.local", witnessC),
      witnessFor(BUNDLE_B, "node-d.zeta.local", witnessD),
    ];
    const v = offer({ policy, witnesses: ws });
    expect(v.kind).toBe("accept");
    if (v.kind !== "accept") throw new Error("unreachable");
    expect(v.via).toBe("witness-quorum");
  });

  test("NEGATIVE: one witness does not", () => {
    const v = offer({ policy, witnesses: [witnessFor(BUNDLE_B, "node-c.zeta.local", witnessC)] });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("insufficient-witness-quorum");
  });

  test("NEGATIVE: the SAME witness twice is one witness, not two", () => {
    const w = witnessFor(BUNDLE_B, "node-c.zeta.local", witnessC);
    const v = offer({ policy, witnesses: [w, { ...w, attestedAtPhase: 91 }] });
    expect(v.kind).toBe("refuse");
  });

  test("NEGATIVE: a self-witness is refused outright, not merely uncounted", () => {
    const ws = [
      witnessFor(BUNDLE_B, "node-b.zeta.local", rootB),
      witnessFor(BUNDLE_B, "node-c.zeta.local", witnessC),
      witnessFor(BUNDLE_B, "node-d.zeta.local", witnessD),
    ];
    const v = offer({ policy, witnesses: ws });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("self-witness");
  });

  test("NEGATIVE: a COERCED witness (voluntary:false) does not count — the field is boolean, so the guard is live", () => {
    const ws = [
      witnessFor(BUNDLE_B, "node-c.zeta.local", witnessC, { voluntary: false }),
      witnessFor(BUNDLE_B, "node-d.zeta.local", witnessD),
    ];
    const v = offer({ policy, witnesses: ws });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("insufficient-witness-quorum");
  });

  test("NEGATIVE: a witness with a valid signature over a DIFFERENT bundle does not count", () => {
    const other = bundleOf("node-b.zeta.local", 9, rootB);
    const ws = [witnessFor(other, "node-c.zeta.local", witnessC), witnessFor(BUNDLE_B, "node-d.zeta.local", witnessD)];
    const v = offer({ policy, witnesses: ws });
    expect(v.kind).toBe("refuse");
  });

  test("NEGATIVE: a forged witness signature does not count", () => {
    const good = witnessFor(BUNDLE_B, "node-d.zeta.local", witnessD);
    const forged: BundleWitness = { ...witnessFor(BUNDLE_B, "node-c.zeta.local", witnessC), signature: good.signature };
    const v = offer({ policy, witnesses: [forged, good] });
    expect(v.kind).toBe("refuse");
  });

  test("NEGATIVE: an EXPIRED witness attestation does not count", () => {
    const ws = [
      witnessFor(BUNDLE_B, "node-c.zeta.local", witnessC, { expiresAtPhase: 95 }),
      witnessFor(BUNDLE_B, "node-d.zeta.local", witnessD),
    ];
    const v = offer({ policy, witnesses: ws });
    expect(v.kind).toBe("refuse");
  });

  test("witnessDomainsFromAccepted derives the list locally and excludes self and subject", () => {
    const accepted: AcceptedBundles = new Map([
      ["node-b.zeta.local", BUNDLE_B],
      ["node-c.zeta.local", bundleOf("node-c.zeta.local", 1, witnessC)],
      ["node-a.zeta.local", BUNDLE_A],
    ]);
    expect(witnessDomainsFromAccepted(accepted, "node-a.zeta.local", "node-b.zeta.local")).toEqual([
      "node-c.zeta.local",
    ]);
    // NEGATIVE: with nothing accepted, the local list is empty — a node with no
    // history cannot conjure witnesses.
    expect(witnessDomainsFromAccepted(NO_BUNDLES, "node-a.zeta.local")).toEqual([]);
  });
});

// ── continuity / rotation ────────────────────────────────────────────────────

function withContinuity(bundle: TrustBundle, signer: ReturnType<typeof toyGenerateSigner>): TrustBundle {
  const unsigned: TrustBundle = { ...bundle, continuity: null };
  const sig = signer.sign(bundleSigningBytes(unsigned));
  if (!sig.ok) throw new Error("test signer failed");
  return { ...bundle, continuity: { signedByKeyId: signer.keyId, signature: sig.value } };
}

describe("rotation under continuity", () => {
  const held: AcceptedBundles = new Map([["node-b.zeta.local", BUNDLE_B]]);
  const rotated = bundleOf("node-b.zeta.local", 2, rootB, 200);
  const rotatedToNewRoot: TrustBundle = {
    trustDomain: "node-b.zeta.local",
    sequence: 2,
    roots: [{ keyId: rootA2.keyId, publicKey: rootA2.publicKey(), notBeforePhase: 0, notAfterPhase: 5000 }],
    issuedAtPhase: 200,
    continuity: null,
  };

  test("a rotation signed by the already-accepted root is accepted UNATTENDED", () => {
    const v = offer({ accepted: held, offered: withContinuity(rotatedToNewRoot, rootB), currentPhase: 220 });
    expect(v.kind).toBe("accept");
    if (v.kind !== "accept") throw new Error("unreachable");
    expect(v.via).toBe("continuity");
    expect(v.reason).toContain("no human needed");
  });

  test("NEGATIVE: the same rotation with NO continuity proof goes to the ceremony gate", () => {
    const v = offer({ accepted: held, offered: rotatedToNewRoot, currentPhase: 220 });
    expect(v.kind).toBe("ceremony-required");
    if (v.kind !== "ceremony-required") throw new Error("unreachable");
    expect(v.operation).toBe("repair-broken-continuity");
  });

  test("NEGATIVE: continuity signed by a root we do NOT hold is refused", () => {
    const v = offer({ accepted: held, offered: withContinuity(rotatedToNewRoot, rootA), currentPhase: 220 });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("continuity-signer-not-accepted");
  });

  test("NEGATIVE: a continuity signature over different bytes is refused", () => {
    const good = withContinuity(rotatedToNewRoot, rootB);
    const tampered: TrustBundle = { ...good, issuedAtPhase: 201 };
    const v = offer({ accepted: held, offered: tampered, currentPhase: 220 });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("continuity-signature-invalid");
  });

  test("re-offering the held bundle is no-change (idempotent), not a conflict", () => {
    const v = offer({ accepted: held, offered: BUNDLE_B, currentPhase: 120 });
    expect(v.kind).toBe("no-change");
  });

  test("NEGATIVE: a DIFFERENT bundle at the same sequence is a conflict and fails closed", () => {
    const twin = bundleOf("node-b.zeta.local", 1, rootA2, 100);
    const v = offer({ accepted: held, offered: twin, currentPhase: 120 });
    expect(v.kind).toBe("conflict");
    if (v.kind !== "conflict") throw new Error("unreachable");
    expect(v.heldDigest).not.toBe(v.offeredDigest);
    // and nothing is adopted
    expect(applyVerdict(held, v).get("node-b.zeta.local")).toBe(BUNDLE_B);
  });

  test("NEGATIVE: a sequence regression is a rollback attempt", () => {
    const held2: AcceptedBundles = new Map([["node-b.zeta.local", rotated]]);
    const v = offer({ accepted: held2, offered: BUNDLE_B, currentPhase: 220 });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("sequence-regression");
  });
});

// ── PAIRWISE, NEVER GLOBAL ───────────────────────────────────────────────────

describe("asymmetry — the discriminating test for pairwise-not-global", () => {
  test("A accepts B while B rejects A, and both nodes keep working", () => {
    // A's own state and policy.
    const aPolicy = policyOf({
      localTrustDomain: "node-a.zeta.local",
      admissibleDomains: ["node-b.zeta.local"],
      firstContact: "trust-on-first-use",
    });
    const aVerdict = evaluateBundleOffer({
      policy: aPolicy,
      accepted: NO_BUNDLES,
      offered: BUNDLE_B,
      witnesses: [],
      currentPhase: 100,
      verifier: V,
    });
    const aAccepted = applyVerdict(NO_BUNDLES, aVerdict);

    // B's own state and policy — B simply does not admit A's domain.
    const bPolicy = policyOf({
      localTrustDomain: "node-b.zeta.local",
      admissibleDomains: [],
      firstContact: "trust-on-first-use",
    });
    const bVerdict = evaluateBundleOffer({
      policy: bPolicy,
      accepted: NO_BUNDLES,
      offered: BUNDLE_A,
      witnesses: [],
      currentPhase: 100,
      verifier: V,
    });
    const bAccepted = applyVerdict(NO_BUNDLES, bVerdict);

    // The relation is DIRECTED and the two directions disagree.
    expect(accepts(aAccepted, "node-b.zeta.local")).toBe(true);
    expect(accepts(bAccepted, "node-a.zeta.local")).toBe(false);

    // Neither node's state was disturbed by the other's decision, and there is
    // no reconciliation step that could disturb it.
    expect(aAccepted.size).toBe(1);
    expect(bAccepted.size).toBe(0);

    // B can still evaluate further offers normally — an asymmetric relation is
    // not a degraded state.
    const bLater = evaluateBundleOffer({
      policy: { ...bPolicy, admissibleDomains: ["node-c.zeta.local"] },
      accepted: bAccepted,
      offered: bundleOf("node-c.zeta.local", 1, witnessC),
      witnesses: [],
      currentPhase: 100,
      verifier: V,
    });
    expect(bLater.kind).toBe("accept");
  });

  test("NEGATIVE: a peer cannot hand a node a bundle for the node's OWN domain", () => {
    const v = offer({ offered: BUNDLE_A });
    expect(v.kind).toBe("refuse");
    if (v.kind !== "refuse") throw new Error("unreachable");
    expect(v.code).toBe("self-domain-impersonation");
  });
});

// ── anti-vacuity: every refusal code must be reachable ───────────────────────

describe("every refusal code is reachable", () => {
  test("no refusal branch is dead code", () => {
    const seen = new Set<BundleRefusalCode>();
    const record = (v: ReturnType<typeof evaluateBundleOffer>) => {
      if (v.kind === "refuse") seen.add(v.code);
    };

    record(offer({ offered: BUNDLE_A })); // self-domain-impersonation
    record(offer({ offered: bundleOf("node-z.zeta.local", 1, rootB) })); // domain-not-admissible
    record(offer({ offered: { ...BUNDLE_B, roots: [] } })); // malformed-bundle
    record(
      offer({
        offered: { ...BUNDLE_B, roots: [{ keyId: "k", publicKey: "p", notBeforePhase: 0, notAfterPhase: 99999 }] },
      }),
    ); // root-lifetime-exceeds-policy
    record(offer({ currentPhase: 100_000 })); // bundle-stale
    record(offer({ currentPhase: 1 })); // bundle-from-the-future
    record(offer({ accepted: new Map([["node-b.zeta.local", bundleOf("node-b.zeta.local", 5, rootB)]]) })); // sequence-regression
    record(
      offer({
        accepted: new Map([["node-b.zeta.local", BUNDLE_B]]),
        offered: { ...bundleOf("node-b.zeta.local", 2, rootA2), continuity: { signedByKeyId: "nope", signature: "x" } },
      }),
    ); // continuity-signer-not-accepted
    record(
      offer({
        accepted: new Map([["node-b.zeta.local", BUNDLE_B]]),
        offered: {
          ...bundleOf("node-b.zeta.local", 2, rootA2),
          continuity: { signedByKeyId: rootB.keyId, signature: "AAAA" },
        },
      }),
    ); // continuity-signature-invalid
    record(offer({ policy: policyOf({ firstContact: "witness-quorum" }) })); // insufficient-witness-quorum
    record(
      offer({
        policy: policyOf({ firstContact: "witness-quorum" }),
        witnesses: [witnessFor(BUNDLE_B, "node-b.zeta.local", rootB)],
      }),
    ); // self-witness
    record(offer({ policy: policyOf({ firstContact: "seed-reconstruction" }) })); // seed-proof-absent
    record(
      offer({
        policy: policyOf({ firstContact: "seed-reconstruction" }),
        seedProof: { code: "answer-mismatch", sharesGenerator: false, reason: "" },
      }),
    ); // seed-proof-failed

    const all: readonly BundleRefusalCode[] = [
      "self-domain-impersonation",
      "domain-not-admissible",
      "malformed-bundle",
      "root-lifetime-exceeds-policy",
      "bundle-stale",
      "bundle-from-the-future",
      "sequence-regression",
      "continuity-signer-not-accepted",
      "continuity-signature-invalid",
      "insufficient-witness-quorum",
      "self-witness",
      "seed-proof-absent",
      "seed-proof-failed",
    ];
    const unreachable = all.filter((c) => !seen.has(c));
    expect(unreachable).toEqual([]);
  });
});
