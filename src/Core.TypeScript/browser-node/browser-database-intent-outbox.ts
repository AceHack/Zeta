import type { ZetaDbDelta, ZetaDbExecutorKind, ZetaDbTickReadout } from "../zetadb/zeta-db-node";

export const BROWSER_DATABASE_INTENT_SCHEMA = "zeta.browser-database-intent.v2" as const;
export const BROWSER_DATABASE_EXECUTION_RECEIPT_SCHEMA = "zeta.browser-database-execution-receipt.v1" as const;
export const BROWSER_DATABASE_INTENT_LEDGER_SCHEMA = "zeta.browser-database-intent-ledger.v2" as const;
export const BROWSER_DATABASE_INTENT_READOUT_SCHEMA = "zeta.browser-database-intent-readout.v2" as const;

const LEGACY_BROWSER_DATABASE_INTENT_SCHEMA = "zeta.browser-database-intent.v1";
const LEGACY_BROWSER_DATABASE_INTENT_LEDGER_SCHEMA = "zeta.browser-database-intent-ledger.v1";

export interface BrowserDatabaseIntentLimits {
  readonly maxIntents: number;
  readonly maxReceipts: number;
  readonly maxLedgerBytes: number;
}

export interface BrowserDatabaseIntentDraft {
  readonly databaseNodeId: string;
  readonly intentId: string;
  readonly expectedRevision: number | null;
  readonly deltas: readonly ZetaDbDelta[];
}

export interface BrowserDatabaseIntentRefusal {
  readonly severity: "backpressure" | "heat";
  readonly code: string;
  readonly detail: string;
}

export interface BrowserDatabaseIntentRecord extends BrowserDatabaseIntentDraft {
  readonly schema: typeof BROWSER_DATABASE_INTENT_SCHEMA;
  readonly sequence: number;
  readonly status: "queued" | "executing" | "refused";
  readonly refusal: BrowserDatabaseIntentRefusal | null;
}

export interface BrowserDatabaseExecutionReceipt {
  readonly schema: typeof BROWSER_DATABASE_EXECUTION_RECEIPT_SCHEMA;
  readonly databaseNodeId: string;
  readonly intentId: string;
  readonly sequence: number;
  readonly status: "settled";
  readonly executorId: string;
  readonly executorKind: ZetaDbExecutorKind;
  readonly revision: number;
  readonly accepted: number;
  readonly duplicates: number;
  readonly deltaCount: number;
}

export interface BrowserDatabaseIntentLedger {
  readonly schema: typeof BROWSER_DATABASE_INTENT_LEDGER_SCHEMA;
  readonly databaseNodeId: string;
  readonly nextSequence: number;
  readonly intents: readonly BrowserDatabaseIntentRecord[];
  readonly receipts: readonly BrowserDatabaseExecutionReceipt[];
}

export interface BrowserDatabaseIntentReadout {
  readonly schema: typeof BROWSER_DATABASE_INTENT_READOUT_SCHEMA;
  readonly databaseNodeId: string;
  readonly admission: "open" | "backpressured";
  readonly nextSequence: number;
  readonly ledgerBytes: number;
  readonly queued: number;
  readonly executing: number;
  readonly settled: number;
  readonly refused: number;
  readonly intents: readonly BrowserDatabaseIntentRecord[];
  readonly receipts: readonly BrowserDatabaseExecutionReceipt[];
}

export interface BrowserDatabaseIntentFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "intent-configuration-invalid"
    | "intent-record-invalid"
    | "intent-conflict"
    | "intent-capacity-exhausted"
    | "intent-sequence-exhausted"
    | "intent-store-closed"
    | "intent-read-failed"
    | "intent-write-failed"
    | "intent-close-failed";
  readonly detail: string;
}

export type BrowserDatabaseIntentResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseIntentFeedback };

export interface BrowserDatabaseIntentOutboxPort {
  enqueue(draft: BrowserDatabaseIntentDraft): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentRecord>>;
  read(databaseNodeId: string): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout>>;
  begin(
    databaseNodeId: string,
    intentId: string,
    sequence: number,
  ): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentRecord>>;
  settle(
    databaseNodeId: string,
    intentId: string,
    sequence: number,
    tick: ZetaDbTickReadout,
  ): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout>>;
  acknowledgeArchive(
    receipt: BrowserDatabaseExecutionReceipt,
  ): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout>>;
  refuse(
    databaseNodeId: string,
    intentId: string,
    sequence: number,
    refusal: BrowserDatabaseIntentRefusal,
  ): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout>>;
  close(): BrowserDatabaseIntentResult<null>;
}

