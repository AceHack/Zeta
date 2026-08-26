/**
 * tools/crypto/better-git-crypt/crypto.ts
 *
 * 081KSNY2Z0008QG0R002JKH50A v1 — Phase 2 REAL crypto implementation (operator-authorized
 * 2026-05-31). Wires the type substrate in `types.ts` to actual
 * post-quantum primitives:
 *
 *   - KEM:       XWing (ML-KEM-768 + X25519 hybrid) — @noble/post-quantum/hybrid.js
 *   - Signature: ML-DSA-65 (Dilithium)             — @noble/post-quantum/ml-dsa.js
 *   - KDF:       HKDF-SHA256                        — @noble/hashes/hkdf.js + sha2.js
 *   - AEAD:      ChaCha20-Poly1305                  — @noble/ciphers/chacha.js
 *   - Envelope:  CBOR (canonical/deterministic)     — cborg
 *
 * Dependency versions (pinned current-latest per dep-pin-search-first-authority,
 * verified empirically against the installed packages 2026-05-31):
 *   @noble/post-quantum@0.6.1  @noble/ciphers@2.2.0  @noble/hashes@2.2.0  cborg@5.1.1
 *
 * API shapes EMPIRICALLY VERIFIED against the installed packages (the runtime
 * is the oracle — the v1 design memo's pseudocode used a different chacha
 * call-shape + a 3-arg ml_dsa sign that do NOT exist in these versions):
 *   - chacha20poly1305(key, nonce).encrypt(pt) / .decrypt(ct)   [NOT (key).encrypt(nonce,pt)]
 *   - ml_dsa65.sign(msg, sk) / verify(sig, msg, pk)             [2-arg; no context positional]
 *   - XWing.keygen() -> {publicKey, secretKey}; encapsulate(pk) -> {cipherText, sharedSecret};
 *     decapsulate(ct, sk) -> sharedSecret
 *   - hkdf(sha256, ikm, salt?, info, len)
 *
 * Domain separation: the signature is computed over the CBOR encoding of the
 * envelope's signed view, which INCLUDES the `context` field
 * ("zeta.git-crypt.file.v1"). That puts the domain-separation tag inside the
 * signed bytes — so the (unavailable) ml_dsa context positional is not needed.
 *
 * Scope (v1):
 *   - content-only encryption (081KSNY2Z0008QG0R0020KXAPS); metadata (filenames / commit msgs) deferred
 *   - git-at-rest threat model (081KSNY2Z0008QG0R001FN4DDB)
 *   - single envelope KEM column (all recipients share one KEM) per memo
 *   - forward-only revocation (081KSNY2Z0008QG0R0008EJDW1 future)
 *
 * Composes with: types.ts (determineEncryptionPath planner + validation),
 * 081KSNY2Z0008QG0R002JKH50A design memo, 081KSNY2Z0008QG0R0030V5ZVS (agent private encrypted state consumer),
 * asymmetric-authorship + monad-propagation rules (Result<T, TFeedback>).
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
// `@noble/post-quantum` 0.7.0 dropped the legacy `XWing` alias; the canonical
// export is `ml_kem768_x25519`. In 0.6.1 the alias was literally
// `export const XWing = ml_kem768_x25519`, and the preset's own definition is
// byte-identical between the two releases (only `combineKEMS` changed, gaining
// argument validation), so this rename moves no wire bytes and invalidates no
// golden vector. The local name stays `XWing` because that is the IETF draft's
// name for this hybrid KEM (draft-connolly-cfrg-xwing-kem) and the vocabulary
// this module, its types, and its documentation are written in.
import { ml_kem768_x25519 as XWing } from "@noble/post-quantum/hybrid.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { encode as cborEncode, decode as cborDecode } from "cborg";

import {
  type EncryptionContext,
  type EncryptionFeedback,
  type DecryptionFeedback,
  type FileEnvelope,
  type RecipientKey,
  type RecipientSlot,
  determineEncryptionPath,
  validateEnvelopeStructure,
} from "./types";

/** v1 algorithm ids — the only ships-v1 set this implementation wires. */
export const V1_KEM_ALG = "ML-KEM-768+X25519";
export const V1_SIG_ALG = "ML-DSA-65";
export const V1_CONTEXT = "zeta.git-crypt.file.v1";

