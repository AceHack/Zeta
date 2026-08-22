export const ZETA_DB_IMAGE_SCHEMA = "zeta.db.image.v1" as const;
export const ZETA_DB_TICK_SCHEMA = "zeta.db.tick.v1" as const;

export type ZetaDbExecutorKind =
  | "browser-tab"
  | "dedicated-worker"
  | "shared-worker"
  | "service-worker-event"
  | "local-process"
  | "cloud-process"
  | "github-actions";

export interface ZetaDbDelta {
  readonly eventId: string;
  readonly rowKey: string;
  readonly payload: string;
  readonly weight: number;
}

export interface ZetaDbRow {
  readonly rowKey: string;
  readonly payload: string;
  readonly weight: number;
}

export interface ZetaDbImage {
  readonly schema: typeof ZETA_DB_IMAGE_SCHEMA;
  readonly nodeId: string;
  readonly revision: number;
  readonly entries: readonly ZetaDbDelta[];
  readonly rows: readonly ZetaDbRow[];
}

export interface ZetaDbImageRecord {
  readonly nodeId: string;
  readonly revision: number;
  readonly payload: Uint8Array;
}

export interface ZetaDbFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "database-request-invalid"
    | "database-image-invalid"
    | "database-image-non-canonical"
    | "database-event-conflict"
    | "database-row-conflict"
    | "database-weight-overflow"
    | "database-capacity-exhausted"
    | "database-read-failed"
    | "database-write-failed"
    | "database-revision-conflict";
  readonly detail: string;
}

export type ZetaDbResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: ZetaDbFeedback };

export interface ZetaDbImagePort {
  load(nodeId: string): Promise<ZetaDbResult<ZetaDbImageRecord | null>>;
  save(record: ZetaDbImageRecord): Promise<ZetaDbResult<ZetaDbImageRecord>>;
  close(): ZetaDbResult<null>;
}

export interface ZetaDbTickLimits {
  readonly maxDeltas: number;
  readonly maxEntries: number;
  readonly maxCheckpointBytes: number;
}

export interface ZetaDbTickRequest {
  readonly nodeId: string;
  readonly executorId: string;
  readonly executorKind: ZetaDbExecutorKind;
  /** Reject the whole tick unless the durable image is still at this revision. */
  readonly expectedRevision?: number;
  /** Reject the whole tick when its complete delta batch cannot be admitted. */
  readonly requireComplete?: boolean;
  readonly deltas: readonly ZetaDbDelta[];
  readonly limits: ZetaDbTickLimits;
}

export interface ZetaDbTickReadout {
  readonly schema: typeof ZETA_DB_TICK_SCHEMA;
  readonly nodeId: string;
  readonly executorId: string;
  readonly executorKind: ZetaDbExecutorKind;
  readonly revision: number;
  readonly admission: "complete" | "backpressured";
  readonly accepted: number;
  readonly duplicates: number;
  readonly nextDeltaIndex: number;
  readonly rows: readonly ZetaDbRow[];
  readonly feedback: readonly ZetaDbFeedback[];
}

const EXECUTOR_KINDS: ReadonlySet<ZetaDbExecutorKind> = new Set([
  "browser-tab",
  "dedicated-worker",
  "shared-worker",
  "service-worker-event",
  "local-process",
  "cloud-process",
  "github-actions",
]);

function succeeded<T>(value: T): ZetaDbResult<T> {
  return { ok: true, value };
}

