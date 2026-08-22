// frost-delta-rotation.ts — revoke a share without the revoked party's cooperation.
// Run: bun test frost-delta-rotation.test.ts
//
// The scenario under test is the one frost-reshare.ts explicitly cannot serve:
// a site is compromised, and its share must stop being able to sign WITHOUT
// that site doing anything. Preserving the group key is what makes that
// impossible, so the key must change — verifiably.
import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  frostKeygen,
  frostThresholdSign,
  frostVerify,
  lagrangeCoefficient,
  type FrostKeyShare,
} from "./frost.ts";
import {
  deltaRotateCombine,
  deltaRotateContribute,
  hashRotationTranscript,
  runDeltaRotationInProcess,
  verifyDeltaRotation,
  type DeltaContribution,
} from "./frost-delta-rotation.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const MSG = new TextEncoder().encode("zeta-frost-delta-rotation");
const Fn = ed25519.Point.Fn;
const G = ed25519.Point.BASE;

const eq = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

/** Reconstruct the group scalar — ONLY inside a test, to play the strongest adversary. */
function reconstructSecret(shares: readonly FrostKeyShare[]): bigint {
  const xs = shares.map((s) => s.x);
  let acc = Fn.ZERO;
  for (const s of shares) {
    acc = Fn.add(acc, Fn.mul(lagrangeCoefficient(s.x, xs), s.secretShare));
  }
  return acc;
}

describe("the key changes, verifiably, and the new set works", () => {
  test("DR-1: A' = A + [delta]B, derived from public points, and the NEW set signs under A'", () => {
    const kg = frostKeygen(2, 3, lcg(1));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 2),
      { newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
      lcg(2),
    );

    // The link is arithmetic, not asserted: A' - A == [delta]B.
    const A = ed25519.Point.fromBytes(kg.groupPublicKey);
    const Aprime = ed25519.Point.fromBytes(out.newGroupPublicKey);
    const delta = ed25519.Point.fromBytes(out.deltaPoint);
    expect(Aprime.equals(A.add(delta))).toBe(true);

    // ...and the key really did move (a rotation that changes nothing is the
    // failure this whole module exists to avoid).
    expect(eq(out.newGroupPublicKey, kg.groupPublicKey)).toBe(false);
    expect(delta.equals(ed25519.Point.ZERO)).toBe(false);

    const sig = frostThresholdSign(out.newGroupPublicKey, out.shares, MSG, lcg(3), 2);
    expect(frostVerify(out.newGroupPublicKey, MSG, sig)).toBe(true);
  });

  test("DR-2: zeroDelta reproduces a RESHARE exactly — the group key is preserved and delta is the identity", () => {
    const kg = frostKeygen(2, 3, lcg(4));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 2),
      { newIndices: [1, 2, 3], newThreshold: 2, zeroDelta: true },
      lcg(5),
    );
    expect(eq(out.newGroupPublicKey, kg.groupPublicKey)).toBe(true);
    expect(ed25519.Point.fromBytes(out.deltaPoint).equals(ed25519.Point.ZERO)).toBe(true);

    // And it is a real share set for the ORIGINAL key — reshare semantics.
    const sig = frostThresholdSign(kg.groupPublicKey, out.shares.slice(0, 2), MSG, lcg(6), 2);
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true);
  });

  test("DR-3: every k-subset of the new set signs — a real threshold set, not one lucky pair", () => {
    const kg = frostKeygen(3, 5, lcg(7));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 3),
      { newIndices: [1, 2, 3, 4], newThreshold: 3, retiredIndices: [5] },
      lcg(8),
    );
    const subsets = [
      [0, 1, 2],
      [0, 1, 3],
      [0, 2, 3],
      [1, 2, 3],
    ];
    for (const idx of subsets) {
      const picked = idx.map((i) => out.shares[i] as FrostKeyShare);
      const sig = frostThresholdSign(out.newGroupPublicKey, picked, MSG, lcg(9), 3);
      expect(frostVerify(out.newGroupPublicKey, MSG, sig)).toBe(true);
    }
  });

  test("DR-4: the threshold may CHANGE across a rotation (2-of-3 becomes 3-of-5)", () => {
    const kg = frostKeygen(2, 3, lcg(10));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 2),
      { newIndices: [1, 2, 4, 5, 6], newThreshold: 3, retiredIndices: [3] },
      lcg(11),
    );
    expect(out.threshold).toBe(3);
    const sig = frostThresholdSign(out.newGroupPublicKey, out.shares.slice(0, 3), MSG, lcg(12), 3);
    expect(frostVerify(out.newGroupPublicKey, MSG, sig)).toBe(true);
  });
});