/** ChaCha20-Poly1305 nonce length (bytes). */
const NONCE_LEN = 12;
/** Content encryption key length (bytes) — ChaCha20 key size. */
const CEK_LEN = 32;
/**
 * Zero nonce used for the per-recipient CEK wrap.
 *
 * SAFETY INVARIANT (per design memo): the wrap key is single-use. It is
 * `HKDF(sha256, sharedSecret, info=cek-wrap.v1:<identity>)` where
 * `sharedSecret` is freshly produced by `XWing.encapsulate` on every
 * encryption (XWing draws fresh randomness per call). A given wrapKey
 * therefore encrypts exactly one CEK, ever — so a fixed (zero) nonce can
 * never be reused under the same key, which is the only condition
 * ChaCha20-Poly1305 nonce-uniqueness requires. The content nonce, by
 * contrast, IS random (the CEK is reused across recipients within one file,
 * though still single-file-scoped).
 */
const WRAP_ZERO_NONCE = new Uint8Array(NONCE_LEN);

/**
 * A recipient's PRIVATE key material — the secret counterpart to the public
 * `RecipientKey` in types.ts. Held only by the identity itself; never
 * serialized into an envelope.
 */
export interface RecipientSecretKeys {
  readonly identity: string;
  readonly kemSecretKey: Uint8Array; // XWing secret key
  readonly sigSecretKey: Uint8Array; // ML-DSA-65 secret key
}

/** A freshly generated keypair: the publishable public half + the private half. */
export interface GeneratedKeyPair {
  readonly publicKey: RecipientKey;
  readonly secretKeys: RecipientSecretKeys;
}

/** Result of `encrypt` — Result<FileEnvelope, EncryptionFeedback>. */
export type EncryptResult = { ok: true; envelope: FileEnvelope } | { ok: false; feedback: EncryptionFeedback };

/** Result of `decrypt` — Result<plaintext, DecryptionFeedback>. */
export type DecryptResult = { ok: true; plaintext: Uint8Array } | { ok: false; feedback: DecryptionFeedback };

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Byte equality for public-key comparison (constant-time not required — keys are public). */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

/**
 * First invalid recipient identity (empty or duplicated), or null if all are
 * non-empty + unique. Empty identities would mint an envelope with an empty
 * `signerIdentity`/slot id that decrypt can't resolve (undecryptable); dupes
 * make a valid later slot unreachable via first-match.
 */
function firstInvalidIdentity(recipients: readonly RecipientKey[]): { identity: string; reason: string } | null {
  const seen = new Set<string>();
  for (const r of recipients) {
    if (r.identity.length === 0) return { identity: r.identity, reason: "empty recipient identity" };
    if (seen.has(r.identity)) return { identity: r.identity, reason: "duplicate recipient identity" };
    seen.add(r.identity);
  }
  return null;
}

/**
 * Generate a v1 recipient keypair (XWing KEM + ML-DSA-65 signature).
 *
 * v1 supports `seedSource: "random-bytes"` only; `adinkra-derived` (081KRW63S0008QG0R000QJR08H)
 * and `hsm-derived` are future substrate. The parameter is NARROWED to the
 * literal `"random-bytes"` (not the full `SeedSource` union) so an unsupported
 * source is a COMPILE error, not a runtime throw — the strongest form of the
 * Result-shaped boundary `encrypt`/`decrypt` use: the unsupported case is made
 * unrepresentable rather than handled. When `adinkra-derived`/`hsm-derived`
 * land, widen the parameter to the union AND return `Result<GeneratedKeyPair,
 * { kind: "SeedSourceNotAvailable"; seedSource }>` to keep the boundary typed.
 * (Codex/Copilot P1 on PR #6217 — exported surface must not throw on a
 * user-selectable option.)
 */
