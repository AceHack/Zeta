/**
 * Replayable room fault receipts.
 *
 * A receipt is an immutable, content-addressed record of one finite fault scenario. It is not a
 * replacement for room evidence: the `undecodable` case deliberately creates no evidence atom.
 * Teaching text records the next safe generator action without silently overwriting an observed
 * fact, a witness conflict, or a missing transport payload.
 */
import { makeStorageRecord, type StorageResult, type ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import {
  classifyAdinkra844ErasureMask,
  type Adinkra844ErasureClassification,
} from "../../research/adinkra-ecc/adinkra-durable-evidence-seam";
import type { RoomEvidenceResult } from "./durable-room-evidence";

export const REPLAYABLE_ROOM_FAULT_RECEIPT_SCHEMA = "zeta.replayable-room-fault-receipt.v1" as const;

export type ReplayableRoomFaultScenario =
  | "correctable-recovery"
  | "undecodable-transport"
  | "altered-content"
  | "unresolved-witness"
  | "visible-witness-conflict";

export type ReplayEvidenceSign = "+1" | "-1" | "not-observed";
export type ReplayContentIntegrity = "intact" | "distinct-content" | "not-assessed";
export type ReplayCausalContinuity = "settled" | "not-observed";
export type ReplayGenesisAuthority = "witnessed" | "unresolved" | "disputed" | "not-observed";
export type ReplayFaultOutcome =
  "recovered" | "no-semantic-receipt" | "distinct-fact" | "authority-unresolved" | "authority-disputed";

export interface ReplayableRoomFaultReceipt {
  readonly schema: typeof REPLAYABLE_ROOM_FAULT_RECEIPT_SCHEMA;
  readonly scenario: ReplayableRoomFaultScenario;
  /** Stable test-vector reference; it is not a claim about a production room. */
  readonly subject: {
    readonly roomFingerprint: string;
    readonly eventRef: string;
  };
  readonly transport: {
    readonly erasureMask: number;
    readonly classification: Adinkra844ErasureClassification;
    readonly semanticReceipt: boolean;
  };
  readonly registers: {
    readonly evidenceSign: ReplayEvidenceSign;
    readonly contentIntegrity: ReplayContentIntegrity;
    readonly causalContinuity: ReplayCausalContinuity;
    readonly genesisAuthority: ReplayGenesisAuthority;
  };
  readonly outcome: ReplayFaultOutcome;
  readonly teaching: {
    readonly code: string;
    readonly lesson: string;
    readonly nextGenerator: string;
  };
}

export interface ContentAddressedReplayableRoomFaultReceipt {
  readonly receipt: ReplayableRoomFaultReceipt;
  /** Merkle address of the exact canonical receipt bytes. */
  readonly contentKey: string;
}

export interface StoredReplayableRoomFaultReceipt extends ContentAddressedReplayableRoomFaultReceipt {
  readonly duplicate: boolean;
}

const SUBJECT = {
  roomFingerprint: "room:adinkra-844-durable-seam:conformance-v1",
  eventRef: "vector:adinkra-844-room-evidence:0",
} as const;

function succeeded<T>(value: T): RoomEvidenceResult<T> {
  return { ok: true, value };
}

function failed(reason: string): RoomEvidenceResult<never> {
  return { ok: false, reason };
}

function faultReceipt(
  scenario: ReplayableRoomFaultScenario,
  evidenceSign: ReplayEvidenceSign,
  erasureMask: number,
  contentIntegrity: ReplayContentIntegrity,
  causalContinuity: ReplayCausalContinuity,
  genesisAuthority: ReplayGenesisAuthority,
  outcome: ReplayFaultOutcome,
  teaching: ReplayableRoomFaultReceipt["teaching"],
): ReplayableRoomFaultReceipt {
  const classification = classifyAdinkra844ErasureMask(erasureMask);
  return {
    schema: REPLAYABLE_ROOM_FAULT_RECEIPT_SCHEMA,
    scenario,
    subject: SUBJECT,
    transport: {
      erasureMask,
      classification,
      semanticReceipt: outcome !== "no-semantic-receipt",
    },
    registers: { evidenceSign, contentIntegrity, causalContinuity, genesisAuthority },
    outcome,
    teaching,
  };
}

/**
 * Create a deterministic finite replay vector. A caller chooses the signed fact only for
 * scenarios where a semantic receipt exists; `undecodable-transport` is necessarily
 * `not-observed` because no evidence atom may be manufactured from absent transport bytes.
 */
export function replayRoomFaultScenario(
  scenario: ReplayableRoomFaultScenario,
  evidenceSign: Exclude<ReplayEvidenceSign, "not-observed"> = "+1",
): ReplayableRoomFaultReceipt {
  switch (scenario) {
    case "correctable-recovery":
      return faultReceipt(scenario, evidenceSign, 0b0000_0111, "intact", "settled", "witnessed", "recovered", {
        code: "ADE-R1",
        lesson:
          "The erased coordinates remain uniquely identifiable; the recovered bytes enter the ordinary durable fold.",
        nextGenerator:
          "Append the recovered signed atom through the existing ledger; retain the transport receipt for replay.",
      });
    case "undecodable-transport":
      return faultReceipt(
        scenario,
        "not-observed",
        0b1111_1111,
        "not-assessed",
        "not-observed",
        "not-observed",
        "no-semantic-receipt",
        {
          code: "ADE-R2",
          lesson: "The erasure pattern is underdetermined. Missing bytes are not an unresolved evidence atom.",
          nextGenerator:
            "Retain the transport diagnostic and request a new transmission; do not append +1 or -1 evidence.",
        },
      );
    case "altered-content":
      return faultReceipt(
        scenario,
        evidenceSign,
        0b0000_0001,
        "distinct-content",
        "settled",
        "witnessed",
        "distinct-fact",
        {
          code: "ADE-R3",
          lesson: "CRC-valid changed content has a different durable root and cannot overwrite the prior signed fact.",
          nextGenerator:
            "Append the new fact separately; if it corrects an earlier claim, emit an explicit -1 retraction and a new generator fact.",
        },
      );
    case "unresolved-witness":
      return faultReceipt(
        scenario,
        evidenceSign,
        0b0000_0001,
        "intact",
        "settled",
        "unresolved",
        "authority-unresolved",
        {
          code: "ADE-R4",
          lesson: "An absent local witness leaves authority unresolved, not invalid and not globally false.",
          nextGenerator:
            "Retain the event and request a locally verifiable witness binding before any authority-dependent action.",
        },
      );
    case "visible-witness-conflict":
      return faultReceipt(scenario, evidenceSign, 0b0000_0001, "intact", "settled", "disputed", "authority-disputed", {
        code: "ADE-R5",
        lesson: "Conflicting visible local witness atoms are disputed; choosing one silently would erase evidence.",
        nextGenerator:
          "Retain both witness atoms, block authority-dependent action, and emit a separately signed correction only after local adjudication.",
      });
  }
}

/** Fixed-field canonical payload; no object-map enumeration enters the content address. */
export function encodeReplayableRoomFaultReceipt(receipt: ReplayableRoomFaultReceipt): string {
  return `${JSON.stringify({
    schema: receipt.schema,
    scenario: receipt.scenario,
    subject: { roomFingerprint: receipt.subject.roomFingerprint, eventRef: receipt.subject.eventRef },
    transport: {
      erasureMask: receipt.transport.erasureMask,
      classification: {
        mask: receipt.transport.classification.mask,
        erasedCount: receipt.transport.classification.erasedCount,
        status: receipt.transport.classification.status,
      },
      semanticReceipt: receipt.transport.semanticReceipt,
    },
    registers: {
      evidenceSign: receipt.registers.evidenceSign,
      contentIntegrity: receipt.registers.contentIntegrity,
      causalContinuity: receipt.registers.causalContinuity,
      genesisAuthority: receipt.registers.genesisAuthority,
    },
    outcome: receipt.outcome,
    teaching: {
      code: receipt.teaching.code,
      lesson: receipt.teaching.lesson,
      nextGenerator: receipt.teaching.nextGenerator,
    },
  })}\n`;
}

export function addressReplayableRoomFaultReceipt(
  receipt: ReplayableRoomFaultReceipt,
): ContentAddressedReplayableRoomFaultReceipt {
  const contentKey = makeStorageRecord(encodeReplayableRoomFaultReceipt(receipt)).key;
  return { receipt, contentKey };
}

export function verifyReplayableRoomFaultReceipt(addressed: ContentAddressedReplayableRoomFaultReceipt): boolean {
  return addressReplayableRoomFaultReceipt(addressed.receipt).contentKey === addressed.contentKey;
}

/** Persist an immutable replay receipt through the existing ZetaDB/DAGFS storage boundary. */
export async function persistReplayableRoomFaultReceipt(
  storage: ZetaStorageCell,
  receipt: ReplayableRoomFaultReceipt,
): Promise<RoomEvidenceResult<StoredReplayableRoomFaultReceipt>> {
  const addressed = addressReplayableRoomFaultReceipt(receipt);
  const written: StorageResult<string> = await storage.write(encodeReplayableRoomFaultReceipt(receipt));
  if (!written.ok) return failed(`fault receipt storage write failed: ${written.reason}`);
  if (written.value !== addressed.contentKey)
    return failed("fault receipt storage key does not bind its canonical payload");
  return succeeded({ ...addressed, duplicate: false });
}
