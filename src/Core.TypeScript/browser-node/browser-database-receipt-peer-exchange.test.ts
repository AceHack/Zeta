import { describe, expect, test } from "bun:test";
import { ContentHash256 } from "../blake3/blake3";
import { decodeZetaDbImage, runZetaDbNodeTick } from "../zetadb/zeta-db-node";
import type { BrowserCheckpointPort, BrowserCheckpointRecord } from "./browser-checkpoint-port";
import {
  browserCheckpointFailed,
  browserCheckpointSucceeded,
  copyBrowserCheckpointRecord,
  decideBrowserCheckpointRemoval,
  decideBrowserCheckpointSave,
} from "./browser-checkpoint-port";
import type { BrowserDatabaseExecutionReceipt } from "./browser-database-intent-outbox";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
  encodeBrowserDatabaseReceiptHandoffBody,
  createZetaDbBrowserDatabaseReceiptHandoff,
  type BrowserDatabaseReceiptHandoffAcknowledgement,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffPort,
} from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA,
  createBrowserDatabaseReceiptPeerReceiver,
  createBrowserDatabaseReceiptPeerSender,
  type BrowserDatabaseReceiptPeerLimits,
  type BrowserDatabaseReceiptPeerReceiver,
  type BrowserDatabaseReceiptPeerTransport,
} from "./browser-database-receipt-peer-exchange";
import { createBrowserZetaDbImagePort } from "./browser-zetadb-image-port";
import { monotoneLastWriterWinsRevisionPolicy } from "../persistence/revision-policy";

const sourcePeerId = "reticulum/source";
const targetPeerId = "reticulum/target";
const databaseNodeId = "browser/global";
const archiveNodeId = "browser/global:receipts";
const targetNodeId = "browser/peer:durable";
const limits: BrowserDatabaseReceiptPeerLimits = {
  maxReceipts: 8,
  maxRequestBytes: 64 * 1024,
  maxResponseBytes: 16 * 1024,
};

function createCheckpointPort(): BrowserCheckpointPort {
  const records = new Map<string, BrowserCheckpointRecord>();
  let closed = false;
  return {
    revisionPolicy: monotoneLastWriterWinsRevisionPolicy,
    load: (nodeId) => {
      if (closed) return Promise.resolve(browserCheckpointFailed("checkpoint-store-closed", "closed"));
      const record = records.get(nodeId);
      return Promise.resolve(
        browserCheckpointSucceeded(record === undefined ? null : copyBrowserCheckpointRecord(record)),
      );
    },
    save: (candidate) => {
      if (closed) return Promise.resolve(browserCheckpointFailed("checkpoint-store-closed", "closed"));
      const decision = decideBrowserCheckpointSave(
        records.get(candidate.nodeId) ?? null,
        candidate,
        monotoneLastWriterWinsRevisionPolicy,
      );
      if (!decision.ok) return Promise.resolve(decision);
      records.set(candidate.nodeId, copyBrowserCheckpointRecord(decision.value.record));
      return Promise.resolve(browserCheckpointSucceeded(copyBrowserCheckpointRecord(decision.value.record)));
    },
    remove: (nodeId, throughRevision) => {
      if (closed) return Promise.resolve(browserCheckpointFailed("checkpoint-store-closed", "closed"));
      const decision = decideBrowserCheckpointRemoval(records.get(nodeId) ?? null, nodeId, throughRevision);
      if (!decision.ok) return Promise.resolve(decision);
      if (decision.value.action === "missing") return Promise.resolve(browserCheckpointSucceeded(false));
      records.delete(nodeId);
      return Promise.resolve(browserCheckpointSucceeded(true));
    },
    close: () => {
      closed = true;
      return browserCheckpointSucceeded(null);
    },
  };
}

function hash(payload: Uint8Array): string {
  return `blake3:${ContentHash256.ofBytes(payload).toHex()}`;
}

function receipt(sequence: number): BrowserDatabaseExecutionReceipt {
  return {
    schema: "zeta.browser-database-execution-receipt.v1",
    databaseNodeId,
    intentId: `event/${sequence.toString()}`,
    sequence,
    status: "settled",
    executorId: "tab-source",
    executorKind: "browser-tab",
    revision: sequence + 1,
    accepted: 1,
    duplicates: 0,
    deltaCount: 1,
  };
}

function batch(...sequences: readonly number[]): BrowserDatabaseReceiptHandoffBatch {
  const receipts = sequences.map(receipt);
  const first = receipts[0];
  const last = receipts.at(-1);
  if (first === undefined || last === undefined) throw new Error("test batches require receipts");
  const body = {
    schema: "zeta.browser-database-receipt-handoff-batch.v1" as const,
    databaseNodeId,
    archiveNodeId,
    archiveRevision: receipts.length,
    firstSequence: first.sequence,
    highWaterSequence: last.sequence,
    receiptCount: receipts.length,
    receipts,
  };
  return { ...body, contentHash: hash(encodeBrowserDatabaseReceiptHandoffBody(body)) };
}