export function generateRecipientKeyPair(
  identity: string,
  seedSource: "random-bytes" = "random-bytes",
): GeneratedKeyPair {
  const kem = XWing.keygen();
  const sig = ml_dsa65.keygen();
  return {
    publicKey: {
      identity,
      kemAlgId: V1_KEM_ALG,
      sigAlgId: V1_SIG_ALG,
      publicKemKey: kem.publicKey,
      publicSigKey: sig.publicKey,
      seedSource,
      composesWith: ["081KSNY2Z0008QG0R002JKH50A", "081KSNY2Z0008QG0R0037X4DP4"],
    },
    secretKeys: {
      identity,
      kemSecretKey: kem.secretKey,
      sigSecretKey: sig.secretKey,
    },
  };
}

/**
 * Prove a KEM SECRET key actually unwraps a given slot to the expected CEK.
 * encrypt uses this on the SENDER's own slot: the guards above only compare
 * sender PUBLIC KEM keys + self-verify the signature key, so a stale/mismatched
 * KEM secret (right public key, wrong secret) would still mint an envelope the
 * sender — a required self-recipient — can't decrypt. This is the KEM-side
 * analogue of the signature self-verify. (Codex P2 on PR #6217.)
 */
function kemSecretUnwrapsSlot(slot: RecipientSlot, kemSecretKey: Uint8Array, expectedCek: Uint8Array): boolean {
  try {
    const sharedSecret = XWing.decapsulate(slot.kemCt, kemSecretKey);
    const wrapKey = hkdf(sha256, sharedSecret, undefined, slot.kdfInfo, CEK_LEN);
    const unwrapped = chacha20poly1305(wrapKey, WRAP_ZERO_NONCE).decrypt(slot.wrappedCek);
    return bytesEqual(unwrapped, expectedCek);
  } catch {
    return false;
  }
}

/**
 * Canonical CBOR encoding of the envelope's SIGNED VIEW — every field except
 * `signature`. Both encrypt (to produce the signature) and decrypt (to verify
 * it) call this with the same field set; cborg's canonical/deterministic
 * encoding then guarantees byte-identical input to sign/verify.
 *
 * The recipient slots are mapped to a fixed shape so no extraneous field can
 * leak into (or fall out of) the signed bytes.
 */
function encodeSignedView(env: {
  version: number;
  context: string;
  algKem: string;
  algKdf: string;
  algWrap: string;
  algContent: string;
  algSig: string;
  recipients: readonly RecipientSlot[];
  ciphertext: Uint8Array;
  contentNonce: Uint8Array;
  signerIdentity: string;
}): Uint8Array {
  return cborEncode({
    version: env.version,
    context: env.context,
    algKem: env.algKem,
    algKdf: env.algKdf,
    algWrap: env.algWrap,
    algContent: env.algContent,
    algSig: env.algSig,
    recipients: env.recipients.map((r) => ({
      identity: r.identity,
      kemCt: r.kemCt,
      wrappedCek: r.wrappedCek,
      kdfInfo: r.kdfInfo,
    })),
    ciphertext: env.ciphertext,
    contentNonce: env.contentNonce,
    signerIdentity: env.signerIdentity,
  });
}

/**
 * Encrypt `context.plaintext` to all `context.recipients`, signed by
 * `context.sender` (whose private keys are supplied separately — the public
 * `RecipientKey` in the context carries no secret).
 *
 * Returns Result<FileEnvelope, EncryptionFeedback>. All failure modes are the
 * function's own authored TFeedback variants (asymmetric-authorship rule).
 */
