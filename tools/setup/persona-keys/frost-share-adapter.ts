// Pluggable FROST share storage — software file | sealed-file | HSM/TPM seal (stub).
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// Layer 1 of agent-native-key-custody: use-without-extract when HSM adapter lands.
// Slice 1: software adapter wraps existing ~/.config/zeta frost share files;
// HSM adapter is an honest stub (throws) until platform bindings exist.

import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes as nodeRandomBytes } from "node:crypto";
import type { FrostCaCustodyEffects, FrostShareFileV1 } from "./frost-ca-custody.ts";
import { FROST_SHARE_SCHEMA, frostSharePath } from "./frost-ca-custody.ts";
import type { FrostKeyShare } from "./frost.ts";

export interface FrostShareRecord {
  readonly x: number;
  readonly secretShare: bigint;
  readonly threshold: number;
  readonly totalShares: number;
  readonly groupPublicKeyHex: string;
}

/** Read/write a participant's FROST share without exposing adapter details to custody logic. */
export interface FrostShareAdapter {
  readonly kind: "software-file" | "sealed-file" | "hsm-stub";
  loadShare(x: number): FrostShareRecord | null;
  storeShare(record: FrostShareRecord, ca: string): void;
}

export const FROST_SEALED_SHARE_SCHEMA = "zeta-frost-share-sealed-v1" as const;

export interface FrostShareSealBox {
  readonly alg: "AES-256-GCM" | string;
  readonly nonceB64: string;
  readonly ciphertextB64: string;
  readonly tagB64?: string;
}

export interface FrostShareSealEffects {
  /** Software-seal key supplied by the host, keychain, TPM binding, or tests. */
  readonly getSealKey: () => Uint8Array;
  readonly randomBytes?: (length: number) => Uint8Array;
  /** Optional door for platform-specific sealing. Defaults to AES-256-GCM. */
  readonly seal?: (plaintext: Uint8Array, aad: Uint8Array) => FrostShareSealBox;
  readonly unseal?: (box: FrostShareSealBox, aad: Uint8Array) => Uint8Array;
}

interface FrostSealedShareFileV1 {
  readonly schema: typeof FROST_SEALED_SHARE_SCHEMA;
  readonly ca: string;
  readonly threshold: number;
  readonly totalShares: number;
  readonly groupPublicKeyHex: string;
  readonly x: number;
  readonly sealed: FrostShareSealBox;
}

export function createSoftwareFileShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
): FrostShareAdapter {
  return {
    kind: "software-file",
    loadShare(x: number): FrostShareRecord | null {
      const p = frostSharePath(sharesDir, x);
      if (!fx.exists(p)) return null;
      const body = JSON.parse(fx.readText(p)) as FrostShareFileV1;
      if (body.schema !== FROST_SHARE_SCHEMA || body.ca !== ca) return null;
      return {
        x: body.x,
        secretShare: BigInt(body.secretShare),
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
      };
    },
    storeShare(record: FrostShareRecord, caName: string): void {
      const body: FrostShareFileV1 = {
        schema: FROST_SHARE_SCHEMA,
        ca: caName,
        threshold: record.threshold,
        totalShares: record.totalShares,
        groupPublicKeyHex: record.groupPublicKeyHex,
        x: record.x,
        secretShare: record.secretShare.toString(10),
      };
      fx.writeText(frostSharePath(sharesDir, record.x), JSON.stringify(body, null, 2) + "\n", 0o600);
    },
  };
}

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

function sealedShareAad(body: Omit<FrostSealedShareFileV1, "sealed">): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(body));
}

function defaultSeal(sealFx: FrostShareSealEffects, plaintext: Uint8Array, aad: Uint8Array): FrostShareSealBox {
  const key = sealFx.getSealKey();
  if (key.length !== 32) throw new Error("frost-share-adapter: sealed-file requires 32-byte AES key");
  const nonce = sealFx.randomBytes?.(12) ?? new Uint8Array(nodeRandomBytes(12));
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "AES-256-GCM",
    nonceB64: toB64(nonce),
    ciphertextB64: toB64(ciphertext),
    tagB64: toB64(tag),
  };
}