export interface BrowserDatabaseIntentLedgerDecision<T> {
  readonly ledger: BrowserDatabaseIntentLedger;
  readonly value: T;
}

function succeeded<T>(value: T): BrowserDatabaseIntentResult<T> {
  return { ok: true, value };
}

export function browserDatabaseIntentFailed(
  code: BrowserDatabaseIntentFeedback["code"],
  detail: string,
  severity: BrowserDatabaseIntentFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserDatabaseIntentFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) return true;
  }
  return false;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !hasControlCharacter(value);
}

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value !== 0;
}

function isExpectedRevision(value: unknown): value is number | null {
  return value === null || isSequence(value);
}

const EXECUTOR_KINDS: ReadonlySet<string> = new Set([
  "browser-tab",
  "dedicated-worker",
  "shared-worker",
  "service-worker-event",
  "local-process",
  "cloud-process",
  "github-actions",
]);

export function validateBrowserDatabaseIntentLimits(
  value: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLimits> {
  if (
    !isRecord(value) ||
    typeof value.maxIntents !== "number" ||
    !Number.isSafeInteger(value.maxIntents) ||
    value.maxIntents < 1 ||
    typeof value.maxReceipts !== "number" ||
    !Number.isSafeInteger(value.maxReceipts) ||
    value.maxReceipts < 1 ||
    typeof value.maxLedgerBytes !== "number" ||
    !Number.isSafeInteger(value.maxLedgerBytes) ||
    value.maxLedgerBytes < 1
  ) {
    return browserDatabaseIntentFailed(
      "intent-configuration-invalid",
      "A browser database intent outbox requires positive safe-integer intent, receipt, and byte budgets.",
    );
  }
  return succeeded({
    maxIntents: value.maxIntents,
    maxReceipts: value.maxReceipts,
    maxLedgerBytes: value.maxLedgerBytes,
  });
}

function copyDelta(delta: ZetaDbDelta): ZetaDbDelta {
  return { eventId: delta.eventId, rowKey: delta.rowKey, payload: delta.payload, weight: delta.weight };
}

function copyRefusal(refusal: BrowserDatabaseIntentRefusal | null): BrowserDatabaseIntentRefusal | null {
  return refusal === null ? null : { ...refusal };
}

export function copyBrowserDatabaseIntent(record: BrowserDatabaseIntentRecord): BrowserDatabaseIntentRecord {
  return { ...record, deltas: record.deltas.map(copyDelta), refusal: copyRefusal(record.refusal) };
}

export function copyBrowserDatabaseExecutionReceipt(
  receipt: BrowserDatabaseExecutionReceipt,
): BrowserDatabaseExecutionReceipt {
  return { ...receipt };
}

export function copyBrowserDatabaseIntentLedger(ledger: BrowserDatabaseIntentLedger): BrowserDatabaseIntentLedger {
  return {
    ...ledger,
    intents: ledger.intents.map(copyBrowserDatabaseIntent),
    receipts: ledger.receipts.map(copyBrowserDatabaseExecutionReceipt),
  };
}

function validateDelta(value: unknown): BrowserDatabaseIntentResult<ZetaDbDelta> {
  if (
    !isRecord(value) ||
    !isIdentifier(value.eventId) ||
    !isIdentifier(value.rowKey) ||
    typeof value.payload !== "string" ||
    !isWeight(value.weight)
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "Each durable intent delta requires printable event and row identifiers, a string payload, and a non-zero safe-integer weight.",
    );
  }
  return succeeded({ eventId: value.eventId, rowKey: value.rowKey, payload: value.payload, weight: value.weight });
}

function validateRefusal(value: unknown): BrowserDatabaseIntentResult<BrowserDatabaseIntentRefusal | null> {
  if (value === null) return succeeded(null);
  if (
    !isRecord(value) ||
    (value.severity !== "backpressure" && value.severity !== "heat") ||
    !isIdentifier(value.code) ||
    typeof value.detail !== "string" ||
    value.detail.length > 4096 ||
    hasControlCharacter(value.detail)
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "A refused browser database intent requires bounded printable feedback.",
    );
  }
  return succeeded({ severity: value.severity, code: value.code, detail: value.detail });
}

export function validateBrowserDatabaseIntentDraft(
  value: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentDraft> {
  if (
    !isRecord(value) ||
    !isIdentifier(value.databaseNodeId) ||
    !isIdentifier(value.intentId) ||
    !isExpectedRevision(value.expectedRevision) ||
    !Array.isArray(value.deltas) ||
    value.deltas.length === 0
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "A browser database intent requires identifiers, optional revision evidence, and at least one delta.",
    );
  }
  const deltas: ZetaDbDelta[] = [];
  for (const candidate of value.deltas) {
    const delta = validateDelta(candidate);
    if (!delta.ok) return delta;
    deltas.push(delta.value);
  }
  return succeeded({
    databaseNodeId: value.databaseNodeId,
    intentId: value.intentId,
    expectedRevision: value.expectedRevision,
    deltas,
  });
}

