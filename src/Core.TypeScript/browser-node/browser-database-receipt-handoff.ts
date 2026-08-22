import {
  copyBrowserDatabaseExecutionReceipt,
  validateBrowserDatabaseExecutionReceipt,
  type BrowserDatabaseExecutionReceipt,
} from "./browser-database-intent-outbox";
import type {
  BrowserDatabaseReceiptArchiveExecutor,
  BrowserDatabaseReceiptArchiveFeedback,
} from "./browser-database-receipt-archive";
import {
  decodeZetaDbImage,
  encodeZetaDbImage,
  type ZetaDbImageRecord,
  type ZetaDbResult,
  type ZetaDbTickLimits,
  type ZetaDbTickReadout,
} from "../zetadb/zeta-db-node";

export const BROWSER_DATABASE_RECEIPT_ARCHIVE_SNAPSHOT_SCHEMA =
  "zeta.browser-database-receipt-archive-snapshot.v1" as const;
export const BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA = "zeta.browser-database-receipt-handoff-batch.v1" as const;
export const BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA = "zeta.browser-database-receipt-handoff-ack.v1" as const;
export const BROWSER_DATABASE_RECEIPT_HANDOFF_READOUT_SCHEMA =
  "zeta.browser-database-receipt-handoff-readout.v1" as const;

export interface BrowserDatabaseReceiptArchiveSnapshot {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_ARCHIVE_SNAPSHOT_SCHEMA;
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly archiveRevision: number;
  readonly receiptPayloadBytes: number;
  readonly limits: ZetaDbTickLimits;
  readonly receipts: readonly BrowserDatabaseExecutionReceipt[];
  readonly generation: ZetaDbImageRecord | null;
}

export interface BrowserDatabaseReceiptHandoffBatch {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA;
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly archiveRevision: number;
  readonly firstSequence: number;
  readonly highWaterSequence: number;
  readonly receiptCount: number;
  readonly receipts: readonly BrowserDatabaseExecutionReceipt[];
  readonly contentHash: string;
}

export interface BrowserDatabaseReceiptHandoffAcknowledgement {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA;
  readonly targetNodeId: string;
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly archiveRevision: number;
  readonly highWaterSequence: number;
  readonly receiptCount: number;
  readonly contentHash: string;
  readonly disposition: "stored" | "duplicate";
}

export interface BrowserDatabaseReceiptHandoffFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | BrowserDatabaseReceiptArchiveFeedback["code"]
    | "receipt-handoff-configuration-invalid"
    | "receipt-handoff-archive-read-invalid"
    | "receipt-handoff-batch-invalid"
    | "receipt-handoff-batch-capacity-exhausted"
    | "receipt-handoff-hash-invalid"
    | "receipt-handoff-downstream-threw"
    | "receipt-handoff-downstream-backpressured"
    | "receipt-handoff-ack-invalid"
    | "receipt-handoff-archive-changed"
    | "receipt-handoff-compact-failed"
    | "receipt-handoff-peer-configuration-invalid"
    | "receipt-handoff-peer-request-invalid"
    | "receipt-handoff-peer-request-capacity-exhausted"
    | "receipt-handoff-peer-response-invalid"
    | "receipt-handoff-peer-response-capacity-exhausted"
    | "receipt-handoff-peer-transport-failed"
    | "receipt-handoff-peer-target-rejected"
    | "receipt-handoff-acceptance-configuration-invalid"
    | "receipt-handoff-acceptance-pending"
    | "receipt-handoff-acceptance-source-threw"
    | "receipt-handoff-acceptance-record-invalid"
    | "receipt-handoff-acceptance-capacity-exhausted"
    | "receipt-handoff-acceptance-content-mismatch"
    | "receipt-handoff-acceptance-pages-configuration-invalid"
    | "receipt-handoff-acceptance-pages-transport-failed"
    | "receipt-handoff-acceptance-pages-index-invalid"
    | "receipt-handoff-acceptance-pages-capacity-exhausted";
  readonly detail: string;
}

export type BrowserDatabaseReceiptHandoffResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptHandoffFeedback };

