/**
 * Durable room-evidence live-feed boundary.
 *
 * Style: published discovery data mirrors already-persisted audit envelopes; it never creates a
 * receipt, signer, witness verdict, or causal fold. A missing feed remains missing data.
 */
import {
  decodeRoomEvidenceAuditEvent,
  encodeRoomEvidenceAuditEvent,
  type DurableRoomEvidenceAuditLedger,
  type RoomEvidenceAuditEvent,
} from "./durable-room-evidence-audit";
import type { RoomEvidenceResult } from "./durable-room-evidence";

export const ROOM_EVIDENCE_LIVE_FEED_INDEX_SCHEMA = "zeta.room-evidence-live-feed-index.v1" as const;
export const ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE = "room-evidence-index.json";
export const ROOM_EVIDENCE_LIVE_FEED_DIRECTORY = "room-evidence";
export const ROOM_WITNESS_ADJUDICATION_DIRECTORY = "adjudications";

export interface RoomEvidenceLiveFeedAdjudicationReference {
  /** Event-bound, local-only teaching record; never an authority roster. */
  readonly file: string;
  /** Content address of the canonical adjudication payload. */
  readonly contentKey: string;
}

export interface RoomEvidenceLiveFeedEntry {
  readonly eventId: string;
  readonly auditContentKey: string;
  readonly receiptContentKey: string;
  /** Relative to the feed root; this is discovery, not a global causal position. */
  readonly file: string;
  /** Optional because legacy published envelopes predate named adjudication references. */
  readonly adjudication?: RoomEvidenceLiveFeedAdjudicationReference;
}

export interface RoomEvidenceLiveFeedIndex {
  readonly schema: typeof ROOM_EVIDENCE_LIVE_FEED_INDEX_SCHEMA;
  readonly entries: readonly RoomEvidenceLiveFeedEntry[];
}

export interface RoomEvidenceLiveFeedPort {
  /** `null` means unavailable; it is not an empty feed. */
  read(path: string): Promise<string | null>;
}

export interface RoomEvidenceLiveFeedWriter {
  write(path: string, payload: string): Promise<RoomEvidenceResult<void>>;
}

export type RoomEvidenceLiveFeedRead =
  | {
      readonly kind: "ready";
      readonly index: RoomEvidenceLiveFeedIndex;
      readonly events: readonly RoomEvidenceAuditEvent[];
    }
  | { readonly kind: "empty"; readonly index: RoomEvidenceLiveFeedIndex }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "malformed"; readonly reason: string };

