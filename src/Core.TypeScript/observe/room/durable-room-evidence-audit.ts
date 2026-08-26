/**
 * Durable room-evidence audit identity and local genesis authority.
 *
 * Receipt content, event identity, causal continuity, and local witness authority stay separate.
 * This module persists the exact event envelope and composes the existing receipt ledger with the
 * zero-crossing audit; it does not turn a local roster into global identity.
 */
import { merkleToHex, hashPayload, type ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import { canonicalBytes, verifySignedAssertion, type RosterEntry, type SignatureScheme } from "../signed-stamp";
import {
  auditView,
  genesisEventHash,
  mintContentFingerprint,
  mintEventId,
  type AuditGenesisAuthority,
  type AuditGenesisBinding,
  type GenesisWitnessVerdict,
  type SignedEvidenceDelta,
  type ZeroCrossingAuditView,
} from "../../research/zero-crossing-evidence-audit";
import {
  DurableRoomEvidenceLedger,
  encodeRoomEvidenceReceipt,
  foldRoomEvidence,
  roomEvidenceAtomKey,
  validateRoomEvidenceReceipt,
  type RoomEvidenceFold,
  type RoomEvidenceReceipt,
  type RoomEvidenceResult,
} from "./durable-room-evidence";

export const ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA = "zeta.room-evidence-audit-event.v1" as const;
export const ROOM_GENESIS_WITNESS_SCHEMA = "zeta.room-genesis-witness.v1" as const;
export const ROOM_GENESIS_WITNESS_DOMAIN = "zeta.room-genesis-witness.v1";

export interface RoomGenesisWitness {
  readonly schema: typeof ROOM_GENESIS_WITNESS_SCHEMA;
  readonly binding: AuditGenesisBinding;
  /** Lowercase hexadecimal signature bytes. */
  readonly signatureHex: string;
}

export interface RoomEvidenceAuditEvent {
  readonly schema: typeof ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA;
  readonly receipt: RoomEvidenceReceipt;
  readonly delta: SignedEvidenceDelta;
  /** Optional by design: an absent witness leaves sequence zero unresolved, not invalid. */
  readonly genesisWitness?: RoomGenesisWitness;
}

export interface RoomEvidenceAuditEventInput {
  readonly receipt: RoomEvidenceReceipt;
  readonly emitterId: string;
  readonly emitterSeq: number;
  readonly previousEventHash?: string;
  readonly genesisBinding?: AuditGenesisBinding;
  readonly genesisWitness?: RoomGenesisWitness;
}

export interface StoredRoomEvidenceAuditEvent {
  readonly receiptContentKey: string;
  readonly auditContentKey: string;
  readonly eventId: string;
  readonly duplicate: boolean;
}

export interface RoomEvidenceAuditFold {
  readonly evidence: RoomEvidenceFold;
  readonly audit: ZeroCrossingAuditView;
}

export interface DurableRoomEvidenceAuditLedgerOptions {
  readonly receiptLedger: DurableRoomEvidenceLedger;
  readonly auditStorage: ZetaStorageCell;
  readonly schemes: readonly SignatureScheme[];
  readonly roster: readonly RosterEntry[];
}

const encoder = new TextEncoder();

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

function hexToBytes(value: string): Uint8Array | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++)
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function canonicalBinding(binding: AuditGenesisBinding): string {
  return JSON.stringify({
    emitterId: binding.emitterId,
    signer: binding.signer,
    scheme: binding.scheme,
    keyFingerprint: binding.keyFingerprint,
    witnessRef: binding.witnessRef,
  });
}

/** Stable local-roster fingerprint for the exact public-key bytes. */
export function auditRosterKeyFingerprint(publicKey: Uint8Array): string {
  const hex = [...publicKey].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `zeta-merkle-text-v1:${merkleToHex(hashPayload(hex))}`;
}

/** The exact domain-separated bytes an external signer signs for one genesis binding. */
export function roomGenesisWitnessSigningBytes(binding: AuditGenesisBinding): Uint8Array {
  return canonicalBytes(ROOM_GENESIS_WITNESS_DOMAIN, binding.emitterId, encoder.encode(canonicalBinding(binding)));
}