export function encrypt(context: EncryptionContext, senderSecretKeys: RecipientSecretKeys): EncryptResult {
  // 1. Plan the algorithm path (reuses the validated planner from types.ts).
  const plan = determineEncryptionPath(context);
  if (!plan.ok) {
    return { ok: false, feedback: plan.feedback };
  }

  // 2. This implementation only DISPATCHES XWing KEM + ML-DSA-65 signatures.
  //    The planner accepts any ships-v1 alg from the registry (e.g. SLH-DSA),
  //    but signing with ml_dsa65 while recording a different `algSig` would
  //    write LYING metadata (bytes are ML-DSA, label says otherwise). Reject
  //    anything we don't actually dispatch so the envelope never lies.
  if (plan.path.algKem !== V1_KEM_ALG) {
    return { ok: false, feedback: { kind: "AlgUnsupported", algId: plan.path.algKem } };
  }
  if (plan.path.algSig !== V1_SIG_ALG) {
    return { ok: false, feedback: { kind: "AlgUnsupported", algId: plan.path.algSig } };
  }

  // 2b. Reject empty + duplicate recipient identities. decrypt resolves a
  //     recipient by identity via first-match: an empty identity would mint a
  //     slot keyed by "" that decrypt can't resolve (undecryptable artifact),
  //     and two slots for the same identity (e.g. a stale registry entry kept
  //     before the current key) would make a valid later slot unreachable and
  //     surface a spurious KemFailure. Since the sender MUST be in the recipient
  //     set (checked next), this also rejects an empty sender identity before it
  //     can sign an envelope with signerIdentity:"". Keep identities non-empty +
  //     unique.
  const invalidId = firstInvalidIdentity(context.recipients);
  if (invalidId !== null) {
    return {
      ok: false,
      feedback: { kind: "RecipientKeyInvalid", identity: invalidId.identity, reason: invalidId.reason },
    };
  }

  // 3. v1 supports random-bytes seed source only.
  if (context.seedSource !== "random-bytes") {
    return {
      ok: false,
      feedback: { kind: "SeedSourceNotAvailable", seedSource: context.seedSource },
    };
  }

  // 4. The sender's secret keys must belong to the sender identity in context.
  if (senderSecretKeys.identity !== context.sender.identity) {
    return {
      ok: false,
      feedback: {
        kind: "RecipientKeyInvalid",
        identity: senderSecretKeys.identity,
        reason: `sender secret key identity "${senderSecretKeys.identity}" != context sender "${context.sender.identity}"`,
      },
    };
  }

  // 4b. The sender's entry in `recipients` must carry the SAME public KEM key as
  //     `context.sender`. Otherwise the CEK gets wrapped to a stale/rotated key
  //     and the sender can't decrypt their own envelope (key-rotation / registry
  //     staleness footgun). Compare the entry that will actually be encrypted to.
  const senderRecipientEntry = context.recipients.find((r) => r.identity === context.sender.identity);
  if (senderRecipientEntry && !bytesEqual(senderRecipientEntry.publicKemKey, context.sender.publicKemKey)) {
    return {
      ok: false,
      feedback: {
        kind: "RecipientKeyInvalid",
        identity: context.sender.identity,
        reason: "sender's recipients entry has a different publicKemKey than context.sender (stale/rotated key)",
      },
    };
  }

  // 5. Content encryption key + content nonce.
  const cek = randomBytes(CEK_LEN);
  const contentNonce = randomBytes(NONCE_LEN);

  // 6. Per-recipient KEM encapsulation + CEK wrap.
  const slots: RecipientSlot[] = [];
  for (const r of context.recipients) {
    let cipherText: Uint8Array;
    let sharedSecret: Uint8Array;
    try {
      const enc = XWing.encapsulate(r.publicKemKey);
      cipherText = enc.cipherText;
      sharedSecret = enc.sharedSecret;
    } catch {
      return { ok: false, feedback: { kind: "KemFailure", recipientIdentity: r.identity } };
    }
    const kdfInfo = utf8(`zeta.git-crypt.cek-wrap.v1:${r.identity}`);
    const wrapKey = hkdf(sha256, sharedSecret, undefined, kdfInfo, CEK_LEN);
    // Zero nonce is safe here — see WRAP_ZERO_NONCE invariant (single-use wrapKey).
    const wrappedCek = chacha20poly1305(wrapKey, WRAP_ZERO_NONCE).encrypt(cek);
    slots.push({ identity: r.identity, kemCt: cipherText, wrappedCek, kdfInfo });
  }

  // 7. Encrypt the content once with the CEK.
  const ciphertext = chacha20poly1305(cek, contentNonce).encrypt(context.plaintext);

  // 8. Sign the signed view (everything except the signature). The signed
  //    bytes include `context` for domain separation.
  const signedView = {
    version: 1 as const,
    context: V1_CONTEXT,
    algKem: plan.path.algKem,
    algKdf: plan.path.algKdf,
    algWrap: plan.path.algWrap,
    algContent: plan.path.algContent,
    algSig: plan.path.algSig,
    recipients: slots,
    ciphertext,
    contentNonce,
    signerIdentity: context.sender.identity,
  };
  const toSign = encodeSignedView(signedView);
  let signature: Uint8Array;
  try {
    signature = ml_dsa65.sign(toSign, senderSecretKeys.sigSecretKey);
  } catch {
    return { ok: false, feedback: { kind: "SignatureFailure" } };
  }

  // Self-verify against the sender's DECLARED public sig key. If the supplied
  // secret key doesn't match (right identity, wrong/stale key), this catches it
  // at encrypt time — otherwise we'd mint an envelope that no one can verify
  // (an undecryptable artifact). Surface it as RecipientKeyInvalid now. The
  // verify is wrapped because Noble's key decoder THROWS on a malformed/truncated
  // publicSigKey — a throw here would break the EncryptResult contract.
  let selfVerified: boolean;
  try {
    selfVerified = ml_dsa65.verify(signature, toSign, context.sender.publicSigKey);
  } catch {
    selfVerified = false;
  }
  if (!selfVerified) {
    return {
      ok: false,
      feedback: {
        kind: "RecipientKeyInvalid",
        identity: context.sender.identity,
        reason: "sender secret key does not match (or sender publicSigKey is malformed)",
      },
    };
  }

  // KEM-side self-check: prove the sender's own KEM SECRET unwraps the sender's
  // slot back to the CEK. Without this, a stale/mismatched KEM secret (right
  // public key, wrong secret) mints an envelope the sender can't decrypt.
  const senderSlot = slots.find((s) => s.identity === context.sender.identity);
  if (!senderSlot || !kemSecretUnwrapsSlot(senderSlot, senderSecretKeys.kemSecretKey, cek)) {
    return {
      ok: false,
      feedback: {
        kind: "RecipientKeyInvalid",
        identity: context.sender.identity,
        reason: "sender KEM secret key does not unwrap the sender slot (stale/mismatched KEM secret)",
      },
    };
  }

  return { ok: true, envelope: { ...signedView, signature } };
}

