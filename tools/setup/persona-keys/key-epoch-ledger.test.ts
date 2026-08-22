// key-epoch-ledger.ts — revocation as a G-set, and the chain that avoids a cold re-pin.
// Run: bun test key-epoch-ledger.test.ts
//
// Two things are under test and they are different: that a relying party LEARNS
// about a rotation and follows it without re-pinning, and that a party which has
// NOT learned is honestly still exposed (KL-11). A revocation mechanism that
// cannot register a revocation is the worst instance of an unfalsifiable check,
// so every positive here is paired with the mutation that must kill it.
import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { frostKeygen, frostThresholdSign, frostVerify, type FrostKeyShare } from "./frost.ts";
import { runDeltaRotationInProcess } from "./frost-delta-rotation.ts";
import {
  admit,
  chainGapProbe,
  decodeSignedTransition,
  detectEquivocation,
  emptyLedger,
  encodeSignedTransition,
  encodeTransition,
  foldChain,
  freshnessAction,
  ledgerAdd,
  ledgerMerge,
  ledgerOf,
  signTransition,
  statementKey,
  type KeyPin,
  type KeyTransition,
  type RevocationLedger,
} from "./key-epoch-ledger.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const MSG = new TextEncoder().encode("zeta-key-epoch-ledger");
const eq = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));
const KEY_ID = "zeta-ca-frost";

/** A whole rotation: run the ceremony, then have the OLD quorum sign the transition. */
function rotate(
  keyId: string,
  epoch: number,
  oldKey: Uint8Array,
  oldShares: readonly FrostKeyShare[],
  quorum: readonly FrostKeyShare[],
  threshold: number,
  newIndices: readonly number[],
  retiredIndices: readonly number[],
  seed: number,
  reason = "site compromised",
): { element: string; newKey: Uint8Array; newShares: readonly FrostKeyShare[] } {
  const out = runDeltaRotationInProcess(
    oldKey,
    oldShares,
    { newIndices, newThreshold: threshold, retiredIndices },
    lcg(seed),
  );
  const statement: KeyTransition = {
    keyId,
    epoch,
    prevGroupPublicKey: oldKey,
    nextGroupPublicKey: out.newGroupPublicKey,
    retiredIndices: [...retiredIndices].sort((a, b) => a - b),
    transcriptHash: out.transcriptHash,
    reason,
  };
  const signed = signTransition(statement, quorum, threshold, lcg(seed + 1));
  return {
    element: encodeSignedTransition(signed),
    newKey: out.newGroupPublicKey,
    newShares: out.shares,
  };
}

