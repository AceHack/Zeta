import { describe, expect, test } from "bun:test";
import { ContentHash256 } from "../blake3/blake3";
import type { BrowserDatabaseExecutionReceipt } from "./browser-database-intent-outbox";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
  createBrowserDatabaseReceiptHandoffRuntime,
  encodeBrowserDatabaseReceiptHandoffBody,
  type BrowserDatabaseReceiptArchiveMaintenancePort,
  type BrowserDatabaseReceiptArchiveSnapshot,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffBody,
} from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_ACCEPTED_RECORD_SCHEMA,
  createBrowserDatabaseReceiptProposalAcceptanceHandoff,
  type BrowserDatabaseReceiptAcceptedRecord,
  type BrowserDatabaseReceiptAcceptedRecordSource,
} from "./browser-database-receipt-proposal-acceptance";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
  browserDatabaseReceiptProposalTargetPath,
  encodeBrowserDatabaseReceiptProposalDocument,
} from "./browser-database-receipt-proposal";

const databaseNodeId = "browser/global";
const archiveNodeId = "browser/global:receipts";
const targetNodeId = "git:Lucent-Financial-Group/Zeta";
const revision = "a".repeat(40);

function receipt(sequence: number): BrowserDatabaseExecutionReceipt {
  return {
    schema: "zeta.browser-database-execution-receipt.v1",
    databaseNodeId,
    intentId: `event/${sequence.toString()}`,
    sequence,
    status: "settled",
    executorId: "tab-a",
    executorKind: "browser-tab",
    revision: sequence + 1,
    accepted: 1,
    duplicates: 0,
    deltaCount: 1,
  };
}

function hash(payload: Uint8Array): string {
  return `blake3:${ContentHash256.ofBytes(payload).toHex()}`;
}

function batch(): BrowserDatabaseReceiptHandoffBatch {
  const receipts = [receipt(3), receipt(4)];
  const body: BrowserDatabaseReceiptHandoffBody = {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
    databaseNodeId,
    archiveNodeId,
    archiveRevision: 8,
    firstSequence: 3,
    highWaterSequence: 4,
    receiptCount: receipts.length,
    receipts,
  };
  return { ...body, contentHash: hash(encodeBrowserDatabaseReceiptHandoffBody(body)) };
}

function record(source: BrowserDatabaseReceiptHandoffBatch = batch()): BrowserDatabaseReceiptAcceptedRecord {
  return {
    schema: BROWSER_DATABASE_RECEIPT_ACCEPTED_RECORD_SCHEMA,
    repository: BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
    ref: "main",
    revision,
    targetPath: browserDatabaseReceiptProposalTargetPath(source.contentHash),
    payload: new TextEncoder().encode(encodeBrowserDatabaseReceiptProposalDocument(source)),
  };
}

function open(source: BrowserDatabaseReceiptAcceptedRecordSource, maxRecordBytes = 32 * 1024) {
  const created = createBrowserDatabaseReceiptProposalAcceptanceHandoff({
    targetNodeId,
    source,
    hasher: { hash },
    maxRecordBytes,
  });
  if (!created.ok) throw new Error(created.feedback.detail);
  return created.value;
}

describe("browser database receipt proposal acceptance observer", () => {
  test("acknowledges only the exact content-addressed record at an immutable revision", async () => {
    const source = batch();
    expect(
      await open({ read: () => Promise.resolve({ ok: true, value: record(source) }) }).handoff(source),
    ).toEqual({
      ok: true,
      value: {
        schema: "zeta.browser-database-receipt-handoff-ack.v1",
        targetNodeId,
        databaseNodeId,
        archiveNodeId,
        archiveRevision: 8,
        highWaterSequence: 4,
        receiptCount: 2,
        contentHash: source.contentHash,
        disposition: "stored",
      },
    });
  });

  test("treats an absent accepted record as backpressure rather than acknowledgement", async () => {
    expect(await open({ read: () => Promise.resolve({ ok: true, value: null }) }).handoff(batch())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-acceptance-pending" },
    });
  });

  test("rejects non-main or mutable revisions, mismatched bytes, and records over the finite budget", async () => {
    const foreignRef = { ...record(), ref: "topic" as const };
    expect(await open({ read: () => Promise.resolve({ ok: true, value: foreignRef }) }).handoff(batch())).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-record-invalid" },
    });

    const mutableRevision = { ...record(), revision: "main" };
    expect(
      await open({ read: () => Promise.resolve({ ok: true, value: mutableRevision }) }).handoff(batch()),
    ).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-record-invalid" },
    });

    const mismatched = { ...record(), payload: new TextEncoder().encode("{}\n") };
    expect(await open({ read: () => Promise.resolve({ ok: true, value: mismatched }) }).handoff(batch())).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-content-mismatch" },
    });

    expect(
      await open({ read: () => Promise.resolve({ ok: true, value: record() }) }, 1).handoff(batch()),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-acceptance-capacity-exhausted" },
    });
  });

  test("retains the archive while pending and compacts only after exact repository evidence", async () => {
    const receipts = [receipt(3), receipt(4)];
    const snapshot: BrowserDatabaseReceiptArchiveSnapshot = {
      schema: "zeta.browser-database-receipt-archive-snapshot.v1",
      databaseNodeId,
      archiveNodeId,
      archiveRevision: 8,
      receiptPayloadBytes: 512,
      limits: { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 32 * 1024 },
      receipts,
      generation: null,
    };
    let accepted = false;
    let compactions = 0;
    const downstream = open({
      read: () => Promise.resolve({ ok: true, value: accepted ? record() : null }),
    });
    const archive: BrowserDatabaseReceiptArchiveMaintenancePort = {
      read: () => Promise.resolve({ ok: true, value: snapshot }),
      compactGeneration: () => {
        compactions++;
        return Promise.resolve({ ok: true, value: true });
      },
    };
    const runtime = createBrowserDatabaseReceiptHandoffRuntime({
      databaseNodeId,
      archiveNodeId,
      targetNodeId,
      archive,
      downstream,
      hasher: { hash },
      limits: { minimumReceipts: 1, maxReceipts: 8, maxBatchBytes: 32 * 1024 },
    });
    if (!runtime.ok) throw new Error(runtime.feedback.detail);

    expect(await runtime.value.handoff()).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-pending" },
    });
    expect(compactions).toBe(0);

    accepted = true;
    expect(await runtime.value.handoff()).toMatchObject({
      ok: true,
      value: { status: "complete", disposition: "stored", releasedReceipts: 2 },
    });
    expect(compactions).toBe(1);
  });

  test("turns repository-reader exceptions into typed feedback", async () => {
    const source = open({
      read: () => {
        throw new Error("offline");
      },
    });
    expect(await source.handoff(batch())).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-source-threw" },
    });
  });
});