function failed(
  code: ZetaDbFeedback["code"],
  detail: string,
  severity: ZetaDbFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: ZetaDbFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value !== 0;
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function sameDelta(left: ZetaDbDelta, right: ZetaDbDelta): boolean {
  return (
    left.eventId === right.eventId &&
    left.rowKey === right.rowKey &&
    left.payload === right.payload &&
    left.weight === right.weight
  );
}

function copyDelta(delta: ZetaDbDelta): ZetaDbDelta {
  return { eventId: delta.eventId, rowKey: delta.rowKey, payload: delta.payload, weight: delta.weight };
}

function copyRow(row: ZetaDbRow): ZetaDbRow {
  return { rowKey: row.rowKey, payload: row.payload, weight: row.weight };
}

function copyImage(image: ZetaDbImage): ZetaDbImage {
  return {
    schema: ZETA_DB_IMAGE_SCHEMA,
    nodeId: image.nodeId,
    revision: image.revision,
    entries: image.entries.map(copyDelta),
    rows: image.rows.map(copyRow),
  };
}

function validateDelta(value: unknown): ZetaDbResult<ZetaDbDelta> {
  if (
    !isRecord(value) ||
    !isIdentifier(value.eventId) ||
    !isIdentifier(value.rowKey) ||
    typeof value.payload !== "string" ||
    !isWeight(value.weight)
  ) {
    return failed(
      "database-request-invalid",
      "Each database delta requires bounded event and row identifiers, a string payload, and a non-zero safe-integer weight.",
    );
  }
  return succeeded({ eventId: value.eventId, rowKey: value.rowKey, payload: value.payload, weight: value.weight });
}

function foldRows(entries: readonly ZetaDbDelta[]): ZetaDbResult<readonly ZetaDbRow[]> {
  const rows = new Map<string, ZetaDbRow>();
  for (const entry of entries) {
    const current = rows.get(entry.rowKey);
    if (current !== undefined && current.payload !== entry.payload) {
      return failed(
        "database-row-conflict",
        `Row key ${entry.rowKey} names more than one payload. Row keys must identify complete row values.`,
      );
    }
    const nextWeight = (current?.weight ?? 0) + entry.weight;
    if (!Number.isSafeInteger(nextWeight)) {
      return failed(
        "database-weight-overflow",
        `Row ${entry.rowKey} exceeded safe-integer signed-weight accounting.`,
        "backpressure",
      );
    }
    if (nextWeight === 0) rows.delete(entry.rowKey);
    else rows.set(entry.rowKey, { rowKey: entry.rowKey, payload: entry.payload, weight: nextWeight });
  }
  return succeeded([...rows.values()].sort((left, right) => compareOrdinal(left.rowKey, right.rowKey)));
}

function validateImage(value: unknown): ZetaDbResult<ZetaDbImage> {
  if (
    !isRecord(value) ||
    value.schema !== ZETA_DB_IMAGE_SCHEMA ||
    !isIdentifier(value.nodeId) ||
    !isRevision(value.revision) ||
    !Array.isArray(value.entries) ||
    !Array.isArray(value.rows)
  ) {
    return failed(
      "database-image-invalid",
      "A database image requires the current schema, node identifier, revision, event ledger, and materialized rows.",
    );
  }

  const entries: ZetaDbDelta[] = [];
  const byEvent = new Map<string, ZetaDbDelta>();
  for (const candidate of value.entries) {
    const decoded = validateDelta(candidate);
    if (!decoded.ok) return failed("database-image-invalid", decoded.feedback.detail);
    const existing = byEvent.get(decoded.value.eventId);
    if (existing !== undefined) {
      return failed("database-image-invalid", `Database image repeats event identifier ${decoded.value.eventId}.`);
    }
    byEvent.set(decoded.value.eventId, decoded.value);
    entries.push(decoded.value);
  }

  const folded = foldRows(entries);
  if (!folded.ok) return folded;
  const rows: ZetaDbRow[] = [];
  for (const candidate of value.rows) {
    if (
      !isRecord(candidate) ||
      !isIdentifier(candidate.rowKey) ||
      typeof candidate.payload !== "string" ||
      !isWeight(candidate.weight)
    ) {
      return failed("database-image-invalid", "A materialized row in the database image is invalid.");
    }
    rows.push({ rowKey: candidate.rowKey, payload: candidate.payload, weight: candidate.weight });
  }
  if (JSON.stringify(rows) !== JSON.stringify(folded.value)) {
    return failed("database-image-invalid", "Materialized rows do not equal the fold of the retained event ledger.");
  }
  return succeeded(
    copyImage({ schema: ZETA_DB_IMAGE_SCHEMA, nodeId: value.nodeId, revision: value.revision, entries, rows }),
  );
}

export function emptyZetaDbImage(nodeId: string): ZetaDbResult<ZetaDbImage> {
  if (!isIdentifier(nodeId)) return failed("database-request-invalid", "A database node identifier must be non-empty.");
  return succeeded({ schema: ZETA_DB_IMAGE_SCHEMA, nodeId, revision: 0, entries: [], rows: [] });
}

export function encodeZetaDbImage(imageValue: unknown): ZetaDbResult<Uint8Array> {
  const image = validateImage(imageValue);
  if (!image.ok) return image;
  try {
    return succeeded(
      new TextEncoder().encode(
        JSON.stringify({
          schema: ZETA_DB_IMAGE_SCHEMA,
          nodeId: image.value.nodeId,
          revision: image.value.revision,
          entries: image.value.entries,
          rows: image.value.rows,
        }),
      ),
    );
  } catch (error) {
    return failed("database-image-invalid", `Database image encoding failed: ${String(error)}`);
  }
}

export function decodeZetaDbImage(payload: Uint8Array): ZetaDbResult<ZetaDbImage> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload));
  } catch (error) {
    return failed("database-image-invalid", `Database image decoding failed: ${String(error)}`);
  }
  const image = validateImage(parsed);
  if (!image.ok) return image;
  const canonical = encodeZetaDbImage(image.value);
  if (!canonical.ok) return canonical;
  if (!sameBytes(payload, canonical.value)) {
    return failed("database-image-non-canonical", "Database image bytes are valid but not canonical.");
  }
  return image;
}