describe("canonical encoding: bytes are the identity", () => {
  const base = (): KeyTransition => ({
    keyId: KEY_ID,
    epoch: 1,
    prevGroupPublicKey: new Uint8Array(32).fill(1),
    nextGroupPublicKey: new Uint8Array(32).fill(2),
    retiredIndices: [3, 7],
    transcriptHash: new Uint8Array(32).fill(3),
    reason: "hello",
  });

  test("KL-1: round-trips, and any field change moves the bytes", () => {
    const st = { statement: base(), signature: new Uint8Array(64).fill(9) };
    const hex = encodeSignedTransition(st);
    const back = decodeSignedTransition(hex);
    expect(back.statement.keyId).toBe(KEY_ID);
    expect(back.statement.epoch).toBe(1);
    expect(back.statement.retiredIndices).toEqual([3, 7]);
    expect(back.statement.reason).toBe("hello");
    expect(eq(back.signature, st.signature)).toBe(true);

    const k = statementKey(base());
    expect(statementKey({ ...base(), epoch: 2 })).not.toBe(k);
    expect(statementKey({ ...base(), keyId: "other" })).not.toBe(k);
    expect(statementKey({ ...base(), retiredIndices: [3] })).not.toBe(k);
    expect(statementKey({ ...base(), reason: "hell" })).not.toBe(k);
    expect(statementKey({ ...base(), nextGroupPublicKey: new Uint8Array(32).fill(4) })).not.toBe(k);
    expect(statementKey({ ...base(), transcriptHash: new Uint8Array(32).fill(4) })).not.toBe(k);
  });

  test("KL-2: non-canonical or oversized input is refused, not repaired", () => {
    expect(() => encodeTransition({ ...base(), retiredIndices: [7, 3] })).toThrow(/ascending/);
    expect(() => encodeTransition({ ...base(), retiredIndices: [3, 3] })).toThrow(/ascending/);
    expect(() => encodeTransition({ ...base(), retiredIndices: [0] })).toThrow(/>= 1/);
    expect(() => encodeTransition({ ...base(), epoch: 0 })).toThrow(/epoch/);
    expect(() => encodeTransition({ ...base(), keyId: "x".repeat(200) })).toThrow(/keyId too long/);
    expect(() => encodeTransition({ ...base(), reason: "x".repeat(600) })).toThrow(/reason too long/);
    expect(() => encodeTransition({ ...base(), prevGroupPublicKey: new Uint8Array(31) })).toThrow(
      /32 bytes/,
    );
    expect(() => encodeTransition({ ...base(), transcriptHash: new Uint8Array(31) })).toThrow(
      /transcriptHash/,
    );
    const good = encodeSignedTransition({ statement: base(), signature: new Uint8Array(64) });
    expect(() => decodeSignedTransition(good + "00")).toThrow(/trailing bytes/);
    expect(() => decodeSignedTransition(good.slice(0, -2))).toThrow();
    expect(() => decodeSignedTransition("abc")).toThrow(/odd-length/);
  });
});

describe("admission is a pure function of the element", () => {
  test("KL-3: a genuine quorum signature is admitted; a tampered statement is not", () => {
    const kg = frostKeygen(2, 3, lcg(100));
    const r = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 101);
    expect(admit(r.element)).toBe(true); // non-vacuity

    // Re-sign the SAME bytes with a different key -> not admitted.
    const other = frostKeygen(2, 3, lcg(102));
    const st = decodeSignedTransition(r.element);
    const wrongSig = frostThresholdSign(
      other.groupPublicKey,
      other.shares.slice(0, 2),
      encodeTransition(st.statement),
      lcg(103),
      2,
    );
    expect(admit(encodeSignedTransition({ statement: st.statement, signature: wrongSig }))).toBe(
      false,
    );

    // Keep the signature, move one byte of the statement -> not admitted.
    const moved = encodeSignedTransition({
      statement: { ...st.statement, reason: "site compromised." },
      signature: st.signature,
    });
    expect(admit(moved)).toBe(false);

    // Garbage and non-hex are rejected, not thrown.
    expect(admit("not-hex")).toBe(false);
    expect(admit("")).toBe(false);
    expect(admit("00".repeat(50))).toBe(false);
  });

  test("KL-4: THE FORGED TRANSCRIPT — arithmetically consistent, no shares, refused by the ledger", () => {
    // The DR-16 forgery: a party with no shares can make verifyDeltaRotation
    // pass. It cannot make admit pass, because it has no quorum. This is the
    // seam: the rotation math checks consistency, the ledger checks authority.
    const kg = frostKeygen(2, 3, lcg(104));
    const statement: KeyTransition = {
      keyId: KEY_ID,
      epoch: 1,
      prevGroupPublicKey: kg.groupPublicKey,
      nextGroupPublicKey: ed25519.Point.BASE.multiply(1234n).toBytes(),
      retiredIndices: [1, 2],
      transcriptHash: new Uint8Array(32).fill(7),
      reason: "attacker takeover",
    };
    const forged = encodeSignedTransition({ statement, signature: new Uint8Array(64).fill(0xab) });
    expect(admit(forged)).toBe(false);
    expect(ledgerAdd(emptyLedger(), forged).length).toBe(0);
    expect(ledgerOf([forged]).length).toBe(0);

    // ...and a chain that never received it does not move.
    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };
    const fold = foldChain(pin, ledgerOf([forged]));
    expect(fold.status).toBe("current");
    if (fold.status === "current") expect(eq(fold.groupPublicKey, kg.groupPublicKey)).toBe(true);
  });
});