/**
 * Decrypt an envelope as `recipientSecretKeys`, verifying it was signed by the
 * holder of `senderPublicSigKey` (the caller resolves the envelope's
 * `signerIdentity` to a known public sig key, e.g. via a recipients registry).
 *
 * Signature is verified FIRST (fail-closed on tampering before touching the
 * KEM). Returns Result<plaintext, DecryptionFeedback>.
 */
export function decrypt(
  envelope: FileEnvelope,
  recipientSecretKeys: RecipientSecretKeys,
  senderPublicSigKey: Uint8Array,
): DecryptResult {
  // 1. Version + context checks FIRST, so the precise typed feedback is
  //    reachable. The `version` literal type says `1`, but decrypt may be
  //    handed UNTRUSTED decoded input (e.g. a hand-built or future-version
  //    envelope) where it isn't — hence the runtime guard the type can't see.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard on untrusted decoded input; the compile-time literal type does not hold for arbitrary runtime envelopes
  if (envelope.version !== 1) {
    return { ok: false, feedback: { kind: "VersionUnsupported", version: envelope.version } };
  }
  if (envelope.context !== V1_CONTEXT) {
    return {
      ok: false,
      feedback: { kind: "ContextMismatch", expected: V1_CONTEXT, actual: envelope.context },
    };
  }

  // 2. This implementation only dispatches XWing KEM + ML-DSA-65. Reject any
  //    envelope whose declared algorithms we don't actually verify with — an
  //    envelope labelled e.g. algSig "SLH-DSA" must NOT be verified with
  //    ml_dsa65 (that would treat lying metadata as valid).
  if (envelope.algKem !== V1_KEM_ALG) {
    return { ok: false, feedback: { kind: "AlgUnsupported", algId: envelope.algKem } };
  }
  if (envelope.algSig !== V1_SIG_ALG) {
    return { ok: false, feedback: { kind: "AlgUnsupported", algId: envelope.algSig } };
  }

  // 3. Structural validation (alg classes / non-empty shape).
  try {
    validateEnvelopeStructure(envelope);
  } catch (e) {
    return {
      ok: false,
      feedback: { kind: "EnvelopeMalformed", reason: e instanceof Error ? e.message : String(e) },
    };
  }

  // 4. Verify the signature over the signed view (fail-closed on tampering).
  let sigValid: boolean;
  try {
    sigValid = ml_dsa65.verify(envelope.signature, encodeSignedView(envelope), senderPublicSigKey);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return { ok: false, feedback: { kind: "SignatureInvalid", signerIdentity: envelope.signerIdentity } };
  }

  // 5. Locate this recipient's slot.
  const slot = envelope.recipients.find((r) => r.identity === recipientSecretKeys.identity);
  if (!slot) {
    return { ok: false, feedback: { kind: "RecipientNotInEnvelope", identity: recipientSecretKeys.identity } };
  }

  // 6. KEM decapsulate -> shared secret -> unwrap CEK.
  //    Per FIPS-203 implicit rejection, decapsulate never throws on a bad
  //    ciphertext; it returns a (wrong) shared secret, and the CEK-unwrap
  //    AEAD tag check below is what fails -> KemFailure.
  let cek: Uint8Array;
  try {
    const sharedSecret = XWing.decapsulate(slot.kemCt, recipientSecretKeys.kemSecretKey);
    const wrapKey = hkdf(sha256, sharedSecret, undefined, slot.kdfInfo, CEK_LEN);
    cek = chacha20poly1305(wrapKey, WRAP_ZERO_NONCE).decrypt(slot.wrappedCek);
  } catch {
    return { ok: false, feedback: { kind: "KemFailure" } };
  }

  // 7. Decrypt content under the CEK.
  try {
    const plaintext = chacha20poly1305(cek, envelope.contentNonce).decrypt(envelope.ciphertext);
    return { ok: true, plaintext };
  } catch {
    return { ok: false, feedback: { kind: "ContentDecryptFailure" } };
  }
}