function validateRequest(request: ZetaDbTickRequest): ZetaDbResult<readonly ZetaDbDelta[]> {
  if (
    !isIdentifier(request.nodeId) ||
    !isIdentifier(request.executorId) ||
    !EXECUTOR_KINDS.has(request.executorKind) ||
    (request.expectedRevision !== undefined && !isRevision(request.expectedRevision)) ||
    (request.requireComplete !== undefined && typeof request.requireComplete !== "boolean") ||
    !Number.isSafeInteger(request.limits.maxDeltas) ||
    request.limits.maxDeltas < 1 ||
    !Number.isSafeInteger(request.limits.maxEntries) ||
    request.limits.maxEntries < 1 ||
    !Number.isSafeInteger(request.limits.maxCheckpointBytes) ||
    request.limits.maxCheckpointBytes < 1
  ) {
    return failed(
      "database-request-invalid",
      "A database tick requires identifiers, a known executor kind, and positive safe-integer budgets.",
    );
  }
  const deltas: ZetaDbDelta[] = [];
  const byEvent = new Map<string, ZetaDbDelta>();
  for (const candidate of request.deltas) {
    const decoded = validateDelta(candidate);
    if (!decoded.ok) return decoded;
    const existing = byEvent.get(decoded.value.eventId);
    if (existing !== undefined && !sameDelta(existing, decoded.value)) {
      return failed(
        "database-event-conflict",
        `Event identifier ${decoded.value.eventId} names conflicting deltas in one tick.`,
      );
    }
    byEvent.set(decoded.value.eventId, decoded.value);
    deltas.push(decoded.value);
  }
  return succeeded(deltas);
}

function mapPortFailure(feedback: ZetaDbFeedback, operation: "read" | "write"): ZetaDbResult<never> {
  if (feedback.code === "database-revision-conflict") return { ok: false, feedback };
  return failed(
    operation === "read" ? "database-read-failed" : "database-write-failed",
    feedback.detail,
    feedback.severity,
  );
}