export interface BrowserDatabaseReceiptArchiveMaintenancePort {
  read(): Promise<BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptArchiveSnapshot>>;
  compactGeneration(
    snapshot: BrowserDatabaseReceiptArchiveSnapshot,
  ): Promise<BrowserDatabaseReceiptHandoffResult<boolean>>;
}

export interface BrowserDatabaseReceiptHandoffPort {
  handoff(
    batch: BrowserDatabaseReceiptHandoffBatch,
  ): Promise<BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffAcknowledgement>>;
}

export interface BrowserDatabaseReceiptBatchHasher {
  hash(payload: Uint8Array): string;
}

export interface BrowserDatabaseReceiptHandoffLimits {
  readonly minimumReceipts: number;
  readonly maxReceipts: number;
  readonly maxBatchBytes: number;
}

export interface BrowserDatabaseReceiptHandoffReadout {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_HANDOFF_READOUT_SCHEMA;
  readonly status: "idle" | "retained" | "complete" | "backpressured" | "heat";
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly targetNodeId: string;
  readonly archiveRevision: number;
  readonly retainedReceipts: number;
  readonly releasedReceipts: number;
  readonly receiptPayloadBytes: number;
  readonly highWaterSequence: number | null;
  readonly contentHash: string | null;
  readonly disposition: "stored" | "duplicate" | null;
  readonly feedback: BrowserDatabaseReceiptHandoffFeedback | null;
}

export interface BrowserDatabaseReceiptHandoffRuntime {
  handoff(): Promise<BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffReadout>>;
  read(): BrowserDatabaseReceiptHandoffReadout;
}

export type BrowserDatabaseReceiptArchiveCompactor = (
  replacement: ZetaDbImageRecord,
) => Promise<ZetaDbResult<ZetaDbImageRecord>>;

export type BrowserDatabaseReceiptArchiveLoader = (
  archiveNodeId: string,
) => Promise<ZetaDbResult<ZetaDbImageRecord | null>>;

export interface ZetaDbBrowserDatabaseReceiptArchiveMaintenanceOptions {
  readonly sourceDatabaseNodeId: string;
  readonly archiveNodeId: string;
  readonly executorId: string;
  readonly limits: ZetaDbTickLimits;
  readonly load: BrowserDatabaseReceiptArchiveLoader;
  readonly save: BrowserDatabaseReceiptArchiveCompactor;
}

export interface BrowserDatabaseReceiptHandoffOptions {
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly targetNodeId: string;
  readonly archive: BrowserDatabaseReceiptArchiveMaintenancePort;
  readonly downstream: BrowserDatabaseReceiptHandoffPort;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly limits: BrowserDatabaseReceiptHandoffLimits;
}

export interface BrowserDatabaseReceiptHandoffPreparationOptions {
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly limits: BrowserDatabaseReceiptHandoffLimits;
}

export type BrowserDatabaseReceiptHandoffPreparation =
  | {
      readonly status: "idle" | "retained";
      readonly snapshot: BrowserDatabaseReceiptArchiveSnapshot;
      readonly batch: null;
      readonly batchBytes: 0;
    }
  | {
      readonly status: "ready";
      readonly snapshot: BrowserDatabaseReceiptArchiveSnapshot;
      readonly batch: BrowserDatabaseReceiptHandoffBatch;
      readonly batchBytes: number;
    };

export interface BrowserDatabaseReceiptHandoffBody {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA;
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly archiveRevision: number;
  readonly firstSequence: number;
  readonly highWaterSequence: number;
  readonly receiptCount: number;
  readonly receipts: readonly BrowserDatabaseExecutionReceipt[];
}

function succeeded<T>(value: T): BrowserDatabaseReceiptHandoffResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserDatabaseReceiptHandoffFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptHandoffFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserDatabaseReceiptHandoffFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function validHandoffLimits(value: BrowserDatabaseReceiptHandoffLimits): boolean {
  return (
    Number.isSafeInteger(value.minimumReceipts) &&
    value.minimumReceipts >= 1 &&
    Number.isSafeInteger(value.maxReceipts) &&
    value.maxReceipts >= 1 &&
    value.minimumReceipts <= value.maxReceipts &&
    Number.isSafeInteger(value.maxBatchBytes) &&
    value.maxBatchBytes >= 1
  );
}

