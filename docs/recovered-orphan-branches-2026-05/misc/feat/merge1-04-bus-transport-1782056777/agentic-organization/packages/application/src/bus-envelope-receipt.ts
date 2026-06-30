// bus-envelope-receipt.ts — Merge1 §04: HMAC-SHA256 envelope receipts.
//
// Port of the donor `tools/bus/envelope-receipt.ts` (absent from this repo's
// bus slice; implemented from the §04 spec). A receipt proves a bus message's
// INTEGRITY (payload digest) and optionally its AUTHENTICITY (sender HMAC over a
// canonical receipt core). Verification uses constant-time comparison so a
// forged signature leaks no timing signal.
//
// MP-6 (asymmetric authorship): the sender signs, the receiver verifies against
// a keyring it controls — the sender never forges an identity the receiver
// hasn't keyed.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { BusMessage, BusMessageEnvelope, RoomAgentId, RoomTopic, SenderRoomAgentId } from "./bus-types.ts";

export type BusEnvelopeReceipt = {
  readonly envelopeId: string;
  readonly from: SenderRoomAgentId;
  readonly to: RoomAgentId;
  readonly topic: RoomTopic;
  readonly payloadSha256: `sha256:${string}`;
  readonly senderKeyId?: string;
  readonly senderHmacSha256?: `hmac-sha256:${string}`;
};

export type BusEnvelopeSigningKey = {
  readonly keyId: string;
  readonly secret: string | Uint8Array;
  /** Validity window (inclusive lower bound), ISO-8601. */
  readonly notBeforeIso?: string;
  /** Validity window (exclusive upper bound), ISO-8601. */
  readonly notAfterIso?: string;
};

export type BusEnvelopeKeyring = Partial<Record<SenderRoomAgentId, readonly BusEnvelopeSigningKey[]>>;

// ── canonicalization ──────────────────────────────────────────────────────────

/** Stable JSON: object keys sorted recursively, so the digest is order-independent. */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

/** Digest the message body (topic + payload) — the thing whose integrity matters. */
function payloadDigest(message: BusMessage): `sha256:${string}` {
  const hex = createHash("sha256").update(canonicalize({ topic: message.topic, payload: message.payload })).digest("hex");
  return `sha256:${hex}`;
}

/** The bytes a sender signs: binds id, routing, topic, and payload digest together. */
function signingMaterial(receipt: Pick<BusEnvelopeReceipt, "envelopeId" | "from" | "to" | "topic" | "payloadSha256">): string {
  return [receipt.envelopeId, receipt.from, receipt.to, receipt.topic, receipt.payloadSha256].join("\n");
}

function hmacHex(secret: string | Uint8Array, material: string): string {
  return createHmac("sha256", secret).update(material).digest("hex");
}

/** Constant-time hex compare; length mismatch is an immediate (safe) false. */
function constantTimeEqualHex(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ── build / verify ────────────────────────────────────────────────────────────

/**
 * Build a receipt for an envelope. Always sets the payload digest; when a
 * `signingKey` is supplied, also stamps `senderKeyId` + `senderHmacSha256`.
 */
export function receiptForEnvelope(envelope: BusMessageEnvelope, signingKey?: BusEnvelopeSigningKey): BusEnvelopeReceipt {
  const payloadSha256 = payloadDigest(envelope);
  const core = { envelopeId: envelope.id, from: envelope.from, to: envelope.to, topic: envelope.topic, payloadSha256 };
  if (signingKey === undefined) return core;
  const hmac = hmacHex(signingKey.secret, signingMaterial(core));
  return { ...core, senderKeyId: signingKey.keyId, senderHmacSha256: `hmac-sha256:${hmac}` };
}

/** True if `key` is within its validity window at `atIso` (open-ended bounds allowed). */
export function validateReceiptKeyringPolicy(key: BusEnvelopeSigningKey, atIso: string): boolean {
  if (key.notBeforeIso !== undefined && atIso < key.notBeforeIso) return false;
  if (key.notAfterIso !== undefined && atIso >= key.notAfterIso) return false;
  return true;
}

/**
 * Verify a receipt against its envelope and (for authenticated receipts) a
 * keyring. Returns false on any mismatch — wrong digest, unknown key, expired
 * key, or bad HMAC. An UNsigned receipt is accepted on integrity alone (digest
 * match); callers that require authenticity should check `senderHmacSha256` is
 * present before trusting the result.
 */
export function authenticatedReceiptMatchesEnvelope(
  receipt: BusEnvelopeReceipt,
  envelope: BusMessageEnvelope,
  keyring: BusEnvelopeKeyring,
): boolean {
  // 1. Routing + identity must agree.
  if (
    receipt.envelopeId !== envelope.id ||
    receipt.from !== envelope.from ||
    receipt.to !== envelope.to ||
    receipt.topic !== envelope.topic
  ) {
    return false;
  }
  // 2. Integrity: recomputed payload digest must match (constant-time).
  const expectedDigest = payloadDigest(envelope);
  if (!constantTimeEqualHex(receipt.payloadSha256, expectedDigest)) return false;

  // 3. Unsigned receipt → integrity-only acceptance.
  if (receipt.senderKeyId === undefined || receipt.senderHmacSha256 === undefined) return true;

  // 4. Authenticity: find the named key, honor its validity window, verify HMAC.
  const keys = keyring[envelope.from];
  if (keys === undefined) return false;
  const key = keys.find((k) => k.keyId === receipt.senderKeyId);
  if (key === undefined) return false;
  if (!validateReceiptKeyringPolicy(key, envelope.publishedAt)) return false;

  const expectedHmac = `hmac-sha256:${hmacHex(key.secret, signingMaterial(receipt))}`;
  return constantTimeEqualHex(receipt.senderHmacSha256, expectedHmac);
}
