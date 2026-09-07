/**
 * attestation-consent-expiry-receipt.ts — finite local observation over one bound
 * attestation subject window. It does not detect consent or grant authority.
 */
import { createHash } from "node:crypto";
import {
  verifyAttestationRecord,
  type AttestationRecord,
  type AttestationVerdict,
  type PersonaKeyRoster,
  type SignatureVerifier,
} from "./attestation-record.ts";

export const CONSENT_EXPIRY_RECEIPT_SCHEMA = "zeta.attestation-consent-expiry-receipt/v1";
export const OBSERVATION_SCOPE = "attestation-window-observation";
export const LOCAL_STATUS_ONLY = "local-status-only";

export type ProvenanceMode = "bound-attestation" | "test-only-bound-adapter";
export type WindowStatus = "within-declared-window" | "expired-declared-window" | "not-yet-declared-window";
export type ConsentExpiryStatus = WindowStatus | "defer-provenance-not-bound";

export interface ConsentExpiryInput {
  readonly rawRecordUtf8: string;
  readonly attestationRecordSha256: string;
  readonly scopeId: string;
  readonly evaluationInstant: string;
  readonly evaluationMode: string;
  readonly roster: PersonaKeyRoster;
  readonly verifier?: SignatureVerifier;
  /** Test-only injection. Production callers must omit this field. */
  readonly testOnlyBinding?: AttestationVerdict;
}

export interface ConsentExpiryReceipt {
  readonly schema: typeof CONSENT_EXPIRY_RECEIPT_SCHEMA;
  readonly provenanceMode: ProvenanceMode;
  readonly attestationRecordSha256: string;
  readonly scopeId: typeof OBSERVATION_SCOPE;
  readonly evaluationInstant: string;
  readonly evaluationMode: typeof LOCAL_STATUS_ONLY;
  readonly status: ConsentExpiryStatus;
}

export type ConsentExpiryOutcome =
  | { readonly kind: "receipt"; readonly receipt: ConsentExpiryReceipt }
  | { readonly kind: "refuse"; readonly reason: string }
  | { readonly kind: "defer"; readonly reason: "provenance-not-bound" };

function sha256Utf8(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function parseRecord(rawRecordUtf8: string): AttestationRecord | null {
  try {
    const parsed: unknown = JSON.parse(rawRecordUtf8);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as AttestationRecord;
  } catch {
    return null;
  }
}

function parseUtc(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function localStatus(evaluation: number, start: number, end: number): WindowStatus {
  if (evaluation < start) return "not-yet-declared-window";
  if (evaluation > end) return "expired-declared-window";
  return "within-declared-window";
}

/**
 * Evaluates only a signed subject window at an explicit caller-owned instant.
 * A test-only binding is accepted exclusively to exercise the structural positive
 * path because the committed corpus contains no production bound attestation.
 */
export function evaluateConsentExpiry(input: ConsentExpiryInput): ConsentExpiryOutcome {
  if (input.scopeId !== OBSERVATION_SCOPE) return { kind: "refuse", reason: "unsupported-scope" };
  if (input.evaluationMode !== LOCAL_STATUS_ONLY) return { kind: "refuse", reason: "unsupported-evaluation-mode" };
  if (sha256Utf8(input.rawRecordUtf8) !== input.attestationRecordSha256) {
    return { kind: "refuse", reason: "identity-mismatch" };
  }

  const record = parseRecord(input.rawRecordUtf8);
  if (record === null) return { kind: "refuse", reason: "malformed-record" };
  const binding =
    input.testOnlyBinding ??
    (input.verifier === undefined
      ? verifyAttestationRecord(record, { roster: input.roster })
      : verifyAttestationRecord(record, { roster: input.roster, verifier: input.verifier }));
  if (binding.status === "unbound") return { kind: "defer", reason: "provenance-not-bound" };
  if (binding.status === "refused") return { kind: "refuse", reason: `attestation-${binding.reason}` };

  const evaluation = parseUtc(input.evaluationInstant);
  const start = parseUtc(record.attestation.windowStart);
  const end = parseUtc(record.attestation.windowEnd);
  if (evaluation === null || start === null || end === null || end < start) {
    return { kind: "refuse", reason: "malformed-window-or-instant" };
  }

  return {
    kind: "receipt",
    receipt: {
      schema: CONSENT_EXPIRY_RECEIPT_SCHEMA,
      provenanceMode: input.testOnlyBinding === undefined ? "bound-attestation" : "test-only-bound-adapter",
      attestationRecordSha256: input.attestationRecordSha256,
      scopeId: OBSERVATION_SCOPE,
      evaluationInstant: input.evaluationInstant,
      evaluationMode: LOCAL_STATUS_ONLY,
      status: localStatus(evaluation, start, end),
    },
  };
}

export function renderCanonicalConsentExpiryReceipt(receipt: ConsentExpiryReceipt): string {
  return `${JSON.stringify(receipt)}\n`;
}

/** Recomputes the local structural query and rejects reordered or altered receipt bytes. */
export function verifyCanonicalConsentExpiryReceipt(input: ConsentExpiryInput, receipt: string): boolean {
  const outcome = evaluateConsentExpiry(input);
  if (outcome.kind !== "receipt") return false;
  if (receiptHasForbiddenAuthorityFields(receipt)) return false;
  return receipt === renderCanonicalConsentExpiryReceipt(outcome.receipt);
}

export function receiptHasForbiddenAuthorityFields(receipt: string): boolean {
  const parsed: unknown = JSON.parse(receipt);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return true;
  const keys = Object.keys(parsed as Record<string, unknown>);
  return ["authority", "permission", "score", "vote", "threshold", "quorum", "consensus", "trust"].some((key) =>
    keys.includes(key),
  );
}
