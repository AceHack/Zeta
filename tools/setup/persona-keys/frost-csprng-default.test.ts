// The DEFAULT randomness source for key material must be the OS CSPRNG.
//
// P0 found 2026-08-14 while shaping the signPartial port. randScalar / randCoeff
// defaulted to Math.random, and EVERY production call site reached that default:
// frost-ca-custody.ts calls frostKeygen / frostDkgKeygen / frostThresholdSign with no
// injected random. So the CA group signing scalar, the Shamir coefficients, and every
// FROST nonce came from a non-cryptographic PRNG whose internal state is recoverable
// from its own output -- and a recovered nonce yields the share directly from
// z_i = k_i + c * lambda_i * s_i.
//
// The fix moved only the DEFAULT; the injected door is untouched, so DST replay is
// unaffected. These tests are the falsifier for the fix: they fail if the default ever
// reaches Math.random again, which a reading of the diff alone would not catch.

import { afterEach, describe, expect, test } from "bun:test";
import { frostKeygen, frostNonceCommit } from "./frost.ts";
import { frostDkgKeygen } from "./frost-dkg.ts";
import { shamirSplit } from "./shamir.ts";

const realRandom = Math.random;

afterEach(() => {
  Math.random = realRandom;
});

/** Count Math.random calls while running body. */
function countsMathRandom(body: () => void): number {
  let calls = 0;
  Math.random = () => {
    calls++;
    return realRandom();
  };
  try {
    body();
  } finally {
    Math.random = realRandom;
  }
  return calls;
}

describe("key material never defaults to Math.random", () => {
  test("CSPRNG-1: frostKeygen with no injected source does not touch Math.random", () => {
    expect(countsMathRandom(() => void frostKeygen(2, 3))).toBe(0);
  });

  test("CSPRNG-2: frostNonceCommit with no injected source does not touch Math.random", () => {
    expect(countsMathRandom(() => void frostNonceCommit())).toBe(0);
  });

  test("CSPRNG-3: frostDkgKeygen with no injected source does not touch Math.random", () => {
    expect(countsMathRandom(() => void frostDkgKeygen(2, 3))).toBe(0);
  });

  test("CSPRNG-4: shamirSplit with no injected source does not touch Math.random", () => {
    const secret = new Uint8Array([1, 2, 3, 4]);
    expect(countsMathRandom(() => void shamirSplit(secret, { threshold: 2, shares: 3 }))).toBe(0);
  });

  test("CSPRNG-5: the injected door still works, so DST replay is unaffected", () => {
    const a = frostKeygen(2, 3, () => 0.5);
    const b = frostKeygen(2, 3, () => 0.5);
    expect(Array.from(a.groupPublicKey)).toEqual(Array.from(b.groupPublicKey));
    const s1 = shamirSplit(new Uint8Array([9, 9]), { threshold: 2, shares: 3, random: () => 0.25 });
    const s2 = shamirSplit(new Uint8Array([9, 9]), { threshold: 2, shares: 3, random: () => 0.25 });
    expect(s1).toEqual(s2);
  });

  test("CSPRNG-6: with no injected source, two draws differ (not a stuck constant)", () => {
    const a = frostKeygen(2, 3);
    const b = frostKeygen(2, 3);
    expect(Array.from(a.groupPublicKey)).not.toEqual(Array.from(b.groupPublicKey));
    const s1 = shamirSplit(new Uint8Array([9, 9, 9, 9]), { threshold: 2, shares: 3 });
    const s2 = shamirSplit(new Uint8Array([9, 9, 9, 9]), { threshold: 2, shares: 3 });
    expect(s1).not.toEqual(s2);
  });
});