describe("REVOCATION: the revoked party is asked for nothing and can no longer sign", () => {
  test("DR-5: the revoked holder's share signs the RETIRED key and fails against the NEW one", () => {
    const kg = frostKeygen(2, 3, lcg(20));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      [kg.shares[0] as FrostKeyShare, kg.shares[1] as FrostKeyShare],
      { newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
      lcg(21),
    );

    // Site 3 is revoked, keeps its share, cooperates with nothing. Its OLD
    // quorum still exists (2-of-3, sites 2+3) and still produces a VALID
    // signature — under the retired anchor only.
    const oldQuorum = [kg.shares[1] as FrostKeyShare, kg.shares[2] as FrostKeyShare];
    const sig = frostThresholdSign(kg.groupPublicKey, oldQuorum, MSG, lcg(22), 2);

    // Non-vacuity: the SAME signature verifies under the old key. The failure
    // below is the key change, not a broken signing path.
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true);
    expect(frostVerify(out.newGroupPublicKey, MSG, sig)).toBe(false);
  });

  test("DR-6: an adversary holding the ENTIRE old secret cannot sign under the new key", () => {
    const kg = frostKeygen(2, 3, lcg(23));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 2),
      { newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
      lcg(24),
    );

    // Total compromise of the OLD key: the adversary interpolates f(0).
    const oldSecret = reconstructSecret(kg.shares.slice(0, 2));
    // Non-vacuity: that really is the old signing scalar.
    expect(eq(G.multiply(oldSecret).toBytes(), kg.groupPublicKey)).toBe(true);
    // And it is NOT the new one. delta is a joint random secret the adversary
    // never saw; it holds only [delta]B, and recovering delta from it is the
    // discrete log problem.
    expect(eq(G.multiply(oldSecret).toBytes(), out.newGroupPublicKey)).toBe(false);
  });

  test("DR-7: MIXING a revoked old share with new shares does not reach the new quorum", () => {
    const kg = frostKeygen(3, 5, lcg(25));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 3),
      { newIndices: [1, 2, 3, 4], newThreshold: 3, retiredIndices: [5] },
      lcg(26),
    );

    // Adversary = revoked site 5 (old share) + two compromised NEW sites. Three
    // shares, threshold three — but one of them is on the old polynomial.
    const mixed = [
      out.shares[0] as FrostKeyShare,
      out.shares[1] as FrostKeyShare,
      kg.shares[4] as FrostKeyShare,
    ];
    const sig = frostThresholdSign(out.newGroupPublicKey, mixed, MSG, lcg(27), 3);
    expect(frostVerify(out.newGroupPublicKey, MSG, sig)).toBe(false);

    // Non-vacuity: three genuine NEW shares at the same indices DO verify.
    const clean = out.shares.slice(0, 3);
    const good = frostThresholdSign(out.newGroupPublicKey, clean, MSG, lcg(27), 3);
    expect(frostVerify(out.newGroupPublicKey, MSG, good)).toBe(true);
  });

  test("DR-8: a retired index still present in newIndices is REFUSED, not quietly issued a share", () => {
    const kg = frostKeygen(2, 3, lcg(28));
    expect(() =>
      deltaRotateContribute(kg.shares[0] as FrostKeyShare, {
        contributingSet: [1, 2],
        newIndices: [1, 2, 3],
        newThreshold: 2,
        retiredIndices: [3],
      }),
    ).toThrow(/retired but is still in newIndices/);
  });

  test("DR-9: a retired index inside the contributing set is REFUSED — it must not help retire itself", () => {
    const kg = frostKeygen(2, 3, lcg(29));
    expect(() =>
      deltaRotateContribute(kg.shares[0] as FrostKeyShare, {
        contributingSet: [1, 3],
        newIndices: [1, 2],
        newThreshold: 2,
        retiredIndices: [3],
      }),
    ).toThrow(/retired but is in the contributing set/);
  });

  test("DR-10: zeroDelta with a retirement is REFUSED — preserving the key revokes nothing", () => {
    const kg = frostKeygen(2, 3, lcg(30));
    expect(() =>
      deltaRotateContribute(kg.shares[0] as FrostKeyShare, {
        contributingSet: [1, 2],
        newIndices: [1, 2],
        newThreshold: 2,
        retiredIndices: [3],
        zeroDelta: true,
      }),
    ).toThrow(/revokes nothing/);
  });
});

