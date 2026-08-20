/**
 * revocation.test.ts — the CRDT laws, and a paired negative proving they do work.
 *
 * The negative is the important half: a non-monotone "unrevoke" is implemented
 * HERE IN THE TEST (never in the library) and shown to DIVERGE under reordering.
 * Without it, "merge is commutative" is a property nobody would notice the
 * absence of.
 */

import { describe, expect, test } from "bun:test";

import {
  addRevocation,
  EMPTY_REVOCATIONS,
  isKeyRevoked,
  mergeAllRevocations,
  mergeRevocations,
  revocationKey,
  revocationSetDigest,
  revocationSigningBytes,
  type RevocationEntry,
  type RevocationGSet,
} from "./revocation.ts";
import { softwareEd25519Verifier, toyGenerateSigner } from "./software-adapters.ts";
import { type AcceptedBundles, type TrustBundle } from "./trust-bundle.ts";

const V = softwareEd25519Verifier;
const rootB = toyGenerateSigner("root-b-1");
const stranger = toyGenerateSigner("root-z-1");

const BUNDLE_B: TrustBundle = {
  trustDomain: "node-b.zeta.local",
  sequence: 1,
  roots: [{ keyId: rootB.keyId, publicKey: rootB.publicKey(), notBeforePhase: 0, notAfterPhase: 5000 }],
  issuedAtPhase: 0,
  continuity: null,
};
const ACCEPTED: AcceptedBundles = new Map([["node-b.zeta.local", BUNDLE_B]]);

function entry(revokedKeyId: string, phase: number, recordSource: string, signer = rootB): RevocationEntry {
  const base = {
    trustDomain: "node-b.zeta.local",
    revokedKeyId,
    revokedFromPhase: phase,
    signedByKeyId: signer.keyId,
    recordSource,
  };
  const sig = signer.sign(revocationSigningBytes({ ...base, signature: "" }));
  if (!sig.ok) throw new Error("fixture signer failed");
  return { ...base, signature: sig.value };
}

const e1 = entry("leaf-1", 100, "peer-c");
const e2 = entry("leaf-2", 110, "peer-d");
const e3 = entry("leaf-3", 120, "peer-c");

const s1 = addRevocation(EMPTY_REVOCATIONS, e1);
const s12 = addRevocation(s1, e2);
const s3 = addRevocation(EMPTY_REVOCATIONS, e3);

describe("G-Set laws", () => {
  test("commutative: a ∪ b == b ∪ a", () => {
    expect(revocationSetDigest(mergeRevocations(s12, s3))).toBe(revocationSetDigest(mergeRevocations(s3, s12)));
  });

  test("associative: (a ∪ b) ∪ c == a ∪ (b ∪ c)", () => {
    const a = s1;
    const b = addRevocation(EMPTY_REVOCATIONS, e2);
    const c = s3;
    expect(revocationSetDigest(mergeRevocations(mergeRevocations(a, b), c))).toBe(
      revocationSetDigest(mergeRevocations(a, mergeRevocations(b, c))),
    );
  });

  test("idempotent: a ∪ a == a, and re-adding an element is a no-op", () => {
    expect(revocationSetDigest(mergeRevocations(s12, s12))).toBe(revocationSetDigest(s12));
    expect(addRevocation(s12, e1)).toBe(s12); // identical reference — literally a no-op
  });

  test("convergence: three nodes receiving the SAME facts in DIFFERENT orders agree", () => {
    const nodeA = mergeAllRevocations([s1, s3, addRevocation(EMPTY_REVOCATIONS, e2)]);
    const nodeB = mergeAllRevocations([s3, addRevocation(EMPTY_REVOCATIONS, e2), s1]);
    const nodeC = mergeAllRevocations([addRevocation(EMPTY_REVOCATIONS, e2), s1, s3, s1, s3]); // with duplicates
    expect(revocationSetDigest(nodeA)).toBe(revocationSetDigest(nodeB));
    expect(revocationSetDigest(nodeB)).toBe(revocationSetDigest(nodeC));
  });

  test("record source does not fork the element — same fact via two channels is one element", () => {
    const viaC = addRevocation(EMPTY_REVOCATIONS, entry("leaf-9", 100, "peer-c"));
    const viaD = addRevocation(EMPTY_REVOCATIONS, entry("leaf-9", 100, "peer-d"));
    const merged = mergeRevocations(viaC, viaD);
    expect(merged.size).toBe(1);
    // and the merge is still commutative on the payload, not only the key set
    expect(revocationSetDigest(merged)).toBe(revocationSetDigest(mergeRevocations(viaD, viaC)));
  });

  test("censorship-resistance: withholding delays and never removes", () => {
    const censor: RevocationGSet = EMPTY_REVOCATIONS; // a node that withholds e1
    const honest = s1; // one honest peer holds it
    const victim = mergeRevocations(mergeRevocations(EMPTY_REVOCATIONS, censor), honest);
    expect(victim.has(revocationKey(e1))).toBe(true);
    // and once landed, no further merge can remove it
    expect(mergeRevocations(victim, censor).has(revocationKey(e1))).toBe(true);
  });
});