function acknowledgement(
  value: BrowserDatabaseReceiptHandoffBatch,
  disposition: "stored" | "duplicate" = "stored",
): BrowserDatabaseReceiptHandoffAcknowledgement {
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
    targetNodeId,
    databaseNodeId: value.databaseNodeId,
    archiveNodeId: value.archiveNodeId,
    archiveRevision: value.archiveRevision,
    highWaterSequence: value.highWaterSequence,
    receiptCount: value.receiptCount,
    contentHash: value.contentHash,
    disposition,
  };
}

function createTarget() {
  const checkpoints = createCheckpointPort();
  const images = createBrowserZetaDbImagePort(checkpoints);
  const target = createZetaDbBrowserDatabaseReceiptHandoff({
    sourceDatabaseNodeId: databaseNodeId,
    sourceArchiveNodeId: archiveNodeId,
    targetNodeId,
    executorId: "tab-target",
    limits: { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 128 * 1024 },
    hasher: { hash },
    execute: (request) => runZetaDbNodeTick(images, request),
  });
  if (!target.ok) throw new Error(target.feedback.detail);
  return { images, target: target.value };
}

function createReceiver(
  downstream: BrowserDatabaseReceiptHandoffPort,
  receiverLimits: BrowserDatabaseReceiptPeerLimits = limits,
): BrowserDatabaseReceiptPeerReceiver {
  const receiver = createBrowserDatabaseReceiptPeerReceiver({
    peerId: targetPeerId,
    sourcePeerId,
    targetNodeId,
    downstream,
    hasher: { hash },
    limits: receiverLimits,
  });
  if (!receiver.ok) throw new Error(receiver.feedback.detail);
  return receiver.value;
}

function createSender(
  transport: BrowserDatabaseReceiptPeerTransport,
  senderLimits: BrowserDatabaseReceiptPeerLimits = limits,
) {
  const sender = createBrowserDatabaseReceiptPeerSender({
    sourcePeerId,
    targetPeerId,
    targetNodeId,
    transport,
    limits: senderLimits,
  });
  if (!sender.ok) throw new Error(sender.feedback.detail);
  return sender.value;
}

