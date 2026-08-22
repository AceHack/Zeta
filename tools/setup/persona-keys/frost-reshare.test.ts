// frost-reshare.ts — replace a lost share without reconstituting the secret.
// Run: bun test frost-reshare.test.ts
//
// The scenario under test is the one that gates the three-house plan: a site's
// HSM dies, and a replacement share must be provisioned while the group public
// key (the trust anchor in every TrustedUserCAKeys on every node) stays put.
import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  frostKeygen,
  frostThresholdSign,
  frostVerify,
  lagrangeCoefficient,
  type FrostKeyShare,
} from "./frost.ts";
import { frostDkgKeygen } from "./frost-dkg.ts";
import {
  reshareCombine,
  reshareContribute,
  runReshareInProcess,
  verifyResharePreservesGroupKey,
  verifyReshareSubshare,
} from "./frost-reshare.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const MSG = new TextEncoder().encode("zeta-frost-reshare");
const Fn = ed25519.Point.Fn;
const G = ed25519.Point.BASE;

describe("reshare preserves the group key", () => {
  test("RS-1: the ORIGINAL group public key still verifies signatures made by the NEW share set", () => {
    const kg = frostKeygen(2, 3, lcg(1));
    const out = runReshareInProcess(kg.groupPublicKey, kg.shares.slice(0, 2), [1, 2, 3], 2, lcg(2));

    // The trust anchor is byte-identical. This is the whole point: no relying
    // party re-pins anything when a site is replaced.
    expect(Buffer.from(out.groupPublicKey).equals(Buffer.from(kg.groupPublicKey))).toBe(true);

    const sig = frostThresholdSign(kg.groupPublicKey, out.shares.slice(0, 2), MSG, lcg(3), 2);
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true);
  });

  test("RS-2: the DEAD-HSM scenario end to end — 2-of-3, site 3 dies, sites 1+2 mint a replacement", () => {
    const kg = frostDkgKeygen(2, 3, lcg(11));
    const survivors = [kg.shares[0]!, kg.shares[1]!]; // site 3's chip is gone, its share unrecoverable

    // The replacement site takes index 4; the dead index 3 is retired, not reused.
    const out = runReshareInProcess(kg.groupPublicKey, survivors, [1, 2, 4], 2, lcg(12));
    expect(Buffer.from(out.groupPublicKey).equals(Buffer.from(kg.groupPublicKey))).toBe(true);
    expect(out.shares.map((s) => s.x)).toEqual([1, 2, 4]);

    // The replacement participant can sign with a survivor, against the old key.
    const withReplacement = [out.shares[0]!, out.shares[2]!];
    const sig = frostThresholdSign(kg.groupPublicKey, withReplacement, MSG, lcg(13), 2);
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true);
  });

  test("RS-3: every k-subset of the new set signs — the new shares are a real threshold set, not one lucky pair", () => {
    const kg = frostKeygen(2, 3, lcg(21));
    const out = runReshareInProcess(kg.groupPublicKey, kg.shares.slice(0, 2), [1, 2, 4], 2, lcg(22));
    const pairs: readonly (readonly [number, number])[] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    for (const [a, b] of pairs) {
      const sig = frostThresholdSign(
        kg.groupPublicKey,
        [out.shares[a]!, out.shares[b]!],
        MSG,
        lcg(23 + a),
        2,
      );
      expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true);
    }
  });

  test("RS-4: the threshold may CHANGE across a reshare (2-of-3 becomes 3-of-5) on the same key", () => {
    const kg = frostKeygen(2, 3, lcg(31));
    const out = runReshareInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 2),
      [1, 2, 3, 4, 5],
      3,
      lcg(32),
    );
    expect(out.threshold).toBe(3);
    expect(Buffer.from(out.groupPublicKey).equals(Buffer.from(kg.groupPublicKey))).toBe(true);

    const sig = frostThresholdSign(kg.groupPublicKey, out.shares.slice(0, 3), MSG, lcg(33), 3);
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true);

    // And 2 of the NEW shares is now genuinely not enough: the signature does
    // not verify. (Under-threshold FROST produces a well-formed but invalid sig.)
    const short = frostThresholdSign(kg.groupPublicKey, out.shares.slice(0, 2), MSG, lcg(34), 2);
    expect(frostVerify(kg.groupPublicKey, MSG, short)).toBe(false);
  });
});

