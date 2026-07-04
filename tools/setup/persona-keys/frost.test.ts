// frost.ts — threshold Schnorr without key reassembly (081KVP3GYW1 live-signing slice).
// Run: bun test frost.test.ts
import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  frostKeygen,
  frostThresholdSign,
  frostVerify,
  lagrangeCoefficient,
} from "./frost.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

describe("frost threshold Schnorr (Ed25519)", () => {
  test("2-of-3: any pair produces a signature verifiable under the group public key", () => {
    const kg = frostKeygen(2, 3, lcg(1));
    const msg = new TextEncoder().encode("zeta frost slice-1");
    const pairs: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    for (const [a, b] of pairs) {
      const sig = frostThresholdSign(
        kg.groupPublicKey,
        [kg.shares[a]!, kg.shares[b]!],
        msg,
        lcg(10 + a + b),
        kg.threshold,
      );
      expect(sig.length).toBe(64);
      expect(frostVerify(kg.groupPublicKey, msg, sig)).toBe(true);
      // Standard noble verify agrees (same wire format).
      expect(ed25519.verify(sig, msg, kg.groupPublicKey)).toBe(true);
    }
  });

  test("3-of-5: threshold subset verifies; fewer than k throws", () => {
    const kg = frostKeygen(3, 5, lcg(99));
    const msg = new TextEncoder().encode("threshold");
    const sig = frostThresholdSign(
      kg.groupPublicKey,
      [kg.shares[0]!, kg.shares[2]!, kg.shares[4]!],
      msg,
      lcg(7),
      kg.threshold,
    );
    expect(frostVerify(kg.groupPublicKey, msg, sig)).toBe(true);
    expect(() =>
      frostThresholdSign(
        kg.groupPublicKey,
        [kg.shares[0]!, kg.shares[1]!],
        msg,
        lcg(8),
        kg.threshold,
      ),
    ).toThrow(/need at least/);
  });

  test("signature does not verify under a different group key", () => {
    const a = frostKeygen(2, 2, lcg(2));
    const b = frostKeygen(2, 2, lcg(3));
    const msg = new TextEncoder().encode("bound");
    const sig = frostThresholdSign(a.groupPublicKey, [...a.shares], msg, lcg(4), a.threshold);
    expect(frostVerify(b.groupPublicKey, msg, sig)).toBe(false);
  });

  test("Lagrange coefficients for {1,2} sum shares to the secret path (algebra check)", () => {
    // λ_1 + λ_2 path: for xs=[1,2], λ_1 = 2/(2-1)=2, λ_2 = 1/(1-2)= -1 = L-1
    const l1 = lagrangeCoefficient(1, [1, 2]);
    const l2 = lagrangeCoefficient(2, [1, 2]);
    // λ_1 * 1 + λ_2 * 2 should be 0 (evaluation identity at x points is not this);
    // λ_1 + λ_2 is not 1 in general — only Σ λ_i s_i = s.
    // Check λ_1 * f(1) + λ_2 * f(2) = f(0) for a known poly f(x)=5+7x.
    const Fn = ed25519.Point.Fn;
    const s0 = Fn.create(5n);
    const s1 = Fn.create(7n);
    const f = (x: number) => Fn.add(s0, Fn.mul(s1, Fn.create(BigInt(x))));
    const recon = Fn.add(Fn.mul(l1, f(1)), Fn.mul(l2, f(2)));
    expect(recon).toBe(s0);
  });
});
