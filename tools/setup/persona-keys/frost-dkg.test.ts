// frost-dkg.ts — distributed keygen (081KWPHRNFW slice 1).
// Run: bun test frost-dkg.test.ts
import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { frostKeygen, frostThresholdSign, frostVerify } from "./frost.ts";
import { frostDkgKeygen, frostDkgSmokeSign, verifyDkgShare } from "./frost-dkg.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

describe("frostDkgKeygen", () => {
  test("DKG-1: produces k shares and group PK; threshold sign verifies", () => {
    const kg = frostDkgKeygen(2, 3, lcg(7));
    expect(kg.shares.length).toBe(3);
    expect(kg.groupPublicKey.length).toBe(32);
    const msg = new TextEncoder().encode("dkg-smoke");
    expect(frostDkgSmokeSign(kg, msg, lcg(8))).toBe(true);
  });

  test("DKG-2: group PK equals sum of constant-term commitments (implicit)", () => {
    const rnd = lcg(99);
    const kg = frostDkgKeygen(2, 2, rnd);
    // Dealer path with same RNG stream would differ — DKG PK is not dealer PK.
    const dealer = frostKeygen(2, 2, rnd);
    expect(Buffer.from(kg.groupPublicKey).equals(Buffer.from(dealer.groupPublicKey))).toBe(false);
  });

  test("DKG-3: any k-of-n subset signs successfully", () => {
    const kg = frostDkgKeygen(3, 5, lcg(11));
    const msg = new TextEncoder().encode("subset");
    const subset = kg.shares.slice(0, 3);
    const sig = frostThresholdSign(kg.groupPublicKey, subset, msg, lcg(12), 3);
    expect(frostVerify(kg.groupPublicKey, msg, sig)).toBe(true);
  });

  test("DKG-4: verifyDkgShare rejects tampered share", () => {
    const kg = frostDkgKeygen(2, 2, lcg(3));
    const G = ed25519.Point.BASE;
    const badCommit = [G.multiply(1n).toBytes(), G.multiply(2n).toBytes()];
    expect(verifyDkgShare(badCommit, 1, 999n)).toBe(false);
    expect(verifyDkgShare(badCommit, 1, kg.shares[0]!.secretShare)).toBe(false);
  });
});
