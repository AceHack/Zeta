export const BROWSER_CHECKPOINT_RECORD_SCHEMA = "zeta.browser-checkpoint-record.v1" as const;

export interface BrowserCheckpointRecord {
  readonly schema: typeof BROWSER_CHECKPOINT_RECORD_SCHEMA;
  readonly nodeId: string;
  readonly revision: number;
  readonly payload: Uint8Array;
}

export interface BrowserCheckpointFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "checkpoint-record-invalid"
    | "checkpoint-revision-conflict"
    | "checkpoint-store-closed"
    | "checkpoint-read-failed"
    | "checkpoint-write-failed"
    | "checkpoint-delete-failed"
    | "checkpoint-close-failed";
  readonly detail: string;
}

export type BrowserCheckpointResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserCheckpointFeedback };

/** Technology-neutral checkpoint boundary implemented by browser persistence adapters. */
export interface BrowserCheckpointPort {
  load(nodeId: string): Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>>;
  save(record: BrowserCheckpointRecord): Promise<BrowserCheckpointResult<BrowserCheckpointRecord>>;
  remove(nodeId: string, throughRevision: number): Promise<BrowserCheckpointResult<boolean>>;
  close(): BrowserCheckpointResult<null>;
}

export type BrowserCheckpointSaveDecision =
  | { readonly action: "write"; readonly record: BrowserCheckpointRecord }
  | { readonly action: "idempotent"; readonly record: BrowserCheckpointRecord };

export type BrowserCheckpointRemovalDecision =
  | { readonly action: "remove"; readonly record: BrowserCheckpointRecord }
  | { readonly action: "missing" };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function samePayload(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function browserCheckpointSucceeded<T>(value: T): BrowserCheckpointResult<T> {
  return { ok: true, value };
}

export function browserCheckpointFailed(
  code: BrowserCheckpointFeedback["code"],
  detail: string,
  severity: BrowserCheckpointFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserCheckpointFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

export function copyBrowserCheckpointRecord(record: BrowserCheckpointRecord): BrowserCheckpointRecord {
  return { ...record, payload: new Uint8Array(record.payload) };
}

export function validateBrowserCheckpointRecord(value: unknown): BrowserCheckpointResult<BrowserCheckpointRecord> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_CHECKPOINT_RECORD_SCHEMA ||
    !isIdentifier(value.nodeId) ||
    !isRevision(value.revision) ||
    !(value.payload instanceof Uint8Array)
  ) {
    return browserCheckpointFailed(
      "checkpoint-record-invalid",
      "A browser checkpoint must carry the current schema, a node identifier, a non-negative safe revision, and bytes.",
    );
  }
  return browserCheckpointSucceeded(
    copyBrowserCheckpointRecord({
      schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
      nodeId: value.nodeId,
      revision: value.revision,
      payload: value.payload,
    }),
  );
}

export function decideBrowserCheckpointSave(
  existingValue: unknown | null,
  candidateValue: unknown,
): BrowserCheckpointResult<BrowserCheckpointSaveDecision> {
  const candidate = validateBrowserCheckpointRecord(candidateValue);
  if (!candidate.ok) return candidate;
  if (existingValue === null) {
    return browserCheckpointSucceeded({ action: "write", record: candidate.value });
  }

  const existing = validateBrowserCheckpointRecord(existingValue);
  if (!existing.ok) return existing;
  if (existing.value.nodeId !== candidate.value.nodeId) {
    return browserCheckpointFailed(
      "checkpoint-record-invalid",
      `Stored checkpoint node ${existing.value.nodeId} does not match candidate node ${candidate.value.nodeId}.`,
    );
  }
  if (candidate.value.revision < existing.value.revision) {
    return browserCheckpointFailed(
      "checkpoint-revision-conflict",
      `Checkpoint revision ${String(candidate.value.revision)} is older than stored revision ${String(existing.value.revision)}.`,
      "backpressure",
    );
  }
  if (candidate.value.revision === existing.value.revision) {
    if (!samePayload(candidate.value.payload, existing.value.payload)) {
      return browserCheckpointFailed(
        "checkpoint-revision-conflict",
        `Checkpoint revision ${String(candidate.value.revision)} already names different bytes.`,
        "backpressure",
      );
    }
    return browserCheckpointSucceeded({ action: "idempotent", record: candidate.value });
  }
  return browserCheckpointSucceeded({ action: "write", record: candidate.value });
}

export function decideBrowserCheckpointRemoval(
  existingValue: unknown | null,
  nodeId: unknown,
  throughRevision: unknown,
): BrowserCheckpointResult<BrowserCheckpointRemovalDecision> {
  if (!isIdentifier(nodeId) || !isRevision(throughRevision)) {
    return browserCheckpointFailed(
      "checkpoint-record-invalid",
      "Checkpoint removal requires a node identifier and safe revision.",
    );
  }
  if (existingValue === null) return browserCheckpointSucceeded({ action: "missing" });

  const existing = validateBrowserCheckpointRecord(existingValue);
  if (!existing.ok) return existing;
  if (existing.value.nodeId !== nodeId) {
    return browserCheckpointFailed(
      "checkpoint-record-invalid",
      `Stored checkpoint node ${existing.value.nodeId} does not match removal node ${nodeId}.`,
    );
  }
  if (existing.value.revision > throughRevision) {
    return browserCheckpointFailed(
      "checkpoint-revision-conflict",
      `Stored checkpoint revision ${String(existing.value.revision)} is newer than removal revision ${String(throughRevision)}.`,
      "backpressure",
    );
  }
  return browserCheckpointSucceeded({ action: "remove", record: existing.value });
}