/**
 * Encode a full envelope (including signature) to canonical CBOR bytes — the
 * on-disk / in-git file format.
 */
export function encodeEnvelope(envelope: FileEnvelope): Uint8Array {
  return cborEncode({
    version: envelope.version,
    context: envelope.context,
    algKem: envelope.algKem,
    algKdf: envelope.algKdf,
    algWrap: envelope.algWrap,
    algContent: envelope.algContent,
    algSig: envelope.algSig,
    recipients: envelope.recipients.map((r) => ({
      identity: r.identity,
      kemCt: r.kemCt,
      wrappedCek: r.wrappedCek,
      kdfInfo: r.kdfInfo,
    })),
    ciphertext: envelope.ciphertext,
    contentNonce: envelope.contentNonce,
    signerIdentity: envelope.signerIdentity,
    signature: envelope.signature,
  });
}

/** Result of `decodeEnvelope` — Result<FileEnvelope, DecryptionFeedback>. */
export type DecodeEnvelopeResult = { ok: true; envelope: FileEnvelope } | { ok: false; feedback: DecryptionFeedback };

/** Decode + shape-validate the recipient-slot array (extracted to keep decodeEnvelope simple). */
function decodeRecipientSlots(arr: readonly unknown[]): { slots: RecipientSlot[] } | { error: string } {
  const isBytes = (v: unknown): v is Uint8Array => v instanceof Uint8Array;
  const isStr = (v: unknown): v is string => typeof v === "string";
  const slots: RecipientSlot[] = [];
  for (const r of arr) {
    if (typeof r !== "object" || r === null) return { error: "recipient slot is not an object" };
    const rr = r as Record<string, unknown>;
    if (!isStr(rr.identity) || !isBytes(rr.kemCt) || !isBytes(rr.wrappedCek) || !isBytes(rr.kdfInfo)) {
      return { error: "recipient slot field shape mismatch" };
    }
    slots.push({ identity: rr.identity, kemCt: rr.kemCt, wrappedCek: rr.wrappedCek, kdfInfo: rr.kdfInfo });
  }
  return { slots };
}

/**
 * Decode on-disk CBOR bytes back into a `FileEnvelope`, structurally validated.
 * Returns `EnvelopeMalformed` feedback on any decode / shape failure rather
 * than throwing (Result-shaped per monad-propagation rule).
 */
