/**
 * Live-feed conformance: discovery reflects durable envelopes or explicitly reports no data.
 * It never turns absence, malformed bytes, or a mismatched event ID into a synthetic receipt.
 */
import { describe, expect, test } from "bun:test";
import { InMemoryStoragePort, ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import { type AuditGenesisBinding } from "../../research/zero-crossing-evidence-audit";
import { type RosterEntry, type SignatureScheme } from "../signed-stamp";
import {
  DurableRoomEvidenceLedger,
  ROOM_EVIDENCE_RECEIPT_SCHEMA,
  type RoomEvidenceReceipt,
} from "./durable-room-evidence";
import {
  DurableRoomEvidenceAuditLedger,
  ROOM_GENESIS_WITNESS_SCHEMA,
  auditRosterKeyFingerprint,
  makeRoomEvidenceAuditEvent,
  roomGenesisWitnessSigningBytes,
  type RoomGenesisWitness,
} from "./durable-room-evidence-audit";
import {
  DurableRoomEvidenceLiveFeedPublisher,
  ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE,
  encodeRoomEvidenceLiveFeedIndex,
  readRoomEvidenceLiveFeed,
  type RoomEvidenceLiveFeedWriter,
} from "./durable-room-evidence-live-feed";

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

function receipt(): RoomEvidenceReceipt {
  return {
    schema: ROOM_EVIDENCE_RECEIPT_SCHEMA,
    roomId: "room-a",
    roomFingerprint: "room/sha256:a",
    channelFingerprint: "channel/udp/a",
    spectrumSlice: "rainbow:cyan",
    signatureSplit: "split:node-a",
    runId: "run-a",
    episodeId: "episode-a",
    factId: "fact-a",
    sourceArtifact: "zeta://room-a/run-a",
    weight: 1,
    uncertainty: { meanPpm: 625_000, precisionPpm: 400_000 },
    solved: true,
    actionCount: 12,
    elapsedMs: 1_250,
    actionBudget: 100,
    timeBudgetMs: 10_000,
  };
}

function binding(): AuditGenesisBinding {
  return {
    emitterId: "node-a",
    signer: "node-a-key-1",
    scheme: scheme.id,
    keyFingerprint: auditRosterKeyFingerprint(key),
    witnessRef: "witness/node-a/1",
  };
}

function witness(value = binding()): RoomGenesisWitness {
  return {
    schema: ROOM_GENESIS_WITNESS_SCHEMA,
    binding: value,
    signatureHex: sign(roomGenesisWitnessSigningBytes(value)),
  };
}

function event() {
  const result = makeRoomEvidenceAuditEvent({
    receipt: receipt(),
    emitterId: "node-a",
    emitterSeq: 0,
    genesisBinding: binding(),
    genesisWitness: witness(),
  });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

function ledger(): DurableRoomEvidenceAuditLedger {
  return new DurableRoomEvidenceAuditLedger({
    receiptLedger: new DurableRoomEvidenceLedger(
      new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId: "receipt-node" }),
    ),
    auditStorage: new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId: "audit-node" }),
    schemes: [scheme],
    roster,
  });
}

class MemoryFeed implements RoomEvidenceLiveFeedWriter {
  readonly files = new Map<string, string>();
  failPath: string | undefined;

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async write(path: string, payload: string) {
    if (path === this.failPath) return { ok: false as const, reason: `intentional failure at ${path}` };
    this.files.set(path, payload);
    return { ok: true as const, value: undefined };
  }
}