describe("the ledger is a G-set: converge with no coordination", () => {
  test("KL-5: merge is idempotent, commutative and associative on real elements", () => {
    const kg = frostKeygen(2, 4, lcg(110));
    const r1 = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2, 3], [4], 111);
    // Retire site 3, so sites 1+2 are the contributing quorum (a retired holder
    // must not be in the set that retires it).
    const r2 = rotate(KEY_ID, 2, r1.newKey, r1.newShares.slice(0, 2), r1.newShares.slice(0, 2), 2, [1, 2], [3], 113);
    const r3 = rotate("other-key", 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 115);

    const a = ledgerOf([r1.element]);
    const b = ledgerOf([r2.element]);
    const c = ledgerOf([r3.element]);
    expect(a.length + b.length + c.length).toBe(3); // non-vacuity: all admitted

    const asSet = (l: RevocationLedger): string => [...l].join("|");
    expect(asSet(ledgerMerge(a, a))).toBe(asSet(a)); // idempotent
    expect(asSet(ledgerMerge(a, b))).toBe(asSet(ledgerMerge(b, a))); // commutative
    expect(asSet(ledgerMerge(ledgerMerge(a, b), c))).toBe(asSet(ledgerMerge(a, ledgerMerge(b, c))));
    expect(asSet(ledgerMerge(a, emptyLedger()))).toBe(asSet(a)); // identity
    expect(ledgerMerge(a, b).length).toBe(2); // and it actually grew

    // A peer that hands over a set built by hand cannot smuggle past admission.
    expect(ledgerMerge(a, ["deadbeef", ""]).length).toBe(1);
  });

  test("KL-6: the fold does not depend on the order elements arrived", () => {
    const kg = frostKeygen(2, 4, lcg(120));
    const r1 = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2, 3], [4], 121);
    const r2 = rotate(KEY_ID, 2, r1.newKey, r1.newShares.slice(0, 2), r1.newShares.slice(0, 2), 2, [1, 2], [3], 123);
    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };

    const forward = foldChain(pin, ledgerOf([r1.element, r2.element]));
    const backward = foldChain(pin, ledgerOf([r2.element, r1.element]));
    // Epoch 2 arrives first and is NOT dropped: admission never consulted state.
    const lateFirst = foldChain(pin, ledgerAdd(ledgerAdd(emptyLedger(), r2.element), r1.element));

    expect(forward.status).toBe("current");
    if (forward.status === "current") {
      expect(forward.epoch).toBe(2);
      expect(forward.advanced).toBe(2);
      expect(eq(forward.groupPublicKey, r2.newKey)).toBe(true);
      expect(forward.retiredIndices).toEqual([3, 4]); // grow-only union along the chain
    }
    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
    expect(JSON.stringify(lateFirst)).toBe(JSON.stringify(forward));
  });

  test("KL-7: re-signing ONE statement is not a fork — signatures are randomised", () => {
    // The bug this file's first draft had. Two valid signatures over the same
    // statement are two elements and one transition.
    const kg = frostKeygen(2, 3, lcg(130));
    const out = runDeltaRotationInProcess(
      kg.groupPublicKey,
      kg.shares.slice(0, 2),
      { newIndices: [1, 2], newThreshold: 2, retiredIndices: [3] },
      lcg(131),
    );
    const statement: KeyTransition = {
      keyId: KEY_ID,
      epoch: 1,
      prevGroupPublicKey: kg.groupPublicKey,
      nextGroupPublicKey: out.newGroupPublicKey,
      retiredIndices: [3],
      transcriptHash: out.transcriptHash,
      reason: "retry",
    };
    const e1 = encodeSignedTransition(signTransition(statement, kg.shares.slice(0, 2), 2, lcg(132)));
    const e2 = encodeSignedTransition(signTransition(statement, kg.shares.slice(0, 2), 2, lcg(133)));
    expect(e1).not.toBe(e2); // non-vacuity: they really are two distinct elements
    expect(admit(e1) && admit(e2)).toBe(true);

    const fold = foldChain(
      { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey },
      ledgerOf([e1, e2]),
    );
    expect(fold.status).toBe("current");
    expect(detectEquivocation(ledgerOf([e1, e2])).length).toBe(0);
  });
});