export function validateBrowserDatabaseIntent(
  value: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentRecord> {
  if (
    !isRecord(value) ||
    (value.schema !== BROWSER_DATABASE_INTENT_SCHEMA && value.schema !== LEGACY_BROWSER_DATABASE_INTENT_SCHEMA) ||
    !isSequence(value.sequence)
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "A stored browser database intent requires the current schema and a safe sequence.",
    );
  }
  const draft = validateBrowserDatabaseIntentDraft(value);
  if (!draft.ok) return draft;
  const status = value.status === "pending" ? "queued" : value.status;
  if (status !== "queued" && status !== "executing" && status !== "refused") {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "A stored browser database intent has an unknown status.",
    );
  }
  const refusal = validateRefusal(value.refusal);
  if (!refusal.ok) return refusal;
  if (
    ((status === "queued" || status === "executing") && refusal.value !== null) ||
    (status === "refused" && refusal.value === null)
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "A queued or executing intent cannot carry refusal feedback and a refused intent must carry it.",
    );
  }
  return succeeded({
    schema: BROWSER_DATABASE_INTENT_SCHEMA,
    ...draft.value,
    sequence: value.sequence,
    status,
    refusal: refusal.value,
  });
}

export function validateBrowserDatabaseExecutionReceipt(
  value: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseExecutionReceipt> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_DATABASE_EXECUTION_RECEIPT_SCHEMA ||
    !isIdentifier(value.databaseNodeId) ||
    !isIdentifier(value.intentId) ||
    !isSequence(value.sequence) ||
    value.status !== "settled" ||
    !isIdentifier(value.executorId) ||
    typeof value.executorKind !== "string" ||
    !EXECUTOR_KINDS.has(value.executorKind) ||
    !isSequence(value.revision) ||
    !isSequence(value.accepted) ||
    !isSequence(value.duplicates) ||
    !isSequence(value.deltaCount) ||
    value.accepted + value.duplicates !== value.deltaCount
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "A settled database execution receipt requires bounded identity, executor, revision, and complete delta counts.",
    );
  }
  return succeeded({
    schema: BROWSER_DATABASE_EXECUTION_RECEIPT_SCHEMA,
    databaseNodeId: value.databaseNodeId,
    intentId: value.intentId,
    sequence: value.sequence,
    status: "settled",
    executorId: value.executorId,
    executorKind: value.executorKind as ZetaDbExecutorKind,
    revision: value.revision,
    accepted: value.accepted,
    duplicates: value.duplicates,
    deltaCount: value.deltaCount,
  });
}

export function emptyBrowserDatabaseIntentLedger(
  databaseNodeId: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedger> {
  if (!isIdentifier(databaseNodeId)) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "An intent ledger requires a database node identifier.",
    );
  }
  return succeeded({
    schema: BROWSER_DATABASE_INTENT_LEDGER_SCHEMA,
    databaseNodeId,
    nextSequence: 0,
    intents: [],
    receipts: [],
  });
}

interface ValidatedIntentRecords {
  readonly intents: readonly BrowserDatabaseIntentRecord[];
  readonly intentIds: ReadonlySet<string>;
  readonly sequences: ReadonlySet<number>;
}

function validateIntentRecords(
  databaseNodeId: string,
  nextSequence: number,
  candidates: readonly unknown[],
): BrowserDatabaseIntentResult<ValidatedIntentRecords> {
  const intents: BrowserDatabaseIntentRecord[] = [];
  const intentIds = new Set<string>();
  const sequences = new Set<number>();
  let previousSequence = -1;
  for (const candidate of candidates) {
    const intent = validateBrowserDatabaseIntent(candidate);
    if (!intent.ok) return intent;
    if (intent.value.databaseNodeId !== databaseNodeId) {
      return browserDatabaseIntentFailed("intent-record-invalid", "An intent ledger contains another database node.");
    }
    if (
      intentIds.has(intent.value.intentId) ||
      sequences.has(intent.value.sequence) ||
      intent.value.sequence <= previousSequence
    ) {
      return browserDatabaseIntentFailed(
        "intent-record-invalid",
        "An intent ledger must contain unique identifiers in strictly increasing sequence order.",
      );
    }
    if (intent.value.sequence >= nextSequence) {
      return browserDatabaseIntentFailed(
        "intent-record-invalid",
        "An intent ledger next sequence must be greater than every retained intent sequence.",
      );
    }
    intentIds.add(intent.value.intentId);
    sequences.add(intent.value.sequence);
    previousSequence = intent.value.sequence;
    intents.push(intent.value);
  }
  return succeeded({ intents, intentIds, sequences });
}