async function loadZetaDbImage(port: ZetaDbImagePort, nodeId: string): Promise<ZetaDbResult<ZetaDbImage>> {
  const loaded = await port.load(nodeId);
  if (!loaded.ok) return mapPortFailure(loaded.feedback, "read");
  if (loaded.value === null) return emptyZetaDbImage(nodeId);
  if (loaded.value.nodeId !== nodeId || loaded.value.revision < 0) {
    return failed("database-image-invalid", "The image port returned a record for the wrong node or revision.");
  }
  const decoded = decodeZetaDbImage(loaded.value.payload);
  if (!decoded.ok) return decoded;
  if (decoded.value.nodeId !== loaded.value.nodeId || decoded.value.revision !== loaded.value.revision) {
    return failed("database-image-invalid", "The image record metadata does not match its canonical payload.");
  }
  return decoded;
}

interface ZetaDbAdmissionReadout {
  readonly entries: readonly ZetaDbDelta[];
  readonly rows: readonly ZetaDbRow[];
  readonly accepted: number;
  readonly duplicates: number;
  readonly nextDeltaIndex: number;
  readonly capacityDetail: string | null;
}

interface ZetaDbAdmissionState {
  readonly existingEvents: Map<string, ZetaDbDelta>;
  readonly rowMap: Map<string, ZetaDbRow>;
  readonly entries: ZetaDbDelta[];
  entryItemBytes: number;
  rowItemBytes: number;
  accepted: number;
  duplicates: number;
  nextDeltaIndex: number;
}

interface ZetaDbRowTransition {
  readonly current: ZetaDbRow | undefined;
  readonly next: ZetaDbRow | null;
}

function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function imageBaseByteLength(nodeId: string, revision: number): number {
  return jsonByteLength({ schema: ZETA_DB_IMAGE_SCHEMA, nodeId, revision, entries: [], rows: [] });
}

function collectionByteLength(itemBytes: number, count: number): number {
  return itemBytes + Math.max(0, count - 1);
}

function sortedRows(state: ZetaDbAdmissionState): readonly ZetaDbRow[] {
  return [...state.rowMap.values()].sort((left, right) => compareOrdinal(left.rowKey, right.rowKey));
}

function admissionReadout(state: ZetaDbAdmissionState, capacityDetail: string | null): ZetaDbAdmissionReadout {
  return {
    entries: state.entries,
    rows: sortedRows(state),
    accepted: state.accepted,
    duplicates: state.duplicates,
    nextDeltaIndex: state.nextDeltaIndex,
    capacityDetail,
  };
}

function planRowTransition(state: ZetaDbAdmissionState, delta: ZetaDbDelta): ZetaDbResult<ZetaDbRowTransition> {
  const current = state.rowMap.get(delta.rowKey);
  if (current !== undefined && current.payload !== delta.payload) {
    return failed(
      "database-row-conflict",
      `Row key ${delta.rowKey} names more than one payload. Row keys must identify complete row values.`,
    );
  }
  const nextWeight = (current?.weight ?? 0) + delta.weight;
  if (!Number.isSafeInteger(nextWeight)) {
    return failed(
      "database-weight-overflow",
      `Row ${delta.rowKey} exceeded safe-integer signed-weight accounting.`,
      "backpressure",
    );
  }
  const next = nextWeight === 0 ? null : { rowKey: delta.rowKey, payload: delta.payload, weight: nextWeight };
  return succeeded({ current, next });
}

function candidateRowCount(state: ZetaDbAdmissionState, transition: ZetaDbRowTransition): number {
  let count = state.rowMap.size;
  if (transition.current === undefined && transition.next !== null) count += 1;
  if (transition.current !== undefined && transition.next === null) count -= 1;
  return count;
}

