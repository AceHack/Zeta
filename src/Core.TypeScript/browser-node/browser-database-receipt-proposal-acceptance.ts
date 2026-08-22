import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
  type BrowserDatabaseReceiptBatchHasher,
  type BrowserDatabaseReceiptHandoffAcknowledgement,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffPort,
  type BrowserDatabaseReceiptHandoffResult,
} from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
  browserDatabaseReceiptProposalTargetPath,
  encodeBrowserDatabaseReceiptProposalDocument,
  validateBrowserDatabaseReceiptProposalBatch,
} from "./browser-database-receipt-proposal";

export const BROWSER_DATABASE_RECEIPT_ACCEPTED_RECORD_SCHEMA =
  "zeta.browser-database-receipt-accepted-record.v1" as const;
export const BROWSER_DATABASE_RECEIPT_PROPOSAL_ACCEPTANCE_PORT_KIND =
  "zeta.browser-database-receipt-proposal-acceptance-port.v1" as const;

export interface BrowserDatabaseReceiptAcceptedRecord {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_ACCEPTED_RECORD_SCHEMA;
  readonly repository: typeof BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY;
  readonly ref: "main";
  readonly revision: string;
  readonly targetPath: string;
  readonly payload: Uint8Array;
}

export interface BrowserDatabaseReceiptAcceptedRecordSource {
  read(targetPath: string): Promise<BrowserDatabaseReceiptHandoffResult<unknown | null>>;
}

export interface BrowserDatabaseReceiptProposalAcceptanceOptions {
  readonly targetNodeId: string;
  readonly source: BrowserDatabaseReceiptAcceptedRecordSource;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly maxRecordBytes: number;
}

export interface BrowserDatabaseReceiptProposalAcceptancePort extends BrowserDatabaseReceiptHandoffPort {
  readonly kind: typeof BROWSER_DATABASE_RECEIPT_PROPOSAL_ACCEPTANCE_PORT_KIND;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptHandoffResult<T> {
  return { ok: true, value };
}

function failed(
  code:
    | "receipt-handoff-batch-invalid"
    | "receipt-handoff-hash-invalid"
    | "receipt-handoff-acceptance-configuration-invalid"
    | "receipt-handoff-acceptance-pending"
    | "receipt-handoff-acceptance-source-threw"
    | "receipt-handoff-acceptance-record-invalid"
    | "receipt-handoff-acceptance-capacity-exhausted"
    | "receipt-handoff-acceptance-content-mismatch",
  detail: string,
  severity: "backpressure" | "heat" = "heat",
): BrowserDatabaseReceiptHandoffResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasMethod(value: unknown, name: string): boolean {
  if (!isRecord(value)) return false;
  try {
    return typeof Reflect.get(value, name) === "function";
  } catch {
    return false;
  }
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function exactBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function acknowledgement(
  targetNodeId: string,
  batch: BrowserDatabaseReceiptHandoffBatch,
): BrowserDatabaseReceiptHandoffAcknowledgement {
  return Object.freeze({
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
    targetNodeId,
    databaseNodeId: batch.databaseNodeId,
    archiveNodeId: batch.archiveNodeId,
    archiveRevision: batch.archiveRevision,
    highWaterSequence: batch.highWaterSequence,
    receiptCount: batch.receiptCount,
    contentHash: batch.contentHash,
    disposition: "stored",
  });
}

/**
 * Observe an accepted content-addressed repository record as the durable side
 * of receipt handoff. Missing records are backpressure, never acknowledgement.
 */
export function createBrowserDatabaseReceiptProposalAcceptanceHandoff(
  options: BrowserDatabaseReceiptProposalAcceptanceOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptProposalAcceptancePort> {
  if (
    !isIdentifier(options.targetNodeId) ||
    !hasMethod(options.source, "read") ||
    !hasMethod(options.hasher, "hash") ||
    !Number.isSafeInteger(options.maxRecordBytes) ||
    options.maxRecordBytes < 1
  ) {
    return failed(
      "receipt-handoff-acceptance-configuration-invalid",
      "A receipt acceptance observer requires a target identity, repository reader, full-digest hasher, and positive finite record budget.",
    );
  }

  return succeeded({
    kind: BROWSER_DATABASE_RECEIPT_PROPOSAL_ACCEPTANCE_PORT_KIND,
    handoff: async (batchValue) => {
      const batch = validateBrowserDatabaseReceiptProposalBatch(batchValue, options.hasher);
      if (!batch.ok) {
        return failed(
          batch.feedback.code === "receipt-proposal-hash-invalid"
            ? "receipt-handoff-hash-invalid"
            : "receipt-handoff-batch-invalid",
          batch.feedback.detail,
          batch.feedback.severity,
        );
      }
      const targetPath = browserDatabaseReceiptProposalTargetPath(batch.value.contentHash);
      const expectedPayload = new TextEncoder().encode(encodeBrowserDatabaseReceiptProposalDocument(batch.value));
      if (expectedPayload.byteLength > options.maxRecordBytes) {
        return failed(
          "receipt-handoff-acceptance-capacity-exhausted",
          `The accepted receipt record needs ${expectedPayload.byteLength.toString()} bytes; the observer budget is ${options.maxRecordBytes.toString()} bytes.`,
          "backpressure",
        );
      }

      let observed: BrowserDatabaseReceiptHandoffResult<unknown | null>;
      try {
        observed = await options.source.read(targetPath);
      } catch {
        return failed(
          "receipt-handoff-acceptance-source-threw",
          "The injected repository reader threw before producing acceptance evidence.",
        );
      }
      if (!observed.ok) return observed;
      if (observed.value === null) {
        return failed(
          "receipt-handoff-acceptance-pending",
          "The content-addressed receipt record is not present in an accepted repository revision yet.",
          "backpressure",
        );
      }
      const record = observed.value;
      if (
        !isRecord(record) ||
        record.schema !== BROWSER_DATABASE_RECEIPT_ACCEPTED_RECORD_SCHEMA ||
        record.repository !== BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY ||
        record.ref !== "main" ||
        typeof record.revision !== "string" ||
        !/^[0-9a-f]{40}$/.test(record.revision) ||
        record.targetPath !== targetPath ||
        !(record.payload instanceof Uint8Array)
      ) {
        return failed(
          "receipt-handoff-acceptance-record-invalid",
          "The repository reader returned no exact main path at an immutable commit revision.",
        );
      }
      if (record.payload.byteLength > options.maxRecordBytes) {
        return failed(
          "receipt-handoff-acceptance-capacity-exhausted",
          "The observed repository record exceeds the finite acceptance budget.",
          "backpressure",
        );
      }
      return exactBytes(record.payload, expectedPayload)
        ? succeeded(acknowledgement(options.targetNodeId, batch.value))
        : failed(
            "receipt-handoff-acceptance-content-mismatch",
            "The accepted repository path does not contain the exact content-addressed receipt batch.",
          );
    },
  });
}
