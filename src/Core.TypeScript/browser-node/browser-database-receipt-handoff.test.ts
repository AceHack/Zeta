import { describe, expect, test } from "bun:test";
import { ContentHash256 } from "../blake3/blake3";
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
  createBrowserDatabaseReceiptHandoffRuntime,
  createZetaDbBrowserDatabaseReceiptArchiveMaintenance,
  createZetaDbBrowserDatabaseReceiptHandoff,
  encodeBrowserDatabaseReceiptHandoffBody,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffPort,
} from "./browser-database-receipt-handoff";
import { createZetaDbBrowserDatabaseReceiptArchive } from "./browser-database-receipt-archive";
import { createBrowserZetaDbImagePort } from "./browser-zetadb-image-port";
import { runZetaDbNodeTick } from "../zetadb/zeta-db-node";
import { monotoneLastWriterWinsRevisionPolicy } from "../persistence/revision-policy";

const archiveLimits = { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 32 * 1024 } as const;
const handoffLimits = { minimumReceipts: 1, maxReceipts: 8, maxBatchBytes: 32 * 1024 } as const;
const databaseNodeId = "browser/global";
const archiveNodeId = "browser/global:receipts";
const targetNodeId = "browser/global:durable";

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

function acknowledgement(batch: BrowserDatabaseReceiptHandoffBatch, disposition: "stored" | "duplicate") {
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
    targetNodeId,
    databaseNodeId: batch.databaseNodeId,
    archiveNodeId: batch.archiveNodeId,
    archiveRevision: batch.archiveRevision,
    highWaterSequence: batch.highWaterSequence,
    receiptCount: batch.receiptCount,
    contentHash: batch.contentHash,
    disposition,
  } as const;
}

function createFixture(
  downstream: BrowserDatabaseReceiptHandoffPort,
  compactOverride?: (revision: number) => Promise<boolean>,
) {
  const checkpoints = createCheckpointPort();
  const images = createBrowserZetaDbImagePort(checkpoints);
  const execute = (request: Parameters<typeof runZetaDbNodeTick>[1]) => runZetaDbNodeTick(images, request);
  const writer = createZetaDbBrowserDatabaseReceiptArchive({
    sourceDatabaseNodeId: databaseNodeId,
    archiveNodeId,
    executorId: "tab-b",
    limits: archiveLimits,
    execute,
  });
  if (!writer.ok) throw new Error(writer.feedback.detail);
  const maintenance = createZetaDbBrowserDatabaseReceiptArchiveMaintenance({
    sourceDatabaseNodeId: databaseNodeId,
    archiveNodeId,
    executorId: "tab-b",
    limits: archiveLimits,
    load: async (nodeId) => {
      const loaded = await checkpoints.load(nodeId);
      return loaded.ok
        ? {
            ok: true,
            value:
              loaded.value === null
                ? null
                : {
                    nodeId: loaded.value.nodeId,
                    revision: loaded.value.revision,
                    payload: new Uint8Array(loaded.value.payload),
                  },
          }
        : {
            ok: false,
            feedback: {
              severity: loaded.feedback.severity,
              code: "database-read-failed",
              detail: loaded.feedback.detail,
            },
          };
    },
    save: async (replacement) => {
      if (compactOverride !== undefined && !(await compactOverride(replacement.revision - 1))) {
        return { ok: true, value: { ...replacement, payload: new Uint8Array([0]) } };
      }
      const saved = await checkpoints.save({
        schema: "zeta.browser-checkpoint-record.v1",
        ...replacement,
      });
      return saved.ok
        ? {
            ok: true,
            value: { nodeId: saved.value.nodeId, revision: saved.value.revision, payload: saved.value.payload },
          }
        : {
            ok: false,
            feedback: {
              severity: saved.feedback.severity,
              code: "database-write-failed",
              detail: saved.feedback.detail,
            },
          };
    },
  });
  if (!maintenance.ok) throw new Error(maintenance.feedback.detail);
  const runtime = createBrowserDatabaseReceiptHandoffRuntime({
    databaseNodeId,
    archiveNodeId,
    targetNodeId,
    archive: maintenance.value,
    downstream,
    hasher: { hash },
    limits: handoffLimits,
  });
  if (!runtime.ok) throw new Error(runtime.feedback.detail);
  return { checkpoints, writer: writer.value, maintenance: maintenance.value, runtime: runtime.value };
}

