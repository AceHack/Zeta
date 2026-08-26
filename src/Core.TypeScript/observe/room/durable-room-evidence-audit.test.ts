import { describe, expect, test } from "bun:test";
import { InMemoryStoragePort, ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import { type RosterEntry, type SignatureScheme } from "../signed-stamp";
import {
  DurableRoomEvidenceAuditLedger,
  ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA,
  ROOM_GENESIS_WITNESS_SCHEMA,
  auditRosterKeyFingerprint,
  decodeRoomEvidenceAuditEvent,
  encodeRoomEvidenceAuditEvent,
  makeRoomEvidenceAuditEvent,
  roomGenesisWitnessSigningBytes,
  type RoomGenesisWitness,
} from "./durable-room-evidence-audit";
import {
  DurableRoomEvidenceLedger,
  ROOM_EVIDENCE_RECEIPT_SCHEMA,
  type RoomEvidenceReceipt,
} from "./durable-room-evidence";
import type { AuditGenesisBinding } from "../../research/zero-crossing-evidence-audit";

const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const key = new Uint8Array([0xa5, 0x5a, 0x0f]);
const scheme: SignatureScheme = {
  id: "toy-v1",
  verify: (publicKey, message, signature) => {
    const expected = new Uint8Array(message.length);
    for (let index = 0; index < message.length; index++)
      expected[index] = message[index]! ^ publicKey[index % publicKey.length]!;
    return hex(expected) === hex(signature);
  },
};
const roster: readonly RosterEntry[] = [{ signer: "node-a-key-1", scheme: scheme.id, publicKey: key }];

function sign(message: Uint8Array): string {
  const signature = new Uint8Array(message.length);
  for (let index = 0; index < message.length; index++) signature[index] = message[index]! ^ key[index % key.length]!;
  return hex(signature);
}

function receipt(weight: number, factId = "fact-a"): RoomEvidenceReceipt {
  return {
    schema: ROOM_EVIDENCE_RECEIPT_SCHEMA,
    roomId: "room-a",
    roomFingerprint: "room/sha256:a",
    channelFingerprint: "channel/udp/a",
    spectrumSlice: "rainbow:cyan",
    signatureSplit: "split:node-a",
    runId: "run-a",
    episodeId: "episode-a",
    factId,
    sourceArtifact: "zeta://room-a/run-a",
    weight,
    uncertainty: { meanPpm: 625_000, precisionPpm: 400_000 },
    solved: true,
    actionCount: 12,
    elapsedMs: 1_250,
    actionBudget: 100,
    timeBudgetMs: 10_000,
  };
}

function binding(overrides: Partial<AuditGenesisBinding> = {}): AuditGenesisBinding {
  return {
    emitterId: "node-a",
    signer: "node-a-key-1",
    scheme: scheme.id,
    keyFingerprint: auditRosterKeyFingerprint(key),
    witnessRef: "witness/node-a/1",
    ...overrides,
  };
}

function witness(forBinding = binding(), signatureHex?: string): RoomGenesisWitness {
  return {
    schema: ROOM_GENESIS_WITNESS_SCHEMA,
    binding: forBinding,
    signatureHex: signatureHex ?? sign(roomGenesisWitnessSigningBytes(forBinding)),
  };
}

function makeLedger(localRoster: readonly RosterEntry[] = roster): DurableRoomEvidenceAuditLedger {
  return new DurableRoomEvidenceAuditLedger({
    receiptLedger: new DurableRoomEvidenceLedger(
      new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId: "receipt-node" }),
    ),
    auditStorage: new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId: "audit-node" }),
    schemes: [scheme],
    roster: localRoster,
  });
}