describe("what the chain does and does not survive", () => {
  test("KL-8: end to end — a relying party follows the rotation WITHOUT re-pinning, and the revoked quorum dies", () => {
    const kg = frostKeygen(2, 3, lcg(140));
    const r = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 141);

    // The relying party's only anchor is the ORIGINAL key. It never re-pins.
    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };
    const fold = foldChain(pin, ledgerOf([r.element]));
    expect(fold.status).toBe("current");
    if (fold.status !== "current") return;
    expect(eq(fold.groupPublicKey, r.newKey)).toBe(true);
    expect(fold.retiredIndices).toEqual([3]);

    // Revoked site 3 cooperates with nothing and keeps its share. Its old
    // quorum still signs — against the key the relying party no longer uses.
    const revokedQuorum = [kg.shares[1] as FrostKeyShare, kg.shares[2] as FrostKeyShare];
    const sig = frostThresholdSign(kg.groupPublicKey, revokedQuorum, MSG, lcg(142), 2);
    expect(frostVerify(kg.groupPublicKey, MSG, sig)).toBe(true); // non-vacuity
    expect(frostVerify(fold.groupPublicKey, MSG, sig)).toBe(false);

    // ...and the surviving holders do sign under the folded key.
    const good = frostThresholdSign(fold.groupPublicKey, r.newShares, MSG, lcg(143), 2);
    expect(frostVerify(fold.groupPublicKey, MSG, good)).toBe(true);
  });

  test("KL-9: an adversary that reached the OLD threshold can equivocate — the fold reports a fork, never a winner", () => {
    const kg = frostKeygen(2, 3, lcg(150));
    // Honest rotation retiring site 3.
    const honest = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 151);
    // The adversary holds t old shares, so it can sign its OWN epoch-1
    // transition, to a different key on a polynomial only it knows. The chain
    // alone cannot stop this — the transition is genuinely well-formed.
    const evil = rotate(
      KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 155,
      "attacker takeover",
    );
    expect(honest.element).not.toBe(evil.element);
    expect(admit(evil.element)).toBe(true); // it really is a valid transition

    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };
    // Alone, each is followed. That is the non-vacuity: the fork detection is
    // not just "two elements make me refuse".
    expect(foldChain(pin, ledgerOf([honest.element])).status).toBe("current");
    expect(foldChain(pin, ledgerOf([evil.element])).status).toBe("current");

    const both = ledgerOf([honest.element, evil.element]);
    const fold = foldChain(pin, both);
    expect(fold.status).toBe("forked");
    if (fold.status === "forked") {
      expect(fold.epoch).toBe(1);
      expect(fold.candidates.length).toBe(2);
      expect(eq(fold.groupPublicKey, kg.groupPublicKey)).toBe(true); // the last agreed key
    }
    const eqv = detectEquivocation(both);
    expect(eqv.length).toBe(1);
    expect(eqv[0]?.epoch).toBe(1);
  });

  test("KL-10: unreachable transitions are ignored, not followed", () => {
    const kg = frostKeygen(2, 4, lcg(160));
    const r1 = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2, 3], [4], 161);
    const r2 = rotate(KEY_ID, 2, r1.newKey, r1.newShares.slice(0, 2), r1.newShares.slice(0, 2), 2, [1, 2], [3], 163);
    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };

    // Epoch 2 alone does not extend a pin at epoch 0: the gap is not skipped.
    const gap = foldChain(pin, ledgerOf([r2.element]));
    expect(gap.status).toBe("current");
    if (gap.status === "current") {
      expect(gap.epoch).toBe(0);
      expect(eq(gap.groupPublicKey, kg.groupPublicKey)).toBe(true);
    }
    // A different keyId is not followed either.
    const other = rotate("other-key", 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 165);
    const wrongId = foldChain(pin, ledgerOf([other.element]));
    expect(wrongId.status === "current" && wrongId.epoch === 0).toBe(true);
    // Non-vacuity: with the epoch-1 link present, the chain does reach epoch 2.
    const full = foldChain(pin, ledgerOf([r1.element, r2.element]));
    expect(full.status === "current" && full.epoch === 2).toBe(true);
  });

  test("KL-11: THE HONEST LIMIT — a relying party that has NOT heard still accepts the retired key", () => {
    // Stated as a test so nobody reads the rotation as instant everywhere. The
    // key change is immediate; the knowledge is eventually consistent.
    const kg = frostKeygen(2, 3, lcg(170));
    const r = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 171);
    const deaf = foldChain({ keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey }, emptyLedger());
    expect(deaf.status).toBe("current");
    if (deaf.status !== "current") return;
    expect(eq(deaf.groupPublicKey, kg.groupPublicKey)).toBe(true);

    const revokedQuorum = [kg.shares[1] as FrostKeyShare, kg.shares[2] as FrostKeyShare];
    const sig = frostThresholdSign(kg.groupPublicKey, revokedQuorum, MSG, lcg(172), 2);
    expect(frostVerify(deaf.groupPublicKey, MSG, sig)).toBe(true); // still exposed
    // ...and one merge closes it.
    const heard = foldChain(
      { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey },
      ledgerMerge(emptyLedger(), ledgerOf([r.element])),
    );
    expect(heard.status === "current" && frostVerify(heard.groupPublicKey, MSG, sig)).toBe(false);
  });

  test("KL-12: a transition at the RIGHT epoch chained to the WRONG predecessor is not followed", () => {
    // Without this the chain would advance on epoch number alone, and any
    // transition an attacker signed under a key it minted would be accepted as
    // long as it guessed the epoch. The predecessor link is what makes it a
    // chain rather than a numbered list.
    const kg = frostKeygen(2, 3, lcg(180));
    const impostor = frostKeygen(2, 3, lcg(181));
    const r = rotate(KEY_ID, 1, impostor.groupPublicKey, impostor.shares.slice(0, 2), impostor.shares.slice(0, 2), 2, [1, 2], [3], 182);
    expect(admit(r.element)).toBe(true); // it is a perfectly valid transition...

    // ...of a chain this relying party is not on.
    const fold = foldChain({ keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey }, ledgerOf([r.element]));
    expect(fold.status === "current" && fold.epoch === 0).toBe(true);
    expect(fold.status === "current" && eq(fold.groupPublicKey, kg.groupPublicKey)).toBe(true);

    // Non-vacuity: a party actually pinned to the impostor key DOES follow it.
    const onChain = foldChain(
      { keyId: KEY_ID, epoch: 0, groupPublicKey: impostor.groupPublicKey },
      ledgerOf([r.element]),
    );
    expect(onChain.status === "current" && onChain.epoch === 1).toBe(true);
  });

  test("KL-12b: an EPOCH JUMP off the current key is not followed — epochs must be dense", () => {
    // Found by mutation: relaxing `epoch === current + 1` to `epoch > current`
    // survived every other test, because no fixture had an element that both
    // chained to the current key AND skipped ahead. It is the takeover move: a
    // holder of the epoch-n key signs a transition labelled epoch n+5, and a
    // verifier that accepts the jump lands on a branch where the honest epoch
    // n+1 is unreachable — silently, with no fork ever reported.
    const kg = frostKeygen(2, 3, lcg(200));
    const jump = rotate(KEY_ID, 5, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 201);
    expect(admit(jump.element)).toBe(true); // validly signed by the current key

    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };
    const fold = foldChain(pin, ledgerOf([jump.element]));
    expect(fold.status === "current" && fold.epoch === 0).toBe(true);
    expect(fold.status === "current" && eq(fold.groupPublicKey, kg.groupPublicKey)).toBe(true);

    // Non-vacuity: the same rotation labelled epoch 1 IS followed.
    const dense = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3], 201);
    const ok = foldChain(pin, ledgerOf([dense.element]));
    expect(ok.status === "current" && ok.epoch === 1).toBe(true);
  });

  test("KL-13: a NON-CANONICAL element is refused even when its signature is valid", () => {
    // Hand-assemble a statement whose retiredIndices are descending. Canonical
    // encoding is what makes "same statement" a byte fact, so an element that
    // is not the canonical encoding of what it decodes to must not enter — two
    // spellings of one revocation would be two G-set elements and a false fork.
    const kg = frostKeygen(2, 3, lcg(190));
    const enc = new TextEncoder();
    const dom = enc.encode("zeta-key-transition-v1");
    const u32 = (n: number): Uint8Array => {
      const b = new Uint8Array(4);
      new DataView(b.buffer).setUint32(0, n, true);
      return b;
    };
    const keyId = enc.encode(KEY_ID);
    const reason = enc.encode("bad order");
    const parts = [
      dom, u32(keyId.length), keyId, u32(1),
      kg.groupPublicKey, new Uint8Array(32).fill(5), new Uint8Array(32).fill(6),
      u32(2), u32(7), u32(3), // DESCENDING — not canonical
      u32(reason.length), reason,
    ];
    const stmt = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) { stmt.set(p, o); o += p.length; }
    const sig = frostThresholdSign(kg.groupPublicKey, kg.shares.slice(0, 2), stmt, lcg(191), 2);
    // The signature over these exact bytes is genuine...
    expect(ed25519.verify(sig, stmt, kg.groupPublicKey)).toBe(true);

    const body = new Uint8Array(4 + stmt.length + 4 + sig.length);
    body.set(u32(stmt.length), 0);
    body.set(stmt, 4);
    body.set(u32(sig.length), 4 + stmt.length);
    body.set(sig, 8 + stmt.length);
    let hex = "";
    for (const x of body) hex += x.toString(16).padStart(2, "0");

    // ...and the element is still refused, on canonicality alone.
    expect(() => decodeSignedTransition(hex)).toThrow();
    expect(admit(hex)).toBe(false);
    expect(ledgerAdd(emptyLedger(), hex).length).toBe(0);
  });

  test("KL-14: freshness is a LOCAL action, never a filter on the fold", () => {
    expect(freshnessAction(1_000, 900, 500)).toBe("accept");
    expect(freshnessAction(1_000, 400, 500)).toBe("fail-closed");
    expect(freshnessAction(1_000, 500, 500)).toBe("accept"); // boundary: not yet over
    expect(freshnessAction(1_000, 499, 500)).toBe("fail-closed");
    expect(freshnessAction(Number.NaN, 0, 500)).toBe("fail-closed");
    expect(freshnessAction(1_000, 900, -1)).toBe("fail-closed");
  });
});

