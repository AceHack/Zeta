import { describe, expect, it } from "bun:test";
import {
  auditView,
  canonicalNet,
  genesisEventHash,
  gSetDuplicateCount,
  inspectEmitterChains,
  inspectFourRegisters,
  mintContentFingerprint,
  mintEventId,
  noEvidence,
  restoresExactly,
  type AuditGenesisAuthority,
  type AuditGenesisBinding,
  type SignedEvidenceDelta,
} from "./zero-crossing-evidence-audit";
import { ofEntries, stringCompare } from "../z-set/z-set";

const nodeABinding: AuditGenesisBinding = {
  emitterId: "node-a",
  signer: "node-a-key-1",
  scheme: "test-ed25519",
  keyFingerprint: "key/node-a/1",
  witnessRef: "witness/node-a/1",
};

const witnessedAuthority: AuditGenesisAuthority = {
  assessGenesis: () => "witnessed",
};

function delta(
  emitterId: string,
  emitterSeq: number,
  key: string,
  weight: number,
  previousEventHash?: string,
  meanPpm = 500_000,
  precisionPpm = 100_000,
): SignedEvidenceDelta {
  const fingerprint = mintContentFingerprint(key, weight, meanPpm, precisionPpm);
  const genesisBinding = emitterSeq === 0 ? { ...nodeABinding, emitterId } : undefined;
  const predecessor = previousEventHash ?? (genesisBinding === undefined ? "" : genesisEventHash(genesisBinding));
  return {
    eventId: mintEventId(emitterId, emitterSeq, predecessor, fingerprint),
    emitterId,
    emitterSeq,
    ...(genesisBinding === undefined ? {} : { genesisBinding }),
    previousEventHash: predecessor,
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
    expect(cancelled.registers.unresolvedGenesisEmitters).toEqual(["node-a"]);
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

  it("keeps unknown witnessed genesis unresolved instead of inventing a restart", () => {
    const first = delta("node-a", 0, "receipt/a", 1);
    const view = auditView([first]);
    expect(view.registers.unresolvedGenesisEmitters).toEqual(["node-a"]);
    expect(view.registers.witnessedGenesisEmitters).toEqual([]);
  });

  it("marks a locally accepted genesis binding as witnessed without using wall-clock time", () => {
    const first = delta("node-a", 0, "receipt/a", 1);
    const view = auditView([first], witnessedAuthority);
    expect(view.registers.witnessedGenesisEmitters).toEqual(["node-a"]);
    expect(view.registers.unresolvedGenesisEmitters).toEqual([]);
    expect(view.registers.settledCausalEventIds).toEqual([first.eventId]);
  });

  it("marks a conflicting local genesis authority as disputed rather than selecting a fresh restart", () => {
    const first = delta("node-a", 0, "receipt/a", 1);
    const disputed: AuditGenesisAuthority = { assessGenesis: () => "disputed" };
    expect(inspectFourRegisters([first], disputed).disputedGenesisEmitters).toEqual(["node-a"]);
  });

  it("rejects a sequence-zero event whose binding is absent or whose genesis anchor was substituted", () => {
    const first = delta("node-a", 0, "receipt/a", 1);
    const missingBinding: SignedEvidenceDelta = {
      eventId: first.eventId,
      emitterId: first.emitterId,
      emitterSeq: first.emitterSeq,
      previousEventHash: first.previousEventHash,
      contentFingerprint: first.contentFingerprint,
      key: first.key,
      weight: first.weight,
      meanPpm: first.meanPpm,
      precisionPpm: first.precisionPpm,
    };
    const substituted: SignedEvidenceDelta = {
      ...first,
      genesisBinding: { ...nodeABinding, witnessRef: "witness/node-a/restart" },
    };
    expect(() => auditView([missingBinding])).toThrow("requires an identity-bound genesis binding");
    expect(() => auditView([substituted])).toThrow("witnessed genesis hash");
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