/** Local authority built only from injected schemes, roster entries, and persisted witness atoms. */
export class LocalRosterGenesisAuthority implements AuditGenesisAuthority {
  private readonly schemes: readonly SignatureScheme[];
  private readonly roster: readonly RosterEntry[];
  private readonly witnesses: ReadonlyMap<string, RoomGenesisWitness | null>;

  constructor(
    schemes: readonly SignatureScheme[],
    roster: readonly RosterEntry[],
    witnesses: readonly RoomGenesisWitness[],
  ) {
    this.schemes = schemes;
    this.roster = roster;
    const byReference = new Map<string, RoomGenesisWitness | null>();
    for (const witness of witnesses) {
      const reference = witness.binding.witnessRef;
      const prior = byReference.get(reference);
      if (prior === undefined) byReference.set(reference, witness);
      else if (
        prior !== null &&
        (canonicalBinding(prior.binding) !== canonicalBinding(witness.binding) ||
          prior.signatureHex !== witness.signatureHex)
      )
        byReference.set(reference, null);
    }
    this.witnesses = byReference;
  }

  assessGenesis(binding: AuditGenesisBinding): GenesisWitnessVerdict {
    const witness = this.witnesses.get(binding.witnessRef);
    if (witness === undefined) return "unresolved";
    if (witness === null) return "disputed";
    if (canonicalBinding(witness.binding) !== canonicalBinding(binding)) return "disputed";

    const rosterEntry = this.roster.find((entry) => entry.signer === binding.signer && entry.scheme === binding.scheme);
    const scheme = this.schemes.find((candidate) => candidate.id === binding.scheme);
    if (rosterEntry === undefined || scheme === undefined) return "unresolved";
    if (auditRosterKeyFingerprint(rosterEntry.publicKey) !== binding.keyFingerprint) return "disputed";

    const signature = hexToBytes(witness.signatureHex);
    if (signature === null) return "disputed";
    const verdict = verifySignedAssertion(this.schemes, this.roster, {
      domain: ROOM_GENESIS_WITNESS_DOMAIN,
      scope: binding.emitterId,
      payload: encoder.encode(canonicalBinding(binding)),
      signer: binding.signer,
      scheme: binding.scheme,
      signature,
    });
    if (verdict.kind === "signature-verified") return "witnessed";
    if (verdict.kind === "signature-invalid") return "disputed";
    return "unresolved";
  }
}

/** Construct a content-bound audit event without deriving event identity from receipt identity. */
export function makeRoomEvidenceAuditEvent(
  input: RoomEvidenceAuditEventInput,
): RoomEvidenceResult<RoomEvidenceAuditEvent> {
  const validated = validateRoomEvidenceReceipt(input.receipt);
  if (!validated.ok) return validated;
  if (!isIdentifier(input.emitterId) || !Number.isSafeInteger(input.emitterSeq) || input.emitterSeq < 0) {
    return failed("audit event requires a printable emitter and non-negative logical sequence");
  }

  let previousEventHash: string;
  let genesisBinding: AuditGenesisBinding | undefined;
  if (input.emitterSeq === 0) {
    if (input.genesisBinding === undefined) return failed("sequence zero requires a genesis binding");
    genesisBinding = input.genesisBinding;
    if (genesisBinding.emitterId !== input.emitterId) return failed("genesis binding emitter must match event emitter");
    previousEventHash = genesisEventHash(genesisBinding);
    if (input.previousEventHash !== undefined && input.previousEventHash !== previousEventHash) {
      return failed("sequence-zero predecessor must equal the bound genesis hash");
    }
  } else {
    if (!isIdentifier(input.previousEventHash))
      return failed("non-genesis audit event requires its predecessor event hash");
    if (input.genesisBinding !== undefined || input.genesisWitness !== undefined) {
      return failed("only sequence zero may carry genesis material");
    }
    previousEventHash = input.previousEventHash;
  }

  const receipt = validated.value;
  const key = roomEvidenceAtomKey(receipt);
  const contentFingerprint = mintContentFingerprint(
    key,
    receipt.weight,
    receipt.uncertainty.meanPpm,
    receipt.uncertainty.precisionPpm,
  );
  const delta: SignedEvidenceDelta = {
    eventId: mintEventId(input.emitterId, input.emitterSeq, previousEventHash, contentFingerprint),
    emitterId: input.emitterId,
    emitterSeq: input.emitterSeq,
    ...(genesisBinding === undefined ? {} : { genesisBinding }),
    previousEventHash,
    contentFingerprint,
    key,
    weight: receipt.weight,
    meanPpm: receipt.uncertainty.meanPpm,
    precisionPpm: receipt.uncertainty.precisionPpm,
  };
  const event: RoomEvidenceAuditEvent = {
    schema: ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA,
    receipt,
    delta,
    ...(input.genesisWitness === undefined ? {} : { genesisWitness: input.genesisWitness }),
  };
  return validateRoomEvidenceAuditEvent(event);
}

