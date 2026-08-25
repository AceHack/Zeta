import {
  compareAndSwapRevisionPolicy,
  type RevisionPolicyPort,
  type RevisionPolicyRefusal,
} from "../persistence/revision-policy";
import {
  noForgetBackpressureAdmissionPolicy,
  type ZetaDbAdmissionAccounting,
  type ZetaDbAdmissionDecision,
  type ZetaDbAdmissionPolicyPort,
  type ZetaDbAdmissionProposal,
  type ZetaDbAdmissionReceipt,
} from "./admission-policy";
import {
  evaluateZetaDbRetentionPolicy,
  type ZetaDbRetentionFeedback,
  type ZetaDbRetentionHeatReceipt,
  type ZetaDbRetentionPolicyPort,
  type ZetaDbRetentionReceipt,
} from "./retention-policy";

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
    | "database-admission-policy-failed"
    | "database-retention-request-invalid"
    | "database-retention-policy-failed"
    | "database-retention-displaced"
    | "database-read-failed"
    | "database-write-failed"
    | "database-revision-conflict";
  readonly detail: string;
  /** Exact resource accounting when an admission policy produced the feedback. */
  readonly admissionReceipt?: ZetaDbAdmissionReceipt;
  /** Exact loss accounting when an applied retention decision displaced durable history. */
  readonly retentionHeatReceipt?: ZetaDbRetentionHeatReceipt;
}

export type ZetaDbResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: ZetaDbFeedback };

export interface ZetaDbImagePort {
  /**
   * Executable revision contract. The adapter applies its decision atomically with `save`.
   *
   * `runConvergentZetaDbNodeTick`'s bounded-retry convergence (#13929) is proved against
   * `compareAndSwapRevisionPolicy`. Other policies require their own convergence evidence.
   */
  readonly revisionPolicy: RevisionPolicyPort;
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
  /** Present only when this tick executed an explicit retained-set policy. */
  readonly retentionReceipt?: ZetaDbRetentionReceipt;
}

export interface ZetaDbConvergencePolicy {
  /** Total finite attempts, including the first execution. */
  readonly maxAttempts: number;
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
  admissionReceipt?: ZetaDbAdmissionReceipt,
): { readonly ok: false; readonly feedback: ZetaDbFeedback } {
  return admissionReceipt === undefined
    ? { ok: false, feedback: { severity, code, detail } }
    : { ok: false, feedback: { severity, code, detail, admissionReceipt } };
}

