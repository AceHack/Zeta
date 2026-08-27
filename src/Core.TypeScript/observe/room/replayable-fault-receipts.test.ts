import { describe, expect, test } from "bun:test";
import { createInMemoryStorageCell } from "../../browser-node/zeta-storage-cell";
import {
  addressReplayableRoomFaultReceipt,
  encodeReplayableRoomFaultReceipt,
  persistReplayableRoomFaultReceipt,
  replayRoomFaultScenario,
  verifyReplayableRoomFaultReceipt,
} from "./replayable-fault-receipts";

describe("replayable room fault receipts", () => {
  test("correctable recovery carries both signed evidence choices through the ordinary durable path", () => {
    for (const sign of ["+1", "-1"] as const) {
      const receipt = replayRoomFaultScenario("correctable-recovery", sign);
      expect(receipt.transport.classification.status).toBe("identifiable");
      expect(receipt.transport.semanticReceipt).toBe(true);
      expect(receipt.registers.evidenceSign).toBe(sign);
      expect(receipt.outcome).toBe("recovered");
      expect(receipt.teaching.nextGenerator).toContain("Append the recovered signed atom");
    }
  });

  test("undecodable transport creates a durable diagnostic vector but never manufactures a signed evidence atom", () => {
    const receipt = replayRoomFaultScenario("undecodable-transport");
    expect(receipt.transport.classification.status).toBe("underdetermined");
    expect(receipt.transport.semanticReceipt).toBe(false);
    expect(receipt.registers.evidenceSign).toBe("not-observed");
    expect(receipt.outcome).toBe("no-semantic-receipt");
    expect(receipt.teaching.nextGenerator).toContain("do not append +1 or -1 evidence");
  });

  test("changed content, unknown witness, and visible witness conflict retain distinct four-register outcomes", () => {
    const altered = replayRoomFaultScenario("altered-content", "-1");
    const unknown = replayRoomFaultScenario("unresolved-witness");
    const conflict = replayRoomFaultScenario("visible-witness-conflict");

    expect(altered.registers.contentIntegrity).toBe("distinct-content");
    expect(altered.outcome).toBe("distinct-fact");
    expect(altered.teaching.nextGenerator).toContain("explicit -1 retraction");
    expect(unknown.registers.genesisAuthority).toBe("unresolved");
    expect(unknown.outcome).toBe("authority-unresolved");
    expect(conflict.registers.genesisAuthority).toBe("disputed");
    expect(conflict.outcome).toBe("authority-disputed");
    expect(conflict.teaching.nextGenerator).toContain("Retain both witness atoms");
  });

  test("content addresses bind exact canonical replay bytes and distinguish signed retraction from assertion", () => {
    const assertion = addressReplayableRoomFaultReceipt(replayRoomFaultScenario("correctable-recovery", "+1"));
    const retraction = addressReplayableRoomFaultReceipt(replayRoomFaultScenario("correctable-recovery", "-1"));
    expect(verifyReplayableRoomFaultReceipt(assertion)).toBe(true);
    expect(assertion.contentKey).not.toBe(retraction.contentKey);
    expect(encodeReplayableRoomFaultReceipt(assertion.receipt)).toContain('"scenario":"correctable-recovery"');
  });

  test("fault-injection control: a changed teaching outcome fails address verification", () => {
    const addressed = addressReplayableRoomFaultReceipt(replayRoomFaultScenario("visible-witness-conflict"));
    const tampered = {
      ...addressed,
      receipt: {
        ...addressed.receipt,
        teaching: { ...addressed.receipt.teaching, nextGenerator: "silently choose one witness" },
      },
    };
    expect(verifyReplayableRoomFaultReceipt(tampered)).toBe(false);
  });

  test("persisted replay vector is address-identical to the immutable storage record", async () => {
    const storage = createInMemoryStorageCell("replay-vector-test");
    const result = await persistReplayableRoomFaultReceipt(storage, replayRoomFaultScenario("altered-content"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(storage.verify(result.value.contentKey, encodeReplayableRoomFaultReceipt(result.value.receipt))).toBe(true);
    const loaded = await storage.read(result.value.contentKey);
    expect(loaded.ok && loaded.value?.payload).toBe(encodeReplayableRoomFaultReceipt(result.value.receipt));
  });
});