function hasMethods(value: unknown, names: readonly string[]): boolean {
  if (!isRecord(value)) return false;
  try {
    return names.every((name) => typeof Reflect.get(value, name) === "function");
  } catch {
    return false;
  }
}

function isContentHash(value: unknown): value is string {
  return typeof value === "string" && /^blake3:[0-9a-f]{64}$/.test(value);
}

function archiveRowSequence(rowKey: string): number | null {
  const prefix = "execution-receipt/";
  if (!rowKey.startsWith(prefix)) return null;
  const suffix = rowKey.slice(prefix.length);
  if (!/^(0|[1-9]\d*)$/.test(suffix)) return null;
  const sequence = Number(suffix);
  return isSequence(sequence) && sequence.toString() === suffix ? sequence : null;
}

function emptySnapshot(
  options: ZetaDbBrowserDatabaseReceiptArchiveMaintenanceOptions,
): BrowserDatabaseReceiptArchiveSnapshot {
  return {
    schema: BROWSER_DATABASE_RECEIPT_ARCHIVE_SNAPSHOT_SCHEMA,
    databaseNodeId: options.sourceDatabaseNodeId,
    archiveNodeId: options.archiveNodeId,
    archiveRevision: 0,
    receiptPayloadBytes: 0,
    limits: { ...options.limits },
    receipts: [],
    generation: null,
  };
}

