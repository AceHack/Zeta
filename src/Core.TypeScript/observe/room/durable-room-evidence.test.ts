import { describe, expect, test } from "bun:test";
import { InMemoryStoragePort, ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import {
  AdinkraRoomEvidenceBridge,
  DurableRoomEvidenceLedger,
  foldRoomEvidence,
  ROOM_EVIDENCE_RECEIPT_SCHEMA,
  type RoomEvidenceDatagramPort,
  type RoomEvidenceReceipt,
} from "./durable-room-evidence";

function receipt(overrides: Partial<RoomEvidenceReceipt> = {}): RoomEvidenceReceipt {
  return {
    schema: ROOM_EVIDENCE_RECEIPT_SCHEMA,
    roomId: "chip9-arc-room",
    roomFingerprint: "room:arc-v1",
    channelFingerprint: "channel:udp-a",
    spectrumSlice: "rainbow:blue",
    signatureSplit: "split:agent-a",
    runId: "run-1",
    episodeId: "episode-1",
    factId: "fact-1",
    sourceArtifact: "sha256:trajectory-1",
    weight: 1,
    uncertainty: { meanPpm: 650_000, precisionPpm: 20 },
    solved: true,
    actionCount: 11,
    elapsedMs: 200,
    actionBudget: 32,
    timeBudgetMs: 500,
    ...overrides,
  };
}

function negate(value: RoomEvidenceReceipt): RoomEvidenceReceipt {
  return { ...value, weight: -value.weight };
}

function makeLedger(): DurableRoomEvidenceLedger {
  return new DurableRoomEvidenceLedger(new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId: "room-test" }));
}

class LoopbackAdinkraPort implements RoomEvidenceDatagramPort {
  readonly sent: Uint8Array[] = [];
  private readonly handlers: Array<(payload: Uint8Array) => void> = [];

  send(payload: Uint8Array): void { this.sent.push(payload); }
  onData(handler: (payload: Uint8Array) => void): void { this.handlers.push(handler); }
  flush(): void {}
  deliver(payload: Uint8Array): void { for (const handler of this.handlers) handler(payload); }
}

describe("durable-room-evidence", () => {
  test("DRE-1: +1 then -1 and -1 then +1 have the identical empty ZSet root and views", () => {
    const assertion = receipt();
    const retraction = negate(assertion);
    const forward = foldRoomEvidence([assertion, retraction]);
    const reverse = foldRoomEvidence([retraction, assertion]);
    expect(forward).toEqual(reverse);
    if (forward.ok) {
      expect(forward.value.atoms).toEqual([]);
      expect(forward.value.views).toEqual([]);
    }
  });

  test("DRE-2: exact retraction removes uncertainty, action cost, elapsed time, and solved outcome together", () => {
    const result = foldRoomEvidence([receipt(), negate(receipt())]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.views).toHaveLength(0);
  });

  test("DRE-3: correction preserves the old atom and resolves to the replacement fact", () => {
    const old = receipt({ factId: "fact-old", solved: false, actionCount: 20, uncertainty: { meanPpm: 200_000, precisionPpm: 10 } });
    const replacement = receipt({ factId: "fact-new", solved: true, actionCount: 8, uncertainty: { meanPpm: 800_000, precisionPpm: 40 } });
    const result = foldRoomEvidence([old, negate(old), replacement]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const view = result.value.views[0]!;
      expect(view.status).toBe("resolved");
      if (view.status === "resolved") {
        expect(view.solved).toBe(true);
        expect(view.actionCount).toBe(8);
        expect(view.uncertainty).toEqual({ meanPpm: 800_000, precisionPpm: 40 });
      }
    }
  });

  test("DRE-4: spectrum and signature splits prevent an unrelated retraction from cancelling evidence", () => {
    const blue = receipt();
    const redRetraction = negate(receipt({ spectrumSlice: "rainbow:red", signatureSplit: "split:agent-b" }));
    const result = foldRoomEvidence([blue, redRetraction]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.views).toHaveLength(2);
      expect(result.value.views.filter((view) => view.status === "resolved")).toHaveLength(1);
      expect(result.value.views.filter((view) => view.status === "unresolved")).toHaveLength(1);
    }
  });

  test("DRE-5: a retraction received before its assertion is unresolved, never negative confidence", () => {
    const result = foldRoomEvidence([negate(receipt())]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.views[0]!.status).toBe("unresolved");
      if (result.value.views[0]!.status === "unresolved") expect(result.value.views[0]!.reason).toContain("retraction");
    }
  });

  test("DRE-6: ZetaStorageCell persistence/replay retains content addresses and the canonical fold", async () => {
    const ledger = makeLedger();
    const stored = await ledger.append(receipt());
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const replayed = await ledger.replay([stored.value.contentKey]);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(replayed.value.views[0]!.status).toBe("resolved");
      const current = ledger.fold();
      expect(current.ok).toBe(true);
      if (current.ok) expect(replayed.value.root).toBe(current.value.root);
    }
  });

  test("DRE-7: an Adinkra-compatible recovered payload reaches the same durable fold boundary", async () => {
    const wire = new LoopbackAdinkraPort();
    const sender = new AdinkraRoomEvidenceBridge(wire, makeLedger());
    const receiverLedger = makeLedger();
    new AdinkraRoomEvidenceBridge(wire, receiverLedger);
    const sent = await sender.send(receipt());
    expect(sent.ok).toBe(true);
    const payload = wire.sent[0];
    expect(payload).toBeDefined();
    wire.deliver(payload!);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const received = receiverLedger.fold();
    expect(received.ok).toBe(true);
    if (received.ok) expect(received.value.views[0]!.status).toBe("resolved");
  });

  test("DRE-8: malformed transport payload is refused before persistence", async () => {
    const bridge = new AdinkraRoomEvidenceBridge(new LoopbackAdinkraPort(), makeLedger());
    const result = await bridge.receive(new TextEncoder().encode("not-json"));
    expect(result).toEqual({ ok: false, reason: "receipt payload is not valid JSON" });
  });
});