export interface PublishedRoomEvidenceLiveFeedEntry extends RoomEvidenceLiveFeedEntry {
  readonly duplicate: boolean;
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

function isFeedFile(value: unknown): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^${ROOM_EVIDENCE_LIVE_FEED_DIRECTORY}/[A-Za-z0-9._:-]+\\.json$`).test(value)
  );
}

function adjudicationFile(eventId: string): string {
  return `${ROOM_WITNESS_ADJUDICATION_DIRECTORY}/${eventId}.json`;
}

function isAdjudicationReference(
  value: unknown,
  eventId: string,
): value is RoomEvidenceLiveFeedAdjudicationReference {
  return isRecord(value) && value.file === adjudicationFile(eventId) && isIdentifier(value.contentKey);
}

function eventFile(eventId: string): string {
  return `${ROOM_EVIDENCE_LIVE_FEED_DIRECTORY}/${eventId}.json`;
}

function canonicalIndex(entries: readonly RoomEvidenceLiveFeedEntry[]): RoomEvidenceLiveFeedIndex {
  return {
    schema: ROOM_EVIDENCE_LIVE_FEED_INDEX_SCHEMA,
    entries: [...entries].sort((left, right) =>
      left.eventId < right.eventId ? -1 : left.eventId > right.eventId ? 1 : 0,
    ),
  };
}

export function encodeRoomEvidenceLiveFeedIndex(index: RoomEvidenceLiveFeedIndex): string {
  return `${JSON.stringify(canonicalIndex(index.entries), null, 2)}\n`;
}

export function decodeRoomEvidenceLiveFeedIndex(payload: string): RoomEvidenceResult<RoomEvidenceLiveFeedIndex> {
  try {
    const value: unknown = JSON.parse(payload);
    if (!isRecord(value) || value.schema !== ROOM_EVIDENCE_LIVE_FEED_INDEX_SCHEMA || !Array.isArray(value.entries)) {
      return failed(`feed index schema must be ${ROOM_EVIDENCE_LIVE_FEED_INDEX_SCHEMA}`);
    }

    const entries: RoomEvidenceLiveFeedEntry[] = [];
    const eventIds = new Set<string>();
    for (const [position, entry] of value.entries.entries()) {
      if (!isRecord(entry)) return failed(`feed index entry ${String(position)} must be an object`);
      if (
        !isIdentifier(entry.eventId) ||
        !isIdentifier(entry.auditContentKey) ||
        !isIdentifier(entry.receiptContentKey) ||
        !isFeedFile(entry.file)
      ) {
        return failed(`feed index entry ${String(position)} has an invalid event ID, content key, or file`);
      }
      if (eventIds.has(entry.eventId)) return failed(`feed index repeats eventId ${entry.eventId}`);
      eventIds.add(entry.eventId);
      if (entry.adjudication !== undefined && !isAdjudicationReference(entry.adjudication, entry.eventId)) {
        return failed(`feed index entry ${String(position)} has an invalid or unbound adjudication reference`);
      }
      entries.push({
        eventId: entry.eventId,
        auditContentKey: entry.auditContentKey,
        receiptContentKey: entry.receiptContentKey,
        file: entry.file,
        ...(entry.adjudication === undefined ? {} : { adjudication: entry.adjudication }),
      });
    }
    return succeeded(canonicalIndex(entries));
  } catch {
    return failed("feed index is not valid JSON");
  }
}

/**
 * Read discovery data without claiming browser-side content-address or roster verification.
 * The durable writer performed those checks before the envelope was published.
 */
export async function readRoomEvidenceLiveFeed(port: RoomEvidenceLiveFeedPort): Promise<RoomEvidenceLiveFeedRead> {
  const indexPayload = await port.read(ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE);
  if (indexPayload === null) return { kind: "unavailable", reason: "room-evidence index is unavailable" };

  const decodedIndex = decodeRoomEvidenceLiveFeedIndex(indexPayload);
  if (!decodedIndex.ok) return { kind: "malformed", reason: decodedIndex.reason };
  if (decodedIndex.value.entries.length === 0) return { kind: "empty", index: decodedIndex.value };

  const events: RoomEvidenceAuditEvent[] = [];
  for (const entry of decodedIndex.value.entries) {
    const payload = await port.read(entry.file);
    if (payload === null) return { kind: "unavailable", reason: `room-evidence envelope ${entry.file} is unavailable` };
    const decodedEvent = decodeRoomEvidenceAuditEvent(payload);
    if (!decodedEvent.ok)
      return { kind: "malformed", reason: `room-evidence envelope ${entry.file}: ${decodedEvent.reason}` };
    if (decodedEvent.value.delta.eventId !== entry.eventId) {
      return { kind: "malformed", reason: `feed eventId ${entry.eventId} does not bind envelope ${entry.file}` };
    }
    events.push(decodedEvent.value);
  }
  return { kind: "ready", index: decodedIndex.value, events };
}

/**
 * Publication happens only after durable append. A failed envelope write never updates discovery.
 * An index-write failure can leave an unreferenced immutable envelope, which is safe and discoverable
 * only after a later successful index publication.
 */
export class DurableRoomEvidenceLiveFeedPublisher {
  private readonly ledger: DurableRoomEvidenceAuditLedger;
  private readonly writer: RoomEvidenceLiveFeedWriter;
  private index: RoomEvidenceLiveFeedIndex;

  constructor(
    ledger: DurableRoomEvidenceAuditLedger,
    writer: RoomEvidenceLiveFeedWriter,
    initialIndex: RoomEvidenceLiveFeedIndex = canonicalIndex([]),
  ) {
    this.ledger = ledger;
    this.writer = writer;
    this.index = canonicalIndex(initialIndex.entries);
  }

  snapshot(): RoomEvidenceLiveFeedIndex {
    return this.index;
  }

  async appendAndPublish(
    event: RoomEvidenceAuditEvent,
    options: { readonly adjudication?: RoomEvidenceLiveFeedAdjudicationReference } = {},
  ): Promise<RoomEvidenceResult<PublishedRoomEvidenceLiveFeedEntry>> {
    if (options.adjudication !== undefined && !isAdjudicationReference(options.adjudication, event.delta.eventId)) {
      return failed("live feed adjudication reference must bind this event ID and declared local namespace");
    }
    const stored = await this.ledger.append(event);
    if (!stored.ok) return stored;

    const prior = this.index.entries.find((entry) => entry.eventId === stored.value.eventId);
    const adjudication = options.adjudication ?? prior?.adjudication;
    const next: RoomEvidenceLiveFeedEntry = {
      eventId: stored.value.eventId,
      auditContentKey: stored.value.auditContentKey,
      receiptContentKey: stored.value.receiptContentKey,
      file: eventFile(stored.value.eventId),
      ...(adjudication === undefined ? {} : { adjudication }),
    };
    if (
      prior !== undefined &&
      (prior.auditContentKey !== next.auditContentKey ||
        prior.receiptContentKey !== next.receiptContentKey ||
        prior.file !== next.file ||
        (prior.adjudication !== undefined &&
          options.adjudication !== undefined &&
          (prior.adjudication.file !== options.adjudication.file ||
            prior.adjudication.contentKey !== options.adjudication.contentKey)))
    ) {
      return failed(`live feed eventId ${next.eventId} conflicts with a prior discovery entry`);
    }

    const envelopeWrite = await this.writer.write(next.file, encodeRoomEvidenceAuditEvent(event));
    if (!envelopeWrite.ok) return failed(`live feed envelope write failed: ${envelopeWrite.reason}`);

    const duplicate = prior !== undefined;
    const candidate = canonicalIndex(
      duplicate
        ? this.index.entries.map((entry) => (entry.eventId === next.eventId ? next : entry))
        : [...this.index.entries, next],
    );
    const indexWrite = await this.writer.write(
      ROOM_EVIDENCE_LIVE_FEED_INDEX_FILE,
      encodeRoomEvidenceLiveFeedIndex(candidate),
    );
    if (!indexWrite.ok) return failed(`live feed index write failed: ${indexWrite.reason}`);
    this.index = candidate;
    return succeeded({ ...next, duplicate });
  }
}