describe("durable room-evidence live feed", () => {
  test("DREL-1: a valid empty index remains an explicit no-emitted-data state", async () => {
    const feed = new MemoryFeed();
    feed.files.set(
      ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE,
      encodeRoomEvidenceLiveFeedIndex({ schema: "zeta.room-evidence-live-feed-index.v1", entries: [] }),
    );
    expect((await readRoomEvidenceLiveFeed(feed)).kind).toBe("empty");
  });

  test("DREL-2: append publishes only an already-durable event and a reader recovers its exact event identity", async () => {
    const feed = new MemoryFeed();
    const publisher = new DurableRoomEvidenceLiveFeedPublisher(ledger(), feed);
    const next = event();
    const published = await publisher.appendAndPublish(next, {
      adjudication: { file: `adjudications/${next.delta.eventId}.json`, contentKey: "a".repeat(32) },
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    const read = await readRoomEvidenceLiveFeed(feed);
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") {
      expect(read.events.map((value) => value.delta.eventId)).toEqual([published.value.eventId]);
      expect(read.events[0]!.receipt.weight).toBe(1);
      expect(read.index.entries[0]!.adjudication).toEqual({
        file: `adjudications/${published.value.eventId}.json`,
        contentKey: "a".repeat(32),
      });
    }
  });

  test("DREL-3: a failed envelope write never creates a discovery index", async () => {
    const feed = new MemoryFeed();
    const next = event();
    feed.failPath = `room-evidence/${next.delta.eventId}.json`;
    const publisher = new DurableRoomEvidenceLiveFeedPublisher(ledger(), feed);
    const published = await publisher.appendAndPublish(next);
    expect(published.ok).toBe(false);
    expect(feed.files.has(ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE)).toBe(false);
  });

  test("DREL-4: unavailable, mismatched, and repeated manifest entries remain teaching errors rather than evidence", async () => {
    const unavailable = new MemoryFeed();
    expect((await readRoomEvidenceLiveFeed(unavailable)).kind).toBe("unavailable");

    const mismatched = new MemoryFeed();
    mismatched.files.set(
      ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE,
      JSON.stringify({
        schema: "zeta.room-evidence-live-feed-index.v1",
        entries: [
          {
            eventId: "not-the-envelope",
            auditContentKey: "audit-a",
            receiptContentKey: "receipt-a",
            file: "room-evidence/a.json",
          },
        ],
      }),
    );
    mismatched.files.set("room-evidence/a.json", JSON.stringify(event()));
    expect((await readRoomEvidenceLiveFeed(mismatched)).kind).toBe("malformed");

    const repeated = new MemoryFeed();
    repeated.files.set(
      ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE,
      JSON.stringify({
        schema: "zeta.room-evidence-live-feed-index.v1",
        entries: [
          { eventId: "same", auditContentKey: "audit-a", receiptContentKey: "receipt-a", file: "room-evidence/a.json" },
          { eventId: "same", auditContentKey: "audit-b", receiptContentKey: "receipt-b", file: "room-evidence/b.json" },
        ],
      }),
    );
    expect((await readRoomEvidenceLiveFeed(repeated)).kind).toBe("malformed");
  });

  test("DREL-5: a legacy published entry can gain one event-bound local adjudication reference without changing its receipt identity", async () => {
    const feed = new MemoryFeed();
    const next = event();
    const publisher = new DurableRoomEvidenceLiveFeedPublisher(ledger(), feed);
    const initial = await publisher.appendAndPublish(next);
    expect(initial.ok).toBe(true);
    const backfill = await publisher.appendAndPublish(next, {
      adjudication: { file: `adjudications/${next.delta.eventId}.json`, contentKey: "b".repeat(32) },
    });
    expect(backfill).toMatchObject({ ok: true, value: { duplicate: true, eventId: next.delta.eventId } });
    const index = JSON.parse(feed.files.get(ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE) ?? "") as { entries: unknown[] };
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({
      eventId: next.delta.eventId,
      adjudication: { file: `adjudications/${next.delta.eventId}.json`, contentKey: "b".repeat(32) },
    });
  });

  test("DREL-6: a sidecar reference for a different event is rejected before durable append or discovery publication", async () => {
    const feed = new MemoryFeed();
    const next = event();
    const result = await new DurableRoomEvidenceLiveFeedPublisher(ledger(), feed).appendAndPublish(next, {
      adjudication: { file: "adjudications/not-this-event.json", contentKey: "c".repeat(32) },
    });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("must bind this event ID") });
    expect(feed.files.has(ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE)).toBe(false);
  });
});