function snapshotFromRecord(
  options: ZetaDbBrowserDatabaseReceiptArchiveMaintenanceOptions,
  record: ZetaDbImageRecord,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptArchiveSnapshot> {
  const decoded = decodeZetaDbImage(record.payload);
  if (
    !decoded.ok ||
    record.nodeId !== options.archiveNodeId ||
    decoded.value.nodeId !== options.archiveNodeId ||
    record.revision !== decoded.value.revision ||
    decoded.value.entries.length > options.limits.maxEntries ||
    record.payload.byteLength > options.limits.maxCheckpointBytes
  ) {
    return failed(
      "receipt-handoff-archive-read-invalid",
      "The loaded receipt archive is not one canonical generation within its finite read budget.",
    );
  }

  const receipts: BrowserDatabaseExecutionReceipt[] = [];
  let receiptPayloadBytes = 0;
  for (const entry of decoded.value.entries) {
    const sequence = archiveRowSequence(entry.rowKey);
    if (sequence === null || entry.eventId !== entry.rowKey || entry.weight !== 1) {
      return failed(
        "receipt-handoff-archive-read-invalid",
        `Archive entry ${entry.eventId} is not one complete execution receipt.`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(entry.payload);
    } catch {
      return failed("receipt-handoff-archive-read-invalid", `Archive entry ${entry.eventId} is not valid JSON.`);
    }
    const receipt = validateBrowserDatabaseExecutionReceipt(parsed);
    if (
      !receipt.ok ||
      receipt.value.databaseNodeId !== options.sourceDatabaseNodeId ||
      receipt.value.sequence !== sequence ||
      JSON.stringify(receipt.value) !== entry.payload
    ) {
      return failed(
        "receipt-handoff-archive-read-invalid",
        `Archive entry ${entry.eventId} does not contain its exact canonical execution receipt.`,
      );
    }
    receipts.push(receipt.value);
    receiptPayloadBytes += new TextEncoder().encode(entry.payload).byteLength;
  }
  receipts.sort((left, right) => left.sequence - right.sequence);
  return succeeded({
    schema: BROWSER_DATABASE_RECEIPT_ARCHIVE_SNAPSHOT_SCHEMA,
    databaseNodeId: options.sourceDatabaseNodeId,
    archiveNodeId: options.archiveNodeId,
    archiveRevision: record.revision,
    receiptPayloadBytes,
    limits: { ...options.limits },
    receipts: receipts.map(copyBrowserDatabaseExecutionReceipt),
    generation: { ...record, payload: new Uint8Array(record.payload) },
  });
}

export function createZetaDbBrowserDatabaseReceiptArchiveMaintenance(
  options: ZetaDbBrowserDatabaseReceiptArchiveMaintenanceOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptArchiveMaintenancePort> {
  if (
    !isIdentifier(options.sourceDatabaseNodeId) ||
    !isIdentifier(options.archiveNodeId) ||
    options.archiveNodeId === options.sourceDatabaseNodeId ||
    !isIdentifier(options.executorId) ||
    !validLimits(options.limits) ||
    typeof options.load !== "function" ||
    typeof options.save !== "function"
  ) {
    return failed(
      "receipt-handoff-configuration-invalid",
      "Archive maintenance requires distinct source and archive nodes, finite budgets, an image loader, and generation compaction.",
    );
  }

  return succeeded({
    read: async () => {
      let loaded: ZetaDbResult<ZetaDbImageRecord | null>;
      try {
        loaded = await options.load(options.archiveNodeId);
      } catch {
        return failed(
          "receipt-archive-executor-threw",
          "The archive image loader threw while reading a handoff snapshot.",
        );
      }
      if (!loaded.ok) return loaded;
      return loaded.value === null ? succeeded(emptySnapshot(options)) : snapshotFromRecord(options, loaded.value);
    },
    compactGeneration: async (snapshot) => {
      if (
        snapshot.databaseNodeId !== options.sourceDatabaseNodeId ||
        snapshot.archiveNodeId !== options.archiveNodeId ||
        snapshot.generation?.revision !== snapshot.archiveRevision ||
        snapshot.archiveRevision === Number.MAX_SAFE_INTEGER
      ) {
        return failed("receipt-handoff-compact-failed", "Archive compaction requires its exact loaded generation.");
      }
      const revision = snapshot.archiveRevision + 1;
      const encoded = encodeZetaDbImage({
        schema: "zeta.db.image.v1",
        nodeId: options.archiveNodeId,
        revision,
        entries: [],
        rows: [],
      });
      if (!encoded.ok) return encoded;
      const replacement = { nodeId: options.archiveNodeId, revision, payload: encoded.value };
      let compacted: ZetaDbResult<ZetaDbImageRecord>;
      try {
        compacted = await options.save(replacement);
      } catch {
        return failed(
          "receipt-handoff-compact-failed",
          "The archive compactor threw before confirming generation replacement.",
        );
      }
      if (!compacted.ok) return compacted;
      const exact =
        compacted.value.nodeId === replacement.nodeId &&
        compacted.value.revision === replacement.revision &&
        compacted.value.payload.byteLength === replacement.payload.byteLength &&
        compacted.value.payload.every((value, index) => value === replacement.payload[index]);
      return exact
        ? succeeded(true)
        : failed("receipt-handoff-compact-failed", "The archive compactor returned no exact replacement image.");
    },
  });
}

function bodyFromSnapshot(snapshot: BrowserDatabaseReceiptArchiveSnapshot): BrowserDatabaseReceiptHandoffBody | null {
  const first = snapshot.receipts[0];
  const last = snapshot.receipts.at(-1);
  if (first === undefined || last === undefined) return null;
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
    databaseNodeId: snapshot.databaseNodeId,
    archiveNodeId: snapshot.archiveNodeId,
    archiveRevision: snapshot.archiveRevision,
    firstSequence: first.sequence,
    highWaterSequence: last.sequence,
    receiptCount: snapshot.receipts.length,
    receipts: snapshot.receipts.map(copyBrowserDatabaseExecutionReceipt),
  };
}

export function encodeBrowserDatabaseReceiptHandoffBody(body: BrowserDatabaseReceiptHandoffBody): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(body));
}

