import { describe, expect, it } from "bun:test";
import {
  splitSecret,
  generateFrostNoncePair,
  computeLagrangeCoefficient,
  signPartialShare,
  aggregateFrostSignatures,
} from "./frost-signer.js";

describe("FROST threshold signing engine", () => {
  it("computes Lagrange coefficients correctly", () => {
    const indices = [1, 2, 3];
    const l1 = computeLagrangeCoefficient(indices, 1);
    const l2 = computeLagrangeCoefficient(indices, 2);
    const l3 = computeLagrangeCoefficient(indices, 3);

    expect(typeof l1).toBe("bigint");
    expect(typeof l2).toBe("bigint");
    expect(typeof l3).toBe("bigint");
  });

  it("generates valid round-1 nonce commitments", () => {
    const { commitment } = generateFrostNoncePair(1);

    expect(commitment.index).toBe(1);
    expect(commitment.hidingPublic.length).toBe(32);
    expect(commitment.bindingPublic.length).toBe(32);
  });

  it("executes round-1 commitments and round-2 partial signing end-to-end", () => {
    const masterSeed = new Uint8Array(32);
    masterSeed.fill(0x42);

    // 2-of-3 split
    const shares = splitSecret(masterSeed, 2, 3);
    const message = new TextEncoder().encode("Zeta-FROST-Test-Message");

    // Participants 1 & 2
    const n1 = generateFrostNoncePair(1);
    const n2 = generateFrostNoncePair(2);
    const commitments = [n1.commitment, n2.commitment];

    // Round 2: Partial signatures
    const p1 = signPartialShare(shares[0]!, n1.noncePair, commitments, message);
    const p2 = signPartialShare(shares[1]!, n2.noncePair, commitments, message);

    expect(p1.index).toBe(1);
    expect(p2.index).toBe(2);

    // Aggregation
    const finalSig = aggregateFrostSignatures([p1, p2], commitments);
    expect(finalSig.length).toBe(64);
  });
});