describe("browser database receipt peer exchange", () => {
  test("persists one addressed batch in peer ZetaDB and acknowledges exact replay as a duplicate", async () => {
    const target = createTarget();
    const receiver = createReceiver(target.target);
    const sender = createSender({ exchange: (payload) => receiver.receive(payload) });
    const value = batch(3, 4);

    expect(await sender.handoff(value)).toMatchObject({
      ok: true,
      value: { disposition: "stored", contentHash: value.contentHash, receiptCount: 2 },
    });
    expect(sender.read()).toMatchObject({
      role: "sender",
      status: "complete",
      localPeerId: sourcePeerId,
      remotePeerId: targetPeerId,
      targetNodeId,
      disposition: "stored",
      receiptCount: 2,
    });
    expect(receiver.read()).toMatchObject({
      role: "receiver",
      status: "complete",
      localPeerId: targetPeerId,
      remotePeerId: sourcePeerId,
      disposition: "stored",
    });
    expect(sender.read().requestBytes).toBeGreaterThan(0);
    expect(sender.read().responseBytes).toBeGreaterThan(0);

    expect(await sender.handoff(value)).toMatchObject({ ok: true, value: { disposition: "duplicate" } });
    expect(receiver.read()).toMatchObject({ status: "complete", disposition: "duplicate" });

    const loaded = await target.images.load(targetNodeId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.value === null) throw new Error("missing peer image");
    const decoded = decodeZetaDbImage(loaded.value.payload);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(decoded.feedback.detail);
    expect(decoded.value.rows).toEqual([
      {
        rowKey: `receipt-batch/${value.contentHash.slice("blake3:".length)}`,
        payload: JSON.stringify(value),
        weight: 1,
      },
    ]);
  });

  test("receiver recomputes the content address and refuses a tampered request before persistence", async () => {
    const target = createTarget();
    const receiver = createReceiver(target.target);
    const sender = createSender({
      exchange: async (payload) => {
        const request = JSON.parse(new TextDecoder().decode(payload)) as {
          batch: { receipts: Array<{ intentId: string }> };
        };
        const first = request.batch.receipts[0];
        if (first !== undefined) first.intentId = "event/tampered";
        return receiver.receive(new TextEncoder().encode(JSON.stringify(request)));
      },
    });

    expect(await sender.handoff(batch(1))).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-handoff-peer-transport-failed" },
    });
    expect(receiver.read()).toMatchObject({
      status: "heat",
      feedback: { code: "receipt-handoff-hash-invalid" },
    });
    expect(await target.images.load(targetNodeId)).toEqual({ ok: true, value: null });
  });

  test("sender rejects an acknowledgement that does not bind the addressed peer, target database, and batch", async () => {
    const value = batch(1);
    const exact = {
      schema: BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA,
      kind: "acknowledged",
      sourcePeerId: targetPeerId,
      targetPeerId: sourcePeerId,
      contentHash: value.contentHash,
      acknowledgement: acknowledgement(value),
    } as const;
    const invalidResponses = [
      { ...exact, sourcePeerId: "reticulum/wrong-peer" },
      { ...exact, contentHash: `blake3:${"0".repeat(64)}` },
      { ...exact, acknowledgement: { ...exact.acknowledgement, targetNodeId: "browser/wrong-target" } },
    ];

    for (const response of invalidResponses) {
      const sender = createSender({
        exchange: () => Promise.resolve({ ok: true, value: new TextEncoder().encode(JSON.stringify(response)) }),
      });

      expect(await sender.handoff(value)).toMatchObject({
        ok: false,
        feedback: { code: "receipt-handoff-peer-response-invalid" },
      });
      expect(sender.read()).toMatchObject({ status: "heat", disposition: null });
    }
  });

  test("valid remote backpressure crosses the peer boundary without becoming an exception", async () => {
    const receiver = createReceiver({
      handoff: () =>
        Promise.resolve({
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "receipt-handoff-downstream-backpressured",
            detail: "The target image is at capacity.",
          },
        }),
    });
    const sender = createSender({ exchange: (payload) => receiver.receive(payload) });

    expect(await sender.handoff(batch(1))).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "receipt-handoff-downstream-backpressured",
        detail: expect.stringContaining("target image is at capacity"),
      },
    });
    expect(receiver.read()).toMatchObject({
      status: "backpressured",
      feedback: { code: "receipt-handoff-downstream-backpressured" },
    });
  });

  test("sender and receiver enforce independent receipt and byte budgets", async () => {
    let exchangeCalls = 0;
    const tinySender = createSender(
      {
        exchange: () => {
          exchangeCalls += 1;
          return Promise.reject(new Error("must not exchange"));
        },
      },
      { ...limits, maxRequestBytes: 1 },
    );
    expect(await tinySender.handoff(batch(1))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-peer-request-capacity-exhausted" },
    });
    expect(exchangeCalls).toBe(0);

    const constrainedReceiver = createReceiver(
      { handoff: (value) => Promise.resolve({ ok: true, value: acknowledgement(value) }) },
      { ...limits, maxReceipts: 1 },
    );
    const sender = createSender({ exchange: (payload) => constrainedReceiver.receive(payload) });
    expect(await sender.handoff(batch(1, 2))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-downstream-backpressured" },
    });
    expect(constrainedReceiver.read()).toMatchObject({
      status: "backpressured",
      feedback: { code: "receipt-handoff-peer-request-capacity-exhausted" },
    });

    const tinyResponseReceiver = createReceiver(
      { handoff: (value) => Promise.resolve({ ok: true, value: acknowledgement(value) }) },
      { ...limits, maxResponseBytes: 1 },
    );
    const responseSender = createSender({ exchange: (payload) => tinyResponseReceiver.receive(payload) });
    expect(await responseSender.handoff(batch(1))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-downstream-backpressured" },
    });
    expect(tinyResponseReceiver.read()).toMatchObject({
      status: "backpressured",
      feedback: { code: "receipt-handoff-peer-response-capacity-exhausted" },
    });
  });

  test("transport exceptions and invalid peer configuration return typed heat", async () => {
    const sender = createSender({
      exchange: () => Promise.reject(new Error("offline")),
    });
    expect(await sender.handoff(batch(1))).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-handoff-peer-transport-failed" },
    });

    expect(
      createBrowserDatabaseReceiptPeerSender({
        sourcePeerId,
        targetPeerId: sourcePeerId,
        targetNodeId,
        transport: { exchange: () => Promise.reject(new Error("unused")) },
        limits,
      }),
    ).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-peer-configuration-invalid" },
    });

    const unboundedFeedback = createSender({
      exchange: () =>
        Promise.resolve({
          ok: false,
          feedback: { severity: "heat", code: "transport-invalid", detail: "x".repeat(4097) },
        }),
    });
    expect(await unboundedFeedback.handoff(batch(1))).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-handoff-peer-response-invalid" },
    });
  });
});