function expectEvent(result: ReturnType<typeof makeRoomEvidenceAuditEvent>) {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

describe("durable room evidence genesis authority", () => {
  test("DREGA-1: a persisted sequence-zero witness is locally witnessed without collapsing evidence or causality", async () => {
    const genesisBinding = binding();
    const event = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
        genesisWitness: witness(genesisBinding),
      }),
    );
    const ledger = makeLedger();
    const stored = await ledger.append(event);
    expect(stored.ok).toBe(true);
    const folded = ledger.fold();
    expect(folded.ok).toBe(true);
    if (folded.ok) {
      expect(folded.value.evidence.atoms).toHaveLength(1);
      expect(folded.value.audit.registers.assertedEventIds).toEqual([event.delta.eventId]);
      expect(folded.value.audit.registers.settledCausalEventIds).toEqual([event.delta.eventId]);
      expect(folded.value.audit.registers.witnessedGenesisEmitters).toEqual(["node-a"]);
    }
  });

  test("DREGA-2: the identical persisted witness is unresolved to a verifier with no local roster entry", async () => {
    const genesisBinding = binding();
    const event = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
        genesisWitness: witness(genesisBinding),
      }),
    );
    const ledger = makeLedger([]);
    expect((await ledger.append(event)).ok).toBe(true);
    const folded = ledger.fold();
    expect(folded.ok).toBe(true);
    if (folded.ok) expect(folded.value.audit.registers.unresolvedGenesisEmitters).toEqual(["node-a"]);
  });

  test("DREGA-2b: an absent witness remains durable and unresolved", async () => {
    const genesisBinding = binding();
    const event = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
      }),
    );
    const ledger = makeLedger();
    expect((await ledger.append(event)).ok).toBe(true);
    const folded = ledger.fold();
    expect(folded.ok).toBe(true);
    if (folded.ok) expect(folded.value.audit.registers.unresolvedGenesisEmitters).toEqual(["node-a"]);
  });

  test("DREGA-3: an invalid signature or substituted witness binding is disputed, never guessed", async () => {
    const genesisBinding = binding();
    for (const genesisWitness of [
      witness(genesisBinding, "00"),
      witness(binding({ witnessRef: genesisBinding.witnessRef, keyFingerprint: "zeta-merkle-text-v1:wrong" })),
    ]) {
      const event = expectEvent(
        makeRoomEvidenceAuditEvent({
          receipt: receipt(1),
          emitterId: "node-a",
          emitterSeq: 0,
          genesisBinding,
          genesisWitness,
        }),
      );
      const ledger = makeLedger();
      expect((await ledger.append(event)).ok).toBe(true);
      const folded = ledger.fold();
      expect(folded.ok).toBe(true);
      if (folded.ok) expect(folded.value.audit.registers.disputedGenesisEmitters).toEqual(["node-a"]);
    }
  });

  test("DREGA-3b: a self-consistent witness for the wrong local key fingerprint is disputed", async () => {
    const genesisBinding = binding({ keyFingerprint: "zeta-merkle-text-v1:wrong" });
    const event = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
        genesisWitness: witness(genesisBinding),
      }),
    );
    const ledger = makeLedger();
    expect((await ledger.append(event)).ok).toBe(true);
    const folded = ledger.fold();
    expect(folded.ok).toBe(true);
    if (folded.ok) expect(folded.value.audit.registers.disputedGenesisEmitters).toEqual(["node-a"]);
  });

  test("DREGA-4: an out-of-order child persists as unresolved causality until its predecessor arrives", async () => {
    const genesisBinding = binding();
    const first = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
        genesisWitness: witness(genesisBinding),
      }),
    );
    const child = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(-1, "fact-b"),
        emitterId: "node-a",
        emitterSeq: 1,
        previousEventHash: first.delta.eventId,
      }),
    );
    const ledger = makeLedger();
    expect((await ledger.append(child)).ok).toBe(true);
    const partial = ledger.fold();
    expect(partial.ok).toBe(true);
    if (partial.ok) expect(partial.value.audit.registers.unresolvedCausalEventIds).toEqual([child.delta.eventId]);
    expect((await ledger.append(first)).ok).toBe(true);
    const complete = ledger.fold();
    expect(complete.ok).toBe(true);
    if (complete.ok) {
      expect(complete.value.audit.chainContinuity.complete).toBe(true);
      expect(complete.value.audit.registers.retractedEventIds).toEqual([child.delta.eventId]);
      expect(complete.value.audit.registers.witnessedGenesisEmitters).toEqual(["node-a"]);
    }
  });

  test("DREGA-5: exact replay is idempotent while same-content logical emissions retain multiplicity", async () => {
    const genesisBinding = binding();
    const first = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
        genesisWitness: witness(genesisBinding),
      }),
    );
    const second = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 1,
        previousEventHash: first.delta.eventId,
      }),
    );
    const ledger = makeLedger();
    const stored = await ledger.append(first);
    expect(stored.ok).toBe(true);
    expect(await ledger.append(first)).toMatchObject({ ok: true, value: { duplicate: true } });
    expect((await ledger.append(second)).ok).toBe(true);
    const folded = ledger.fold();
    expect(folded.ok).toBe(true);
    if (folded.ok) {
      expect(folded.value.audit.auditCount).toBe(2);
      expect(folded.value.audit.net).toEqual([{ e: first.delta.key, w: 2 }]);
    }
  });

  test("DREGA-6: persisted audit content replays to the same roots", async () => {
    const genesisBinding = binding();
    const event = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
        genesisWitness: witness(genesisBinding),
      }),
    );
    const ledger = makeLedger();
    const stored = await ledger.append(event);
    if (!stored.ok) throw new Error(stored.reason);
    const encoded = encodeRoomEvidenceAuditEvent(event);
    expect(decodeRoomEvidenceAuditEvent(encoded)).toEqual({ ok: true, value: event });
    expect(event.schema).toBe(ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA);

    const replayed = await ledger.replay([stored.value.auditContentKey]);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.value.audit.auditCount).toBe(1);
  });

  test("DREGA-7: receipt tampering cannot retain the original event identity", () => {
    const genesisBinding = binding();
    const event = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
      }),
    );
    const tampered = {
      ...event,
      receipt: { ...event.receipt, uncertainty: { meanPpm: 624_999, precisionPpm: 400_000 } },
    };
    expect(decodeRoomEvidenceAuditEvent(JSON.stringify(tampered))).toEqual({
      ok: false,
      reason: "audit delta key does not bind the receipt atom",
    });
  });

  test("DREGA-7b: sequence zero refuses a caller-supplied predecessor that substitutes the genesis anchor", () => {
    const result = makeRoomEvidenceAuditEvent({
      receipt: receipt(1),
      emitterId: "node-a",
      emitterSeq: 0,
      genesisBinding: binding(),
      previousEventHash: "event/substituted",
    });
    expect(result).toEqual({ ok: false, reason: "sequence-zero predecessor must equal the bound genesis hash" });
  });

  test("DREGA-8: two different persisted witnesses at one reference are visibly disputed", async () => {
    const genesisBinding = binding();
    const eventA = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1),
        emitterId: "node-a",
        emitterSeq: 0,
        genesisBinding,
        genesisWitness: witness(genesisBinding),
      }),
    );
    const eventB = {
      ...eventA,
      genesisWitness: witness(genesisBinding, "00"),
    };
    const ledger = makeLedger();
    expect((await ledger.append(eventA)).ok).toBe(true);
    expect((await ledger.append(eventB)).ok).toBe(false);

    const authorityOnly = makeLedger();
    const secondEmitter = expectEvent(
      makeRoomEvidenceAuditEvent({
        receipt: receipt(1, "fact-c"),
        emitterId: "node-b",
        emitterSeq: 0,
        genesisBinding: binding({ emitterId: "node-b" }),
        genesisWitness: witness(genesisBinding, "00"),
      }),
    );
    expect((await authorityOnly.append(eventA)).ok).toBe(true);
    expect((await authorityOnly.append(secondEmitter)).ok).toBe(true);
    const folded = authorityOnly.fold();
    expect(folded.ok).toBe(true);
    if (folded.ok) expect(folded.value.audit.registers.disputedGenesisEmitters).toEqual(["node-a", "node-b"]);
  });
});