function validateReceiptRecords(
  databaseNodeId: string,
  nextSequence: number,
  candidates: readonly unknown[],
  retained: ValidatedIntentRecords,
): BrowserDatabaseIntentResult<readonly BrowserDatabaseExecutionReceipt[]> {
  const receipts: BrowserDatabaseExecutionReceipt[] = [];
  const intentIds = new Set(retained.intentIds);
  const sequences = new Set(retained.sequences);
  let previousSequence = -1;
  for (const candidate of candidates) {
    const receipt = validateBrowserDatabaseExecutionReceipt(candidate);
    if (!receipt.ok) return receipt;
    if (receipt.value.databaseNodeId !== databaseNodeId) {
      return browserDatabaseIntentFailed(
        "intent-record-invalid",
        "An intent ledger contains another database node receipt.",
      );
    }
    if (
      intentIds.has(receipt.value.intentId) ||
      sequences.has(receipt.value.sequence) ||
      receipt.value.sequence <= previousSequence
    ) {
      return browserDatabaseIntentFailed(
        "intent-record-invalid",
        "An intent ledger must contain unique receipt identities in strictly increasing sequence order.",
      );
    }
    if (receipt.value.sequence >= nextSequence) {
      return browserDatabaseIntentFailed(
        "intent-record-invalid",
        "An intent ledger next sequence must be greater than every retained receipt sequence.",
      );
    }
    intentIds.add(receipt.value.intentId);
    sequences.add(receipt.value.sequence);
    previousSequence = receipt.value.sequence;
    receipts.push(receipt.value);
  }
  return succeeded(receipts);
}

export function validateBrowserDatabaseIntentLedger(
  value: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedger> {
  if (
    !isRecord(value) ||
    (value.schema !== BROWSER_DATABASE_INTENT_LEDGER_SCHEMA &&
      value.schema !== LEGACY_BROWSER_DATABASE_INTENT_LEDGER_SCHEMA) ||
    !isIdentifier(value.databaseNodeId) ||
    !isSequence(value.nextSequence) ||
    !Array.isArray(value.intents) ||
    (value.receipts !== undefined && !Array.isArray(value.receipts))
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "A browser database intent ledger requires the current schema, node identity, sequence, and intent list.",
    );
  }
  const intents = validateIntentRecords(value.databaseNodeId, value.nextSequence, value.intents);
  if (!intents.ok) return intents;
  const receipts = validateReceiptRecords(
    value.databaseNodeId,
    value.nextSequence,
    value.receipts ?? [],
    intents.value,
  );
  if (!receipts.ok) return receipts;
  return succeeded({
    schema: BROWSER_DATABASE_INTENT_LEDGER_SCHEMA,
    databaseNodeId: value.databaseNodeId,
    nextSequence: value.nextSequence,
    intents: intents.value.intents,
    receipts: receipts.value,
  });
}

function sameDelta(left: ZetaDbDelta, right: ZetaDbDelta): boolean {
  return (
    left.eventId === right.eventId &&
    left.rowKey === right.rowKey &&
    left.payload === right.payload &&
    left.weight === right.weight
  );
}

function sameDraft(record: BrowserDatabaseIntentRecord, draft: BrowserDatabaseIntentDraft): boolean {
  if (
    record.databaseNodeId !== draft.databaseNodeId ||
    record.intentId !== draft.intentId ||
    record.expectedRevision !== draft.expectedRevision ||
    record.deltas.length !== draft.deltas.length
  ) {
    return false;
  }
  return record.deltas.every((delta, index) => {
    const candidate = draft.deltas[index];
    return candidate !== undefined && sameDelta(delta, candidate);
  });
}

function ledgerBytes(ledger: BrowserDatabaseIntentLedger): number {
  return new TextEncoder().encode(JSON.stringify(ledger)).byteLength;
}

function activeIntentCount(ledger: BrowserDatabaseIntentLedger): number {
  return ledger.intents.filter((intent) => intent.status === "queued" || intent.status === "executing").length;
}

