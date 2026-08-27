/**
 * Local witness adjudication record.
 *
 * Style: an adjudication is an additional immutable, content-addressed teaching record. It never
 * overwrites a witness, promotes a local roster into global identity, or manufactures a correction
 * signature. A later signed correction must be appended as a separate audit event.
 */
import { makeStorageRecord, type StorageResult, type ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import type { RoomEvidenceResult } from "./durable-room-evidence";

export const ROOM_WITNESS_ADJUDICATION_SCHEMA = "zeta.room-witness-adjudication.v1" as const;

export type LocalWitnessAdjudicationDisposition = "request-local-witness" | "retain-conflict";

export interface RoomWitnessAdjudication {
  readonly schema: typeof ROOM_WITNESS_ADJUDICATION_SCHEMA;
  readonly prior: {
    readonly eventId: string;
    readonly auditContentKey: string;
    readonly receiptContentKey: string;
  };
  /** Canonically sorted visible witness references; an empty list means no local witness was available. */
  readonly witnessRefs: readonly string[];
  readonly authority: "unresolved" | "disputed";
  readonly disposition: LocalWitnessAdjudicationDisposition;
  readonly teaching: {
    readonly code: "RWA-1" | "RWA-2";
    readonly lesson: string;
    readonly nextGenerator: string;
  };
}

export interface AddressedRoomWitnessAdjudication {
  readonly record: RoomWitnessAdjudication;
  readonly contentKey: string;
}

function succeeded<T>(value: T): RoomEvidenceResult<T> {
  return { ok: true, value };
}

function failed(reason: string): RoomEvidenceResult<never> {
  return { ok: false, reason };
}

function isIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(value);
}

function canonicalRefs(witnessRefs: readonly string[]): readonly string[] {
  return [...new Set(witnessRefs)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function makeRoomWitnessAdjudication(
  prior: RoomWitnessAdjudication["prior"],
  authority: RoomWitnessAdjudication["authority"],
  witnessRefs: readonly string[],
): RoomEvidenceResult<RoomWitnessAdjudication> {
  if (!isIdentifier(prior.eventId) || !isIdentifier(prior.auditContentKey) || !isIdentifier(prior.receiptContentKey)) {
    return failed("adjudication prior must bind event, audit content, and receipt content identities");
  }
  const refs = canonicalRefs(witnessRefs);
  if (refs.some((reference) => !isIdentifier(reference)))
    return failed("adjudication witness references must be printable identifiers");
  if (authority === "unresolved") {
    if (refs.length !== 0) return failed("unresolved authority must not claim a visible witness reference");
    return succeeded({
      schema: ROOM_WITNESS_ADJUDICATION_SCHEMA,
      prior,
      witnessRefs: [],
      authority,
      disposition: "request-local-witness",
      teaching: {
        code: "RWA-1",
        lesson: "No local verifier established the genesis binding; the retained event is unresolved, not invalid.",
        nextGenerator:
          "Request and append a locally verifiable witness atom; do not assign authority from workflow identity.",
      },
    });
  }
  if (refs.length < 2) return failed("disputed authority requires at least two distinct visible witness references");
  return succeeded({
    schema: ROOM_WITNESS_ADJUDICATION_SCHEMA,
    prior,
    witnessRefs: refs,
    authority,
    disposition: "retain-conflict",
    teaching: {
      code: "RWA-2",
      lesson: "Visible witness atoms conflict. Choosing one silently would erase evidence.",
      nextGenerator:
        "Retain every witness atom, block authority-dependent action, then append a separately signed correction only after local adjudication.",
    },
  });
}

export function encodeRoomWitnessAdjudication(record: RoomWitnessAdjudication): string {
  return `${JSON.stringify({
    schema: record.schema,
    prior: {
      eventId: record.prior.eventId,
      auditContentKey: record.prior.auditContentKey,
      receiptContentKey: record.prior.receiptContentKey,
    },
    witnessRefs: canonicalRefs(record.witnessRefs),
    authority: record.authority,
    disposition: record.disposition,
    teaching: record.teaching,
  })}\n`;
}

export function addressRoomWitnessAdjudication(record: RoomWitnessAdjudication): AddressedRoomWitnessAdjudication {
  return { record, contentKey: makeStorageRecord(encodeRoomWitnessAdjudication(record)).key };
}

export async function persistRoomWitnessAdjudication(
  storage: ZetaStorageCell,
  record: RoomWitnessAdjudication,
): Promise<RoomEvidenceResult<AddressedRoomWitnessAdjudication>> {
  const addressed = addressRoomWitnessAdjudication(record);
  const written: StorageResult<string> = await storage.write(encodeRoomWitnessAdjudication(record));
  if (!written.ok) return failed(`adjudication persistence failed: ${written.reason}`);
  if (written.value !== addressed.contentKey)
    return failed("adjudication content key does not bind its canonical bytes");
  return succeeded(addressed);
}