function revisionRefused(refusal: RevisionPolicyRefusal): { readonly ok: false; readonly feedback: ZetaDbFeedback } {
  return failed(
    refusal.reason === "node-mismatch" ? "database-image-invalid" : "database-revision-conflict",
    refusal.detail,
    refusal.reason === "node-mismatch" ? "heat" : "backpressure",
  );
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

/**
 * The one canonical order for a retained event ledger: ordinal by `eventId`.
 *
 * 081KZM0FTJM — `entries` used to persist in ARRIVAL order, so two cells holding the
 * same state serialised to different bytes. Git then saw a real diff, last-writer-wins
 * clobbered, and content-addressing could not dedup. Ordering by `eventId` makes the
 * image a pure function of the delta SET, which is what makes concurrent folds on
 * runners + local hardware + browser tabs CONVERGE instead of race — convergence, not
 * a distributed lock (a lock would be a central point of coordination, §1 scale-free,
 * and would not survive a browser tab going offline).
 *
 * Event identifiers are unique within an image (`validateImage` and the admission path
 * both reject repeats), so this is a total order and the canonical form is unique.
 *
 * Ordinal, never culture-sensitive: the same bytes must be produced on every locale.
 */
function canonicalEntryOrder(entries: readonly ZetaDbDelta[]): readonly ZetaDbDelta[] {
  return [...entries].sort((left, right) => compareOrdinal(left.eventId, right.eventId));
}

/**
 * Fold the retained ledger into materialized rows — a Z-set fold: signed weights are
 * summed per `(rowKey, payload)`, zero-weight pairs vanish, and a row is well-formed
 * when at most one payload survives under its key.
 *
 * 081KZM0FTJM — this is the commutative-monoid half of the convergence property. The
 * previous fold summed weights per `rowKey` alone and rejected the moment an incoming
 * payload differed from the running one, which made the *conflict verdict* depend on
 * arrival order across a zero-weight crossing: an ordinary retract-then-emit update was
 * accepted in one order and refused in the other. Summing per `(rowKey, payload)` and
 * checking well-formedness once at the end makes the fold a pure function of the entry
 * SET, so every substrate reaches the same verdict and the same rows. Weight addition
 * is commutative and associative with `0` as identity; the well-formedness check is a
 * post-condition on the result, not a step of the fold.
 *
 * The accumulation still runs in canonical order so that even the partial sums — and
 * therefore which overflow is reported — replay identically (DST).
 */
function foldRows(entries: readonly ZetaDbDelta[]): ZetaDbResult<readonly ZetaDbRow[]> {
  const weightsByRow = new Map<string, Map<string, number>>();
  for (const entry of canonicalEntryOrder(entries)) {
    let weights = weightsByRow.get(entry.rowKey);
    if (weights === undefined) {
      weights = new Map<string, number>();
      weightsByRow.set(entry.rowKey, weights);
    }
    const nextWeight = (weights.get(entry.payload) ?? 0) + entry.weight;
    if (!Number.isSafeInteger(nextWeight)) {
      return failed(
        "database-weight-overflow",
        `Row ${entry.rowKey} exceeded safe-integer signed-weight accounting.`,
        "backpressure",
      );
    }
    weights.set(entry.payload, nextWeight);
  }

  const rows: ZetaDbRow[] = [];
  for (const rowKey of [...weightsByRow.keys()].sort(compareOrdinal)) {
    const surviving = [...(weightsByRow.get(rowKey) ?? new Map<string, number>()).entries()].filter(
      ([, weight]) => weight !== 0,
    );
    if (surviving.length > 1) {
      return failed(
        "database-row-conflict",
        `Row key ${rowKey} names more than one payload. Row keys must identify complete row values.`,
        "backpressure",
      );
    }
    for (const [payload, weight] of surviving) rows.push({ rowKey, payload, weight });
  }
  return succeeded(rows);
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
    copyImage({
      schema: ZETA_DB_IMAGE_SCHEMA,
      nodeId: value.nodeId,
      revision: value.revision,
      entries: canonicalEntryOrder(entries),
      rows,
    }),
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
  readonly capacityReceipt: ZetaDbAdmissionReceipt | null;
  readonly retentionReceipt: ZetaDbRetentionReceipt | null;
}

interface ZetaDbAdmissionRefusal {
  readonly detail: string;
  readonly receipt: ZetaDbAdmissionReceipt | null;
}

interface ZetaDbEvaluatedAdmissionDecision {
  readonly decision: ZetaDbAdmissionDecision;
  readonly policyId: string;
}

interface ZetaDbAdmissionState {
  readonly existingEvents: Map<string, ZetaDbDelta>;
  /**
   * Surviving signed weight per `(rowKey, payload)` pair, keyed by `rowPairKey`.
   *
   * 081KZM0FTJM — this used to be keyed by `rowKey` alone, which forced the
   * well-formedness check ("a row key names one payload") to run per delta, on the
   * running materialized row. That made the verdict depend on arrival order: a
   * retract-then-emit update was admitted, and the same two deltas in the other order
   * were refused with `database-row-conflict`. Keying by the pair defers the check to
   * `foldRows` at the end of the batch, where it is a post-condition on the admitted
   * SET and every substrate reaches it identically.
   */
  readonly rowWeights: Map<string, ZetaDbRow>;
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

/**
 * Close the admission. `state.rowWeights` carries running per-`(rowKey, payload)` weights
 * because the byte budgets are charged as deltas land, and it deliberately does NOT decide
 * well-formedness; the rows the tick reports and persists are the fold of the admitted
 * SET, so the end-of-batch fold is where "a row key names one payload" is settled — once,
 * order-independently, for every substrate (081KZM0FTJM).
 *
 * `entries` stay in arrival order here; `validateImage` is the single point that puts a
 * ledger into canonical order, so every path that serialises an image — this one and any
 * caller of `encodeZetaDbImage` — is canonical by construction rather than by discipline.
 */
function admissionReadout(
  state: ZetaDbAdmissionState,
  refusal: ZetaDbAdmissionRefusal | null,
): ZetaDbResult<ZetaDbAdmissionReadout> {
  const rows = foldRows(state.entries);
  if (!rows.ok) return rows;
  return succeeded({
    entries: state.entries,
    rows: rows.value,
    accepted: state.accepted,
    duplicates: state.duplicates,
    nextDeltaIndex: state.nextDeltaIndex,
    capacityDetail: refusal?.detail ?? null,
    capacityReceipt: refusal?.receipt ?? null,
    retentionReceipt: null,
  });
}

/** Unambiguous key for a `(rowKey, payload)` pair — both halves are arbitrary strings,
 *  so the pair is encoded rather than concatenated with a separator that could occur. */
function rowPairKey(rowKey: string, payload: string): string {
  return JSON.stringify([rowKey, payload]);
}

function planRowTransition(state: ZetaDbAdmissionState, delta: ZetaDbDelta): ZetaDbResult<ZetaDbRowTransition> {
  const current = state.rowWeights.get(rowPairKey(delta.rowKey, delta.payload));
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
  let count = state.rowWeights.size;
  if (transition.current === undefined && transition.next !== null) count += 1;
  if (transition.current !== undefined && transition.next === null) count -= 1;
  return count;
}

function validAdmissionAccounting(
  value: unknown,
  proposal: ZetaDbAdmissionProposal,
): value is ZetaDbAdmissionAccounting {
  if (!isRecord(value)) return false;
  return (
    value.resource === proposal.resource &&
    value.current === proposal.current &&
    value.candidate === proposal.candidate &&
    value.hardLimit === proposal.limit &&
    typeof value.reserved === "number" &&
    Number.isSafeInteger(value.reserved) &&
    value.reserved >= 0 &&
    value.reserved <= proposal.limit &&
    typeof value.effectiveLimit === "number" &&
    Number.isSafeInteger(value.effectiveLimit) &&
    value.effectiveLimit === proposal.limit - value.reserved
  );
}

function snapshotAdmissionAccounting(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    resource: value.resource,
    current: value.current,
    candidate: value.candidate,
    hardLimit: value.hardLimit,
    effectiveLimit: value.effectiveLimit,
    reserved: value.reserved,
  };
}

function snapshotAdmissionDecision(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const action = value.action;
  if (action === "admit") return { action };
  const accounting = value.accounting;
  return accounting === undefined
    ? { action, detail: value.detail }
    : { action, detail: value.detail, accounting: snapshotAdmissionAccounting(accounting) };
}

function validAdmissionDecision(value: unknown, proposal: ZetaDbAdmissionProposal): value is ZetaDbAdmissionDecision {
  if (!isRecord(value)) return false;
  if (value.action === "admit") return true;
  return (
    value.action === "backpressure" &&
    typeof value.detail === "string" &&
    value.detail.length > 0 &&
    (value.accounting === undefined || validAdmissionAccounting(value.accounting, proposal))
  );
}

function decideAdmission(
  policy: ZetaDbAdmissionPolicyPort,
  proposal: ZetaDbAdmissionProposal,
): ZetaDbResult<ZetaDbEvaluatedAdmissionDecision> {
  const hardLimit = noForgetBackpressureAdmissionPolicy.decide(proposal);
  if (hardLimit.action === "backpressure") {
    return succeeded({ decision: hardLimit, policyId: noForgetBackpressureAdmissionPolicy.id });
  }

  let policyId = "<unreadable>";
  try {
    if (!isRecord(policy) || typeof policy.id !== "string" || policy.id.length === 0) {
      return failed(
        "database-admission-policy-failed",
        "The injected database admission policy does not implement a named decide function.",
      );
    }
    policyId = policy.id;
    if (typeof policy.decide !== "function") {
      return failed(
        "database-admission-policy-failed",
        "The injected database admission policy does not implement a named decide function.",
      );
    }
    const decision = snapshotAdmissionDecision(policy.decide(proposal));
    return validAdmissionDecision(decision, proposal)
      ? succeeded({ decision, policyId })
      : failed(
          "database-admission-policy-failed",
          `Database admission policy ${policyId} returned an invalid decision.`,
        );
  } catch (error) {
    return failed("database-admission-policy-failed", `Database admission policy ${policyId} failed: ${String(error)}`);
  }
}

function admissionRefusal(value: ZetaDbEvaluatedAdmissionDecision): ZetaDbAdmissionRefusal | null {
  if (value.decision.action === "admit") return null;
  const receipt =
    value.decision.accounting === undefined
      ? null
      : {
          ...value.decision.accounting,
          policyId: value.policyId,
        };
  return { detail: value.decision.detail, receipt };
}

function admitNewDelta(
  state: ZetaDbAdmissionState,
  delta: ZetaDbDelta,
  baseBytes: number,
  limits: ZetaDbTickLimits,
  policy: ZetaDbAdmissionPolicyPort,
): ZetaDbResult<ZetaDbAdmissionRefusal | null> {
  const entryDecision = decideAdmission(policy, {
    resource: "retained-events",
    current: state.entries.length,
    candidate: state.entries.length + 1,
    limit: limits.maxEntries,
  });
  if (!entryDecision.ok) return entryDecision;
  const entryRefusal = admissionRefusal(entryDecision.value);
  if (entryRefusal !== null) return succeeded(entryRefusal);

  const transition = planRowTransition(state, delta);
  if (!transition.ok) return transition;
  const currentRowBytes = transition.value.current === undefined ? 0 : jsonByteLength(transition.value.current);
  const nextRowBytes = transition.value.next === null ? 0 : jsonByteLength(transition.value.next);
  const nextEntryItemBytes = state.entryItemBytes + jsonByteLength(delta);
  const nextRowItemBytes = state.rowItemBytes - currentRowBytes + nextRowBytes;
  const nextRowCount = candidateRowCount(state, transition.value);
  const currentBytes =
    baseBytes +
    collectionByteLength(state.entryItemBytes, state.entries.length) +
    collectionByteLength(state.rowItemBytes, state.rowWeights.size);
  const candidateBytes =
    baseBytes +
    collectionByteLength(nextEntryItemBytes, state.entries.length + 1) +
    collectionByteLength(nextRowItemBytes, nextRowCount);
  const checkpointDecision = decideAdmission(policy, {
    resource: "checkpoint-bytes",
    current: currentBytes,
    candidate: candidateBytes,
    limit: limits.maxCheckpointBytes,
  });
  if (!checkpointDecision.ok) return checkpointDecision;
  const checkpointRefusal = admissionRefusal(checkpointDecision.value);
  if (checkpointRefusal !== null) return succeeded(checkpointRefusal);

  state.entries.push(delta);
  state.existingEvents.set(delta.eventId, delta);
  const pairKey = rowPairKey(delta.rowKey, delta.payload);
  if (transition.value.next === null) state.rowWeights.delete(pairKey);
  else state.rowWeights.set(pairKey, transition.value.next);
  state.entryItemBytes = nextEntryItemBytes;
  state.rowItemBytes = nextRowItemBytes;
  state.accepted += 1;
  return succeeded(null);
}

function admitZetaDbDeltas(
  image: ZetaDbImage,
  deltas: readonly ZetaDbDelta[],
  limits: ZetaDbTickLimits,
  policy: ZetaDbAdmissionPolicyPort,
): ZetaDbResult<ZetaDbAdmissionReadout> {
  const state: ZetaDbAdmissionState = {
    existingEvents: new Map(image.entries.map((entry) => [entry.eventId, entry])),
    rowWeights: new Map(image.rows.map((row) => [rowPairKey(row.rowKey, row.payload), row])),
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
    const admitted = admitNewDelta(state, delta, baseBytes, limits, policy);
    if (!admitted.ok) return admitted;
    if (admitted.value !== null) return admissionReadout(state, admitted.value);
    state.nextDeltaIndex = index + 1;
  }

  const capacityRefusal =
    state.nextDeltaIndex < deltas.length
      ? {
          detail: `The tick spent its ${String(limits.maxDeltas)}-delta execution budget.`,
          receipt: null,
        }
      : null;
  return admissionReadout(state, capacityRefusal);
}

function retentionFailure(feedback: ZetaDbRetentionFeedback): ZetaDbResult<never> {
  return failed(feedback.code, feedback.detail);
}

function unappliedRetentionReadout(
  image: ZetaDbImage,
  refusal: ZetaDbAdmissionRefusal,
): ZetaDbResult<ZetaDbAdmissionReadout> {
  return succeeded({
    entries: image.entries,
    rows: image.rows,
    accepted: 0,
    duplicates: 0,
    nextDeltaIndex: 0,
    capacityDetail: refusal.detail,
    capacityReceipt: refusal.receipt,
    retentionReceipt: null,
  });
}

function retentionCapacityDetail(
  receipt: ZetaDbRetentionReceipt,
  processed: number,
  total: number,
  maxDeltas: number,
): string | null {
  const details: string[] = [];
  if (receipt.refusedEventIds.length > 0) {
    const bound =
      receipt.resource === "retained-events"
        ? `${String(receipt.limit)}-entry bound`
        : `${String(receipt.limit)}-byte checkpoint bound`;
    details.push(
      `Retention policy ${receipt.policyId} refused ${String(receipt.refusedEventIds.length)} novel event(s) at the ${bound}.`,
    );
  }
  if (processed < total) details.push(`The tick spent its ${String(maxDeltas)}-delta execution budget.`);
  return details.length === 0 ? null : details.join(" ");
}

interface ZetaDbRetentionCandidates {
  readonly observed: ReadonlyMap<string, ZetaDbDelta>;
  readonly novelEventIds: ReadonlySet<string>;
  readonly duplicates: number;
}

function collectRetentionCandidates(
  image: ZetaDbImage,
  processed: readonly ZetaDbDelta[],
): ZetaDbResult<ZetaDbRetentionCandidates> {
  const observed = new Map(image.entries.map((entry) => [entry.eventId, entry]));
  const novelEventIds = new Set<string>();
  let duplicates = 0;
  for (const delta of processed) {
    const existing = observed.get(delta.eventId);
    if (existing === undefined) {
      observed.set(delta.eventId, delta);
      novelEventIds.add(delta.eventId);
      continue;
    }
    if (!sameDelta(existing, delta)) {
      return failed("database-event-conflict", `Event identifier ${delta.eventId} already names a different delta.`);
    }
    duplicates += 1;
  }
  return succeeded({ observed, novelEventIds, duplicates });
}

function materializeRetainedEntries(
  receipt: ZetaDbRetentionReceipt,
  observed: ReadonlyMap<string, ZetaDbDelta>,
): ZetaDbResult<readonly ZetaDbDelta[]> {
  const entries: ZetaDbDelta[] = [];
  for (const eventId of receipt.retainedEventIds) {
    const entry = observed.get(eventId);
    if (entry === undefined) {
      return failed(
        "database-retention-policy-failed",
        `Database retention policy ${receipt.policyId} selected unavailable event ${eventId}.`,
      );
    }
    entries.push(entry);
  }
  return succeeded(entries);
}

function sameEventIdSet(left: readonly ZetaDbDelta[], retainedEventIds: readonly string[]): boolean {
  if (left.length !== retainedEventIds.length) return false;
  const retained = new Set(retainedEventIds);
  return left.every((entry) => retained.has(entry.eventId));
}

function measureRetentionCheckpointBytes(
  image: ZetaDbImage,
  observed: ReadonlyMap<string, ZetaDbDelta>,
  retainedEventIds: readonly string[],
): number | null {
  const entries: ZetaDbDelta[] = [];
  for (const eventId of retainedEventIds) {
    const entry = observed.get(eventId);
    if (entry === undefined) return null;
    entries.push(entry);
  }
  const rows = foldRows(entries);
  if (!rows.ok) return null;
  const revision = sameEventIdSet(image.entries, retainedEventIds) ? image.revision : image.revision + 1;
  const encoded = encodeZetaDbImage({ ...image, revision, entries, rows: rows.value });
  return encoded.ok ? encoded.value.byteLength : null;
}

function decideRetentionMutationAdmission(
  image: ZetaDbImage,
  entries: readonly ZetaDbDelta[],
  rows: readonly ZetaDbRow[],
  limits: ZetaDbTickLimits,
  policy: ZetaDbAdmissionPolicyPort,
): ZetaDbResult<ZetaDbAdmissionRefusal | null> {
  const entryDecision = decideAdmission(policy, {
    resource: "retained-events",
    current: image.entries.length,
    candidate: entries.length,
    limit: limits.maxEntries,
  });
  if (!entryDecision.ok) return entryDecision;
  const entryRefusal = admissionRefusal(entryDecision.value);
  if (entryRefusal !== null) return succeeded(entryRefusal);

  const nextRevision = image.revision + 1;
  const currentPayload = encodeZetaDbImage({ ...image, revision: nextRevision });
  if (!currentPayload.ok) return currentPayload;
  const candidatePayload = encodeZetaDbImage({ ...image, revision: nextRevision, entries, rows });
  if (!candidatePayload.ok) return candidatePayload;
  const checkpointDecision = decideAdmission(policy, {
    resource: "checkpoint-bytes",
    current: currentPayload.value.byteLength,
    candidate: candidatePayload.value.byteLength,
    limit: limits.maxCheckpointBytes,
  });
  if (!checkpointDecision.ok) return checkpointDecision;
  return succeeded(admissionRefusal(checkpointDecision.value));
}

/**
 * Apply an explicit retained-set policy as one finite batch. A byte-aware policy may query exact
 * candidate image sizes through a kernel-owned measurement capability; the admission policy still
 * rechecks the final entry reservation and encoded checkpoint-byte budget. A byte refusal leaves
 * the durable image and continuation untouched.
 */
function retainZetaDbDeltas(
  image: ZetaDbImage,
  deltas: readonly ZetaDbDelta[],
  limits: ZetaDbTickLimits,
  admissionPolicy: ZetaDbAdmissionPolicyPort,
  retentionPolicy: ZetaDbRetentionPolicyPort,
): ZetaDbResult<ZetaDbAdmissionReadout> {
  const processThrough = Math.min(deltas.length, limits.maxDeltas);
  const processed = deltas.slice(0, processThrough);
  const candidates = collectRetentionCandidates(image, processed);
  if (!candidates.ok) return candidates;

  const planned = evaluateZetaDbRetentionPolicy(
    retentionPolicy,
    {
      currentEventIds: image.entries.map((entry) => entry.eventId),
      candidateEventIds: processed.map((delta) => delta.eventId),
      limit: limits.maxEntries,
    },
    {
      maxCheckpointBytes: limits.maxCheckpointBytes,
      measureCheckpointBytes: (retainedEventIds) =>
        measureRetentionCheckpointBytes(image, candidates.value.observed, retainedEventIds),
    },
  );
  if (!planned.ok) return retentionFailure(planned.feedback);

  const entries = materializeRetainedEntries(planned.value, candidates.value.observed);
  if (!entries.ok) return entries;
  const rows = foldRows(entries.value);
  if (!rows.ok) return rows;
  const accepted = planned.value.retainedEventIds.filter((eventId) =>
    candidates.value.novelEventIds.has(eventId),
  ).length;
  const changed = accepted > 0 || planned.value.displacedEventIds.length > 0;

  if (changed) {
    const mutationAdmission = decideRetentionMutationAdmission(
      image,
      entries.value,
      rows.value,
      limits,
      admissionPolicy,
    );
    if (!mutationAdmission.ok) return mutationAdmission;
    if (mutationAdmission.value !== null) return unappliedRetentionReadout(image, mutationAdmission.value);
  }

  return succeeded({
    entries: entries.value,
    rows: rows.value,
    accepted,
    duplicates: candidates.value.duplicates,
    nextDeltaIndex: processThrough,
    capacityDetail: retentionCapacityDetail(planned.value, processThrough, deltas.length, limits.maxDeltas),
    capacityReceipt: null,
    retentionReceipt: planned.value,
  });
}

function admissionFeedback(value: ZetaDbAdmissionReadout): readonly ZetaDbFeedback[] {
  const feedback: ZetaDbFeedback[] = [];
  if (value.capacityDetail !== null) {
    const capacity: ZetaDbFeedback = {
      severity: "backpressure",
      code: "database-capacity-exhausted",
      detail: value.capacityDetail,
    };
    feedback.push(value.capacityReceipt === null ? capacity : { ...capacity, admissionReceipt: value.capacityReceipt });
  }
  for (const receipt of value.retentionReceipt?.heatReceipts ?? []) {
    feedback.push({
      severity: "heat",
      code: "database-retention-displaced",
      detail: receipt.detail,
      retentionHeatReceipt: receipt,
    });
  }
  return feedback;
}

/**
 * Execute one finite database wake-up. The executor may disappear after this promise resolves;
 * all continuity is carried by the image port and the returned continuation index.
 * Supplying a retention policy opts this tick into batch retained-set selection; omitting it
 * preserves the append-only no-forget behavior and its exact prefix continuation semantics.
 */
export async function runZetaDbNodeTick(
  port: ZetaDbImagePort,
  request: ZetaDbTickRequest,
  admissionPolicy: ZetaDbAdmissionPolicyPort = noForgetBackpressureAdmissionPolicy,
  retentionPolicy?: ZetaDbRetentionPolicyPort,
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
  const admission =
    retentionPolicy === undefined
      ? admitZetaDbDeltas(image.value, validated.value, request.limits, admissionPolicy)
      : retainZetaDbDeltas(image.value, validated.value, request.limits, admissionPolicy, retentionPolicy);
  if (!admission.ok) return admission;
  if (request.requireComplete === true && admission.value.capacityDetail !== null) {
    return failed(
      "database-capacity-exhausted",
      admission.value.capacityDetail,
      "backpressure",
      admission.value.capacityReceipt ?? undefined,
    );
  }

  let revision = image.value.revision;
  if (admission.value.accepted > 0 || (admission.value.retentionReceipt?.displacedEventIds.length ?? 0) > 0) {
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

  const feedback = admissionFeedback(admission.value);
  const retentionReadout =
    admission.value.retentionReceipt === null ? {} : { retentionReceipt: admission.value.retentionReceipt };
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
    ...retentionReadout,
  });
}

