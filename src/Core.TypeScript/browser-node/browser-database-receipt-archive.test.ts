import { describe, expect, test } from "bun:test";
import { createInMemoryZetaDbImagePort, runZetaDbNodeTick } from "../zetadb/zeta-db-node";
import type { BrowserDatabaseExecutionReceipt } from "./browser-database-intent-outbox";
import {
  createZetaDbBrowserDatabaseReceiptArchive,
  type BrowserDatabaseReceiptArchiveExecutor,
} from "./browser-database-receipt-archive";

const receipt: BrowserDatabaseExecutionReceipt = {
  schema: "zeta.browser-database-execution-receipt.v1",
  databaseNodeId: "browser/global",
  intentId: "event/score",
  sequence: 3,
  status: "settled",
  executorId: "tab-a",
  executorKind: "browser-tab",
  revision: 7,
  accepted: 1,
  duplicates: 0,
  deltaCount: 1,
};

const limits = { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 16 * 1024 } as const;

function create(execute: BrowserDatabaseReceiptArchiveExecutor) {
  const created = createZetaDbBrowserDatabaseReceiptArchive({
    sourceDatabaseNodeId: "browser/global",
    archiveNodeId: "browser/global:receipts",
    executorId: "tab-b",
    limits,
    execute,
  });
  if (!created.ok) throw new Error(created.feedback.detail);
  return created.value;
}

describe("browser database receipt archive", () => {
  test("stores canonical receipt rows and acknowledges idempotent replay", async () => {
    const image = createInMemoryZetaDbImagePort();
    const requests: Parameters<BrowserDatabaseReceiptArchiveExecutor>[0][] = [];
    const archive = create((request) => {
      requests.push(request);
      return runZetaDbNodeTick(image, request);
    });

    expect(await archive.archive(receipt)).toEqual({
      ok: true,
      value: {
        schema: "zeta.browser-database-receipt-archive-ack.v1",
        archiveNodeId: "browser/global:receipts",
        databaseNodeId: "browser/global",
        intentId: "event/score",
        sequence: 3,
        archiveRevision: 1,
        disposition: "stored",
      },
    });
    expect(await archive.archive(receipt)).toMatchObject({
      ok: true,
      value: { archiveRevision: 1, disposition: "duplicate" },
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual({
      nodeId: "browser/global:receipts",
      executorId: "tab-b",
      executorKind: "browser-tab",
      requireComplete: true,
      deltas: [
        {
          eventId: "execution-receipt/3",
          rowKey: "execution-receipt/3",
          payload: JSON.stringify(receipt),
          weight: 1,
        },
      ],
      limits,
    });
  });

  test("preserves typed database backpressure and rejects false acknowledgements", async () => {
    const backpressured = create(() =>
      Promise.resolve({
        ok: false,
        feedback: {
          severity: "backpressure",
          code: "database-capacity-exhausted",
          detail: "archive full",
        },
      }),
    );
    expect(await backpressured.archive(receipt)).toEqual({
      ok: false,
      feedback: { severity: "backpressure", code: "database-capacity-exhausted", detail: "archive full" },
    });

    const falseAck = create(() =>
      Promise.resolve({
        ok: true,
        value: {
          schema: "zeta.db.tick.v1",
          nodeId: "browser/global:receipts",
          executorId: "tab-b",
          executorKind: "browser-tab",
          revision: 1,
          admission: "complete",
          accepted: 1,
          duplicates: 0,
          nextDeltaIndex: 1,
          rows: [],
          feedback: [],
        },
      }),
    );
    expect(await falseAck.archive(receipt)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-archive-ack-invalid" },
    });
  });

  test("rejects another source database and captures executor throws", async () => {
    const archive = create(() => Promise.reject(new Error("offline")));
    expect(await archive.archive({ ...receipt, databaseNodeId: "another/database" })).toMatchObject({
      ok: false,
      feedback: { code: "receipt-archive-record-invalid" },
    });
    expect(await archive.archive(receipt)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-archive-executor-threw" },
    });
  });
});