describe("the secret is never assembled, and the old set is superseded", () => {
  test("RS-5: new shares are on a DIFFERENT polynomial — old and new shares do not interoperate", () => {
    const kg = frostKeygen(2, 3, lcg(41));
    const out = runReshareInProcess(kg.groupPublicKey, kg.shares.slice(0, 2), [1, 2, 3], 2, lcg(42));

    // Same index, different scalar: the share value genuinely rotated.
    expect(out.shares[0]!.secretShare).not.toBe(kg.shares[0]!.secretShare);

    // Mixing one old and one new share yields an INVALID signature. This is the
    // proactive-refresh property: an attacker holding k-1 old and k-1 new shares
    // cannot combine them. It is also why the old set must be destroyed — it
    // remains a complete, independent signing quorum until it is.
    const mixed: FrostKeyShare[] = [kg.shares[0]!, out.shares[1]!];
    const sig = frostThresholdSign(kg.groupPublicKey, mixed, MSG, lcg(43), 2);
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(false);
  });

  test("RS-6: no single contributor's committed additive share equals the group key", () => {
    // [u_i]B == groupPK would mean that holder alone carries the whole secret.
    // With k >= 2 it must not, and the contributions are public, so this is
    // checkable by an auditor who holds nothing.
    const kg = frostKeygen(2, 3, lcg(51));
    const set = [1, 2];
    for (const s of kg.shares.slice(0, 2)) {
      const { contribution } = reshareContribute(s, set, [1, 2, 3], 2, lcg(52));
      expect(Buffer.from(contribution.commitments[0]!).equals(Buffer.from(kg.groupPublicKey))).toBe(
        false,
      );
      // ...yet the SUM of them does equal it.
    }
    const contribs = kg.shares
      .slice(0, 2)
      .map((s) => reshareContribute(s, set, [1, 2, 3], 2, lcg(53)).contribution);
    expect(verifyResharePreservesGroupKey(kg.groupPublicKey, contribs)).toBe(true);
  });

  test("RS-7: the old share set still signs after a reshare — destruction is an operational step, not a cryptographic one", () => {
    // Stated as a test so nobody assumes resharing revokes anything. It does not.
    const kg = frostKeygen(2, 3, lcg(61));
    runReshareInProcess(kg.groupPublicKey, kg.shares.slice(0, 2), [1, 2, 3], 2, lcg(62));
    const sig = frostThresholdSign(kg.groupPublicKey, kg.shares.slice(0, 2), MSG, lcg(63), 2);
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true);
  });
});

describe("the public verifier catches a bad ceremony", () => {
  test("RS-8: a WRONG contributing set (wrong Lagrange coefficients) is caught by the group-key check", () => {
    // The subtle, plausible operator error: three holders are online so the
    // operator lists all three, but only two actually contribute. Each holder's
    // lambda is then computed against the wrong set, so the u_i sum to the wrong
    // scalar and the reshare silently targets a DIFFERENT key. Caught here.
    const kg = frostKeygen(2, 3, lcg(71));
    const wrongSet = [1, 2, 3]; // claimed
    const contribs = kg.shares
      .slice(0, 2) // actual contributors
      .map((s) => reshareContribute(s, wrongSet, [1, 2, 3], 2, lcg(72)).contribution);
    expect(verifyResharePreservesGroupKey(kg.groupPublicKey, contribs)).toBe(false);
  });

  test("RS-9: too FEW contributors (below threshold) is caught by the group-key check", () => {
    const kg = frostKeygen(3, 5, lcg(81));
    const contribs = kg.shares
      .slice(0, 2)
      .map((s) => reshareContribute(s, [1, 2], [1, 2, 3], 3, lcg(82)).contribution);
    expect(verifyResharePreservesGroupKey(kg.groupPublicKey, contribs)).toBe(false);
    expect(() =>
      runReshareInProcess(kg.groupPublicKey, kg.shares.slice(0, 2), [1, 2, 3], 3, lcg(83)),
    ).toThrow(/do not reconstruct the group public key/);
  });

  test("RS-10: one holder submitting TWO contributions is rejected even when they sum correctly", () => {
    // The naive form of this test (pass [c1, c1]) proves nothing: the sum is then
    // 2*u_1, which misses the group key anyway, so it passes with or without the
    // duplicate check. A mutant that deletes the check survives it. The real
    // attack is one holder claiming two seats with commitments crafted to sum to
    // the group key exactly — computable from PUBLIC points alone, so an
    // attacker can actually build it.
    const kg = frostKeygen(2, 3, lcg(91));
    const c1 = reshareContribute(kg.shares[0]!, [1, 2], [1, 2], 2, lcg(92)).contribution;
    const u1P = ed25519.Point.fromBytes(c1.commitments[0]!);
    const complement = ed25519.Point.fromBytes(kg.groupPublicKey).add(u1P.negate());

    const forged = [
      { fromX: 1, commitments: [c1.commitments[0]!] },
      { fromX: 1, commitments: [complement.toBytes()] }, // same holder, second seat
    ];
    // The sum IS the group key — the arithmetic alone would wave it through.
    const sum = forged.reduce(
      (acc, c) => acc.add(ed25519.Point.fromBytes(c.commitments[0]!)),
      ed25519.Point.ZERO,
    );
    expect(Buffer.from(sum.toBytes()).equals(Buffer.from(kg.groupPublicKey))).toBe(true);
    // ...and it is refused, because one holder cannot be two contributors.
    expect(verifyResharePreservesGroupKey(kg.groupPublicKey, forged)).toBe(false);
  });

  test("RS-11: an EMPTY contribution list is rejected (it must not vacuously pass)", () => {
    const kg = frostKeygen(2, 3, lcg(101));
    expect(verifyResharePreservesGroupKey(kg.groupPublicKey, [])).toBe(false);
  });

  test("RS-12: a contribution with no commitments, or garbage bytes, is rejected not thrown", () => {
    const kg = frostKeygen(2, 3, lcg(111));
    expect(verifyResharePreservesGroupKey(kg.groupPublicKey, [{ fromX: 1, commitments: [] }])).toBe(
      false,
    );
    const garbage = new Uint8Array(32).fill(0xff); // not a valid compressed point
    expect(
      verifyResharePreservesGroupKey(kg.groupPublicKey, [{ fromX: 1, commitments: [garbage] }]),
    ).toBe(false);
  });
});

