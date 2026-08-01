// zeta-creds-crypto.ts — pure crypto primitives for 081KSKBP80008QG0R003AX2A69 credential persistence.
//
// 081KSKBP80008QG0R003AX2A69 sub-row .1 (smallest concrete substrate slice). Pure functions; no I/O.
// Composes with:
//   - tools/installer/zeta-creds-persist.ts (081KSKBP80008QG0R003AX2A69.2; consumes encrypt)
//   - tools/installer/zeta-creds-restore.ts (081KSKBP80008QG0R003AX2A69.2; consumes decrypt)
//   - docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-*.md
//
// Threat model (Phase 1 scope; per row body):
//   - Attacker has physical USB access → blob on ESP is readable as a file
//   - Attacker can copy ESP contents to a different-UUID USB
//   - Attacker does NOT have operator passphrase
//   - Operator passphrase is typed at boot; never persisted to disk
//
// Defense:
//   - scrypt (memory-hard work-factor KDF; OWASP 2026 defaults N=2^17 r=8 p=1)
//     stretches the low-entropy operator passphrase into a high-entropy
//     intermediate — makes brute-force attempts memory-prohibitively expensive
//     on GPU/ASIC (security-review HIGH finding 2026-05-27 fix; HKDF alone
//     assumes high-entropy IKM which passphrases violate)
//   - HKDF-SHA256 then binds the stretched secret to USB UUID so blob copied
//     to a different-UUID USB cannot be decrypted (assuming passphrase secret)
//   - AES-256-GCM authenticated encryption rejects tampered ciphertext
//   - Wrong passphrase produces a different scrypt output → different HKDF
//     key → GCM auth tag verification fails → decrypt returns error
//     (NOT garbled plaintext)
//
// Phase 3 (NOT this row): hardware-bound keys (TPM / YubiKey / Touch-ID-derived)
//   to defeat the "attacker stole USB AND knows passphrase AND knows UUID" case.

import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";

function hkdfHmacSync(hashAlgo: string, ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, keyLen: number): Buffer {
  const prk = createHmac(hashAlgo, salt.length ? salt : new Uint8Array(32)).update(ikm).digest();
  const okm = Buffer.alloc(keyLen);
  let t = Buffer.alloc(0);
  let offset = 0;
  let counter = 1;
  while (offset < keyLen) {
    const hmac = createHmac(hashAlgo, prk);
    hmac.update(t);
    hmac.update(info);
    hmac.update(Buffer.from([counter]));
    t = hmac.digest();
    const chunkLen = Math.min(t.length, keyLen - offset);
    t.copy(okm, offset, 0, chunkLen);
    offset += chunkLen;
    counter++;
  }
  return okm;
}

/** AES-256-GCM key size (bytes). */
export const KEY_LEN = 32;

/** AES-GCM IV size (bytes); 12 is the AES-GCM spec recommendation. */
export const IV_LEN = 12;

/** AES-GCM authentication tag size (bytes). */
export const TAG_LEN = 16;

/** Salt length (bytes); shared between scrypt + HKDF; ships per-blob in envelope. */
export const SALT_LEN = 32;

/** HKDF info string — bound to this row's substrate-engineering purpose. */
export const HKDF_INFO = Buffer.from("zeta-b0852-cred-persistence-v1");

/**
 * scrypt cost parameters (OWASP-recommended 2026 defaults for password-derived keys).
 *
 * N=2^17 (~128MB memory cost) makes brute-force exponentially expensive on GPU/ASIC
 * because the attacker needs to commit ~128MB of memory PER GUESS. r=8 + p=1 are
 * standard. Operational cost: ~1-2s per derivation on modern CPU (operator types
 * passphrase ONCE at boot; this latency is acceptable; brute-force latency is the
 * defense).
 *
 * NOTE: must allow node:crypto to bypass its default `maxmem` (32MB); we set
 * `maxmem: 256 * 1024 * 1024` (256MB) which comfortably accommodates N=2^17.
 */
export const SCRYPT_N = 1 << 17;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SCRYPT_MAXMEM = 256 * 1024 * 1024;
export const SCRYPT_STRETCHED_LEN = 32;

/**
 * Envelope written to /esp/zeta-creds.enc. Wire format is a single binary
 * blob (Phase 1 implementation will length-prefix-pack salt+iv+tag+ciphertext).
 * This module returns the structured object; serialization is a sibling
 * concern (081KSKBP80008QG0R003AX2A69.2 persist CLI).
 */
export interface Envelope {
  readonly salt: Uint8Array;
  readonly iv: Uint8Array;
  readonly tag: Uint8Array;
  readonly ciphertext: Uint8Array;
}

/**
 * Derive AES-256 key from binding material + operator passphrase via scrypt → HKDF chain.
 *
 * `bindingMaterial` is the factor-specific stable (or ephemeral) string — today the
 * shipped path passes `usbUuid`; research factors pass iSerial / keyfile / TPM seal.
 * See `credential-binding-model.ts` for the reformat/swap expectation matrix.
 */