export function validateRoomEvidenceAuditEvent(value: unknown): RoomEvidenceResult<RoomEvidenceAuditEvent> {
  if (!isRecord(value) || value.schema !== ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA) {
    return failed(`audit event schema must be ${ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA}`);
  }
  const receipt = validateRoomEvidenceReceipt(value.receipt);
  if (!receipt.ok) return receipt;
  if (!isRecord(value.delta)) return failed("audit event delta must be an object");
  const delta = value.delta as unknown as SignedEvidenceDelta;
  if (delta.key !== roomEvidenceAtomKey(receipt.value)) return failed("audit delta key does not bind the receipt atom");
  if (
    delta.weight !== receipt.value.weight ||
    delta.meanPpm !== receipt.value.uncertainty.meanPpm ||
    delta.precisionPpm !== receipt.value.uncertainty.precisionPpm
  ) {
    return failed("audit delta does not bind receipt sign and uncertainty");
  }
  try {
    auditView([delta]);
  } catch (error) {
    return failed(error instanceof Error ? error.message : "audit delta failed validation");
  }

  const witnessValue = value.genesisWitness;
  let genesisWitness: RoomGenesisWitness | undefined;
  if (witnessValue !== undefined) {
    if (delta.emitterSeq !== 0) return failed("only sequence zero may carry a genesis witness");
    if (
      !isRecord(witnessValue) ||
      witnessValue.schema !== ROOM_GENESIS_WITNESS_SCHEMA ||
      !isRecord(witnessValue.binding) ||
      !isIdentifier(witnessValue.signatureHex)
    ) {
      return failed("genesis witness must carry its schema, binding, and hexadecimal signature");
    }
    const binding = witnessValue.binding as unknown as AuditGenesisBinding;
    if (
      !isIdentifier(binding.emitterId) ||
      !isIdentifier(binding.signer) ||
      !isIdentifier(binding.scheme) ||
      !isIdentifier(binding.keyFingerprint) ||
      !isIdentifier(binding.witnessRef)
    ) {
      return failed("genesis witness binding fields must be printable identifiers");
    }
    genesisWitness = {
      schema: ROOM_GENESIS_WITNESS_SCHEMA,
      binding,
      signatureHex: witnessValue.signatureHex,
    };
  }
  return succeeded({
    schema: ROOM_EVIDENCE_AUDIT_EVENT_SCHEMA,
    receipt: receipt.value,
    delta,
    ...(genesisWitness === undefined ? {} : { genesisWitness }),
  });
}

export function encodeRoomEvidenceAuditEvent(event: RoomEvidenceAuditEvent): string {
  return JSON.stringify({
    schema: event.schema,
    receipt: JSON.parse(encodeRoomEvidenceReceipt(event.receipt)) as unknown,
    delta: {
      eventId: event.delta.eventId,
      emitterId: event.delta.emitterId,
      emitterSeq: event.delta.emitterSeq,
      ...(event.delta.genesisBinding === undefined ? {} : { genesisBinding: event.delta.genesisBinding }),
      previousEventHash: event.delta.previousEventHash,
      contentFingerprint: event.delta.contentFingerprint,
      key: event.delta.key,
      weight: event.delta.weight,
      meanPpm: event.delta.meanPpm,
      precisionPpm: event.delta.precisionPpm,
    },
    ...(event.genesisWitness === undefined ? {} : { genesisWitness: event.genesisWitness }),
  });
}