describe("the gap probe: knowing you are stalled, without letting that be a verdict", () => {
  test("KL-15: THE SUPPRESSED LINK — a stalled replica and a deaf one fold IDENTICALLY, and the probe is what separates them", () => {
    // The measured defect. Withhold exactly one element from a target: its fold
    // output is field-for-field what a replica that heard nothing returns, so
    // "I am up to date" and "I am being eclipsed" are the same answer.
    const kg = frostKeygen(2, 4, lcg(300));
    const r1 = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2, 3], [4], 301);
    const r2 = rotate(KEY_ID, 2, r1.newKey, r1.newShares.slice(0, 2), r1.newShares.slice(0, 2), 2, [1, 2], [3], 303);
    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };

    const stalled = foldChain(pin, ledgerOf([r2.element])); // epoch 1 suppressed
    const deaf = foldChain(pin, emptyLedger());
    expect(admit(r2.element)).toBe(true); // the withheld-from replica holds REAL evidence
    expect(stalled.status === "current" && deaf.status === "current").toBe(true);
    expect(stalled.status === "current" && stalled.epoch).toBe(0);
    expect(stalled.status === "current" && stalled.advanced).toBe(0);
    expect(deaf.status === "current" && deaf.epoch).toBe(0);
    // ...and the retired holder still signs a key the stalled replica accepts.
    const revoked = [kg.shares[2] as FrostKeyShare, kg.shares[3] as FrostKeyShare];
    const sig = frostThresholdSign(kg.groupPublicKey, revoked, MSG, lcg(305), 2);
    expect(stalled.status === "current" && frostVerify(stalled.groupPublicKey, MSG, sig)).toBe(true);

    // The probe is the only thing that tells them apart, and it names the ONE
    // element to ask for.
    const probe = chainGapProbe(pin, ledgerOf([r2.element]));
    expect(probe.kind).toBe("request-epoch");
    if (probe.kind !== "request-epoch") return;
    expect(probe.epoch).toBe(1); // the missing link, not the epoch it can see
    expect(probe.unattachedEpochs).toEqual([2]);
    expect(probe.keyId).toBe(KEY_ID);

    // Non-vacuity on BOTH sides: heard nothing => nothing to request; heard
    // everything => nothing to request. Only the gap speaks.
    expect(chainGapProbe(pin, emptyLedger()).kind).toBe("nothing-to-request");
    expect(chainGapProbe(pin, ledgerOf([r1.element, r2.element])).kind).toBe("nothing-to-request");

    // And the fetch closes it: supplying exactly the requested epoch advances the chain.
    const healed = foldChain(pin, ledgerMerge(ledgerOf([r2.element]), ledgerOf([r1.element])));
    expect(healed.status === "current" && healed.epoch).toBe(2);
    expect(healed.status === "current" && healed.retiredIndices).toEqual([3, 4]);
    expect(healed.status === "current" && frostVerify(healed.groupPublicKey, MSG, sig)).toBe(false);
  });

  test("KL-16: THE HONEST NEGATIVE — a party with NO shares can manufacture the gap signal, so it must never gate acceptance", () => {
    // This is why `ChainGapProbe` has no "reject" case. An attacker generates
    // its OWN group and signs a transition for the victim's keyId at a high
    // epoch; `admit` passes it, because admission is a pure function of the
    // element (header property 1). If the probe were wired to fail closed, that
    // one element would be a denial of service on every listening verifier.
    const kg = frostKeygen(2, 3, lcg(310));
    const impostor = frostKeygen(2, 3, lcg(311));
    const forged = rotate(KEY_ID, 42, impostor.groupPublicKey, impostor.shares.slice(0, 2), impostor.shares.slice(0, 2), 2, [1, 2], [3], 312);
    expect(admit(forged.element)).toBe(true); // forgeable at will

    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };
    const probe = chainGapProbe(pin, ledgerOf([forged.element]));
    expect(probe.kind).toBe("request-epoch");
    if (probe.kind !== "request-epoch") return;
    // It asks for ONE link, never the far-future epoch the forgery named — a
    // forged element cannot inflate the request into a scan.
    expect(probe.epoch).toBe(1);
    expect(probe.unattachedEpochs).toEqual([42]);

    // THE PROPERTY THAT MATTERS: the probe changed no acceptance decision. The
    // fold is byte-for-byte what it was without the forgery.
    const withForgery = foldChain(pin, ledgerOf([forged.element]));
    const without = foldChain(pin, emptyLedger());
    expect(withForgery.status === "current" && withForgery.epoch).toBe(0);
    expect(withForgery.status === "current" && without.status === "current" && eq(withForgery.groupPublicKey, without.groupPublicKey)).toBe(true);
  });

  test("KL-17: an element at the RIGHT epoch with the WRONG predecessor is still a gap — having AN element is not having THE link", () => {
    // The subtle one. The replica holds something at epoch 1, so a naive "do I
    // have epoch n+1?" check would call itself satisfied and stop asking, while
    // the element it holds chains to a key it is not on (KL-12).
    const kg = frostKeygen(2, 3, lcg(320));
    const impostor = frostKeygen(2, 3, lcg(321));
    const offChain = rotate(KEY_ID, 1, impostor.groupPublicKey, impostor.shares.slice(0, 2), impostor.shares.slice(0, 2), 2, [1, 2], [3], 322);
    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };

    const probe = chainGapProbe(pin, ledgerOf([offChain.element]));
    expect(probe.kind).toBe("request-epoch");
    if (probe.kind !== "request-epoch") return;
    expect(probe.epoch).toBe(1); // still asking for epoch 1 — the one that CHAINS
    expect(probe.unattachedEpochs).toEqual([1]);
  });

  test("KL-18: the probe is a pure function of (pin, set) — no arrival order, no clock, and another keyId is not our gap", () => {
    const kg = frostKeygen(2, 4, lcg(330));
    const r1 = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2, 3], [4], 331);
    const r2 = rotate(KEY_ID, 2, r1.newKey, r1.newShares.slice(0, 2), r1.newShares.slice(0, 2), 2, [1, 2, 5], [3], 333);
    const r3 = rotate(KEY_ID, 3, r2.newKey, r2.newShares.slice(0, 2), r2.newShares.slice(0, 2), 2, [1, 2, 6], [5], 335);
    const pin: KeyPin = { keyId: KEY_ID, epoch: 0, groupPublicKey: kg.groupPublicKey };

    // Same set, three arrival orders => the same request.
    const a = chainGapProbe(pin, ledgerOf([r2.element, r3.element]));
    const b = chainGapProbe(pin, ledgerOf([r3.element, r2.element]));
    const c = chainGapProbe(pin, ledgerMerge(ledgerOf([r3.element]), ledgerOf([r2.element])));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
    expect(a.kind === "request-epoch" && a.epoch).toBe(1);
    expect(a.kind === "request-epoch" && a.unattachedEpochs).toEqual([2, 3]);

    // Walking one link forward moves the request forward with it.
    const after1 = chainGapProbe(pin, ledgerOf([r1.element, r3.element]));
    expect(after1.kind === "request-epoch" && after1.epoch).toBe(2);
    expect(after1.kind === "request-epoch" && after1.unattachedEpochs).toEqual([3]);

    // Evidence about someone ELSE's keyId is not our gap. It must sit ABOVE our
    // walked epoch, or dropping the keyId filter would change nothing and this
    // assertion would be unable to fail — the first draft of this line put it at
    // epoch 1 under a chain walked to 3, and the mutation survived.
    const stranger = frostKeygen(2, 3, lcg(336));
    const other = rotate("other-key", 9, stranger.groupPublicKey, stranger.shares.slice(0, 2), stranger.shares.slice(0, 2), 2, [1, 2], [3], 337);
    expect(admit(other.element)).toBe(true);
    expect(chainGapProbe(pin, ledgerOf([r1.element, r2.element, r3.element, other.element])).kind).toBe("nothing-to-request");

    // A fork is not a gap: foldChain already reports it and the remedy is a
    // re-pin. Same trap — there must be an element ABOVE the fork epoch, or
    // "the fork short-circuits" and "there is nothing ahead anyway" are the
    // same observation.
    const forkA = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2, 3], [4], 341);
    const forkB = rotate(KEY_ID, 1, kg.groupPublicKey, kg.shares.slice(0, 2), kg.shares.slice(0, 2), 2, [1, 2], [3, 4], 343);
    const afterFork = rotate(KEY_ID, 2, forkA.newKey, forkA.newShares.slice(0, 2), forkA.newShares.slice(0, 2), 2, [1, 2], [3], 345);
    const forkLedger = ledgerOf([forkA.element, forkB.element, afterFork.element]);
    const forked = foldChain(pin, forkLedger);
    expect(forked.status).toBe("forked");
    expect(forked.status === "forked" && forked.epoch).toBe(1);
    expect(chainGapProbe(pin, forkLedger).kind).toBe("nothing-to-request");
  });
});