function batchFromSnapshot(
  options: BrowserDatabaseReceiptHandoffPreparationOptions,
  snapshot: BrowserDatabaseReceiptArchiveSnapshot,
): BrowserDatabaseReceiptHandoffResult<{ readonly batch: BrowserDatabaseReceiptHandoffBatch; readonly bytes: number }> {
  const body = bodyFromSnapshot(snapshot);
  if (body === null) {
    return failed("receipt-handoff-archive-read-invalid", "An empty archive has no handoff batch.");
  }
  const payload = encodeBrowserDatabaseReceiptHandoffBody(body);
  if (body.receiptCount > options.limits.maxReceipts || payload.byteLength > options.limits.maxBatchBytes) {
    return failed(
      "receipt-handoff-batch-capacity-exhausted",
      `The complete archive generation needs ${body.receiptCount.toString()} receipts and ${payload.byteLength.toString()} bytes; the handoff budget is ${options.limits.maxReceipts.toString()} receipts and ${options.limits.maxBatchBytes.toString()} bytes.`,
      "backpressure",
    );
  }
  let contentHash: string;
  try {
    contentHash = options.hasher.hash(payload);
  } catch {
    return failed("receipt-handoff-hash-invalid", "The injected receipt batch hasher threw.");
  }
  if (!isContentHash(contentHash)) {
    return failed("receipt-handoff-hash-invalid", "The receipt batch hasher returned no full BLAKE3-256 digest.");
  }
  return succeeded({ batch: { ...body, contentHash }, bytes: payload.byteLength });
}

/** Prepare one immutable archive generation without contacting or compacting a downstream store. */
export function prepareBrowserDatabaseReceiptHandoffBatch(
  options: BrowserDatabaseReceiptHandoffPreparationOptions,
  snapshot: BrowserDatabaseReceiptArchiveSnapshot,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffPreparation> {
  if (
    !isIdentifier(options.databaseNodeId) ||
    !isIdentifier(options.archiveNodeId) ||
    options.databaseNodeId === options.archiveNodeId ||
    !hasMethods(options.hasher, ["hash"]) ||
    !validHandoffLimits(options.limits)
  ) {
    return failed(
      "receipt-handoff-configuration-invalid",
      "Receipt handoff preparation requires distinct source and archive nodes, a full-digest hasher, and finite batch budgets.",
    );
  }
  if (snapshot.databaseNodeId !== options.databaseNodeId || snapshot.archiveNodeId !== options.archiveNodeId) {
    return failed(
      "receipt-handoff-archive-read-invalid",
      "The archive snapshot names different source or archive nodes.",
    );
  }
  if (snapshot.receipts.length === 0) {
    return succeeded({ status: "idle", snapshot, batch: null, batchBytes: 0 });
  }
  if (snapshot.receipts.length < options.limits.minimumReceipts) {
    return succeeded({ status: "retained", snapshot, batch: null, batchBytes: 0 });
  }
  const prepared = batchFromSnapshot(options, snapshot);
  return prepared.ok
    ? succeeded({ status: "ready", snapshot, batch: prepared.value.batch, batchBytes: prepared.value.bytes })
    : prepared;
}

function acknowledgementMatches(
  acknowledgement: unknown,
  batch: BrowserDatabaseReceiptHandoffBatch,
  targetNodeId: string,
): acknowledgement is BrowserDatabaseReceiptHandoffAcknowledgement {
  return (
    isRecord(acknowledgement) &&
    acknowledgement.schema === BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA &&
    acknowledgement.targetNodeId === targetNodeId &&
    acknowledgement.databaseNodeId === batch.databaseNodeId &&
    acknowledgement.archiveNodeId === batch.archiveNodeId &&
    acknowledgement.archiveRevision === batch.archiveRevision &&
    acknowledgement.highWaterSequence === batch.highWaterSequence &&
    acknowledgement.receiptCount === batch.receiptCount &&
    acknowledgement.contentHash === batch.contentHash &&
    (acknowledgement.disposition === "stored" || acknowledgement.disposition === "duplicate")
  );
}

function readout(
  options: BrowserDatabaseReceiptHandoffOptions,
  status: BrowserDatabaseReceiptHandoffReadout["status"],
  snapshot: BrowserDatabaseReceiptArchiveSnapshot | null,
  releasedReceipts: number,
  batch: BrowserDatabaseReceiptHandoffBatch | null,
  disposition: BrowserDatabaseReceiptHandoffReadout["disposition"],
  feedback: BrowserDatabaseReceiptHandoffFeedback | null,
): BrowserDatabaseReceiptHandoffReadout {
  const generationRemoved = status === "complete";
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_READOUT_SCHEMA,
    status,
    databaseNodeId: options.databaseNodeId,
    archiveNodeId: options.archiveNodeId,
    targetNodeId: options.targetNodeId,
    archiveRevision: snapshot?.archiveRevision ?? 0,
    retainedReceipts: generationRemoved ? 0 : (snapshot?.receipts.length ?? 0),
    releasedReceipts,
    receiptPayloadBytes: generationRemoved ? 0 : (snapshot?.receiptPayloadBytes ?? 0),
    highWaterSequence: batch?.highWaterSequence ?? null,
    contentHash: batch?.contentHash ?? null,
    disposition,
    feedback,
  };
}