describe("the public check: what it catches, and the one thing it does NOT", () => {
  test("DR-11: a WRONG contributing set (wrong Lagrange coefficients) is caught", () => {
    const kg = frostKeygen(2, 3, lcg(40));
    const bundles = [
      deltaRotateContribute(
        kg.shares[0] as FrostKeyShare,
        { contributingSet: [1, 2], newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
        lcg(41),
      ),
      // Holder 2 believes the set is {2,3} — different lambda, wrong secret.
      deltaRotateContribute(
        kg.shares[1] as FrostKeyShare,
        { contributingSet: [2, 3], newIndices: [1, 2], newThreshold: 2, retiredIndices: [] },
        lcg(42),
      ),
    ];
    const check = verifyDeltaRotation(
      kg.groupPublicKey,
      bundles.map((b) => b.contribution),
    );
    expect(check.ok).toBe(false);
  });

  test("DR-12: too FEW contributors (below threshold) is caught", () => {
    const kg = frostKeygen(3, 5, lcg(43));
    const bundle = deltaRotateContribute(
      kg.shares[0] as FrostKeyShare,
      { contributingSet: [1, 2, 3], newIndices: [1, 2, 3, 4], newThreshold: 3 },
      lcg(44),
    );
    const check = verifyDeltaRotation(kg.groupPublicKey, [bundle.contribution]);
    expect(check.ok).toBe(false);
  });

  test("DR-13: a TAMPERED deltaCommitment is caught — the delta must match the commitments", () => {
    const kg = frostKeygen(2, 3, lcg(45));
    const bundles = kg.shares
      .slice(0, 2)
      .map((s) =>
        deltaRotateContribute(
          s,
          { contributingSet: [1, 2], newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
          lcg(46),
        ),
      );
    const contributions = bundles.map((b) => b.contribution);
    expect(verifyDeltaRotation(kg.groupPublicKey, contributions).ok).toBe(true);

    const first = contributions[0] as DeltaContribution;
    const tampered: DeltaContribution[] = [
      { ...first, deltaCommitment: G.multiply(Fn.create(7n)).toBytes() },
      contributions[1] as DeltaContribution,
    ];
    expect(verifyDeltaRotation(kg.groupPublicKey, tampered).ok).toBe(false);
  });

  test("DR-14: an empty contribution list is rejected — it must not vacuously pass", () => {
    const kg = frostKeygen(2, 3, lcg(47));
    expect(verifyDeltaRotation(kg.groupPublicKey, []).ok).toBe(false);
  });

  test("DR-15: a duplicated contribution and a commitment-less one are rejected, not thrown", () => {
    const kg = frostKeygen(2, 3, lcg(48));
    const b = deltaRotateContribute(
      kg.shares[0] as FrostKeyShare,
      { contributingSet: [1, 2], newIndices: [1, 2], newThreshold: 2 },
      lcg(49),
    );
    expect(verifyDeltaRotation(kg.groupPublicKey, [b.contribution, b.contribution]).ok).toBe(false);
    expect(
      verifyDeltaRotation(kg.groupPublicKey, [{ ...b.contribution, commitments: [] }]).ok,
    ).toBe(false);
    expect(
      verifyDeltaRotation(kg.groupPublicKey, [
        { ...b.contribution, deltaCommitment: new Uint8Array(32).fill(0xff) },
      ]).ok,
    ).toBe(false);
    expect(verifyDeltaRotation(new Uint8Array(32).fill(0xff), [b.contribution]).ok).toBe(false);
  });

  test("DR-15b: one holder claiming TWO SEATS is refused even when the seats sum correctly", () => {
    // Found by mutation: deleting the duplicate-contribution guard SURVIVED
    // DR-15, because [c, c] misses the group key on the arithmetic anyway. The
    // real attack is one holder taking two seats with the second crafted to
    // close the equation — computable from PUBLIC points, so it is buildable.
    const kg = frostKeygen(2, 3, lcg(51));
    const c1 = deltaRotateContribute(
      kg.shares[0] as FrostKeyShare,
      { contributingSet: [1, 2], newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
      lcg(52),
    ).contribution;
    const A = ed25519.Point.fromBytes(kg.groupPublicKey);
    // Seat 1 contributes [u_1]B. Seat 2 must contribute A - [u_1]B, and its own
    // head Q is free — so set Delta_2 = Q - (A - [u_1]B).
    const u1 = ed25519.Point.fromBytes(c1.commitments[0] as Uint8Array).subtract(
      ed25519.Point.fromBytes(c1.deltaCommitment),
    );
    const Q = G.multiply(Fn.create(4242n));
    const forged: DeltaContribution[] = [
      c1,
      { fromX: 1, commitments: [Q.toBytes()], deltaCommitment: Q.subtract(A.subtract(u1)).toBytes() },
    ];
    // Non-vacuity: the arithmetic alone WOULD wave this through.
    const heads = forged.reduce(
      (acc, c) => acc.add(ed25519.Point.fromBytes(c.commitments[0] as Uint8Array)),
      ed25519.Point.ZERO,
    );
    const deltas = forged.reduce(
      (acc, c) => acc.add(ed25519.Point.fromBytes(c.deltaCommitment)),
      ed25519.Point.ZERO,
    );
    expect(heads.equals(A.add(deltas))).toBe(true);
    // ...and it is refused, because one holder cannot be two contributors.
    expect(verifyDeltaRotation(kg.groupPublicKey, forged).ok).toBe(false);
    // The same shape with the seat honestly relabelled to a second holder does
    // pass the arithmetic — proving the refusal above came from the seat check.
    const relabelled: DeltaContribution[] = [c1, { ...(forged[1] as DeltaContribution), fromX: 2 }];
    expect(verifyDeltaRotation(kg.groupPublicKey, relabelled).ok).toBe(true);
  });

  test("DR-16: THE HONEST NEGATIVE — a party with NO shares forges a transcript that PASSES the arithmetic check", () => {
    // This is header caveat 1, planted. Pick any two heads freely, then choose
    // the deltas so that SUM (C_i[0] - Delta_i) == A. No share is involved.
    const kg = frostKeygen(2, 3, lcg(50));
    const A = ed25519.Point.fromBytes(kg.groupPublicKey);
    const h1 = G.multiply(Fn.create(11111n));
    const h2 = G.multiply(Fn.create(22222n));
    // Choose X_1 = A, X_2 = 0  =>  Delta_1 = C_1[0] - A, Delta_2 = C_2[0].
    const forged: DeltaContribution[] = [
      { fromX: 1, commitments: [h1.toBytes()], deltaCommitment: h1.subtract(A).toBytes() },
      { fromX: 2, commitments: [h2.toBytes()], deltaCommitment: h2.toBytes() },
    ];
    const check = verifyDeltaRotation(kg.groupPublicKey, forged);
    expect(check.ok).toBe(true); // <- the check is arithmetic, not authentication

    // What it forges is a key nobody can sign under, and — the point — the
    // ledger rejects it because no old quorum signed the transition. That
    // separation is asserted in key-epoch-ledger.test.ts (KL-6).
    if (check.ok) {
      expect(eq(check.newGroupPublicKey, kg.groupPublicKey)).toBe(false);
    }
  });
});

describe("the recipient side and the transcript digest", () => {
  test("DR-17: deltaRotateCombine re-verifies — a tampered subshare cannot be smuggled past it", () => {
    const kg = frostKeygen(2, 3, lcg(60));
    const contributingSet = [1, 2];
    const bundles = kg.shares
      .slice(0, 2)
      .map((s) =>
        deltaRotateContribute(
          s,
          { contributingSet, newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
          lcg(61),
        ),
      );
    const contributions = bundles.map((b) => b.contribution);
    const subshares = bundles.flatMap((b) => b.subshares);

    // Non-vacuity: untampered, it combines.
    expect(() => deltaRotateCombine(1, contributions, subshares)).not.toThrow();

    const tampered = subshares.map((s) =>
      s.toX === 1 && s.fromX === 1 ? { ...s, scalar: Fn.add(s.scalar, Fn.ONE) } : s,
    );
    expect(() => deltaRotateCombine(1, contributions, tampered)).toThrow(/Feldman/);
  });

  test("DR-18: a MISSING contributor's subshare is refused, not silently summed over", () => {
    const kg = frostKeygen(2, 3, lcg(62));
    const bundles = kg.shares
      .slice(0, 2)
      .map((s) =>
        deltaRotateContribute(
          s,
          { contributingSet: [1, 2], newIndices: [1, 2], newThreshold: 2 },
          lcg(63),
        ),
      );
    const contributions = bundles.map((b) => b.contribution);
    const only = bundles[0]!.subshares;
    expect(() => deltaRotateCombine(1, contributions, only)).toThrow(/exactly one subshare/);
    expect(() => deltaRotateCombine(0, contributions, only)).toThrow(/index must be >= 1/);
    expect(() => deltaRotateCombine(1, [], only)).toThrow(/no contributions/);
  });

  test("DR-19: the transcript digest ignores collection ORDER and moves on any byte", () => {
    const kg = frostKeygen(2, 3, lcg(64));
    const bundles = kg.shares
      .slice(0, 2)
      .map((s) =>
        deltaRotateContribute(
          s,
          { contributingSet: [1, 2], newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
          lcg(65),
        ),
      );
    const cs = bundles.map((b) => b.contribution);
    const forward = hashRotationTranscript(cs);
    const reversed = hashRotationTranscript([...cs].reverse());
    expect(eq(forward, reversed)).toBe(true); // a coordinator cannot move it by reordering

    const first = cs[0] as DeltaContribution;
    const mutated: DeltaContribution[] = [
      { ...first, deltaCommitment: G.multiply(Fn.create(3n)).toBytes() },
      cs[1] as DeltaContribution,
    ];
    expect(eq(forward, hashRotationTranscript(mutated))).toBe(false);

    // ...and relabelling the sender moves it too (fromX is inside the digest).
    const relabelled: DeltaContribution[] = [
      { ...first, fromX: 9 },
      cs[1] as DeltaContribution,
    ];
    expect(eq(forward, hashRotationTranscript(relabelled))).toBe(false);

    // Found by mutation, TWICE. Dropping fromX from the digest survived the
    // line above, because 1 -> 9 also moves the sort position, so the ORDER
    // change was giving the test its answer and the attribution was never
    // actually checked. It survived a label SWAP for the same reason. The
    // mutation only dies on a relabel that leaves the sort order alone: move
    // the second contributor 2 -> 5 and nothing but the attribution changes.
    const second = cs[1] as DeltaContribution;
    const renumbered: DeltaContribution[] = [first, { ...second, fromX: 5 }];
    expect(renumbered.map((c) => c.fromX)).toEqual([1, 5]); // order preserved
    expect(eq(forward, hashRotationTranscript(renumbered))).toBe(false);
  });

  test("DR-20: input validation refuses rather than repairs", () => {
    const kg = frostKeygen(2, 3, lcg(66));
    const s0 = kg.shares[0] as FrostKeyShare;
    const base = { contributingSet: [1, 2], newIndices: [1, 2], newThreshold: 2 };
    expect(() => deltaRotateContribute(s0, { ...base, newThreshold: 0 })).toThrow(/newThreshold/);
    expect(() => deltaRotateContribute(s0, { ...base, newIndices: [1], newThreshold: 2 })).toThrow(
      /at least newThreshold/,
    );
    expect(() => deltaRotateContribute(s0, { ...base, newIndices: [1, 1, 2] })).toThrow(
      /duplicate new participant/,
    );
    expect(() => deltaRotateContribute(s0, { ...base, newIndices: [0, 1] })).toThrow(/>= 1/);
    expect(() => deltaRotateContribute(s0, { ...base, contributingSet: [1, 1, 2] })).toThrow(
      /duplicate contributing/,
    );
    expect(() => deltaRotateContribute(s0, { ...base, contributingSet: [2, 3] })).toThrow(
      /not in the contributing set/,
    );
  });
});