describe("the recipient-side Feldman check", () => {
  test("RS-13: an honest subshare verifies; a TAMPERED one does not", () => {
    const kg = frostKeygen(2, 3, lcg(121));
    const bundle = reshareContribute(kg.shares[0]!, [1, 2], [1, 2, 3], 2, lcg(122));
    const sub = bundle.subshares[0]!;
    expect(verifyReshareSubshare(bundle.contribution, sub)).toBe(true);

    const tampered = { ...sub, scalar: Fn.add(sub.scalar, 1n) };
    expect(verifyReshareSubshare(bundle.contribution, tampered)).toBe(false);
  });

  test("RS-14: a subshare delivered to the WRONG recipient index does not verify", () => {
    const kg = frostKeygen(2, 3, lcg(131));
    const bundle = reshareContribute(kg.shares[0]!, [1, 2], [1, 2, 3], 2, lcg(132));
    const forRecipient1 = bundle.subshares.find((s) => s.toX === 1)!;
    // Relabel it as if it were participant 2's — a misrouted or replayed delivery.
    expect(verifyReshareSubshare(bundle.contribution, { ...forRecipient1, toX: 2 })).toBe(false);
  });

  test("RS-15: a subshare attributed to the wrong sender is rejected", () => {
    const kg = frostKeygen(2, 3, lcg(141));
    const b1 = reshareContribute(kg.shares[0]!, [1, 2], [1, 2], 2, lcg(142));
    const b2 = reshareContribute(kg.shares[1]!, [1, 2], [1, 2], 2, lcg(143));
    // b2's subshare checked against b1's commitments.
    expect(verifyReshareSubshare(b1.contribution, b2.subshares[0]!)).toBe(false);
  });

  test("RS-15b: a RELABELLED contribution is rejected by the sender binding, not by the math", () => {
    // RS-15 alone does not exercise the fromX binding: two different holders have
    // different polynomials, so the Feldman equation fails on its own and a
    // mutant deleting the binding survives. The attack the binding actually stops
    // is REPLAY: take holder 1's contribution, relabel it as holder 2's, and now
    // one holder occupies two seats with commitments that verify perfectly.
    const kg = frostKeygen(2, 3, lcg(145));
    const b1 = reshareContribute(kg.shares[0]!, [1, 2], [1, 2], 2, lcg(146));
    const sub = b1.subshares[0]!; // genuinely from holder 1
    const relabelled = { fromX: 2, commitments: b1.contribution.commitments };

    // The Feldman math WOULD pass — same polynomial, same commitments.
    expect(verifyReshareSubshare(b1.contribution, sub)).toBe(true);
    // Only the sender binding catches the relabelling.
    expect(verifyReshareSubshare(relabelled, sub)).toBe(false);
  });

  test("RS-16: reshareCombine re-verifies — a tampered subshare cannot be smuggled past it", () => {
    const kg = frostKeygen(2, 3, lcg(151));
    const set = [1, 2];
    const bundles = kg.shares.slice(0, 2).map((s) => reshareContribute(s, set, [1, 2], 2, lcg(152)));
    const contributions = bundles.map((b) => b.contribution);
    const subs = bundles.flatMap((b) => b.subshares);

    // Honest path works.
    expect(() => reshareCombine(1, contributions, subs)).not.toThrow();

    const tampered = subs.map((s) =>
      s.toX === 1 && s.fromX === 1 ? { ...s, scalar: Fn.add(s.scalar, 7n) } : s,
    );
    expect(() => reshareCombine(1, contributions, tampered)).toThrow(/failed Feldman verification/);
  });

  test("RS-17: a MISSING contributor's subshare is refused, not silently summed over", () => {
    // Silently summing k-1 terms yields a share of a different secret that fails
    // only later, at signing time, far from the cause.
    const kg = frostKeygen(2, 3, lcg(161));
    const set = [1, 2];
    const bundles = kg.shares.slice(0, 2).map((s) => reshareContribute(s, set, [1, 2], 2, lcg(162)));
    const contributions = bundles.map((b) => b.contribution);
    const dropped = bundles.flatMap((b) => b.subshares).filter((s) => s.fromX !== 2);
    expect(() => reshareCombine(1, contributions, dropped)).toThrow(/exactly one subshare/);
  });
});