function statusFor(feedback: BrowserDatabaseReceiptHandoffFeedback): "backpressured" | "heat" {
  return feedback.severity === "backpressure" ? "backpressured" : "heat";
}

/**
 * Move one complete archive generation across an injected durability boundary.
 * A same-revision conflict keeps concurrent receipts from being compacted away.
 */
export function createBrowserDatabaseReceiptHandoffRuntime(
  options: BrowserDatabaseReceiptHandoffOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffRuntime> {
  if (
    !isIdentifier(options.databaseNodeId) ||
    !isIdentifier(options.archiveNodeId) ||
    !isIdentifier(options.targetNodeId) ||
    new Set([options.databaseNodeId, options.archiveNodeId, options.targetNodeId]).size !== 3 ||
    !hasMethods(options.archive, ["read", "compactGeneration"]) ||
    !hasMethods(options.downstream, ["handoff"]) ||
    !hasMethods(options.hasher, ["hash"]) ||
    !validHandoffLimits(options.limits)
  ) {
    return failed(
      "receipt-handoff-configuration-invalid",
      "Receipt handoff requires three distinct nodes, archive and downstream ports, a full-digest hasher, and finite batch budgets.",
    );
  }

  let latest = readout(options, "idle", null, 0, null, null, null);
  const failWith = (
    feedback: BrowserDatabaseReceiptHandoffFeedback,
    snapshot: BrowserDatabaseReceiptArchiveSnapshot | null,
    batch: BrowserDatabaseReceiptHandoffBatch | null = null,
  ): BrowserDatabaseReceiptHandoffResult<never> => {
    latest = readout(options, statusFor(feedback), snapshot, 0, batch, null, feedback);
    return { ok: false, feedback };
  };

  return succeeded({
    read: () => ({ ...latest, feedback: latest.feedback === null ? null : { ...latest.feedback } }),
    handoff: async () => {
      let snapshotResult: BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptArchiveSnapshot>;
      try {
        snapshotResult = await options.archive.read();
      } catch {
        return failWith(
          {
            severity: "heat",
            code: "receipt-handoff-archive-read-invalid",
            detail: "The injected archive reader threw before returning a snapshot.",
          },
          null,
        );
      }
      if (!snapshotResult.ok) return failWith(snapshotResult.feedback, null);
      const snapshot = snapshotResult.value;
      const prepared = prepareBrowserDatabaseReceiptHandoffBatch(options, snapshot);
      if (!prepared.ok) return failWith(prepared.feedback, snapshot);
      if (prepared.value.status !== "ready") {
        latest = readout(options, prepared.value.status, snapshot, 0, null, null, null);
        return succeeded(latest);
      }
      const batch = prepared.value.batch;

      let handed: BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffAcknowledgement>;
      try {
        handed = await options.downstream.handoff(batch);
      } catch {
        return failWith(
          {
            severity: "heat",
            code: "receipt-handoff-downstream-threw",
            detail: "The injected downstream receipt store threw before acknowledging persistence.",
          },
          snapshot,
          batch,
        );
      }
      if (!handed.ok) return failWith(handed.feedback, snapshot, batch);
      if (!acknowledgementMatches(handed.value, batch, options.targetNodeId)) {
        return failWith(
          {
            severity: "heat",
            code: "receipt-handoff-ack-invalid",
            detail: "The downstream store returned no exact complete batch acknowledgement.",
          },
          snapshot,
          batch,
        );
      }

      const current = await options.archive.read();
      if (!current.ok) return failWith(current.feedback, snapshot, batch);
      const currentBatch = prepareBrowserDatabaseReceiptHandoffBatch(options, current.value);
      if (
        !currentBatch.ok ||
        currentBatch.value.status !== "ready" ||
        current.value.archiveRevision !== snapshot.archiveRevision ||
        currentBatch.value.batch.contentHash !== batch.contentHash
      ) {
        return failWith(
          {
            severity: "backpressure",
            code: "receipt-handoff-archive-changed",
            detail:
              "The local receipt generation changed after downstream persistence; it remains retained for a fresh handoff.",
          },
          current.value,
          batch,
        );
      }

      const compacted = await options.archive.compactGeneration(current.value);
      if (!compacted.ok) return failWith(compacted.feedback, current.value, batch);
      if (!compacted.value) {
        return failWith(
          {
            severity: "heat",
            code: "receipt-handoff-compact-failed",
            detail: "The archive compactor returned no exact generation-replacement acknowledgement.",
          },
          current.value,
          batch,
        );
      }
      latest = readout(options, "complete", snapshot, batch.receiptCount, batch, handed.value.disposition, null);
      return succeeded(latest);
    },
  });
}

export interface ZetaDbBrowserDatabaseReceiptHandoffOptions {
  readonly sourceDatabaseNodeId: string;
  readonly sourceArchiveNodeId: string;
  readonly targetNodeId: string;
  readonly executorId: string;
  readonly limits: ZetaDbTickLimits;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly execute: BrowserDatabaseReceiptArchiveExecutor;
}

function validateBatchReceipt(
  candidate: unknown,
  options: ZetaDbBrowserDatabaseReceiptHandoffOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseExecutionReceipt> {
  const receipt = validateBrowserDatabaseExecutionReceipt(candidate);
  return receipt.ok && receipt.value.databaseNodeId === options.sourceDatabaseNodeId
    ? succeeded(receipt.value)
    : failed("receipt-handoff-batch-invalid", "A handoff batch contains an invalid execution receipt.");
}

function validateHandoffBatch(
  value: unknown,
  options: ZetaDbBrowserDatabaseReceiptHandoffOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffBatch> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA ||
    value.databaseNodeId !== options.sourceDatabaseNodeId ||
    value.archiveNodeId !== options.sourceArchiveNodeId ||
    !isSequence(value.archiveRevision) ||
    !isSequence(value.firstSequence) ||
    !isSequence(value.highWaterSequence) ||
    !isSequence(value.receiptCount) ||
    value.receiptCount < 1 ||
    !Array.isArray(value.receipts) ||
    value.receipts.length !== value.receiptCount ||
    !isContentHash(value.contentHash)
  ) {
    return failed("receipt-handoff-batch-invalid", "A receipt handoff batch has invalid identity or bounds.");
  }
  const receipts: BrowserDatabaseExecutionReceipt[] = [];
  let previousSequence: number | null = null;
  for (const candidate of value.receipts) {
    const receipt = validateBatchReceipt(candidate, options);
    if (!receipt.ok) return receipt;
    if (previousSequence !== null && receipt.value.sequence <= previousSequence) {
      return failed("receipt-handoff-batch-invalid", "Receipt handoff sequences must be strictly increasing.");
    }
    previousSequence = receipt.value.sequence;
    receipts.push(receipt.value);
  }
  const first = receipts[0];
  const last = receipts.at(-1);
  if (first?.sequence !== value.firstSequence || last?.sequence !== value.highWaterSequence) {
    return failed("receipt-handoff-batch-invalid", "Receipt handoff boundaries do not match their ordered receipts.");
  }
  const body: BrowserDatabaseReceiptHandoffBody = {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
    databaseNodeId: options.sourceDatabaseNodeId,
    archiveNodeId: options.sourceArchiveNodeId,
    archiveRevision: value.archiveRevision,
    firstSequence: value.firstSequence,
    highWaterSequence: value.highWaterSequence,
    receiptCount: value.receiptCount,
    receipts,
  };
  let contentHash: string;
  try {
    contentHash = options.hasher.hash(encodeBrowserDatabaseReceiptHandoffBody(body));
  } catch {
    return failed("receipt-handoff-hash-invalid", "The downstream batch hasher threw.");
  }
  if (contentHash !== value.contentHash) {
    return failed("receipt-handoff-batch-invalid", "The receipt batch bytes do not match their content hash.");
  }
  return succeeded({ ...body, contentHash, receipts: receipts.map(copyBrowserDatabaseExecutionReceipt) });
}

function handoffRowKey(contentHash: string): string {
  return `receipt-batch/${contentHash.slice("blake3:".length)}`;
}

function handoffRequest(
  options: ZetaDbBrowserDatabaseReceiptHandoffOptions,
  batch: BrowserDatabaseReceiptHandoffBatch,
) {
  const rowKey = handoffRowKey(batch.contentHash);
  return {
    nodeId: options.targetNodeId,
    executorId: options.executorId,
    executorKind: "browser-tab" as const,
    requireComplete: true,
    deltas: [{ eventId: rowKey, rowKey, payload: JSON.stringify(batch), weight: 1 }],
    limits: options.limits,
  };
}

function handoffAcknowledgement(
  options: ZetaDbBrowserDatabaseReceiptHandoffOptions,
  batch: BrowserDatabaseReceiptHandoffBatch,
  tick: ZetaDbTickReadout,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffAcknowledgement> {
  const rowKey = handoffRowKey(batch.contentHash);
  const exactRow = tick.rows.find(
    (row) => row.rowKey === rowKey && row.payload === JSON.stringify(batch) && row.weight === 1,
  );
  const untrusted = tick as unknown as Readonly<Record<string, unknown>>;
  if (
    untrusted.schema !== "zeta.db.tick.v1" ||
    tick.nodeId !== options.targetNodeId ||
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
    return failed("receipt-handoff-ack-invalid", "The target ZetaDB returned no exact complete batch acknowledgement.");
  }
  return succeeded({
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
    targetNodeId: options.targetNodeId,
    databaseNodeId: batch.databaseNodeId,
    archiveNodeId: batch.archiveNodeId,
    archiveRevision: batch.archiveRevision,
    highWaterSequence: batch.highWaterSequence,
    receiptCount: batch.receiptCount,
    contentHash: batch.contentHash,
    disposition: tick.accepted === 1 ? "stored" : "duplicate",
  });
}

/** Adapt any finite ZetaDB executor into the downstream side of receipt handoff. */
export function createZetaDbBrowserDatabaseReceiptHandoff(
  options: ZetaDbBrowserDatabaseReceiptHandoffOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffPort> {
  if (
    !isIdentifier(options.sourceDatabaseNodeId) ||
    !isIdentifier(options.sourceArchiveNodeId) ||
    !isIdentifier(options.targetNodeId) ||
    new Set([options.sourceDatabaseNodeId, options.sourceArchiveNodeId, options.targetNodeId]).size !== 3 ||
    !isIdentifier(options.executorId) ||
    !validLimits(options.limits) ||
    !hasMethods(options.hasher, ["hash"]) ||
    typeof options.execute !== "function"
  ) {
    return failed(
      "receipt-handoff-configuration-invalid",
      "A ZetaDB receipt target requires three distinct nodes, an executor identity, finite budgets, and a full-digest hasher.",
    );
  }
  return succeeded({
    handoff: async (batchValue) => {
      const batch = validateHandoffBatch(batchValue, options);
      if (!batch.ok) return batch;
      let executed: ZetaDbResult<ZetaDbTickReadout>;
      try {
        executed = await options.execute(handoffRequest(options, batch.value));
      } catch {
        return failed(
          "receipt-handoff-downstream-threw",
          "The injected target ZetaDB executor threw before acknowledging persistence.",
        );
      }
      return executed.ok ? handoffAcknowledgement(options, batch.value, executed.value) : executed;
    },
  });
}