describe("browser database receipt archive handoff", () => {
  test("hands off one canonical generation and compacts it only after exact acknowledgement", async () => {
    const batches: BrowserDatabaseReceiptHandoffBatch[] = [];
    const fixture = createFixture({
      handoff: (batch) => {
        batches.push(batch);
        return Promise.resolve({ ok: true, value: acknowledgement(batch, "stored") });
      },
    });
    expect((await fixture.writer.archive(receipt(4))).ok).toBe(true);
    expect((await fixture.writer.archive(receipt(3))).ok).toBe(true);

    expect(await fixture.runtime.handoff()).toMatchObject({
      ok: true,
      value: {
        status: "complete",
        archiveRevision: 2,
        releasedReceipts: 2,
        retainedReceipts: 0,
        highWaterSequence: 4,
        disposition: "stored",
      },
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]?.receipts.map((value) => value.sequence)).toEqual([3, 4]);
    const batch = batches[0];
    if (batch === undefined) throw new Error("missing batch");
    const body = {
      schema: batch.schema,
      databaseNodeId: batch.databaseNodeId,
      archiveNodeId: batch.archiveNodeId,
      archiveRevision: batch.archiveRevision,
      firstSequence: batch.firstSequence,
      highWaterSequence: batch.highWaterSequence,
      receiptCount: batch.receiptCount,
      receipts: batch.receipts,
    };
    expect(batch.contentHash).toBe(hash(encodeBrowserDatabaseReceiptHandoffBody(body)));
    expect(await fixture.maintenance.read()).toMatchObject({ ok: true, value: { archiveRevision: 3, receipts: [] } });
  });

  test("replays a duplicate downstream batch after interrupted local compaction", async () => {
    const stored = new Set<string>();
    let allowRemoval = false;
    const fixture = createFixture(
      {
        handoff: (batch) => {
          const disposition = stored.has(batch.contentHash) ? "duplicate" : "stored";
          stored.add(batch.contentHash);
          return Promise.resolve({ ok: true, value: acknowledgement(batch, disposition) });
        },
      },
      () => Promise.resolve(allowRemoval),
    );
    expect((await fixture.writer.archive(receipt(1))).ok).toBe(true);
    expect(await fixture.runtime.handoff()).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-compact-failed" },
    });
    allowRemoval = true;
    expect(await fixture.runtime.handoff()).toMatchObject({
      ok: true,
      value: { status: "complete", disposition: "duplicate", releasedReceipts: 1 },
    });
  });

  test("backpressures a same-revision compaction race and retains the newly archived receipt", async () => {
    let appendDuringCompaction = true;
    const fixture = createFixture(
      { handoff: (batch) => Promise.resolve({ ok: true, value: acknowledgement(batch, "stored") }) },
      async () => {
        if (appendDuringCompaction) {
          appendDuringCompaction = false;
          expect((await fixture.writer.archive(receipt(2))).ok).toBe(true);
        }
        return true;
      },
    );
    expect((await fixture.writer.archive(receipt(1))).ok).toBe(true);

    expect(await fixture.runtime.handoff()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-write-failed" },
    });
    expect(await fixture.maintenance.read()).toMatchObject({
      ok: true,
      value: { archiveRevision: 2, receipts: [{ sequence: 1 }, { sequence: 2 }] },
    });
  });

  test("backpressures a concurrent archive change instead of compacting the newer receipt", async () => {
    let appendReceipt: (() => Promise<void>) | null = null;
    let appendDuringFirstHandoff = true;
    const fixture = createFixture({
      handoff: async (batch) => {
        if (appendDuringFirstHandoff) {
          appendDuringFirstHandoff = false;
          await appendReceipt?.();
        }
        return { ok: true, value: acknowledgement(batch, "stored") };
      },
    });
    appendReceipt = async () => {
      expect((await fixture.writer.archive(receipt(2))).ok).toBe(true);
    };
    expect((await fixture.writer.archive(receipt(1))).ok).toBe(true);
    expect(await fixture.runtime.handoff()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-archive-changed" },
    });
    expect(await fixture.maintenance.read()).toMatchObject({
      ok: true,
      value: { receipts: [{ sequence: 1 }, { sequence: 2 }] },
    });
    expect(await fixture.runtime.handoff()).toMatchObject({ ok: true, value: { releasedReceipts: 2 } });
  });

  test("rejects false acknowledgements and complete generations over budget without compaction", async () => {
    let calls = 0;
    const fixture = createFixture({
      handoff: (batch) => {
        calls += 1;
        return Promise.resolve({
          ok: true,
          value: { ...acknowledgement(batch, "stored"), contentHash: `blake3:${"0".repeat(64)}` },
        });
      },
    });
    expect((await fixture.writer.archive(receipt(1))).ok).toBe(true);
    expect(await fixture.runtime.handoff()).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-ack-invalid" },
    });
    expect(await fixture.maintenance.read()).toMatchObject({ ok: true, value: { receipts: [{ sequence: 1 }] } });

    const constrained = createBrowserDatabaseReceiptHandoffRuntime({
      databaseNodeId,
      archiveNodeId,
      targetNodeId,
      archive: fixture.maintenance,
      downstream: {
        handoff: () => {
          calls += 1;
          return Promise.reject(new Error("must not run"));
        },
      },
      hasher: { hash },
      limits: { minimumReceipts: 1, maxReceipts: 1, maxBatchBytes: 1 },
    });
    if (!constrained.ok) throw new Error(constrained.feedback.detail);
    expect(await constrained.value.handoff()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-batch-capacity-exhausted" },
    });
    expect(calls).toBe(1);
  });

  test("stores content-addressed batches in a target ZetaDB and treats exact replay as a duplicate", async () => {
    const checkpoints = createCheckpointPort();
    const images = createBrowserZetaDbImagePort(checkpoints);
    const target = createZetaDbBrowserDatabaseReceiptHandoff({
      sourceDatabaseNodeId: databaseNodeId,
      sourceArchiveNodeId: archiveNodeId,
      targetNodeId,
      executorId: "tab-target",
      limits: { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 64 * 1024 },
      hasher: { hash },
      execute: (request) => runZetaDbNodeTick(images, request),
    });
    if (!target.ok) throw new Error(target.feedback.detail);

    const receipts = [receipt(1), receipt(2)];
    const body = {
      schema: "zeta.browser-database-receipt-handoff-batch.v1" as const,
      databaseNodeId,
      archiveNodeId,
      archiveRevision: 2,
      firstSequence: 1,
      highWaterSequence: 2,
      receiptCount: 2,
      receipts,
    };
    const batch: BrowserDatabaseReceiptHandoffBatch = {
      ...body,
      contentHash: hash(encodeBrowserDatabaseReceiptHandoffBody(body)),
    };

    expect(await target.value.handoff(batch)).toMatchObject({
      ok: true,
      value: { disposition: "stored", receiptCount: 2, highWaterSequence: 2 },
    });
    expect(await target.value.handoff(batch)).toMatchObject({
      ok: true,
      value: { disposition: "duplicate", contentHash: batch.contentHash },
    });
    expect(
      await target.value.handoff({
        ...batch,
        receipts: [receipt(1), receipt(3)],
      }),
    ).toMatchObject({ ok: false, feedback: { code: "receipt-handoff-batch-invalid" } });
  });
});