describe("NEGATIVE: a non-monotone 'unrevoke' breaks convergence — so the laws are load-bearing", () => {
  /**
   * NOT exported from the library. It exists only here, to prove that the
   * grow-only restriction is doing work rather than being a stylistic choice.
   */
  type Op =
    | { readonly kind: "add"; readonly entry: RevocationEntry }
    | { readonly kind: "unrevoke"; readonly key: string };

  function applyNonMonotone(set: RevocationGSet, op: Op): RevocationGSet {
    if (op.kind === "add") return addRevocation(set, op.entry);
    const next = new Map(set);
    next.delete(op.key);
    return next;
  }

  test("with unrevoke, two orderings of the same ops reach DIFFERENT states", () => {
    const ops: readonly Op[] = [
      { kind: "add", entry: e1 },
      { kind: "unrevoke", key: revocationKey(e1) },
    ];
    const forward = ops.reduce(applyNonMonotone, EMPTY_REVOCATIONS);
    const reversed = [...ops].reverse().reduce(applyNonMonotone, EMPTY_REVOCATIONS);
    expect(revocationSetDigest(forward)).not.toBe(revocationSetDigest(reversed));
    expect(forward.size).toBe(0);
    expect(reversed.size).toBe(1);
  });

  test("POSITIVE CONTROL: the same two orderings converge when only 'add' is available", () => {
    const adds: readonly Op[] = [
      { kind: "add", entry: e1 },
      { kind: "add", entry: e2 },
    ];
    const forward = adds.reduce(applyNonMonotone, EMPTY_REVOCATIONS);
    const reversed = [...adds].reverse().reduce(applyNonMonotone, EMPTY_REVOCATIONS);
    expect(revocationSetDigest(forward)).toBe(revocationSetDigest(reversed));
  });

  test("the library offers no removal at all — the union of its exported ops is monotone", async () => {
    const mod = (await import("./revocation.ts")) as Record<string, unknown>;
    const removalShaped = Object.keys(mod).filter((k) => /remove|delete|unrevoke|prune|clear|expire/i.test(k));
    expect(removalShaped).toEqual([]);
  });
});

describe("adjudication is pairwise and unknown is not permissive", () => {
  test("a signed revocation from an ACCEPTED domain is decisive", () => {
    const r = isKeyRevoked({
      revocations: s1,
      accepted: ACCEPTED,
      trustDomain: "node-b.zeta.local",
      keyId: "leaf-1",
      currentPhase: 150,
      verifier: V,
    });
    expect(r.revoked).toBe(true);
  });

  test("NEGATIVE: not yet in force at an earlier phase", () => {
    const r = isKeyRevoked({
      revocations: s1,
      accepted: ACCEPTED,
      trustDomain: "node-b.zeta.local",
      keyId: "leaf-1",
      currentPhase: 99,
      verifier: V,
    });
    expect(r.revoked).toBe(false);
  });

  test("NEGATIVE: a revocation signed by a root we do not accept is retained but not decisive", () => {
    const rogue = addRevocation(EMPTY_REVOCATIONS, entry("leaf-1", 100, "peer-c", stranger));
    const r = isKeyRevoked({
      revocations: rogue,
      accepted: ACCEPTED,
      trustDomain: "node-b.zeta.local",
      keyId: "leaf-1",
      currentPhase: 150,
      verifier: V,
    });
    expect(r.revoked).toBe(false);
    expect(rogue.size).toBe(1); // retained — this node may accept that root later
  });

  test("NEGATIVE: a forged signature is not decisive", () => {
    const forged = addRevocation(EMPTY_REVOCATIONS, { ...e1, signature: "AAAA" });
    expect(
      isKeyRevoked({
        revocations: forged,
        accepted: ACCEPTED,
        trustDomain: "node-b.zeta.local",
        keyId: "leaf-1",
        currentPhase: 150,
        verifier: V,
      }).revoked,
    ).toBe(false);
  });

  test("NEGATIVE: with no accepted bundle the answer is ABSENCE OF A DECISION, and says so", () => {
    const r = isKeyRevoked({
      revocations: s1,
      accepted: new Map(),
      trustDomain: "node-b.zeta.local",
      keyId: "leaf-1",
      currentPhase: 150,
      verifier: V,
    });
    expect(r.revoked).toBe(false);
    expect(r.reason).toContain("ABSENCE OF A DECISION");
  });
});
