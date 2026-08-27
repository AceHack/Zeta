/**
 * Public-room adjudication parser — discovery only.
 * It binds a named local teaching record to its manifest entry and never promotes it into global authority.
 */
export type LocalWitnessAdjudicationView = {
  readonly authority: "unresolved" | "disputed";
  readonly disposition: "request-local-witness" | "retain-conflict";
  readonly teaching: { readonly code: "RWA-1" | "RWA-2"; readonly lesson: string; readonly nextGenerator: string };
};

export type LocalWitnessAdjudicationReference = { readonly file: string; readonly contentKey: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

export function parseLocalWitnessAdjudicationReference(value: unknown, eventId: string): LocalWitnessAdjudicationReference {
  if (!isRecord(value)) throw new Error("adjudication reference must be an object");
  const file = requireString(value.file, "adjudication reference file");
  const contentKey = requireString(value.contentKey, "adjudication reference content key");
  if (file !== `adjudications/${eventId}.json`) throw new Error("adjudication reference must bind this event ID");
  if (!/^[0-9a-f]{32}$/.test(contentKey)) throw new Error("adjudication reference content key must be 32 lowercase hex characters");
  return { file, contentKey };
}

export function parseLocalWitnessAdjudication(
  value: unknown,
  expected: { readonly eventId: string; readonly auditContentKey: string; readonly receiptContentKey: string },
): LocalWitnessAdjudicationView {
  if (!isRecord(value) || value.schema !== "zeta.room-witness-adjudication.v1" || !isRecord(value.prior) || !isRecord(value.teaching)) {
    throw new Error("adjudication does not match zeta.room-witness-adjudication.v1");
  }
  if (
    requireString(value.prior.eventId, "adjudication prior event ID") !== expected.eventId ||
    requireString(value.prior.auditContentKey, "adjudication prior audit key") !== expected.auditContentKey ||
    requireString(value.prior.receiptContentKey, "adjudication prior receipt key") !== expected.receiptContentKey
  ) {
    throw new Error("adjudication prior does not bind the discovered envelope");
  }
  const authority = value.authority;
  const disposition = value.disposition;
  const code = value.teaching.code;
  if (authority !== "unresolved" && authority !== "disputed") throw new Error("adjudication authority is not a retained local state");
  if (disposition !== "request-local-witness" && disposition !== "retain-conflict") throw new Error("adjudication disposition is invalid");
  if (code !== "RWA-1" && code !== "RWA-2") throw new Error("adjudication teaching code is invalid");
  if (
    (authority === "unresolved" && (disposition !== "request-local-witness" || code !== "RWA-1")) ||
    (authority === "disputed" && (disposition !== "retain-conflict" || code !== "RWA-2"))
  ) {
    throw new Error("adjudication authority, disposition, and teaching code do not agree");
  }
  return {
    authority,
    disposition,
    teaching: {
      code,
      lesson: requireString(value.teaching.lesson, "adjudication lesson"),
      nextGenerator: requireString(value.teaching.nextGenerator, "adjudication next generator"),
    },
  };
}
