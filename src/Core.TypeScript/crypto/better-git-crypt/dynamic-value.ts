/**
 * tools/crypto/better-git-crypt/dynamic-value.ts
 *
 * 081KSNY2Z0008QG0R002JKH50A × 081KT07NV0008QG0R0032MCYER — the PRIVACY FACE of the DynamicValue 4×4.
 *
 * Encryption is the **privacy fence** (operator 2026-06-02: like a *memory fence*
 * in concurrency — a barrier the plaintext↔ciphertext boundary crosses; each
 * fence a hemostat in the chain built from the remainder). It is NOT a fifth
 * byte-locked golden-vector codec sitting next to json/cbor/xml/yaml: encryption
 * is nonce-non-deterministic, so the same value never encrypts to the same bytes.
 *
 * So privacy is a **TRANSFORM over the 4×4**, not a new point in the byte-lock:
 *   value → canonical CBOR (the deterministic inner — the SAME serialization the
 *   golden vectors pin) → wrap in the PQ lattice envelope (XWing ML-KEM + ML-DSA
 *   over canonical CBOR, per crypto.ts) → `.zc` ciphertext.
 *
 * The guarantee the fence provides: `decryptValue(encryptValue(v)) ≡ v` (VALUE
 * identity) even though the `.zc` bytes differ on every call (nonce). The value
 * that crosses the fence is exact because the deterministic inner is canonical
 * CBOR — the remainder/seed serialization the 4×4 consensus already locks.
 *
 * Dependency direction (load-bearing): this is TOOLING (better-git-crypt)
 * depending on the LIBRARY (dynamic-value/cbor) — never the reverse. The library
 * stays crypto-free; the privacy fence is a tooling concern layered on top.
 */

import {
  canonicalCbor,
  fromCanonicalCbor,
  type Tagged,
  type DecodeError,
} from "../../dynamic-value/cbor";
import { encryptBytes, decryptBytes, type SelfKeys } from "./files";
import type { RecipientKey, EncryptionFeedback, DecryptionFeedback } from "./types";

/** Result of {@link encryptValue} — the `.zc` envelope bytes, or an encrypt feedback. */
export type EncryptValueResult =
  | { ok: true; envelopeBytes: Uint8Array; recipientIdentities: string[] }
  | { ok: false; feedback: EncryptionFeedback };

/**
 * Result of {@link decryptValue}. Two distinct failure channels:
 *  - `feedback`    — crypto-layer failure (wrong key, tamper, version/context).
 *  - `decodeError` — the recovered plaintext was not canonical CBOR (a foreign /
 *    non-DynamicValue payload encrypted to you). AEAD makes silent corruption
 *    impossible, so this only fires on a genuinely wrong inner payload.
 */
export type DecryptValueResult =
  | { ok: true; value: Tagged }
  | { ok: false; feedback: DecryptionFeedback }
  | { ok: false; decodeError: DecodeError }
  | { ok: false; identityMismatch: { expected: string; actual: string } };

/**
 * Privacy face — encrypt a DynamicValue: `value → canonical CBOR → PQ envelope`.
 * Self-encrypt (only the secret-bundle holder can read) unless `extraRecipients`
 * are supplied (then those public recipients can also decrypt; `self` always can,
 * as sender + self-recipient).
 */
export function encryptValue(
  value: Tagged,
  self: SelfKeys,
  extraRecipients: readonly RecipientKey[] = [],
): EncryptValueResult {
  const enc = canonicalCbor(value);
  if (!enc.ok) {
    throw new Error(`encryptValue: canonicalCbor failed: ${enc.error}`);
  }
  const inner = Uint8Array.from(enc.value);
  return encryptBytes(inner, self, extraRecipients);
}

/**
 * Inverse — decrypt a `.zc` back to the DynamicValue: `envelope → PQ decrypt →
 * canonical CBOR decode`. `senderPublicSigKey` defaults to `self` (self-encrypted
 * files); pass the signer's public sig key for files another party encrypted, and
 * (RECOMMENDED for a foreign sender) `expectedSignerIdentity` to BIND the claimed
 * identity — mismatch surfaces on the `identityMismatch` channel (fail-closed).
 */
export function decryptValue(
  envelopeBytes: Uint8Array,
  self: SelfKeys,
  senderPublicSigKey?: Uint8Array,
  expectedSignerIdentity?: string,
): DecryptValueResult {
  const dec = decryptBytes(envelopeBytes, self, senderPublicSigKey, expectedSignerIdentity);
  if (!dec.ok) {
    return "identityMismatch" in dec
      ? { ok: false, identityMismatch: dec.identityMismatch }
      : { ok: false, feedback: dec.feedback };
  }
  const decoded = fromCanonicalCbor(Array.from(dec.plaintext));
  if (!decoded.ok) return { ok: false, decodeError: decoded.error };
  return { ok: true, value: decoded.value };
}