function admitNewDelta(
  state: ZetaDbAdmissionState,
  delta: ZetaDbDelta,
  baseBytes: number,
  limits: ZetaDbTickLimits,
): ZetaDbResult<string | null> {
  if (state.entries.length >= limits.maxEntries) {
    return succeeded(`The retained event ledger reached its ${String(limits.maxEntries)}-entry no-forget budget.`);
  }
  const transition = planRowTransition(state, delta);
  if (!transition.ok) return transition;
  const currentRowBytes = transition.value.current === undefined ? 0 : jsonByteLength(transition.value.current);
  const nextRowBytes = transition.value.next === null ? 0 : jsonByteLength(transition.value.next);
  const nextEntryItemBytes = state.entryItemBytes + jsonByteLength(delta);
  const nextRowItemBytes = state.rowItemBytes - currentRowBytes + nextRowBytes;
  const nextRowCount = candidateRowCount(state, transition.value);
  const candidateBytes =
    baseBytes +
    collectionByteLength(nextEntryItemBytes, state.entries.length + 1) +
    collectionByteLength(nextRowItemBytes, nextRowCount);
  if (candidateBytes > limits.maxCheckpointBytes) {
    return succeeded(
      `The next database image needs ${String(candidateBytes)} bytes; the no-forget checkpoint budget is ${String(limits.maxCheckpointBytes)} bytes.`,
    );
  }

  state.entries.push(delta);
  state.existingEvents.set(delta.eventId, delta);
  if (transition.value.next === null) state.rowMap.delete(delta.rowKey);
  else state.rowMap.set(delta.rowKey, transition.value.next);
  state.entryItemBytes = nextEntryItemBytes;
  state.rowItemBytes = nextRowItemBytes;
  state.accepted += 1;
  return succeeded(null);
}

function admitZetaDbDeltas(
  image: ZetaDbImage,
  deltas: readonly ZetaDbDelta[],
  limits: ZetaDbTickLimits,
): ZetaDbResult<ZetaDbAdmissionReadout> {
  const state: ZetaDbAdmissionState = {
    existingEvents: new Map(image.entries.map((entry) => [entry.eventId, entry])),
    rowMap: new Map(image.rows.map((row) => [row.rowKey, row])),
    entries: [...image.entries],
    entryItemBytes: image.entries.reduce((total, entry) => total + jsonByteLength(entry), 0),
    rowItemBytes: image.rows.reduce((total, row) => total + jsonByteLength(row), 0),
    accepted: 0,
    duplicates: 0,
    nextDeltaIndex: 0,
  };
  const processThrough = Math.min(deltas.length, limits.maxDeltas);
  const baseBytes = imageBaseByteLength(image.nodeId, image.revision + 1);

  for (const [index, delta] of deltas.slice(0, processThrough).entries()) {
    const existing = state.existingEvents.get(delta.eventId);
    if (existing !== undefined) {
      if (!sameDelta(existing, delta)) {
        return failed("database-event-conflict", `Event identifier ${delta.eventId} already names a different delta.`);
      }
      state.duplicates += 1;
      state.nextDeltaIndex = index + 1;
      continue;
    }
    const admitted = admitNewDelta(state, delta, baseBytes, limits);
    if (!admitted.ok) return admitted;
    if (admitted.value !== null) return succeeded(admissionReadout(state, admitted.value));
    state.nextDeltaIndex = index + 1;
  }

  const capacityDetail =
    state.nextDeltaIndex < deltas.length
      ? `The tick spent its ${String(limits.maxDeltas)}-delta execution budget.`
      : null;
  return succeeded(admissionReadout(state, capacityDetail));
}

/**
 * Execute one finite database wake-up. The executor may disappear after this promise resolves;
 * all continuity is carried by the image port and the returned continuation index.
 */
