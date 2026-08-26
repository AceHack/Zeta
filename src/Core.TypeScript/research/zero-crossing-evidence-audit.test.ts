import { describe, expect, it } from "bun:test";
import {
  auditView,
  canonicalNet,
  gSetDuplicateCount,
  noEvidence,
  restoresExactly,
  type SignedEvidenceDelta,
} from "./zero-crossing-evidence-audit";
import { ofEntries, stringCompare } from "../z-set/z-set";

function delta(
  deltaId: string,
  key: string,
  weight: number,
  meanPpm = 500_000,
  precisionPpm = 100_000,
): SignedEvidenceDelta {
  return { deltaId, key, weight, meanPpm, precisionPpm };
}

describe("zero-crossing evidence audit", () => {
  it("ZA-1: known delta translation restores the exact pre-crossing ZSet", () => {
    const initial = ofEntries(stringCompare, [{ e: "receipt/a", w: 1 }]);
    const retraction = ofEntries(stringCompare, [{ e: "receipt/a", w: -1 }]);
    expect(restoresExactly(initial, retraction)).toBe(true);
  });

  it("ZA-2: canonical net state cannot distinguish absence from exact cancellation", () => {
    const neverObserved = auditView([]);
    const cancelled = auditView([
      delta("assert-1", "receipt/a", 1),
      delta("retract-1", "receipt/a", -1),
    ]);
    expect(canonicalNet([])).toEqual(noEvidence());
    expect(cancelled.net).toEqual(neverObserved.net);
    expect(cancelled.net).toEqual([]);
  });

  it("ZA-3: retained signed delta audit distinguishes cancelled history and is order-independent", () => {
    const forward = [delta("assert-1", "receipt/a", 1), delta("retract-1", "receipt/a", -1)];
    const reverse = [...forward].reverse();
    const cancelled = auditView(forward);
    const reordered = auditView(reverse);
    const neverObserved = auditView([]);
    expect(cancelled.net).toEqual([]);
    expect(cancelled.auditRoot).toBe(reordered.auditRoot);
    expect(cancelled.auditRoot).not.toBe(neverObserved.auditRoot);
    expect(cancelled.auditCount).toBe(2);
  });

  it("deduplicates an exact retransmission by delta identity", () => {
    const atom = delta("assert-1", "receipt/a", 1);
    const once = auditView([atom]);
    const deliveredTwice = auditView([atom, atom]);
    expect(deliveredTwice).toEqual(once);
  });

  it("rejects conflicting reuse of a transport identity", () => {
    expect(() => auditView([
      delta("same-id", "receipt/a", 1),
      delta("same-id", "receipt/a", -1),
    ])).toThrow("conflicting evidence");
  });

  it("negative control: an in-flight retraction remains canonical evidence, not absence", () => {
    const pending = auditView([delta("retract-before-assert", "receipt/a", -1)]);
    expect(pending.net).toEqual([{ e: "receipt/a", w: -1 }]);
    expect(pending.auditCount).toBe(1);
  });

  it("negative control: tampering uncertainty changes the retained audit identity", () => {
    const original = auditView([delta("assert-1", "receipt/a", 1, 500_000, 100_000)]);
    const tampered = auditView([delta("assert-1", "receipt/a", 1, 500_000, 99_999)]);
    expect(original.net).toEqual(tampered.net);
    expect(original.auditRoot).not.toBe(tampered.auditRoot);
  });

  it("ZA-4: GSet duplicate identity compacts multiplicity and is not an audit ledger", () => {
    expect(gSetDuplicateCount("delta/assert-1")).toBe(1);
  });

  it("refuses a zero-weight audit atom rather than silently fabricating a retained event", () => {
    expect(() => auditView([delta("invalid", "receipt/a", 0)])).toThrow("nonzero safe integer");
  });
});