function defaultUnseal(sealFx: FrostShareSealEffects, box: FrostShareSealBox, aad: Uint8Array): Uint8Array {
  if (box.alg !== "AES-256-GCM") {
    throw new Error(`frost-share-adapter: unsupported seal alg ${box.alg}`);
  }
  if (box.tagB64 === undefined) throw new Error("frost-share-adapter: missing AES-GCM tag");
  const key = sealFx.getSealKey();
  if (key.length !== 32) throw new Error("frost-share-adapter: sealed-file requires 32-byte AES key");
  const decipher = createDecipheriv("aes-256-gcm", key, fromB64(box.nonceB64));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(box.tagB64, "base64"));
  return new Uint8Array(Buffer.concat([decipher.update(fromB64(box.ciphertextB64)), decipher.final()]));
}

export function createSealedFileShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  sealFx: FrostShareSealEffects,
): FrostShareAdapter {
  return {
    kind: "sealed-file",
    loadShare(x: number): FrostShareRecord | null {
      const p = frostSharePath(sharesDir, x);
      if (!fx.exists(p)) return null;
      const body = JSON.parse(fx.readText(p)) as FrostSealedShareFileV1;
      if (body.schema !== FROST_SEALED_SHARE_SCHEMA || body.ca !== ca) return null;
      const aadBody: Omit<FrostSealedShareFileV1, "sealed"> = {
        schema: body.schema,
        ca: body.ca,
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
        x: body.x,
      };
      const plaintext =
        sealFx.unseal?.(body.sealed, sealedShareAad(aadBody)) ??
        defaultUnseal(sealFx, body.sealed, sealedShareAad(aadBody));
      const payload = JSON.parse(new TextDecoder().decode(plaintext)) as { readonly secretShare: string };
      return {
        x: body.x,
        secretShare: BigInt(payload.secretShare),
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
      };
    },
    storeShare(record: FrostShareRecord, caName: string): void {
      const aadBody: Omit<FrostSealedShareFileV1, "sealed"> = {
        schema: FROST_SEALED_SHARE_SCHEMA,
        ca: caName,
        threshold: record.threshold,
        totalShares: record.totalShares,
        groupPublicKeyHex: record.groupPublicKeyHex,
        x: record.x,
      };
      const plaintext = new TextEncoder().encode(JSON.stringify({ secretShare: record.secretShare.toString(10) }));
      const aad = sealedShareAad(aadBody);
      const sealed = sealFx.seal?.(plaintext, aad) ?? defaultSeal(sealFx, plaintext, aad);
      const body: FrostSealedShareFileV1 = { ...aadBody, sealed };
      fx.writeText(frostSharePath(sharesDir, record.x), JSON.stringify(body, null, 2) + "\n", 0o600);
    },
  };
}

/** Honest stub — documents the HSM seam; does not pretend hardware exists. */
export function createHsmShareAdapterStub(): FrostShareAdapter {
  const err = (): never => {
    throw new Error(
      "frost-share-adapter: HSM/TPM seal not implemented — use software-file adapter or land 081KWPHRNFW HSM slice",
    );
  };
  return {
    kind: "hsm-stub",
    loadShare: err,
    storeShare: err,
  };
}

/** Load all local shares for threshold signing (software adapter). */
export function loadFrostKeyShares(adapter: FrostShareAdapter, totalShares: number): FrostKeyShare[] {
  const out: FrostKeyShare[] = [];
  for (let x = 1; x <= totalShares; x++) {
    const rec = adapter.loadShare(x);
    if (rec) out.push({ x: rec.x, secretShare: rec.secretShare });
  }
  return out;
}
