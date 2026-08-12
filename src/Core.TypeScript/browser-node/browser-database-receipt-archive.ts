import {
  validateBrowserDatabaseExecutionReceipt,
  type BrowserDatabaseExecutionReceipt,
} from "./browser-database-intent-outbox";
import type {
  ZetaDbFeedback,
  ZetaDbResult,
  ZetaDbTickLimits,
  ZetaDbTickReadout,
  ZetaDbTickRequest,
} from "../zetadb/zeta-db-node";

export const BROWSER_DATABASE_RECEIPT_ARCHIVE_ACK_SCHEMA = "zeta.browser-database-receipt-archive-ack.v1" as const;

export interface BrowserDatabaseReceiptArchiveAcknowledgement {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_ARCHIVE_ACK_SCHEMA;
  readonly archiveNodeId: string;
  readonly databaseNodeId: string;
  readonly intentId: string;
  readonly sequence: number;
  readonly archiveRevision: number;
  readonly disposition: "stored" | "duplicate";
}

export interface BrowserDatabaseReceiptArchiveFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | ZetaDbFeedback["code"]
    | "receipt-archive-configuration-invalid"
    | "receipt-archive-record-invalid"
    | "receipt-archive-executor-threw"
    | "receipt-archive-ack-invalid";
  readonly detail: string;
}

export type BrowserDatabaseReceiptArchiveResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptArchiveFeedback };

export interface BrowserDatabaseReceiptArchivePort {
  archive(
    receipt: BrowserDatabaseExecutionReceipt,
  ): Promise<BrowserDatabaseReceiptArchiveResult<BrowserDatabaseReceiptArchiveAcknowledgement>>;
}

export type BrowserDatabaseReceiptArchiveExecutor = (
  request: ZetaDbTickRequest,
) => Promise<ZetaDbResult<ZetaDbTickReadout>>;

export interface ZetaDbBrowserDatabaseReceiptArchiveOptions {
  readonly sourceDatabaseNodeId: string;
  readonly archiveNodeId: string;
  readonly executorId: string;
  readonly limits: ZetaDbTickLimits;
  readonly execute: BrowserDatabaseReceiptArchiveExecutor;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptArchiveResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserDatabaseReceiptArchiveFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptArchiveFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserDatabaseReceiptArchiveFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validLimits(value: ZetaDbTickLimits): boolean {
  return (
    Number.isSafeInteger(value.maxDeltas) &&
    value.maxDeltas >= 1 &&
    Number.isSafeInteger(value.maxEntries) &&
    value.maxEntries >= 1 &&
    Number.isSafeInteger(value.maxCheckpointBytes) &&
    value.maxCheckpointBytes >= 1
  );
}

function archiveRowKey(sequence: number): string {
  return `execution-receipt/${sequence.toString()}`;
}

function archiveRequest(
  options: ZetaDbBrowserDatabaseReceiptArchiveOptions,
  receipt: BrowserDatabaseExecutionReceipt,
): ZetaDbTickRequest {
  const rowKey = archiveRowKey(receipt.sequence);
  return {
    nodeId: options.archiveNodeId,
    executorId: options.executorId,
    executorKind: "browser-tab",
    requireComplete: true,
    deltas: [{ eventId: rowKey, rowKey, payload: JSON.stringify(receipt), weight: 1 }],
    limits: options.limits,
  };
}

function archiveAcknowledgement(
  options: ZetaDbBrowserDatabaseReceiptArchiveOptions,
  receipt: BrowserDatabaseExecutionReceipt,
  tick: ZetaDbTickReadout,
): BrowserDatabaseReceiptArchiveResult<BrowserDatabaseReceiptArchiveAcknowledgement> {
  const rowKey = archiveRowKey(receipt.sequence);
  const payload = JSON.stringify(receipt);
  const exactRow = tick.rows.find((row) => row.rowKey === rowKey && row.payload === payload && row.weight === 1);
  const untrustedTick = tick as unknown as Readonly<Record<string, unknown>>;
  if (
    untrustedTick.schema !== "zeta.db.tick.v1" ||
    tick.nodeId !== options.archiveNodeId ||
    tick.executorId !== options.executorId ||
    tick.executorKind !== "browser-tab" ||
    !isSequence(tick.revision) ||
    tick.admission !== "complete" ||
    tick.nextDeltaIndex !== 1 ||
    tick.accepted + tick.duplicates !== 1 ||
    (tick.accepted !== 0 && tick.accepted !== 1) ||
    (tick.duplicates !== 0 && tick.duplicates !== 1) ||
    exactRow === undefined
  ) {
    return failed(
      "receipt-archive-ack-invalid",
      "The receipt archive executor returned no exact complete persistence acknowledgement.",
    );
  }
  return succeeded({
    schema: BROWSER_DATABASE_RECEIPT_ARCHIVE_ACK_SCHEMA,
    archiveNodeId: options.archiveNodeId,
    databaseNodeId: receipt.databaseNodeId,
    intentId: receipt.intentId,
    sequence: receipt.sequence,
    archiveRevision: tick.revision,
    disposition: tick.accepted === 1 ? "stored" : "duplicate",
  });
}

/**
 * Adapt a finite ZetaDB executor into receipt archival. A dedicated archive
 * node keeps receipt rows out of the application database projection.
 */
export function createZetaDbBrowserDatabaseReceiptArchive(
  options: ZetaDbBrowserDatabaseReceiptArchiveOptions,
): BrowserDatabaseReceiptArchiveResult<BrowserDatabaseReceiptArchivePort> {
  if (
    !isIdentifier(options.sourceDatabaseNodeId) ||
    !isIdentifier(options.archiveNodeId) ||
    options.archiveNodeId === options.sourceDatabaseNodeId ||
    !isIdentifier(options.executorId) ||
    !validLimits(options.limits) ||
    typeof options.execute !== "function"
  ) {
    return failed(
      "receipt-archive-configuration-invalid",
      "A receipt archive requires distinct source and archive nodes, an executor identity, and positive finite budgets.",
    );
  }

  return succeeded({
    archive: async (receiptValue) => {
      const receipt = validateBrowserDatabaseExecutionReceipt(receiptValue);
      if (!receipt.ok) {
        return failed("receipt-archive-record-invalid", receipt.feedback.detail);
      }
      if (receipt.value.databaseNodeId !== options.sourceDatabaseNodeId) {
        return failed(
          "receipt-archive-record-invalid",
          `Receipt ${receipt.value.intentId} belongs to another database node.`,
        );
      }

      let executed: ZetaDbResult<ZetaDbTickReadout>;
      try {
        executed = await options.execute(archiveRequest(options, receipt.value));
      } catch {
        return failed(
          "receipt-archive-executor-threw",
          "The injected receipt archive executor threw before acknowledging persistence.",
        );
      }
      if (!executed.ok) return executed;
      return archiveAcknowledgement(options, receipt.value, executed.value);
    },
  });
}