export function browserDatabaseIntentReadout(
  ledgerValue: unknown,
  limitsValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout> {
  const ledger = validateBrowserDatabaseIntentLedger(ledgerValue);
  if (!ledger.ok) return ledger;
  const limits = validateBrowserDatabaseIntentLimits(limitsValue);
  if (!limits.ok) return limits;
  const bytes = ledgerBytes(ledger.value);
  const refused = ledger.value.intents.filter((intent) => intent.status === "refused").length;
  const queued = ledger.value.intents.filter((intent) => intent.status === "queued").length;
  const executing = ledger.value.intents.filter((intent) => intent.status === "executing").length;
  return succeeded({
    schema: BROWSER_DATABASE_INTENT_READOUT_SCHEMA,
    databaseNodeId: ledger.value.databaseNodeId,
    admission:
      ledger.value.intents.length >= limits.value.maxIntents ||
      ledger.value.receipts.length + activeIntentCount(ledger.value) >= limits.value.maxReceipts ||
      bytes >= limits.value.maxLedgerBytes ||
      ledger.value.nextSequence === Number.MAX_SAFE_INTEGER
        ? "backpressured"
        : "open",
    nextSequence: ledger.value.nextSequence,
    ledgerBytes: bytes,
    queued,
    executing,
    settled: ledger.value.receipts.length,
    refused,
    intents: ledger.value.intents.map(copyBrowserDatabaseIntent),
    receipts: ledger.value.receipts.map(copyBrowserDatabaseExecutionReceipt),
  });
}

function currentLedger(
  existingValue: unknown,
  databaseNodeId: string,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedger> {
  if (existingValue === null) return emptyBrowserDatabaseIntentLedger(databaseNodeId);
  const existing = validateBrowserDatabaseIntentLedger(existingValue);
  if (!existing.ok) return existing;
  return existing.value.databaseNodeId === databaseNodeId
    ? existing
    : browserDatabaseIntentFailed("intent-record-invalid", "The stored intent ledger names another database node.");
}

export function decideBrowserDatabaseIntentEnqueue(
  existingValue: unknown,
  draftValue: unknown,
  limitsValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedgerDecision<BrowserDatabaseIntentRecord>> {
  const draft = validateBrowserDatabaseIntentDraft(draftValue);
  if (!draft.ok) return draft;
  const limits = validateBrowserDatabaseIntentLimits(limitsValue);
  if (!limits.ok) return limits;
  const existing = currentLedger(existingValue, draft.value.databaseNodeId);
  if (!existing.ok) return existing;
  const duplicate = existing.value.intents.find((intent) => intent.intentId === draft.value.intentId);
  if (duplicate !== undefined) {
    return sameDraft(duplicate, draft.value)
      ? succeeded({ ledger: existing.value, value: duplicate })
      : browserDatabaseIntentFailed(
          "intent-conflict",
          `Intent identifier ${draft.value.intentId} already names different work.`,
        );
  }
  const settled = existing.value.receipts.find((receipt) => receipt.intentId === draft.value.intentId);
  if (settled !== undefined) {
    return browserDatabaseIntentFailed(
      "intent-conflict",
      `Intent identifier ${draft.value.intentId} is already represented by settled receipt ${settled.sequence.toString()}.`,
    );
  }
  const reservedReceipts = existing.value.receipts.length + activeIntentCount(existing.value);
  if (reservedReceipts >= limits.value.maxReceipts) {
    return browserDatabaseIntentFailed(
      "intent-capacity-exhausted",
      `The outbox retained or reserved ${reservedReceipts.toString()} receipts and will not erase history to admit another intent.`,
      "backpressure",
    );
  }
  if (existing.value.intents.length >= limits.value.maxIntents) {
    return browserDatabaseIntentFailed(
      "intent-capacity-exhausted",
      `The outbox retained ${existing.value.intents.length.toString()} intents and will not forget one to admit another.`,
      "backpressure",
    );
  }
  if (existing.value.nextSequence === Number.MAX_SAFE_INTEGER) {
    return browserDatabaseIntentFailed(
      "intent-sequence-exhausted",
      "The outbox sequence reached Number.MAX_SAFE_INTEGER and will not wrap.",
      "backpressure",
    );
  }
  const record: BrowserDatabaseIntentRecord = {
    schema: BROWSER_DATABASE_INTENT_SCHEMA,
    ...draft.value,
    sequence: existing.value.nextSequence,
    status: "queued",
    refusal: null,
  };
  const ledger: BrowserDatabaseIntentLedger = {
    ...existing.value,
    nextSequence: existing.value.nextSequence + 1,
    intents: [...existing.value.intents, record],
  };
  const bytes = ledgerBytes(ledger);
  if (bytes > limits.value.maxLedgerBytes) {
    return browserDatabaseIntentFailed(
      "intent-capacity-exhausted",
      `The next intent ledger needs ${bytes.toString()} bytes; the no-forget budget is ${limits.value.maxLedgerBytes.toString()} bytes.`,
      "backpressure",
    );
  }
  return succeeded({ ledger, value: record });
}

function retainedIntent(
  ledger: BrowserDatabaseIntentLedger,
  intentId: unknown,
  sequence: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentRecord | null> {
  if (!isIdentifier(intentId) || !isSequence(sequence)) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "Intent settlement requires an identifier and safe sequence.",
    );
  }
  const intent = ledger.intents.find((candidate) => candidate.intentId === intentId);
  if (intent === undefined) return succeeded(null);
  return intent.sequence === sequence
    ? succeeded(intent)
    : browserDatabaseIntentFailed(
        "intent-conflict",
        `Intent identifier ${intentId} does not match retained sequence ${intent.sequence.toString()}.`,
      );
}

export function decideBrowserDatabaseIntentBegin(
  existingValue: unknown,
  databaseNodeId: unknown,
  intentId: unknown,
  sequence: unknown,
  limitsValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedgerDecision<BrowserDatabaseIntentRecord>> {
  if (!isIdentifier(databaseNodeId)) {
    return browserDatabaseIntentFailed("intent-record-invalid", "Intent execution requires a database node.");
  }
  const limits = validateBrowserDatabaseIntentLimits(limitsValue);
  if (!limits.ok) return limits;
  const existing = currentLedger(existingValue, databaseNodeId);
  if (!existing.ok) return existing;
  const intent = retainedIntent(existing.value, intentId, sequence);
  if (!intent.ok) return intent;
  if (intent.value === null) {
    return browserDatabaseIntentFailed("intent-conflict", `Intent ${String(intentId)} is not retained for execution.`);
  }
  if (intent.value.status === "refused") {
    return browserDatabaseIntentFailed(
      "intent-conflict",
      `Refused intent ${intent.value.intentId} cannot begin execution.`,
    );
  }
  const executing: BrowserDatabaseIntentRecord = { ...intent.value, status: "executing" };
  const ledger: BrowserDatabaseIntentLedger = {
    ...existing.value,
    intents: existing.value.intents.map((candidate) =>
      candidate.intentId === executing.intentId ? executing : candidate,
    ),
  };
  const bytes = ledgerBytes(ledger);
  if (bytes > limits.value.maxLedgerBytes) {
    return browserDatabaseIntentFailed(
      "intent-capacity-exhausted",
      `The executing intent ledger needs ${bytes.toString()} bytes; the no-forget budget is ${limits.value.maxLedgerBytes.toString()} bytes.`,
      "backpressure",
    );
  }
  return succeeded({ ledger, value: executing });
}

function executionReceipt(
  intent: BrowserDatabaseIntentRecord,
  tickValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseExecutionReceipt> {
  if (
    !isRecord(tickValue) ||
    tickValue.schema !== "zeta.db.tick.v1" ||
    tickValue.nodeId !== intent.databaseNodeId ||
    !isIdentifier(tickValue.executorId) ||
    typeof tickValue.executorKind !== "string" ||
    !EXECUTOR_KINDS.has(tickValue.executorKind) ||
    !isSequence(tickValue.revision) ||
    tickValue.admission !== "complete" ||
    !isSequence(tickValue.accepted) ||
    !isSequence(tickValue.duplicates) ||
    !isSequence(tickValue.nextDeltaIndex) ||
    tickValue.nextDeltaIndex !== intent.deltas.length ||
    tickValue.accepted + tickValue.duplicates !== intent.deltas.length
  ) {
    return browserDatabaseIntentFailed(
      "intent-record-invalid",
      "Intent settlement requires a complete database tick for the same node and delta batch.",
    );
  }
  return succeeded({
    schema: BROWSER_DATABASE_EXECUTION_RECEIPT_SCHEMA,
    databaseNodeId: intent.databaseNodeId,
    intentId: intent.intentId,
    sequence: intent.sequence,
    status: "settled",
    executorId: tickValue.executorId,
    executorKind: tickValue.executorKind as ZetaDbExecutorKind,
    revision: tickValue.revision,
    accepted: tickValue.accepted,
    duplicates: tickValue.duplicates,
    deltaCount: intent.deltas.length,
  });
}

function receiptMatchesTick(receipt: BrowserDatabaseExecutionReceipt, tickValue: unknown): boolean {
  return (
    isRecord(tickValue) &&
    tickValue.schema === "zeta.db.tick.v1" &&
    tickValue.nodeId === receipt.databaseNodeId &&
    tickValue.executorId === receipt.executorId &&
    tickValue.executorKind === receipt.executorKind &&
    tickValue.revision === receipt.revision &&
    tickValue.admission === "complete" &&
    tickValue.accepted === receipt.accepted &&
    tickValue.duplicates === receipt.duplicates &&
    tickValue.nextDeltaIndex === receipt.deltaCount
  );
}

function sameExecutionReceipt(left: BrowserDatabaseExecutionReceipt, right: BrowserDatabaseExecutionReceipt): boolean {
  return (
    left.databaseNodeId === right.databaseNodeId &&
    left.intentId === right.intentId &&
    left.sequence === right.sequence &&
    left.executorId === right.executorId &&
    left.executorKind === right.executorKind &&
    left.revision === right.revision &&
    left.accepted === right.accepted &&
    left.duplicates === right.duplicates &&
    left.deltaCount === right.deltaCount
  );
}

export function decideBrowserDatabaseIntentSettlement(
  existingValue: unknown,
  databaseNodeId: unknown,
  intentId: unknown,
  sequence: unknown,
  tickValue: unknown,
  limitsValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedgerDecision<BrowserDatabaseExecutionReceipt>> {
  if (!isIdentifier(databaseNodeId)) {
    return browserDatabaseIntentFailed("intent-record-invalid", "Intent settlement requires a database node.");
  }
  const limits = validateBrowserDatabaseIntentLimits(limitsValue);
  if (!limits.ok) return limits;
  const existing = currentLedger(existingValue, databaseNodeId);
  if (!existing.ok) return existing;
  const intent = retainedIntent(existing.value, intentId, sequence);
  if (!intent.ok) return intent;
  if (intent.value === null) {
    const retained = existing.value.receipts.find((candidate) => candidate.intentId === intentId);
    if (retained === undefined) {
      return browserDatabaseIntentFailed(
        "intent-conflict",
        `Intent ${String(intentId)} is not retained for settlement.`,
      );
    }
    return retained.sequence === sequence && receiptMatchesTick(retained, tickValue)
      ? succeeded({ ledger: existing.value, value: retained })
      : browserDatabaseIntentFailed(
          "intent-conflict",
          `Intent identifier ${String(intentId)} does not match its settled execution receipt.`,
        );
  }
  if (intent.value.status !== "executing") {
    return browserDatabaseIntentFailed(
      "intent-conflict",
      `Intent ${intent.value.intentId} must be executing before it can settle.`,
    );
  }
  if (existing.value.receipts.length >= limits.value.maxReceipts) {
    return browserDatabaseIntentFailed(
      "intent-capacity-exhausted",
      `The outbox retained ${existing.value.receipts.length.toString()} receipts and will not erase one to settle another.`,
      "backpressure",
    );
  }
  const receipt = executionReceipt(intent.value, tickValue);
  if (!receipt.ok) return receipt;
  const ledger: BrowserDatabaseIntentLedger = {
    ...existing.value,
    intents: existing.value.intents.filter((candidate) => candidate.intentId !== intentId),
    receipts: [...existing.value.receipts, receipt.value].sort((left, right) => left.sequence - right.sequence),
  };
  const bytes = ledgerBytes(ledger);
  if (bytes > limits.value.maxLedgerBytes) {
    return browserDatabaseIntentFailed(
      "intent-capacity-exhausted",
      `The settled intent ledger needs ${bytes.toString()} bytes; the no-forget budget is ${limits.value.maxLedgerBytes.toString()} bytes.`,
      "backpressure",
    );
  }
  return succeeded({ ledger, value: receipt.value });
}

export function decideBrowserDatabaseReceiptArchiveAcknowledgement(
  existingValue: unknown,
  receiptValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedger> {
  const receipt = validateBrowserDatabaseExecutionReceipt(receiptValue);
  if (!receipt.ok) return receipt;
  const existing = currentLedger(existingValue, receipt.value.databaseNodeId);
  if (!existing.ok) return existing;
  const retained = existing.value.receipts.find((candidate) => candidate.intentId === receipt.value.intentId);
  if (retained === undefined) return succeeded(existing.value);
  if (!sameExecutionReceipt(retained, receipt.value)) {
    return browserDatabaseIntentFailed(
      "intent-conflict",
      `Archive acknowledgement for ${receipt.value.intentId} does not match its retained execution receipt.`,
    );
  }
  return succeeded({
    ...existing.value,
    receipts: existing.value.receipts.filter((candidate) => candidate.intentId !== receipt.value.intentId),
  });
}

export function decideBrowserDatabaseIntentRefusal(
  existingValue: unknown,
  databaseNodeId: unknown,
  intentId: unknown,
  sequence: unknown,
  refusalValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedger> {
  if (!isIdentifier(databaseNodeId)) {
    return browserDatabaseIntentFailed("intent-record-invalid", "Intent refusal requires a database node.");
  }
  const existing = currentLedger(existingValue, databaseNodeId);
  if (!existing.ok) return existing;
  const intent = retainedIntent(existing.value, intentId, sequence);
  if (!intent.ok) return intent;
  const refusal = validateRefusal(refusalValue);
  if (!refusal.ok) return refusal;
  if (refusal.value === null) {
    return browserDatabaseIntentFailed("intent-record-invalid", "Intent refusal feedback cannot be null.");
  }
  if (intent.value === null) return succeeded(existing.value);
  return succeeded({
    ...existing.value,
    intents: existing.value.intents.map((candidate) =>
      candidate.intentId === intentId ? { ...candidate, status: "refused", refusal: refusal.value } : candidate,
    ),
  });
}

export function createInMemoryBrowserDatabaseIntentOutbox(
  limitsValue: unknown,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentOutboxPort> {
  const limits = validateBrowserDatabaseIntentLimits(limitsValue);
  if (!limits.ok) return limits;
  const ledgers = new Map<string, BrowserDatabaseIntentLedger>();
  let closed = false;

  const unavailable = <T>(): BrowserDatabaseIntentResult<T> =>
    browserDatabaseIntentFailed("intent-store-closed", "The browser database intent outbox is closed.");
  const readLedger = (databaseNodeId: string): BrowserDatabaseIntentResult<BrowserDatabaseIntentLedger> =>
    closed ? unavailable() : currentLedger(ledgers.get(databaseNodeId) ?? null, databaseNodeId);
  const store = (ledger: BrowserDatabaseIntentLedger): void => {
    ledgers.set(ledger.databaseNodeId, copyBrowserDatabaseIntentLedger(ledger));
  };
  const readout = (ledger: BrowserDatabaseIntentLedger): BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout> =>
    browserDatabaseIntentReadout(ledger, limits.value);

  return succeeded({
    enqueue: (draft) => {
      if (closed) return Promise.resolve(unavailable());
      const decision = decideBrowserDatabaseIntentEnqueue(
        ledgers.get(draft.databaseNodeId) ?? null,
        draft,
        limits.value,
      );
      if (!decision.ok) return Promise.resolve(decision);
      store(decision.value.ledger);
      return Promise.resolve(succeeded(copyBrowserDatabaseIntent(decision.value.value)));
    },
    read: (databaseNodeId) => {
      const ledger = readLedger(databaseNodeId);
      return Promise.resolve(ledger.ok ? readout(ledger.value) : ledger);
    },
    begin: (databaseNodeId, intentId, sequence) => {
      const ledger = readLedger(databaseNodeId);
      if (!ledger.ok) return Promise.resolve(ledger);
      const decision = decideBrowserDatabaseIntentBegin(ledger.value, databaseNodeId, intentId, sequence, limits.value);
      if (!decision.ok) return Promise.resolve(decision);
      store(decision.value.ledger);
      return Promise.resolve(succeeded(copyBrowserDatabaseIntent(decision.value.value)));
    },
    settle: (databaseNodeId, intentId, sequence, tick) => {
      const ledger = readLedger(databaseNodeId);
      if (!ledger.ok) return Promise.resolve(ledger);
      const decision = decideBrowserDatabaseIntentSettlement(
        ledger.value,
        databaseNodeId,
        intentId,
        sequence,
        tick,
        limits.value,
      );
      if (!decision.ok) return Promise.resolve(decision);
      store(decision.value.ledger);
      return Promise.resolve(readout(decision.value.ledger));
    },
    acknowledgeArchive: (receipt) => {
      const ledger = readLedger(receipt.databaseNodeId);
      if (!ledger.ok) return Promise.resolve(ledger);
      const decision = decideBrowserDatabaseReceiptArchiveAcknowledgement(ledger.value, receipt);
      if (!decision.ok) return Promise.resolve(decision);
      store(decision.value);
      return Promise.resolve(readout(decision.value));
    },
    refuse: (databaseNodeId, intentId, sequence, refusal) => {
      const ledger = readLedger(databaseNodeId);
      if (!ledger.ok) return Promise.resolve(ledger);
      const decision = decideBrowserDatabaseIntentRefusal(ledger.value, databaseNodeId, intentId, sequence, refusal);
      if (!decision.ok) return Promise.resolve(decision);
      store(decision.value);
      return Promise.resolve(readout(decision.value));
    },
    close: () => {
      closed = true;
      return succeeded(null);
    },
  });
}
