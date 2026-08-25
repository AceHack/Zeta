/**
 * homoiconicity-transport-seam.ts — executable boundary between representation and recovery.
 *
 * A code quotient and an error-correcting channel answer different questions. This module keeps
 * them apart: it compares rank-1 freeness of the uncoded/coded representations and separately
 * checks that canonical room evidence survives a transport serialization round-trip. It does not
 * claim that error correction restores a quotient pre-image or establishes agent homoiconicity.
 */

import {
  algebraDimension,
  buildCodedAdinkra,
  freeOverSubalgebra,
  type Mask,
} from "./regular-representation-defect";
import {
  decodeRoomEvidenceReceipt,
  encodeRoomEvidenceReceipt,
  foldRoomEvidence,
  type RoomEvidenceReceipt,
  type RoomEvidenceResult,
} from "../../observe/room/durable-room-evidence";

/** A small prime used only for exact maximum-rank checks in the existing matrix route. */
export const HOMOICONICITY_SEAM_PRIME = 1_000_003;

export interface RepresentationObservation {
  readonly algebraDimension: number;
  readonly moduleDimension: number;
  readonly defect: number;
  readonly fullRankOneFree: boolean;
}

export interface CodedUncodedComparison {
  readonly uncoded: RepresentationObservation;
  readonly coded: RepresentationObservation;
  readonly coloredResidueRankOneFree: boolean;
}

function observeRepresentation(n: number, codeGenerators: readonly Mask[]): RepresentationObservation {
  const adinkra = buildCodedAdinkra(n, [...codeGenerators], -1);
  const moduleDimension = adinkra.reps.length;
  const generatedAlgebraDimension = algebraDimension(adinkra, HOMOICONICITY_SEAM_PRIME);
  return {
    algebraDimension: generatedAlgebraDimension,
    moduleDimension,
    defect: generatedAlgebraDimension / moduleDimension,
    fullRankOneFree: generatedAlgebraDimension === moduleDimension,
  };
}

/**
 * Canonical N=4 witness: the uncoded cube is regular; quotienting by d4 is not. The first three
 * colours remain a positive residue, but that is intentionally a subalgebra claim, not recovery
 * of the full coded representation.
 */
export function compareN4D4Seam(): CodedUncodedComparison {
  const d4 = 0b1111;
  const codedAdinkra = buildCodedAdinkra(4, [d4], -1);
  return {
    uncoded: observeRepresentation(4, []),
    coded: observeRepresentation(4, [d4]),
    coloredResidueRankOneFree: freeOverSubalgebra(codedAdinkra, [0, 1, 2], HOMOICONICITY_SEAM_PRIME) === codedAdinkra.reps.length,
  };
}

export interface TransportRoundTripObservation {
  readonly canonicalPayloadPreserved: boolean;
  readonly foldRootPreserved: boolean;
  readonly resolvedViewCount: number;
}

/**
 * This models the semantic boundary below an Adinkra-capable datagram port. The actual channel
 * supplies CRC and [8,4,4] recovery; this check intentionally verifies only what the receipt layer
 * can observe after a valid payload is delivered.
 */
export function observeRoomEvidenceTransportRoundTrip(
  receipt: RoomEvidenceReceipt,
): RoomEvidenceResult<TransportRoundTripObservation> {
  const decoded = decodeRoomEvidenceReceipt(encodeRoomEvidenceReceipt(receipt));
  if (!decoded.ok) return decoded;
  const before = foldRoomEvidence([receipt]);
  if (!before.ok) return before;
  const after = foldRoomEvidence([decoded.value]);
  if (!after.ok) return after;
  return {
    ok: true,
    value: {
      canonicalPayloadPreserved: encodeRoomEvidenceReceipt(receipt) === encodeRoomEvidenceReceipt(decoded.value),
      foldRootPreserved: before.value.root === after.value.root,
      resolvedViewCount: after.value.views.filter((view) => view.status === "resolved").length,
    },
  };
}