export async function runZetaDbNodeTick(
  port: ZetaDbImagePort,
  request: ZetaDbTickRequest,
): Promise<ZetaDbResult<ZetaDbTickReadout>> {
  const validated = validateRequest(request);
  if (!validated.ok) return validated;
  const image = await loadZetaDbImage(port, request.nodeId);
  if (!image.ok) return image;
  if (request.expectedRevision !== undefined && image.value.revision !== request.expectedRevision) {
    return failed(
      "database-revision-conflict",
      `Database revision ${String(image.value.revision)} does not match expected revision ${String(request.expectedRevision)}.`,
      "backpressure",
    );
  }
  const admission = admitZetaDbDeltas(image.value, validated.value, request.limits);
  if (!admission.ok) return admission;
  if (request.requireComplete === true && admission.value.capacityDetail !== null) {
    return failed("database-capacity-exhausted", admission.value.capacityDetail, "backpressure");
  }

  let revision = image.value.revision;
  if (admission.value.accepted > 0) {
    revision += 1;
    const nextImage: ZetaDbImage = {
      schema: ZETA_DB_IMAGE_SCHEMA,
      nodeId: request.nodeId,
      revision,
      entries: admission.value.entries,
      rows: admission.value.rows,
    };
    const payload = encodeZetaDbImage(nextImage);
    if (!payload.ok) return payload;
    const saved = await port.save({ nodeId: request.nodeId, revision, payload: payload.value });
    if (!saved.ok) return mapPortFailure(saved.feedback, "write");
  }

  const feedback: readonly ZetaDbFeedback[] =
    admission.value.capacityDetail === null
      ? []
      : [
          {
            severity: "backpressure",
            code: "database-capacity-exhausted",
            detail: admission.value.capacityDetail,
          },
        ];
  return succeeded({
    schema: ZETA_DB_TICK_SCHEMA,
    nodeId: request.nodeId,
    executorId: request.executorId,
    executorKind: request.executorKind,
    revision,
    admission: admission.value.capacityDetail === null ? "complete" : "backpressured",
    accepted: admission.value.accepted,
    duplicates: admission.value.duplicates,
    nextDeltaIndex: admission.value.nextDeltaIndex,
    rows: admission.value.rows.map(copyRow),
    feedback,
  });
}

/** Reference durable port used by local, cloud, and deterministic-simulation tests. */
export function createInMemoryZetaDbImagePort(): ZetaDbImagePort {
  const records = new Map<string, ZetaDbImageRecord>();
  let closed = false;

  const unavailable = (): ZetaDbResult<never> =>
    failed("database-read-failed", "The in-memory database image port is closed.");
  return {
    load: (nodeId) => {
      if (closed) return Promise.resolve(unavailable());
      const value = records.get(nodeId);
      return Promise.resolve(
        succeeded(value === undefined ? null : { ...value, payload: new Uint8Array(value.payload) }),
      );
    },
    save: (candidate) => {
      if (closed)
        return Promise.resolve(failed("database-write-failed", "The in-memory database image port is closed."));
      const existing = records.get(candidate.nodeId);
      if (existing === undefined && candidate.revision !== 1) {
        return Promise.resolve(
          failed(
            "database-revision-conflict",
            "The first durable database image must have revision 1.",
            "backpressure",
          ),
        );
      }
      if (existing !== undefined) {
        if (candidate.revision === existing.revision && sameBytes(candidate.payload, existing.payload)) {
          return Promise.resolve(succeeded({ ...candidate, payload: new Uint8Array(candidate.payload) }));
        }
        if (candidate.revision !== existing.revision + 1) {
          return Promise.resolve(
            failed(
              "database-revision-conflict",
              `Database revision ${String(candidate.revision)} cannot follow stored revision ${String(existing.revision)}.`,
              "backpressure",
            ),
          );
        }
      }
      const stored = { ...candidate, payload: new Uint8Array(candidate.payload) };
      records.set(candidate.nodeId, stored);
      return Promise.resolve(succeeded({ ...stored, payload: new Uint8Array(stored.payload) }));
    },
    close: () => {
      closed = true;
      return succeeded(null);
    },
  };
}