export function decodeRoomEvidenceAuditEvent(payload: string): RoomEvidenceResult<RoomEvidenceAuditEvent> {
  try {
    return validateRoomEvidenceAuditEvent(JSON.parse(payload));
  } catch {
    return failed("audit event payload is not valid JSON");
  }
}

/** Durable content-addressed audit envelope ledger, composed with the existing receipt ledger. */
export class DurableRoomEvidenceAuditLedger {
  private readonly receiptLedger: DurableRoomEvidenceLedger;
  private readonly auditStorage: ZetaStorageCell;
  private readonly schemes: readonly SignatureScheme[];
  private readonly roster: readonly RosterEntry[];
  private readonly known = new Map<string, RoomEvidenceAuditEvent>();

  constructor(options: DurableRoomEvidenceAuditLedgerOptions) {
    this.receiptLedger = options.receiptLedger;
    this.auditStorage = options.auditStorage;
    this.schemes = options.schemes;
    this.roster = options.roster;
  }

  async append(raw: RoomEvidenceAuditEvent): Promise<RoomEvidenceResult<StoredRoomEvidenceAuditEvent>> {
    const validated = validateRoomEvidenceAuditEvent(raw);
    if (!validated.ok) return validated;
    const event = validated.value;
    const encoded = encodeRoomEvidenceAuditEvent(event);
    const prior = this.known.get(event.delta.eventId);
    if (prior !== undefined && encodeRoomEvidenceAuditEvent(prior) !== encoded) {
      return failed(`eventId ${event.delta.eventId} was reused with conflicting durable evidence`);
    }
    const receiptStored = await this.receiptLedger.append(event.receipt);
    if (!receiptStored.ok) return receiptStored;
    const auditStored = await this.auditStorage.write(encoded);
    if (!auditStored.ok) return failed(`audit event persistence failed: ${auditStored.reason}`);
    const duplicate = prior !== undefined;
    this.known.set(event.delta.eventId, event);
    return succeeded({
      receiptContentKey: receiptStored.value.contentKey,
      auditContentKey: auditStored.value,
      eventId: event.delta.eventId,
      duplicate,
    });
  }

  async replay(contentKeys: readonly string[]): Promise<RoomEvidenceResult<RoomEvidenceAuditFold>> {
    for (const contentKey of contentKeys) {
      const read = await this.auditStorage.read(contentKey);
      if (!read.ok) return failed(`audit replay failed for ${contentKey}: ${read.reason}`);
      if (read.value === null) return failed(`audit replay missing content key ${contentKey}`);
      if (!this.auditStorage.verify(contentKey, read.value.payload))
        return failed(`audit replay hash mismatch for ${contentKey}`);
      const decoded = decodeRoomEvidenceAuditEvent(read.value.payload);
      if (!decoded.ok) return decoded;
      const appended = await this.append(decoded.value);
      if (!appended.ok) return appended;
    }
    return this.fold();
  }

  fold(): RoomEvidenceResult<RoomEvidenceAuditFold> {
    const events = [...this.known.values()];
    const evidence = foldRoomEvidence(events.map((event) => event.receipt));
    if (!evidence.ok) return evidence;
    const authority = new LocalRosterGenesisAuthority(
      this.schemes,
      this.roster,
      events.flatMap((event) => (event.genesisWitness === undefined ? [] : [event.genesisWitness])),
    );
    try {
      return succeeded({
        evidence: evidence.value,
        audit: auditView(
          events.map((event) => event.delta),
          authority,
        ),
      });
    } catch (error) {
      return failed(error instanceof Error ? error.message : "audit fold failed");
    }
  }
}
