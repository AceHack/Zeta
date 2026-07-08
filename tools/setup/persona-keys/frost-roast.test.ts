// frost-roast.ts — documented ROAST subset for robust FROST attempts.
// Run: bun test frost-roast.test.ts
import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { frostKeygen, frostNonceCommit, frostVerify, type FrostKeyShare } from "./frost.ts";
import { FrostRoastCoordinator, type FrostRoastParticipant } from "./frost-roast.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function publicShare(share: FrostKeyShare): Uint8Array {
  return ed25519.Point.BASE.multiply(share.secretShare).toBytes();
}

function participants(
  shares: readonly FrostKeyShare[],
  nonces: readonly ReturnType<typeof frostNonceCommit>[],
): readonly FrostRoastParticipant[] {
  return shares.map((share, i) => ({
    participantIndex: share.x,
    nonceCommitment: nonces[i]!.commitment,
    publicShare: publicShare(share),
  }));
}

describe("FrostRoastCoordinator documented subset", () => {
  test("ROAST-1: combines only after threshold valid partials", () => {
    const kg = frostKeygen(2, 3, lcg(1));
    const msg = new TextEncoder().encode("roast threshold");
    const selected = [kg.shares[0]!, kg.shares[1]!];
    const nonces = selected.map(() => frostNonceCommit(lcg(2)));
    const coord = new FrostRoastCoordinator({ nowMs: () => 0 });
    coord.openSession({
      sessionId: "s1",
      groupPublicKey: kg.groupPublicKey,
      message: msg,
      threshold: 2,
      participants: participants(selected, nonces),
      timeoutMs: 100,
    });

    coord.submitPartial(coord.createPartial("s1", selected[0]!, nonces[0]!.nonce));
    expect(() => coord.combineSubmitted("s1")).toThrow(/need at least 2 valid partials/);
    coord.submitPartial(coord.createPartial("s1", selected[1]!, nonces[1]!.nonce));
    const sig = coord.combineSubmitted("s1");

    expect(frostVerify(kg.groupPublicKey, msg, sig)).toBe(true);
  });

  test("ROAST-2: duplicate partial aborts the attempt", () => {
    const kg = frostKeygen(2, 2, lcg(3));
    const msg = new TextEncoder().encode("duplicate");
    const selected = [...kg.shares];
    const nonces = selected.map(() => frostNonceCommit(lcg(4)));
    const coord = new FrostRoastCoordinator({ nowMs: () => 0 });
    coord.openSession({
      sessionId: "dup",
      groupPublicKey: kg.groupPublicKey,
      message: msg,
      threshold: 2,
      participants: participants(selected, nonces),
      timeoutMs: 100,
    });
    const partial = coord.createPartial("dup", selected[0]!, nonces[0]!.nonce);
    coord.submitPartial(partial);

    expect(() => coord.submitPartial(partial)).toThrow(/duplicate-partial/);
    expect(coord.getSession("dup").aborted).toBe(true);
  });

  test("ROAST-3: refuses mixed-session partials", () => {
    const kg = frostKeygen(2, 2, lcg(5));
    const msg = new TextEncoder().encode("mixed");
    const selected = [...kg.shares];
    const noncesA = selected.map(() => frostNonceCommit(lcg(6)));
    const noncesB = selected.map(() => frostNonceCommit(lcg(7)));
    const coord = new FrostRoastCoordinator({ nowMs: () => 0 });
    for (const [sessionId, nonces] of [
      ["a", noncesA],
      ["b", noncesB],
    ] as const) {
      coord.openSession({
        sessionId,
        groupPublicKey: kg.groupPublicKey,
        message: msg,
        threshold: 2,
        participants: participants(selected, nonces),
        timeoutMs: 100,
      });
    }
    const partialA = coord.createPartial("a", selected[0]!, noncesA[0]!.nonce);
    const partialB = coord.createPartial("b", selected[1]!, noncesB[1]!.nonce);

    expect(() => coord.combinePartials("b", [partialA, partialB])).toThrow(/mixed-session/);
    expect(coord.getSession("b").abortReason).toBe("mixed-session");
  });

  test("ROAST-4: timeout aborts and retry signs with replacement participant", () => {
    let now = 0;
    const kg = frostKeygen(2, 3, lcg(8));
    const msg = new TextEncoder().encode("retry");
    const coord = new FrostRoastCoordinator({ nowMs: () => now });

    const first = [kg.shares[0]!, kg.shares[1]!];
    const firstNonces = first.map(() => frostNonceCommit(lcg(9)));
    coord.openSession({
      sessionId: "first",
      groupPublicKey: kg.groupPublicKey,
      message: msg,
      threshold: 2,
      participants: participants(first, firstNonces),
      timeoutMs: 10,
    });

    now = 11;
    const retry = [kg.shares[0]!, kg.shares[2]!];
    const retryNonces = retry.map(() => frostNonceCommit(lcg(10)));
    coord.retryTimedOutSession("first", {
      sessionId: "retry",
      groupPublicKey: kg.groupPublicKey,
      message: msg,
      threshold: 2,
      participants: participants(retry, retryNonces),
      timeoutMs: 10,
    });

    expect(coord.getSession("first").abortReason).toBe("timeout");
    coord.submitPartial(coord.createPartial("retry", retry[0]!, retryNonces[0]!.nonce));
    coord.submitPartial(coord.createPartial("retry", retry[1]!, retryNonces[1]!.nonce));
    expect(frostVerify(kg.groupPublicKey, msg, coord.combineSubmitted("retry"))).toBe(true);
  });

  test("ROAST-5: invalid partial aborts before aggregate combine", () => {
    const kg = frostKeygen(2, 2, lcg(11));
    const msg = new TextEncoder().encode("invalid");
    const selected = [...kg.shares];
    const nonces = selected.map(() => frostNonceCommit(lcg(12)));
    const coord = new FrostRoastCoordinator({ nowMs: () => 0 });
    coord.openSession({
      sessionId: "bad",
      groupPublicKey: kg.groupPublicKey,
      message: msg,
      threshold: 2,
      participants: participants(selected, nonces),
      timeoutMs: 100,
    });
    const partial = coord.createPartial("bad", selected[0]!, nonces[0]!.nonce);

    expect(() => coord.submitPartial({ ...partial, z: partial.z + 1n })).toThrow(/invalid partial/);
    expect(coord.getSession("bad").abortReason).toBe("invalid-partial");
  });
});