export function decodeEnvelope(bytes: Uint8Array): DecodeEnvelopeResult {
  let raw: unknown;
  try {
    raw = cborDecode(bytes);
  } catch (e) {
    return {
      ok: false,
      feedback: {
        kind: "EnvelopeMalformed",
        reason: `cbor decode failed: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, feedback: { kind: "EnvelopeMalformed", reason: "decoded value is not an object" } };
  }
  const o = raw as Record<string, unknown>;
  const isBytes = (v: unknown): v is Uint8Array => v instanceof Uint8Array;
  const isStr = (v: unknown): v is string => typeof v === "string";
  // Split the version check from the shape check so a well-formed envelope of an
  // UNSUPPORTED version gets the precise VersionUnsupported feedback (the same
  // condition decrypt exposes), not a generic EnvelopeMalformed.
  if (typeof o.version !== "number") {
    return { ok: false, feedback: { kind: "EnvelopeMalformed", reason: "version is not a number" } };
  }
  if (o.version !== 1) {
    return { ok: false, feedback: { kind: "VersionUnsupported", version: o.version } };
  }
  if (
    !isStr(o.context) ||
    !isStr(o.algKem) ||
    !isStr(o.algKdf) ||
    !isStr(o.algWrap) ||
    !isStr(o.algContent) ||
    !isStr(o.algSig) ||
    !Array.isArray(o.recipients) ||
    !isBytes(o.ciphertext) ||
    !isBytes(o.contentNonce) ||
    !isStr(o.signerIdentity) ||
    !isBytes(o.signature)
  ) {
    return { ok: false, feedback: { kind: "EnvelopeMalformed", reason: "envelope field shape mismatch" } };
  }
  // contentNonce is a fixed-size ChaCha20-Poly1305 nonce — reject a wrong-length
  // one here (a signed-but-malformed nonce would otherwise only surface as a
  // late ContentDecryptFailure rather than a structural EnvelopeMalformed).
  if (o.contentNonce.length !== NONCE_LEN) {
    return {
      ok: false,
      feedback: {
        kind: "EnvelopeMalformed",
        reason: `contentNonce must be ${String(NONCE_LEN)} bytes, got ${String(o.contentNonce.length)}`,
      },
    };
  }
  const recipientsResult = decodeRecipientSlots(o.recipients as readonly unknown[]);
  if ("error" in recipientsResult) {
    return { ok: false, feedback: { kind: "EnvelopeMalformed", reason: recipientsResult.error } };
  }
  const recipients = recipientsResult.slots;
  const envelope: FileEnvelope = {
    version: 1,
    context: o.context,
    algKem: o.algKem,
    algKdf: o.algKdf,
    algWrap: o.algWrap,
    algContent: o.algContent,
    algSig: o.algSig,
    recipients,
    ciphertext: o.ciphertext,
    contentNonce: o.contentNonce,
    signerIdentity: o.signerIdentity,
    signature: o.signature,
  };
  try {
    validateEnvelopeStructure(envelope);
  } catch (e) {
    return { ok: false, feedback: { kind: "EnvelopeMalformed", reason: e instanceof Error ? e.message : String(e) } };
  }
  // Canonical-bytes enforcement (closes two findings at once):
  //  - non-canonical CBOR malleability: a byte-level rewrite to another valid
  //    encoding of the same fields would otherwise decode + re-encode-for-verify
  //    and still pass. (Codex P2)
  //  - unknown top-level fields: extra unauthenticated data dropped from the
  //    reconstructed signed view would otherwise ride along in a valid envelope. (Copilot P1)
  // Re-encoding the reconstructed envelope canonically and requiring it to equal
  // the input bytes rejects BOTH: the only valid on-disk form is the canonical
  // encodeEnvelope output, so the bytes are bit-locked to the signed content.
  if (!bytesEqual(encodeEnvelope(envelope), bytes)) {
    return {
      ok: false,
      feedback: { kind: "EnvelopeMalformed", reason: "non-canonical CBOR encoding or unknown fields present" },
    };
  }
  return { ok: true, envelope };
}
