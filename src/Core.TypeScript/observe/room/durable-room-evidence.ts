/**
 * durable-room-evidence.ts — ZetaDB/DAGFS-backed uncertain signed room evidence.
 *
 * A room receipt is an immutable fact, not mutable room state. `weight = +1`
 * asserts an atom and `weight = -1` retracts that exact atom. Both signs carry
 * the same uncertainty sufficient statistics, so corrections can arrive before
 * assertions and converge once the durable evidence relation is complete.
 *
 * ZetaStorageCell supplies the content-addressed ZetaDB/DAGFS persistence path.
 * The datagram interface is structurally satisfied by LossyUdpChannel, whose
 * existing Adinkra [8,4,4] recovery and CRC boundary run below this semantic
 * layer. This module does not claim a cryptographic identity proof.
 */

import { merkleToHex, type StorageResult, type ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import { root as zSetMerkleRoot } from "../../z-set-merkle/z-set-merkle";
import { ofEntries, stringCompare, type ZSet } from "../../z-set/z-set";

export const ROOM_EVIDENCE_RECEIPT_SCHEMA = "zeta.room-evidence-receipt.v1" as const;
export const ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES = 4;

const PPM_MAX = 1_000_000;
const KEY_SEPARATOR = "\u001f";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface RoomEvidenceUncertainty {
  /** Posterior mean on a fixed [0, 1_000_000] ppm scale. */
  readonly meanPpm: number;
  /** Positive integer precision contribution on the same fixed scale. */
  readonly precisionPpm: number;
}

export interface RoomEvidenceReceipt {
  readonly schema: typeof ROOM_EVIDENCE_RECEIPT_SCHEMA;
  readonly roomId: string;
  readonly roomFingerprint: string;
  readonly channelFingerprint: string;
  readonly spectrumSlice: string;
  readonly signatureSplit: string;
  readonly runId: string;
  readonly episodeId: string;
  /** Identity of this asserted atom, not merely the episode. */
  readonly factId: string;
  /** Immutable external trajectory or visual-verification receipt reference. */
  readonly sourceArtifact: string;
  /** ZSet delta: +1 assertion or -1 retraction. Fractions and zero are refused. */
  readonly weight: number;
  readonly uncertainty: RoomEvidenceUncertainty;
  readonly solved: boolean;
  readonly actionCount: number;
  readonly elapsedMs: number;
  readonly actionBudget: number;
  readonly timeBudgetMs: number;
}

export interface RoomEvidenceDerivedUncertainty {
  readonly meanPpm: number;
  readonly precisionPpm: number;
}

export interface ResolvedRoomEvidenceView {
  readonly status: "resolved";
  readonly roomKey: string;
  readonly activeFactCount: number;
  readonly solved: boolean;
  readonly actionCount: number;
  readonly elapsedMs: number;
  readonly uncertainty: RoomEvidenceDerivedUncertainty;
}

export interface UnresolvedRoomEvidenceView {
  readonly status: "unresolved";
  readonly roomKey: string;
  readonly reason: string;
}

export type RoomEvidenceView = ResolvedRoomEvidenceView | UnresolvedRoomEvidenceView;

export interface RoomEvidenceFold {
  /** Canonical Merkle root over the signed atom ZSet, including negative in-flight atoms. */
  readonly root: string;
  readonly atoms: ZSet<string>;
  readonly views: readonly RoomEvidenceView[];
}

export type RoomEvidenceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

/** Minimal structural surface implemented by LossyUdpChannel. */
export interface RoomEvidenceDatagramPort {
  send(payload: Uint8Array): void;
  onData(handler: (payload: Uint8Array) => void): void;
  flush?(): void;
}

function succeeded<T>(value: T): RoomEvidenceResult<T> {
  return { ok: true, value };
}

function failed(reason: string): RoomEvidenceResult<never> {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNonZeroWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value !== 0;
}

function isMeanPpm(value: unknown): value is number {
  return isSafeNonNegativeInteger(value) && value <= PPM_MAX;
}

function isPrecisionPpm(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER;
}

/** Validate a receipt before persistence, transport, or DBSP folding. */
export function validateRoomEvidenceReceipt(value: unknown): RoomEvidenceResult<RoomEvidenceReceipt> {
  if (!isRecord(value) || value.schema !== ROOM_EVIDENCE_RECEIPT_SCHEMA) {
    return failed(`receipt schema must be ${ROOM_EVIDENCE_RECEIPT_SCHEMA}`);
  }

  const roomId = value.roomId;
  const roomFingerprint = value.roomFingerprint;
  const channelFingerprint = value.channelFingerprint;
  const spectrumSlice = value.spectrumSlice;
  const signatureSplit = value.signatureSplit;
  const runId = value.runId;
  const episodeId = value.episodeId;
  const factId = value.factId;
  const sourceArtifact = value.sourceArtifact;
  if (
    !isIdentifier(roomId) ||
    !isIdentifier(roomFingerprint) ||
    !isIdentifier(channelFingerprint) ||
    !isIdentifier(spectrumSlice) ||
    !isIdentifier(signatureSplit) ||
    !isIdentifier(runId) ||
    !isIdentifier(episodeId) ||
    !isIdentifier(factId) ||
    !isIdentifier(sourceArtifact)
  ) {
    return failed("receipt identifiers must be printable non-empty strings");
  }

  const weight = value.weight;
  const uncertainty = value.uncertainty;
  const solved = value.solved;
  const actionCount = value.actionCount;
  const elapsedMs = value.elapsedMs;
  const actionBudget = value.actionBudget;
  const timeBudgetMs = value.timeBudgetMs;
  if (!isNonZeroWeight(weight)) return failed("receipt weight must be a non-zero safe integer");
  if (!isRecord(uncertainty) || !isMeanPpm(uncertainty.meanPpm) || !isPrecisionPpm(uncertainty.precisionPpm)) {
    return failed(`uncertainty requires meanPpm in [0, ${PPM_MAX}] and positive integer precisionPpm`);
  }
  if (typeof solved !== "boolean") return failed("receipt solved must be boolean");
  if (!isSafeNonNegativeInteger(actionCount) || !isSafeNonNegativeInteger(elapsedMs)) {
    return failed("receipt actionCount and elapsedMs must be non-negative safe integers");
  }
  if (!isSafeNonNegativeInteger(actionBudget) || actionBudget < 1 || !isSafeNonNegativeInteger(timeBudgetMs) || timeBudgetMs < 1) {
    return failed("receipt actionBudget and timeBudgetMs must be positive safe integers");
  }
  if (actionCount > actionBudget || elapsedMs > timeBudgetMs) {
    return failed("receipt observation exceeds its declared room budget");
  }

  return succeeded({
    schema: ROOM_EVIDENCE_RECEIPT_SCHEMA,
    roomId,
    roomFingerprint,
    channelFingerprint,
    spectrumSlice,
    signatureSplit,
    runId,
    episodeId,
    factId,
    sourceArtifact,
    weight,
    uncertainty: { meanPpm: uncertainty.meanPpm, precisionPpm: uncertainty.precisionPpm },
    solved,
    actionCount,
    elapsedMs,
    actionBudget,
    timeBudgetMs,
  });
}

/** Stable payload order makes the ZetaDB/DAGFS address cross-run reproducible. */
export function encodeRoomEvidenceReceipt(receipt: RoomEvidenceReceipt): string {
  return JSON.stringify({
    schema: receipt.schema,
    roomId: receipt.roomId,
    roomFingerprint: receipt.roomFingerprint,
    channelFingerprint: receipt.channelFingerprint,
    spectrumSlice: receipt.spectrumSlice,
    signatureSplit: receipt.signatureSplit,
    runId: receipt.runId,
    episodeId: receipt.episodeId,
    factId: receipt.factId,
    sourceArtifact: receipt.sourceArtifact,
    weight: receipt.weight,
    uncertainty: { meanPpm: receipt.uncertainty.meanPpm, precisionPpm: receipt.uncertainty.precisionPpm },
    solved: receipt.solved,
    actionCount: receipt.actionCount,
    elapsedMs: receipt.elapsedMs,
    actionBudget: receipt.actionBudget,
    timeBudgetMs: receipt.timeBudgetMs,
  });
}

export function decodeRoomEvidenceReceipt(payload: string): RoomEvidenceResult<RoomEvidenceReceipt> {
  try {
    return validateRoomEvidenceReceipt(JSON.parse(payload));
  } catch {
    return failed("receipt payload is not valid JSON");
  }
}

/**
 * Frame one canonical receipt for a variable-width datagram lane.
 *
 * `LossyUdpChannel` pads all four data symbols in one `[8,4,4]` block to the
 * longest symbol. Without an explicit length, a shorter JSON receipt acquires
 * trailing NUL bytes and is no longer valid JSON after recovery. The unsigned
 * 32-bit prefix preserves the semantic payload length; any remaining bytes must
 * be zero padding produced by the block builder.
 */
export function encodeRoomEvidenceDatagram(receipt: RoomEvidenceReceipt): Uint8Array {
  const payload = textEncoder.encode(encodeRoomEvidenceReceipt(receipt));
  const framed = new Uint8Array(ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES + payload.length);
  new DataView(framed.buffer).setUint32(0, payload.length, false);
  framed.set(payload, ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES);
  return framed;
}

export function decodeRoomEvidenceDatagram(payload: Uint8Array): RoomEvidenceResult<RoomEvidenceReceipt> {
  if (payload.length < ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES) {
    return failed("receipt datagram is shorter than its length header");
  }
  const declaredLength = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(0, false);
  if (declaredLength === 0) return failed("receipt datagram payload length must be positive");
  const payloadEnd = ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES + declaredLength;
  if (payloadEnd > payload.length) return failed("receipt datagram is truncated");
  for (let index = payloadEnd; index < payload.length; index++) {
    if (payload[index] !== 0) return failed("receipt datagram has non-zero bytes after its declared payload");
  }
  return decodeRoomEvidenceReceipt(
    textDecoder.decode(payload.subarray(ROOM_EVIDENCE_DATAGRAM_HEADER_BYTES, payloadEnd)),
  );
}

/** Identity of the exact assertion/retraction pair; the weight is intentionally excluded. */
export function roomEvidenceAtomKey(receipt: RoomEvidenceReceipt): string {
  return [
    receipt.schema,
    receipt.roomFingerprint,
    receipt.channelFingerprint,
    receipt.spectrumSlice,
    receipt.signatureSplit,
    receipt.runId,
    receipt.episodeId,
    receipt.factId,
    receipt.sourceArtifact,
    receipt.uncertainty.meanPpm,
    receipt.uncertainty.precisionPpm,
    receipt.solved ? 1 : 0,
    receipt.actionCount,
    receipt.elapsedMs,
    receipt.actionBudget,
    receipt.timeBudgetMs,
  ].join(KEY_SEPARATOR);
}

/** Identity of a materialized room/episode view; fact identity is intentionally excluded. */
export function roomEvidenceViewKey(receipt: RoomEvidenceReceipt): string {
  return [
    receipt.roomFingerprint,
    receipt.channelFingerprint,
    receipt.spectrumSlice,
    receipt.signatureSplit,
    receipt.runId,
    receipt.episodeId,
  ].join(KEY_SEPARATOR);
}

function viewSort(left: RoomEvidenceView, right: RoomEvidenceView): number {
  return stringCompare(left.roomKey, right.roomKey);
}

/**
 * Fold immutable atoms through a canonical ZSet. Delivery order is irrelevant.
 * A negative atom with no matching positive atom remains visible as `unresolved`;
 * it never becomes negative confidence or a negative solved count.
 */
export function foldRoomEvidence(receipts: readonly RoomEvidenceReceipt[]): RoomEvidenceResult<RoomEvidenceFold> {
  const atoms = new Map<string, RoomEvidenceReceipt>();
  for (const raw of receipts) {
    const receipt = validateRoomEvidenceReceipt(raw);
    if (!receipt.ok) return receipt;
    const key = roomEvidenceAtomKey(receipt.value);
    const previous = atoms.get(key);
    if (previous !== undefined && encodeRoomEvidenceReceipt({ ...previous, weight: 1 }) !== encodeRoomEvidenceReceipt({ ...receipt.value, weight: 1 })) {
      return failed(`atom key collision for fact ${receipt.value.factId}`);
    }
    atoms.set(key, receipt.value);
  }

  const zSet = ofEntries(
    stringCompare,
    receipts.map((receipt) => ({ e: roomEvidenceAtomKey(receipt), w: receipt.weight })),
  );
  const groups = new Map<string, Array<{ readonly receipt: RoomEvidenceReceipt; readonly weight: number }>>();
  for (const entry of zSet) {
    const receipt = atoms.get(entry.e);
    if (receipt === undefined) return failed(`missing atom body for canonical key ${entry.e}`);
    const key = roomEvidenceViewKey(receipt);
    const group = groups.get(key) ?? [];
    group.push({ receipt, weight: entry.w });
    groups.set(key, group);
  }

  const views: RoomEvidenceView[] = [];
  for (const [roomKey, entries] of groups) {
    if (entries.some((entry) => entry.weight < 0)) {
      views.push({ status: "unresolved", roomKey, reason: "retraction is present before its matching assertion" });
      continue;
    }

    const solvedValues = new Set(entries.map((entry) => entry.receipt.solved));
    if (solvedValues.size !== 1) {
      views.push({ status: "unresolved", roomKey, reason: "active evidence atoms disagree on the solved predicate" });
      continue;
    }

    let precisionPpm = 0;
    let naturalMeanPpm = 0;
    let actionCount = 0;
    let elapsedMs = 0;
    let activeFactCount = 0;
    for (const entry of entries) {
      const multiplicity = entry.weight;
      const { uncertainty } = entry.receipt;
      precisionPpm += multiplicity * uncertainty.precisionPpm;
      naturalMeanPpm += multiplicity * uncertainty.precisionPpm * uncertainty.meanPpm;
      actionCount += multiplicity * entry.receipt.actionCount;
      elapsedMs += multiplicity * entry.receipt.elapsedMs;
      activeFactCount += multiplicity;
    }
    if (!(precisionPpm > 0) || !Number.isSafeInteger(precisionPpm) || !Number.isSafeInteger(naturalMeanPpm) || !Number.isSafeInteger(actionCount) || !Number.isSafeInteger(elapsedMs)) {
      views.push({ status: "unresolved", roomKey, reason: "active evidence has non-positive or non-representable signed sufficient statistics" });
      continue;
    }
    const first = entries[0]!.receipt;
    views.push({
      status: "resolved",
      roomKey,
      activeFactCount,
      solved: first.solved,
      actionCount,
      elapsedMs,
      uncertainty: { meanPpm: naturalMeanPpm / precisionPpm, precisionPpm },
    });
  }

  const root = merkleToHex(zSetMerkleRoot((key) => textEncoder.encode(key), zSet));
  return succeeded({ root, atoms: zSet, views: views.sort(viewSort) });
}

export interface StoredRoomEvidence {
  readonly contentKey: string;
  readonly duplicate: boolean;
}

/**
 * Durable, content-addressed local receipt ledger. The provided content keys are
 * the replay manifest: no global storage scan can accidentally fold unrelated
 * ZetaDB rows into a room.
 */
export class DurableRoomEvidenceLedger {
  private readonly known = new Map<string, RoomEvidenceReceipt>();
  private readonly storage: ZetaStorageCell;

  constructor(storage: ZetaStorageCell) {
    this.storage = storage;
  }

  async append(raw: RoomEvidenceReceipt): Promise<RoomEvidenceResult<StoredRoomEvidence>> {
    const receipt = validateRoomEvidenceReceipt(raw);
    if (!receipt.ok) return receipt;
    const payload = encodeRoomEvidenceReceipt(receipt.value);
    const write: StorageResult<string> = await this.storage.write(payload);
    if (!write.ok) return failed(`receipt persistence failed: ${write.reason}`);
    const duplicate = this.known.has(write.value);
    this.known.set(write.value, receipt.value);
    return succeeded({ contentKey: write.value, duplicate });
  }

  async replay(contentKeys: readonly string[]): Promise<RoomEvidenceResult<RoomEvidenceFold>> {
    const replayed: RoomEvidenceReceipt[] = [];
    for (const contentKey of contentKeys) {
      const read = await this.storage.read(contentKey);
      if (!read.ok) return failed(`receipt replay failed for ${contentKey}: ${read.reason}`);
      if (read.value === null) return failed(`receipt replay missing content key ${contentKey}`);
      if (!this.storage.verify(contentKey, read.value.payload)) return failed(`receipt replay hash mismatch for ${contentKey}`);
      const receipt = decodeRoomEvidenceReceipt(read.value.payload);
      if (!receipt.ok) return receipt;
      this.known.set(contentKey, receipt.value);
      replayed.push(receipt.value);
    }
    return foldRoomEvidence(replayed);
  }

  fold(): RoomEvidenceResult<RoomEvidenceFold> {
    return foldRoomEvidence([...this.known.values()]);
  }
}

/**
 * Transport adapter for existing Adinkra [8,4,4] channels. Persistence occurs at
 * both sender and receiver boundaries. ECC recovery is delegated to the channel.
 */
export class AdinkraRoomEvidenceBridge {
  private readonly channel: RoomEvidenceDatagramPort;
  private readonly ledger: DurableRoomEvidenceLedger;

  constructor(
    channel: RoomEvidenceDatagramPort,
    ledger: DurableRoomEvidenceLedger,
  ) {
    this.channel = channel;
    this.ledger = ledger;
    this.channel.onData((payload) => { void this.receive(payload); });
  }

  async send(raw: RoomEvidenceReceipt): Promise<RoomEvidenceResult<StoredRoomEvidence>> {
    const receipt = validateRoomEvidenceReceipt(raw);
    if (!receipt.ok) return receipt;
    const persisted = await this.ledger.append(receipt.value);
    if (!persisted.ok) return persisted;
    this.channel.send(encodeRoomEvidenceDatagram(receipt.value));
    return persisted;
  }

  flush(): void {
    this.channel.flush?.();
  }

  async receive(payload: Uint8Array): Promise<RoomEvidenceResult<StoredRoomEvidence>> {
    const receipt = decodeRoomEvidenceDatagram(payload);
    if (!receipt.ok) return receipt;
    return this.ledger.append(receipt.value);
  }
}
