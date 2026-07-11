// signing.ts -- Ace slice 3: pure Ed25519 authenticity primitives (zero-dep, node:crypto).
// Pure: no fs, no process. The signature covers the WHOLE manifest minus its own
// `signature` field, via recursive key-sorted canonical JSON (§3 of the design) — so
// every present + future manifest field is bound. content_hash (over `files`) is a
// SEPARATE slice-2 concern handled by store.ts/ace.ts, NOT here.
import {
  createHash, generateKeyPairSync, createPrivateKey, createPublicKey,
  sign as nodeSign, verify as nodeVerify,
} from "node:crypto";
import type { AceManifest } from "./store.ts";
import { canonicalBytes } from "./canonical.ts";

export interface Keypair { privatePem: string; publicSpkiB64: string; keyId: string; }
export interface AceSignature { algo: "ed25519"; key_id: string; sig: string; }
/** Minimal shape verifySignature needs from a trust-store entry (store.ts's LoadedTrustEntry satisfies it structurally). */
export interface TrustEntry { public_key: string; label?: string; }
export type VerifyResult =
  | { ok: true; key_id: string; label?: string }
  | { ok: false; reason: "no-signature" | "untrusted-key" | "bad-signature" | "unsupported-algo" };

/** key_id = "ed25519:" + first 16 hex of sha256(SPKI-DER). */
export function keyId(spkiB64: string): string {
  const der = Buffer.from(spkiB64, "base64");
  return "ed25519:" + createHash("sha256").update(der).digest("hex").slice(0, 16);
}

export function generateKeypair(): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicSpkiB64 = (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  return { privatePem, publicSpkiB64, keyId: keyId(publicSpkiB64) };
}

/** Whole manifest minus `signature`, via the shared canonical byte form (§8.1). */
export function canonicalManifestBytes(manifest: AceManifest): Uint8Array {
  const { signature, ...rest } = manifest as AceManifest & { signature?: AceSignature };
  void signature; // excluded from canonical bytes — only `rest` is serialized
  return canonicalBytes(rest);
}

export function signManifest(manifest: AceManifest, privatePem: string): AceSignature {
  const bytes = canonicalManifestBytes(manifest);
  const priv = createPrivateKey(privatePem);
  const sig = (nodeSign(null, bytes, priv) as Buffer).toString("base64");
  const spkiB64 = (createPublicKey(priv as any).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  return { algo: "ed25519", key_id: keyId(spkiB64), sig };
}

export function verifySignature(
  manifest: AceManifest, trustStore: Map<string, TrustEntry>,
): VerifyResult {
  const signature = (manifest as AceManifest & { signature?: AceSignature }).signature;
  if (!signature) return { ok: false, reason: "no-signature" };
  if (signature.algo !== "ed25519") return { ok: false, reason: "unsupported-algo" };
  const entry = trustStore.get(signature.key_id);
  if (!entry) return { ok: false, reason: "untrusted-key" };
  let verified = false;
  try {
    const pub = createPublicKey({ key: Buffer.from(entry.public_key, "base64"), format: "der", type: "spki" });
    verified = nodeVerify(null, canonicalManifestBytes(manifest), pub, Buffer.from(signature.sig, "base64"));
  } catch {
    verified = false; // malformed key/sig bytes -> treat as bad-signature, never throw
  }
  if (!verified) return { ok: false, reason: "bad-signature" };
  const result: VerifyResult = { ok: true, key_id: signature.key_id };
  if (entry.label !== undefined) (result as { ok: true; key_id: string; label?: string }).label = entry.label;
  return result;
}

export interface RevocationEntry { reason?: string; at: string }
export type RevocationMap = Record<string, Record<string, RevocationEntry>>;

/** Derive the SPKI-DER base64 public key + its keyId from a private PEM (for a self-verify
 *  trust store). Sibling of signIndex's internal signer-id derivation. */
export function publicKeyInfoFromPrivatePem(privatePem: string): { keyId: string; public_key: string } {
  const priv = createPrivateKey(privatePem);
  if (priv.asymmetricKeyType !== "ed25519") {
    throw new Error(`publicKeyInfoFromPrivatePem: expected an ed25519 key, got ${priv.asymmetricKeyType ?? "unknown"}`);
  }
  const public_key = (createPublicKey(priv as any).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  return { keyId: keyId(public_key), public_key };
}