export function deriveKeyFromBindingMaterial(
  bindingMaterial: string,
  passphrase: string,
  salt: Uint8Array,
): Buffer {
  if (salt.length !== SALT_LEN) {
    throw new Error(`salt must be ${SALT_LEN} bytes; got ${salt.length}`);
  }
  if (bindingMaterial.length === 0) {
    throw new Error("bindingMaterial must be non-empty");
  }
  const saltCopy = Buffer.from(salt);
  const stretched = scryptSync(passphrase, saltCopy, SCRYPT_STRETCHED_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  const ikm = Buffer.concat([
    Buffer.from(bindingMaterial, "utf8"),
    Buffer.from("|", "utf8"),
    stretched,
  ]);
  const derived = hkdfHmacSync("sha256", ikm, saltCopy, HKDF_INFO, KEY_LEN);
  return Buffer.from(derived);
}

/**
 * Derive AES-256 key from USB UUID + operator passphrase via scrypt → HKDF chain.
 *
 * **Two-layer derivation** (security-review HIGH finding 2026-05-27 fix):
 *
 *   1. scrypt(passphrase, salt) → stretched 32 bytes
 *      - Memory-hard work-factor-tunable KDF (N=2^17 ~128MB; ~1-2s on modern CPU)
 *      - Makes low-entropy passphrases brute-force-resistant (HKDF alone assumes
 *        high-entropy IKM; passphrases violate that assumption)
 *      - OWASP 2026 recommended parameters
 *   2. HKDF-SHA256(usbUuid || stretched, salt, info) → 32 byte AES-256 key
 *      - Binds key to USB UUID for the copy-to-different-UUID-attack defense
 *        named by Aaron 2026-05-27: "we can put a key on the usb too if wnated
 *        tied to the uuid so it can't be copied to uuid"
 *      - HKDF's high-entropy IKM assumption is now satisfied (scrypt output is
 *        cryptographically random)
 *
 * Both layers must produce matching outputs at decrypt time for the AES-GCM
 * auth tag to verify. Wrong passphrase → different scrypt output → different
 * HKDF key → GCM auth tag fails → structured error returned (not garbled
 * plaintext).
 *
 * @param usbUuid - the USB stick's filesystem UUID (operator-provided; e.g.
 *                  from `blkid -s UUID -o value /dev/disk6s1`)
 * @param passphrase - operator passphrase typed at boot
 * @param salt - 32 random bytes; freshly generated per encryption, stored in
 *               the envelope; required at decrypt time; shared between scrypt
 *               + HKDF (same salt across different functions with different
 *               parameters is safe per modern crypto guidance)
 * @returns 32-byte AES-256 key
 */
export function deriveKey(usbUuid: string, passphrase: string, salt: Uint8Array): Buffer {
  return deriveKeyFromBindingMaterial(usbUuid, passphrase, salt);
}

/** Encrypt with explicit binding material (generalized factor path). */
export function encryptWithBindingMaterial(
  plaintext: Uint8Array,
  bindingMaterial: string,
  passphrase: string,
): Envelope {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKeyFromBindingMaterial(bindingMaterial, passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { salt, iv, tag, ciphertext };
}

/**
 * Encrypt plaintext with AES-256-GCM. Generates fresh salt + IV per call.
 *
 * @param plaintext - cred-blob bytes (cleartext)
 * @param usbUuid - USB filesystem UUID (bound into key derivation)
 * @param passphrase - operator passphrase
 * @returns envelope { salt, iv, tag, ciphertext } ready for serialization
 */
export function encrypt(plaintext: Uint8Array, usbUuid: string, passphrase: string): Envelope {
  return encryptWithBindingMaterial(plaintext, usbUuid, passphrase);
}

/**
 * Decrypt envelope. Returns plaintext on success OR { error } on:
 *   - wrong passphrase (auth tag verification fails)
 *   - wrong binding material (auth tag verification fails)
 *   - tampered ciphertext (auth tag verification fails)
 *   - tampered tag (auth tag verification fails)
 *   - tampered salt (key derives differently → auth tag verification fails)
 *
 * Operationally: any error means the operator should fall through to the
 * picker's option (2) fresh-login OR option (3) operator-provided PAT path
 * per the row's auth-method picker semantics.
 *
 * @param envelope - serialized blob contents
 * @param bindingMaterial - factor material used at encrypt (today: USB UUID string)
 * @param passphrase - operator passphrase
 * @returns plaintext on success OR { error: string } on any failure
 */
export function decrypt(
  envelope: Envelope,
  bindingMaterial: string,
  passphrase: string,
): Buffer | { readonly error: string } {
  if (envelope.salt.length !== SALT_LEN) {
    return { error: `salt must be ${SALT_LEN} bytes; got ${envelope.salt.length}` };
  }
  if (envelope.iv.length !== IV_LEN) {
    return { error: `iv must be ${IV_LEN} bytes; got ${envelope.iv.length}` };
  }
  if (envelope.tag.length !== TAG_LEN) {
    return { error: `tag must be ${TAG_LEN} bytes; got ${envelope.tag.length}` };
  }
  const key = deriveKeyFromBindingMaterial(bindingMaterial, passphrase, envelope.salt);
  const decipher = createDecipheriv("aes-256-gcm", key, envelope.iv);
  decipher.setAuthTag(envelope.tag);
  try {
    const plaintext = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
    return plaintext;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      error: `decryption failed (wrong passphrase / wrong binding / tampered blob): ${msg}`,
    };
  }
}
