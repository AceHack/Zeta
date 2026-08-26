import { describe, expect, it } from "bun:test";
import {
  auditView,
  canonicalNet,
  genesisEventHash,
  gSetDuplicateCount,
  inspectEmitterChains,
  mintContentFingerprint,
  mintEventId,
  noEvidence,
  restoresExactly,
  type SignedEvidenceDelta,
} from "./zero-crossing-evidence-audit";
import { ofEntries, stringCompare } from "../z-set/z-set";

function delta(
  emitterId: string,
  emitterSeq: number,
  key: string,
  weight: number,
  previousEventHash = genesisEventHash(emitterId),
  meanPpm = 500_000,
  precisionPpm = 100_000,
): SignedEvidenceDelta {
  const fingerprint = mintContentFingerprint(key, weight, meanPpm, precisionPpm);
  return {
    eventId: mintEventId(emitterId, emitterSeq, previousEventHash, fingerprint),
    emitterId,
    emitterSeq,
    previousEventHash,
    contentFingerprint: fingerprint,
    key,
    weight,
    meanPpm,
    precisionPpm,
  };
}

describe("zero-crossing evidence audit", () => {
  it("ZA-1: known delta translation restores the exact pre-crossing ZSet", () => {
    const initial = ofEntries(stringCompare, [{ e: "receipt/a", w: 1 }]);
    const retraction = ofEntries(stringCompare, [{ e: "receipt/a", w: -1 }]);
    expect(restoresExactly(initial, retraction)).toBe(true);
  });

  it("ZA-2 implementation control: zero-weight keys are absent after exact canonical cancellation", () => {
    const asserted = delta("node-a", 0, "receipt/a", 1);
    const retracted = delta("node-a", 1, "receipt/a", -1, asserted.eventId);
    const neverObserved = auditView([]);
    const cancelled = auditView([asserted, retracted]);
    expect(canonicalNet([])).toEqual(noEvidence());
    expect(cancelled.net).toEqual(neverObserved.net);
    expect(cancelled.net).toEqual([]);
    expect(cancelled.net.find((entry) => entry.e === "receipt/a")).toBeUndefined();
  });

  it("ZA-3: retained signed audit distinguishes cancelled history and is order-independent", () => {
    const asserted = delta("node-a", 0, "receipt/a", 1);
    const retracted = delta("node-a", 1, "receipt/a", -1, asserted.eventId);
    const forward = [asserted, retracted];
    const cancelled = auditView(forward);
    const reordered = auditView([...forward].reverse());
    const neverObserved = auditView([]);
    expect(cancelled.net).toEqual([]);
    expect(cancelled.auditRoot).toBe(reordered.auditRoot);
    expect(cancelled.auditRoot).not.toBe(neverObserved.auditRoot);
    expect(cancelled.auditCount).toBe(2);
    expect(cancelled.chainContinuity.complete).toBe(true);
  });

  it("deduplicates an exact retransmission by event identity", () => {
    const atom = delta("node-a", 0, "receipt/a", 1);
    expect(auditView([atom, atom])).toEqual(auditView([atom]));
  });

  it("ZA-5: same-content separate emissions preserve multiplicity", () => {
    const first = delta("node-a", 0, "receipt/a", 1);
    const second = delta("node-a", 1, "receipt/a", 1, first.eventId);
    const once = auditView([first]);
    const twice = auditView([first, second]);
    expect(twice.net).toEqual([{ e: "receipt/a", w: 2 }]);
    expect(twice.auditRoot).not.toBe(once.auditRoot);
    expect(twice.auditCount).toBe(2);
  });

  it("detects a known same-counter chain fork instead of treating it as one event", () => {
    const first = delta("node-a", 0, "receipt/a", 1);
    const forkA = delta("node-a", 1, "receipt/a", 1, first.eventId);
    const forkB = delta("node-a", 1, "receipt/b", 1, first.eventId);
    expect(() => auditView([first, forkA, forkB])).toThrow("conflicting chain branches");
  });

  it("keeps a valid out-of-order child unresolved until its predecessor arrives", () => {
    const first = delta("node-a", 0, "receipt/a", 1);
    const child = delta("node-a", 1, "receipt/b", 1, first.eventId);
    const partial = inspectEmitterChains([child]);
    expect(partial.complete).toBe(false);
    expect(partial.missingPredecessors).toEqual([child.eventId]);
    expect(inspectEmitterChains([child, first]).complete).toBe(true);
  });

  it("negative control: an in-flight retraction remains canonical evidence, not absence", () => {
    const pending = auditView([delta("node-a", 0, "receipt/a", -1)]);
    expect(pending.net).toEqual([{ e: "receipt/a", w: -1 }]);
    expect(pending.auditCount).toBe(1);
  });

  it("negative control: tampering payload uncertainty invalidates its hash-minted event identity", () => {
    const original = delta("node-a", 0, "receipt/a", 1);
    const tampered: SignedEvidenceDelta = { ...original, precisionPpm: 99_999 };
    expect(() => auditView([tampered])).toThrow("does not bind");
  });

  it("ZA-4: GSet duplicate identity compacts multiplicity and is not an audit ledger", () => {
    expect(gSetDuplicateCount("event/node-a/0")).toBe(1);
  });

  it("refuses a zero-weight audit atom rather than silently fabricating a retained event", () => {
    expect(() => auditView([delta("node-a", 0, "receipt/a", 0)])).toThrow("nonzero safe integer");
  });
});