/**
 * Reapply one logical tick after a transient conflict at the durable boundary.
 *
 * Explicit `expectedRevision` requests are compare-and-swap operations, so their
 * predicate is never weakened by retrying. Ordinary idempotent event batches may
 * reload and fold again after either a revision race or a row prefix that another
 * concurrent batch can complete, but only within the caller's finite attempt budget.
 *
 * PRECONDITION on the port (081M0Q8TQYE087G0R001WBX1ZC): the convergence this retry provides was established
 * against `compareAndSwapRevisionPolicy`, because the retry is driven by the port REFUSING
 * a revision another writer already took. A policy that refuses fewer writes needs its own
 * convergence evidence. This remains a documented precondition rather than silently
 * changing the browser path's established monotone behavior.
 */
export async function runConvergentZetaDbNodeTick(
  port: ZetaDbImagePort,
  request: ZetaDbTickRequest,
  policy: ZetaDbConvergencePolicy,
  admissionPolicy: ZetaDbAdmissionPolicyPort = noForgetBackpressureAdmissionPolicy,
  retentionPolicy?: ZetaDbRetentionPolicyPort,
): Promise<ZetaDbResult<ZetaDbTickReadout>> {
  if (
    !isRecord(policy) ||
    typeof policy.maxAttempts !== "number" ||
    !Number.isSafeInteger(policy.maxAttempts) ||
    policy.maxAttempts < 1
  ) {
    return failed(
      "database-request-invalid",
      "A database convergence policy requires a positive safe-integer attempt budget.",
    );
  }

  const maxAttempts = policy.maxAttempts;
  let lastConflict: ZetaDbFeedback | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runZetaDbNodeTick(port, request, admissionPolicy, retentionPolicy);
    if (result.ok) return result;
    if (result.feedback.code !== "database-revision-conflict" && result.feedback.code !== "database-row-conflict")
      return result;
    if (request.expectedRevision !== undefined) return result;
    lastConflict = result.feedback;
  }

  return failed(
    lastConflict?.code ?? "database-revision-conflict",
    `Database tick spent its ${String(maxAttempts)}-attempt convergence budget. Last conflict: ${lastConflict?.detail ?? "durable state changed"}`,
    "backpressure",
  );
}

/** Reference durable port used by local, cloud, and deterministic-simulation tests. */
export function createInMemoryZetaDbImagePort(): ZetaDbImagePort {
  const records = new Map<string, ZetaDbImageRecord>();
  let closed = false;

  const unavailable = (): ZetaDbResult<never> =>
    failed("database-read-failed", "The in-memory database image port is closed.");
  return {
    revisionPolicy: compareAndSwapRevisionPolicy,
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
      const existing = records.get(candidate.nodeId) ?? null;
      const decision = compareAndSwapRevisionPolicy.decide(existing, candidate);
      if (!decision.ok) return Promise.resolve(revisionRefused(decision.refusal));
      if (decision.value.action === "idempotent")
        return Promise.resolve(succeeded({ ...candidate, payload: new Uint8Array(candidate.payload) }));
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
