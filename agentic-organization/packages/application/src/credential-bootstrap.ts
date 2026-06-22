/**
 * Credential bootstrap — port of
 * `full-ai-cluster/nixos/modules/zeta-creds-restore.nix` (Merge1 §08).
 *
 * Boot-time credential restore from an encrypted blob produced at install time
 * and stored on the ESP. At boot the operator enters a passphrase; the blob is
 * decrypted via scrypt (KDF) → HKDF-SHA256 (key expansion) → AES-256-GCM
 * (authenticated decryption). Per-cred paths are populated before user-facing
 * services start.
 *
 * SECURITY (enforced below):
 *   - scrypt default N=2^20, r=8, p=1 (per source); overridable for tests
 *   - random 16-byte salt + 12-byte IV stored in the blob header (not hardcoded)
 *   - empty passphrase rejected
 *   - AES-256-GCM authenticates the blob header (version+params+salt+IV) as AAD
 *   - passphrase-derived key material is zeroed after use
 *   - never logs/emits passphrase, derived key, or decrypted credentials
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, scryptSync } from "node:crypto";

export type RestoredCredential = {
  readonly name: string;
  readonly path: string;
  readonly contentClass: "public_identifier" | "secret_material";
  readonly value: string;
};

export type BootstrapError =
  | { readonly kind: "decryption_failed"; readonly reason: string }
  | { readonly kind: "passphrase_required" }
  | { readonly kind: "blob_not_found"; readonly path: string };

export type BootstrapResult =
  | { readonly outcome: "ok"; readonly value: readonly RestoredCredential[] }
  | { readonly outcome: "feedback"; readonly error: BootstrapError };

export interface CredentialBootstrap {
  restore(blob: Uint8Array, passphrase: string): Promise<BootstrapResult>;
}

export type ScryptParams = {
  /** log2(N) — source uses 20 (N = 2^20). */
  readonly logN: number;
  readonly r: number;
  readonly p: number;
};

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { logN: 20, r: 8, p: 1 };

const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = 1 + 3 + SALT_LEN + IV_LEN; // version + (logN,r,p) + salt + iv
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const HKDF_INFO = ENCODER.encode("zeta-creds-aes-256-gcm");

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function deriveKey(passphrase: string, salt: Uint8Array, params: ScryptParams): Uint8Array {
  const pass = ENCODER.encode(passphrase);
  try {
    const N = 2 ** params.logN;
    const maxmem = 256 * N * params.r + 1024 * 1024;
    const prk = scryptSync(pass, salt, 32, { N, r: params.r, p: params.p, maxmem });
    const aesKey = new Uint8Array(hkdfSync("sha256", prk, salt, HKDF_INFO, 32));
    prk.fill(0);
    return aesKey;
  } finally {
    pass.fill(0); // zero passphrase bytes from memory
  }
}

/**
 * Encrypt credentials into a self-describing blob (install-time companion to
 * `restore`). Blob layout: [version|logN|r|p|salt(16)|iv(12)|tag(16)|ciphertext];
 * the header is authenticated as AES-GCM AAD.
 */
export function encryptCredentials(
  credentials: readonly RestoredCredential[],
  passphrase: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Uint8Array {
  if (passphrase === "") throw new Error("passphrase required");
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const header = concatBytes([new Uint8Array([VERSION, params.logN, params.r, params.p]), salt, iv]);
  const key = deriveKey(passphrase, salt, params);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(header);
    const plaintext = ENCODER.encode(JSON.stringify(credentials));
    const ciphertext = concatBytes([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return concatBytes([header, tag, ciphertext]);
  } finally {
    key.fill(0);
  }
}

/** Real credential bootstrap — scrypt + HKDF + AES-256-GCM. */
export function createCredentialBootstrap(): CredentialBootstrap {
  return {
    restore(blob: Uint8Array, passphrase: string): Promise<BootstrapResult> {
      if (passphrase === "") {
        return Promise.resolve({ outcome: "feedback", error: { kind: "passphrase_required" } });
      }
      if (blob.length < HEADER_LEN + TAG_LEN) {
        return Promise.resolve({
          outcome: "feedback",
          error: { kind: "decryption_failed", reason: "blob too short" },
        });
      }
      if (blob[0] !== VERSION) {
        return Promise.resolve({
          outcome: "feedback",
          error: { kind: "decryption_failed", reason: `unsupported version ${blob[0]}` },
        });
      }
      const params: ScryptParams = { logN: blob[1]!, r: blob[2]!, p: blob[3]! };
      const header = blob.subarray(0, HEADER_LEN);
      const salt = blob.subarray(4, 4 + SALT_LEN);
      const iv = blob.subarray(4 + SALT_LEN, HEADER_LEN);
      const tag = blob.subarray(HEADER_LEN, HEADER_LEN + TAG_LEN);
      const ciphertext = blob.subarray(HEADER_LEN + TAG_LEN);

      let key: Uint8Array;
      try {
        key = deriveKey(passphrase, salt, params);
      } catch (err) {
        return Promise.resolve({
          outcome: "feedback",
          error: { kind: "decryption_failed", reason: `kdf failed: ${(err as Error).message}` },
        });
      }
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(header);
        decipher.setAuthTag(tag);
        const plaintext = concatBytes([decipher.update(ciphertext), decipher.final()]);
        const parsed = JSON.parse(DECODER.decode(plaintext)) as readonly RestoredCredential[];
        return Promise.resolve({ outcome: "ok", value: parsed });
      } catch (err) {
        return Promise.resolve({
          outcome: "feedback",
          error: { kind: "decryption_failed", reason: (err as Error).message },
        });
      } finally {
        key.fill(0);
      }
    },
  };
}