describe("input validation refuses rather than repairs", () => {
  test("RS-18: a holder outside the contributing set is refused", () => {
    const kg = frostKeygen(2, 3, lcg(171));
    expect(() => reshareContribute(kg.shares[2]!, [1, 2], [1, 2], 2, lcg(172))).toThrow(
      /not in the contributing set/,
    );
  });

  test("RS-19: duplicate new indices, duplicate contributors, and index 0 are refused", () => {
    const kg = frostKeygen(2, 3, lcg(181));
    expect(() => reshareContribute(kg.shares[0]!, [1, 2], [1, 1], 2, lcg(182))).toThrow(
      /duplicate new participant index/,
    );
    expect(() => reshareContribute(kg.shares[0]!, [1, 1, 2], [1, 2], 2, lcg(183))).toThrow(
      /duplicate contributing index/,
    );
    // x = 0 is f(0) itself — the secret. Accepting it would hand a "share" that
    // IS the group scalar to whoever asked for participant 0.
    expect(() => reshareContribute(kg.shares[0]!, [1, 2], [0, 1], 2, lcg(184))).toThrow(
      /index must be >= 1/,
    );
  });

  test("RS-20: fewer new participants than the new threshold is refused", () => {
    const kg = frostKeygen(2, 3, lcg(191));
    expect(() => reshareContribute(kg.shares[0]!, [1, 2], [1, 2], 3, lcg(192))).toThrow(
      /at least newThreshold long/,
    );
  });
});

describe("the arithmetic identity the whole scheme rests on", () => {
  test("RS-21: SUM lambda_i * s_i over a k-subset is the SAME scalar for every k-subset", () => {
    // If this failed, the additive decomposition u_i would not be a decomposition
    // of a single fixed secret and resharing would be nonsense. Computed here
    // over a locally generated throwaway key, in a test, never over real custody.
    const kg = frostKeygen(2, 4, lcg(201));
    const recombine = (idx: readonly number[]): bigint => {
      let acc = Fn.ZERO;
      for (const i of idx) {
        const sh = kg.shares.find((s) => s.x === i)!;
        acc = Fn.add(acc, Fn.mul(lagrangeCoefficient(i, idx), sh.secretShare));
      }
      return acc;
    };
    const a = recombine([1, 2]);
    expect(recombine([2, 3])).toBe(a);
    expect(recombine([1, 4])).toBe(a);
    expect(recombine([1, 2, 3])).toBe(a);
    // And it is the discrete log of the group public key.
    expect(Buffer.from(G.multiply(a).toBytes()).equals(Buffer.from(kg.groupPublicKey))).toBe(true);
  });
});
