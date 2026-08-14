// Pluggable FROST share storage: software file | sealed file | PKCS#11 | TPM 2.0 | declared fake.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// 081KWPHRNFW DoD item 5 (the L1 rung of the agent-sovereign-keys ladder, see
// docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md).
//
// ============================================================================
// READ THIS BEFORE TRUSTING ANY TIER BELOW
// ============================================================================
//
// use-without-extract is NOT met by any adapter in this file, and cannot be met
// behind this port as it is currently shaped. loadShare RETURNS the share
// scalar, so the raw secret necessarily lands in host RAM. Sovereignty
// invariant 2 says: if an adapter can return the share, it has failed the
// invariant regardless of what it encrypts.
//
// That fact is therefore made unfakeable at the type level: every adapter
// carries usesWithoutExtract typed as the LITERAL false. An adapter that tries
// to claim otherwise does not compile. Removing that marker requires changing
// the port -- see PORT CHANGE REQUIRED FOR L1 COMPLETION at the bottom.
//
// What the hardware tiers DO buy today is at-rest sealing: the share on disk is
// not readable without the chip. That is real and worth having (it is the
// "host root dumps a share at rest" row of the ladder threat model), and it is
// strictly less than use-without-extract. Do not conflate the two.
// ============================================================================

import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
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

/**
 * What actually protected the share. This is the security-bearing discriminator,
 * NOT kind (which only describes the storage shape).
 *
 * The fake tier is spelled in shouting case on purpose: it appears in the adapter
 * object, in the on-disk artifact, and in the seal algorithm string, so a fake
 * share is identifiable at runtime, at rest, and in a git diff. It is not
 * distinguished by documentation.
 */
export type FrostSealTier =
  | "software-plaintext"
  | "software-sealed"
  | "INSECURE-SOFTWARE-FAKE-HSM"
  | "hardware-pkcs11"
  | "hardware-tpm2";

export const HARDWARE_SEAL_TIERS: readonly FrostSealTier[] = ["hardware-pkcs11", "hardware-tpm2"];

export function isHardwareSealTier(tier: FrostSealTier): boolean {
  return HARDWARE_SEAL_TIERS.includes(tier);
}

/** Read/write a participant FROST share without exposing adapter details to custody logic. */
export interface FrostShareAdapter {
  /** Storage shape only. Carries NO security claim; read sealTier for that. */
  readonly kind: "software-file" | "sealed-file" | "hsm-stub";
  /** What actually protected the share. The security-bearing field. */
  readonly sealTier: FrostSealTier;
  /**
   * Literal false by construction. See the header: this port returns the share
   * scalar, so no adapter behind it can operate the share without extracting it.
   */
  readonly usesWithoutExtract: false;
  loadShare(x: number): FrostShareRecord | null;
  storeShare(record: FrostShareRecord, ca: string): void;
}

export const FROST_SEALED_SHARE_SCHEMA = "zeta-frost-share-sealed-v2" as const;
/** Pre-tier artifacts. Refused on load rather than silently read at an unknown tier. */
export const FROST_SEALED_SHARE_SCHEMA_V1 = "zeta-frost-share-sealed-v1" as const;

export interface FrostShareSealBox {
  readonly alg: string;
  readonly nonceB64: string;
  readonly ciphertextB64: string;
  readonly tagB64?: string;
}

export interface FrostShareSealEffects {
  /**
   * Software-seal key supplied by the host, keychain, or tests. A seal backend that
   * genuinely never releases key material (PKCS#11) throws here on purpose.
   */
  readonly getSealKey: () => Uint8Array;
  readonly randomBytes?: (length: number) => Uint8Array;
  /** Optional door for platform-specific sealing. Defaults to AES-256-GCM. */
  readonly seal?: (plaintext: Uint8Array, aad: Uint8Array) => FrostShareSealBox;
  readonly unseal?: (box: FrostShareSealBox, aad: Uint8Array) => Uint8Array;
  /**
   * Eager liveness check. Called once at adapter construction so an absent or
   * unusable chip fails LOUDLY and EARLY instead of at first signature. Absence of
   * this hook means there is nothing external to probe.
   */
  readonly probe?: () => void;
}

interface FrostSealedShareFileV2 {
  readonly schema: typeof FROST_SEALED_SHARE_SCHEMA;
  readonly sealTier: FrostSealTier;
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
    sealTier: "software-plaintext",
    usesWithoutExtract: false,
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

function sealedShareAad(body: Omit<FrostSealedShareFileV2, "sealed">): Uint8Array {
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
  if (!box.alg.endsWith("AES-256-GCM")) {
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

/**
 * Sealed-file adapter over an injected seal backend.
 *
 * The header binding (schema, tier, ca, threshold, totalShares, group pubkey, x) is
 * bound to the ciphertext TWICE:
 *   1. as AEAD associated data, where the backend is an AEAD (the AES-GCM default), and
 *   2. embedded INSIDE the plaintext and compared after decrypt.
 *
 * (2) exists because not every backend is an AEAD. The PKCS#11 backend below uses
 * CKM_AES_CBC_PAD, which supplies confidentiality and NO integrity and which has no
 * associated-data input at all. Without (2), the header of a PKCS#11-sealed share --
 * including its x index and its group public key -- would be freely editable.
 *
 * Stated precisely so it is not oversold: (2) is a binding CHECK, not a MAC. It detects
 * header substitution, and ciphertext tampering garbles the plaintext so the check
 * fails with overwhelming probability. It is NOT INT-CTXT. A token that offers
 * CKM_AES_GCM should use it; that upgrade is a named open item on 081KWPHRNFW.
 */
export function createSealedFileShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  sealFx: FrostShareSealEffects,
  sealTier: FrostSealTier = "software-sealed",
): FrostShareAdapter {
  sealFx.probe?.();
  return {
    kind: "sealed-file",
    sealTier,
    usesWithoutExtract: false,
    loadShare(x: number): FrostShareRecord | null {
      const p = frostSharePath(sharesDir, x);
      if (!fx.exists(p)) return null;
      const body = JSON.parse(fx.readText(p)) as FrostSealedShareFileV2;
      if ((body.schema as string) === FROST_SEALED_SHARE_SCHEMA_V1) {
        throw new Error(
          "frost-share-adapter: refusing pre-tier sealed artifact " +
            `${FROST_SEALED_SHARE_SCHEMA_V1} at x=${x}; it records no seal tier, so its ` +
            "protection level is unknown. Re-seal it under a declared tier.",
        );
      }
      if (body.schema !== FROST_SEALED_SHARE_SCHEMA) {
        throw new Error(`frost-share-adapter: unknown sealed-share schema ${String(body.schema)} at x=${x}`);
      }
      if (body.ca !== ca) return null;
      if (body.sealTier !== sealTier) {
        throw new Error(
          `frost-share-adapter: seal-tier mismatch at x=${x}: artifact was sealed by ` +
            `"${body.sealTier}" but this adapter is "${sealTier}". Refusing rather than ` +
            "silently accepting a differently-protected share.",
        );
      }
      const aadBody: Omit<FrostSealedShareFileV2, "sealed"> = {
        schema: body.schema,
        sealTier: body.sealTier,
        ca: body.ca,
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
        x: body.x,
      };
      const aad = sealedShareAad(aadBody);
      const plaintext = sealFx.unseal?.(body.sealed, aad) ?? defaultUnseal(sealFx, body.sealed, aad);
      const payload = JSON.parse(new TextDecoder().decode(plaintext)) as {
        readonly bind: string;
        readonly secretShare: string;
      };
      if (payload.bind !== new TextDecoder().decode(aad)) {
        throw new Error(
          `frost-share-adapter: seal-binding mismatch at x=${x}; the sealed header does not ` +
            "match the file header. Treat this share as tampered.",
        );
      }
      return {
        x: body.x,
        secretShare: BigInt(payload.secretShare),
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
      };
    },
    storeShare(record: FrostShareRecord, caName: string): void {
      const aadBody: Omit<FrostSealedShareFileV2, "sealed"> = {
        schema: FROST_SEALED_SHARE_SCHEMA,
        sealTier,
        ca: caName,
        threshold: record.threshold,
        totalShares: record.totalShares,
        groupPublicKeyHex: record.groupPublicKeyHex,
        x: record.x,
      };
      const aad = sealedShareAad(aadBody);
      const plaintext = new TextEncoder().encode(
        JSON.stringify({ bind: new TextDecoder().decode(aad), secretShare: record.secretShare.toString(10) }),
      );
      const sealed = sealFx.seal?.(plaintext, aad) ?? defaultSeal(sealFx, plaintext, aad);
      const body: FrostSealedShareFileV2 = { ...aadBody, sealed };
      fx.writeText(frostSharePath(sharesDir, record.x), JSON.stringify(body, null, 2) + "\n", 0o600);
    },
  };
}

/** Honest stub: documents the HSM seam without pretending hardware exists. */
export function createHsmShareAdapterStub(): FrostShareAdapter {
  const err = (): never => {
    throw new Error("frost-share-adapter: HSM/TPM seal not implemented for this kind - choose a declared tier");
  };
  return {
    kind: "hsm-stub",
    sealTier: "software-plaintext",
    usesWithoutExtract: false,
    loadShare: err,
    storeShare: err,
  };
}

// ============================================================================
// THE FAKE
// ============================================================================
//
// CI runners have no usable TPM and no PKCS#11 token, so the port needs a software
// stand-in. A stand-in that can be MISTAKEN for hardware is the vacuity class -- a
// check that cannot fail looking like one that passed. So the fake is made
// unmistakable by four independent mechanisms, none of which is documentation:
//
//   1. CONSTRUCTION IS GATED. It cannot be built by accident: the caller must pass
//      an explicit acknowledgement object. There is no default and no boolean flag
//      that reads as innocuous.
//   2. THE TIER SHOUTS. sealTier is "INSECURE-SOFTWARE-FAKE-HSM" on the live object.
//   3. THE ARTIFACT SHOUTS, FOREVER. The tier and a fake-specific alg string are
//      written into the on-disk share, so a fake-sealed share stays identifiable
//      long after the process that made it is gone, and shows up in a git diff.
//   4. THE REAL ADAPTER REFUSES IT. Because seal tiers must match exactly on load
//      (see createSealedFileShareAdapter), a hardware adapter throws on a
//      fake-sealed artifact. A silent substitution is therefore caught at the next
//      load even if nobody was watching when it was written.
//
// The seal key is a PUBLISHED CONSTANT below. It is not a secret and is not meant
// to be one: anyone with this repository can decrypt anything the fake sealed. That
// is the point -- the fake must not be able to masquerade as protection.

/** Deliberately public. Anyone with the repo can open a fake-sealed share. */
export const INSECURE_FAKE_SEAL_KEY_SEED = "zeta-INSECURE-fake-hsm-seed-NOT-A-SECRET";

export const INSECURE_FAKE_SEAL_ALG = "INSECURE-SOFTWARE-FAKE-HSM:AES-256-GCM";

export interface InsecureFakeHsmAcknowledgement {
  /** Must be literally true. Typed as the literal so it cannot be widened silently. */
  readonly iUnderstandThisIsNotHardware: true;
  /** Where the loud runtime warning goes. Injected so tests can capture it (noninterference). */
  readonly warn?: (message: string) => void;
}

/**
 * Software stand-in for a hardware seal. NOT hardware. NOT secret. NOT a security
 * boundary. Use only in tests and in explicitly-declared local development.
 */
export function createInsecureFakeHsmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  ack: InsecureFakeHsmAcknowledgement,
): FrostShareAdapter {
  if (ack?.iUnderstandThisIsNotHardware !== true) {
    throw new Error(
      "frost-share-adapter: the fake HSM adapter requires an explicit acknowledgement " +
        "({ iUnderstandThisIsNotHardware: true }). It provides NO confidentiality: its seal " +
        "key is a published constant. Refusing to construct it implicitly.",
    );
  }
  const warn = ack.warn ?? ((m: string) => console.warn(m));
  const sealKey = new Uint8Array(32);
  sealKey.set(new TextEncoder().encode(INSECURE_FAKE_SEAL_KEY_SEED).subarray(0, 32));

  const sealFx: FrostShareSealEffects = {
    getSealKey: () => sealKey,
    seal(plaintext: Uint8Array, aad: Uint8Array): FrostShareSealBox {
      warn("frost-share-adapter: SEALING WITH THE INSECURE SOFTWARE FAKE - this is NOT hardware");
      return { ...defaultSeal(sealFx, plaintext, aad), alg: INSECURE_FAKE_SEAL_ALG };
    },
    unseal(box: FrostShareSealBox, aad: Uint8Array): Uint8Array {
      warn("frost-share-adapter: UNSEALING WITH THE INSECURE SOFTWARE FAKE - this is NOT hardware");
      if (box.alg !== INSECURE_FAKE_SEAL_ALG) {
        throw new Error(`frost-share-adapter: fake adapter refuses non-fake alg ${box.alg}`);
      }
      return defaultUnseal(sealFx, box, aad);
    },
  };
  return createSealedFileShareAdapter(fx, sharesDir, ca, sealFx, "INSECURE-SOFTWARE-FAKE-HSM");
}

// ============================================================================
// PKCS#11 (macOS + Linux, needs Bun FFI and a token)
// ============================================================================

export interface Pkcs11Lib {
  readonly C_Initialize: (pInitArgs: number | bigint) => number | bigint;
  readonly C_Finalize: (pReserved: number | bigint) => number | bigint;
  readonly C_GetSlotList: (tokenPresent: number, pSlotList: unknown, pulCount: unknown) => number | bigint;
  readonly C_OpenSession: (
    slotID: number | bigint,
    flags: number | bigint,
    pApplication: unknown,
    Notify: unknown,
    phSession: BigUint64Array,
  ) => number | bigint;
  readonly C_CloseSession: (hSession: number | bigint) => number | bigint;
  readonly C_Login: (
    hSession: number | bigint,
    userType: number | bigint,
    pPin: unknown,
    ulPinLen: number | bigint,
  ) => number | bigint;
  readonly C_Logout: (hSession: number | bigint) => number | bigint;
  readonly C_FindObjectsInit: (hSession: number | bigint, pTemplate: unknown, ulCount: number | bigint) => number | bigint;
  readonly C_FindObjects: (
    hSession: number | bigint,
    phObject: BigUint64Array,
    ulMaxObjectCount: number | bigint,
    pulObjectCount: BigUint64Array,
  ) => number | bigint;
  readonly C_FindObjectsFinal: (hSession: number | bigint) => number | bigint;
  readonly C_EncryptInit: (hSession: number | bigint, pMechanism: unknown, hKey: number | bigint) => number | bigint;
  readonly C_Encrypt: (
    hSession: number | bigint,
    pData: unknown,
    ulDataLen: number | bigint,
    pEncryptedData: unknown,
    pulEncryptedDataLen: BigUint64Array,
  ) => number | bigint;
  readonly C_DecryptInit: (hSession: number | bigint, pMechanism: unknown, hKey: number | bigint) => number | bigint;
  readonly C_Decrypt: (
    hSession: number | bigint,
    pEncryptedData: unknown,
    ulEncryptedDataLen: number | bigint,
    pData: unknown,
    pulDataLen: BigUint64Array,
  ) => number | bigint;
}

/**
 * Address-of for buffers handed across the FFI boundary.
 *
 * This is an INJECTED effect, not an ambient capability, for a specific reason: the
 * previous implementation wrapped bun:ffi ptr() in try/catch and left NULL (0n) in the
 * attribute template when FFI was unavailable. A real PKCS#11 module handed that
 * template would search on a malformed attribute list; a mock never dereferences it and
 * passes. That is a defect that only appears on hardware -- exactly the class the fake
 * must not be able to hide. Making it injected means the no-FFI case is a declared
 * choice by the caller rather than a silent catch.
 */
export type Pkcs11PointerOf = (buf: Uint8Array | BigUint64Array) => bigint;

export const defaultPointerOf: Pkcs11PointerOf = (buf) => {
  const ffi = tryRequireBunFfi();
  if (!ffi) {
    throw new Error(
      "frost-share-adapter: Bun FFI is unavailable, so no real pointer can be taken for the " +
        "PKCS#11 attribute template. Refusing to pass NULL to a token. Inject pointerOf explicitly " +
        "if you are driving a mock.",
    );
  }
  return BigInt(ffi.ptr(buf));
};

interface BunFfi {
  readonly dlopen: (path: string, symbols: unknown) => { symbols: unknown };
  readonly FFIType: Record<string, unknown>;
  readonly ptr: (buf: Uint8Array | BigUint64Array) => number | bigint;
}

function tryRequireBunFfi(): BunFfi | null {
  try {
    return require("bun:ffi") as BunFfi;
  } catch {
    return null;
  }
}

export const defaultFfiLoader = (libPath: string): Pkcs11Lib => {
  const ffi = tryRequireBunFfi();
  if (!ffi) throw new Error("frost-share-adapter: Bun FFI is not supported in this runtime environment");
  const t = ffi.FFIType;
  const lib = ffi.dlopen(libPath, {
    C_Initialize: { args: [t.ptr], returns: t.u64 },
    C_Finalize: { args: [t.ptr], returns: t.u64 },
    C_GetSlotList: { args: [t.u8, t.ptr, t.ptr], returns: t.u64 },
    C_OpenSession: { args: [t.u64, t.u64, t.ptr, t.ptr, t.ptr], returns: t.u64 },
    C_CloseSession: { args: [t.u64], returns: t.u64 },
    C_Login: { args: [t.u64, t.u64, t.ptr, t.u64], returns: t.u64 },
    C_Logout: { args: [t.u64], returns: t.u64 },
    C_FindObjectsInit: { args: [t.u64, t.ptr, t.u64], returns: t.u64 },
    C_FindObjects: { args: [t.u64, t.ptr, t.u64, t.ptr], returns: t.u64 },
    C_FindObjectsFinal: { args: [t.u64], returns: t.u64 },
    C_EncryptInit: { args: [t.u64, t.ptr, t.u64], returns: t.u64 },
    C_Encrypt: { args: [t.u64, t.ptr, t.u64, t.ptr, t.ptr], returns: t.u64 },
    C_DecryptInit: { args: [t.u64, t.ptr, t.u64], returns: t.u64 },
    C_Decrypt: { args: [t.u64, t.ptr, t.u64, t.ptr, t.ptr], returns: t.u64 },
  });
  return lib.symbols as Pkcs11Lib;
};

const CKF_SERIAL_SESSION = 0x00000004n;
const CKF_RW_SESSION = 0x00000002n;
const CKU_USER = 1n;
const CKO_SECRET_KEY = 4n;
const CKA_CLASS = 0x00000000n;
const CKA_LABEL = 0x00000003n;
const CKM_AES_CBC_PAD = 0x0000010dn;
const CKR_OK = 0n;
const CKR_USER_ALREADY_LOGGED_IN = 0x100n;

export const PKCS11_SEAL_ALG = "PKCS11:AES-256-CBC-PAD";

export interface Pkcs11SealEffectsOptions {
  readonly libraryPath: string;
  readonly pin?: string;
  readonly slotId?: number;
  readonly keyLabel?: string;
  readonly ffiLoader?: (libraryPath: string) => Pkcs11Lib;
  /** Injected on purpose. See Pkcs11PointerOf. */
  readonly pointerOf?: Pkcs11PointerOf;
}

function buildFindKeyTemplate(label: string, pointerOf: Pkcs11PointerOf) {
  const labelBytes = new TextEncoder().encode(label);
  const classVal = new BigUint64Array([CKO_SECRET_KEY]);
  const template = new Uint8Array(48); // 2 attributes * 24 bytes
  const view = new DataView(template.buffer);
  view.setBigUint64(0, CKA_CLASS, true);
  view.setBigUint64(8, pointerOf(classVal), true);
  view.setBigUint64(16, 8n, true);
  view.setBigUint64(24, CKA_LABEL, true);
  view.setBigUint64(32, pointerOf(labelBytes), true);
  view.setBigUint64(40, BigInt(labelBytes.length), true);
  // classVal and labelBytes must outlive the call; returned so the caller keeps them alive.
  return { template, classVal, labelBytes };
}

function buildCbcMechanism(iv: Uint8Array, pointerOf: Pkcs11PointerOf) {
  const mech = new Uint8Array(24);
  const view = new DataView(mech.buffer);
  view.setBigUint64(0, CKM_AES_CBC_PAD, true);
  view.setBigUint64(8, pointerOf(iv), true);
  view.setBigUint64(16, BigInt(iv.length), true);
  return { mechanism: mech, iv };
}

function rvOk(rv: number | bigint): boolean {
  return BigInt(rv) === CKR_OK;
}

function findKey(lib: Pkcs11Lib, hSession: bigint | number, keyLabel: string, pointerOf: Pkcs11PointerOf): bigint {
  const held = buildFindKeyTemplate(keyLabel, pointerOf);
  let rv = lib.C_FindObjectsInit(hSession, held.template, 2n);
  if (!rvOk(rv)) throw new Error(`C_FindObjectsInit failed: ${rv}`);
  const phObject = new BigUint64Array(1);
  const pulObjectCount = new BigUint64Array(1);
  rv = lib.C_FindObjects(hSession, phObject, 1n, pulObjectCount);
  lib.C_FindObjectsFinal(hSession);
  if (!rvOk(rv) || (pulObjectCount[0] ?? 0n) === 0n) {
    throw new Error(`frost-share-adapter: no PKCS#11 key labelled ${keyLabel} in the token`);
  }
  void held.classVal;
  void held.labelBytes;
  return phObject[0] ?? 0n;
}

export function createPkcs11SealEffects(opts: Pkcs11SealEffectsOptions): FrostShareSealEffects {
  const pin = opts.pin ?? "";
  const slotId = opts.slotId ?? 0;
  const keyLabel = opts.keyLabel ?? "zeta-frost-wrap";
  const loader = opts.ffiLoader ?? defaultFfiLoader;
  const pointerOf = opts.pointerOf ?? defaultPointerOf;

  let cachedLib: Pkcs11Lib | null = null;
  const getLib = (): Pkcs11Lib => {
    if (!cachedLib) cachedLib = loader(opts.libraryPath);
    return cachedLib;
  };

  /** Open a logged-in session, run body, always tear down. */
  const withSession = <T>(body: (lib: Pkcs11Lib, hSession: bigint) => T): T => {
    const lib = getLib();
    lib.C_Initialize(0n);
    const phSession = new BigUint64Array(1);
    const rv = lib.C_OpenSession(BigInt(slotId), CKF_SERIAL_SESSION | CKF_RW_SESSION, 0n, 0n, phSession);
    if (!rvOk(rv)) {
      lib.C_Finalize(0n);
      throw new Error(`C_OpenSession failed: ${rv}`);
    }
    const hSession = phSession[0] ?? 0n;
    let loggedIn = false;
    try {
      if (pin.length > 0) {
        const pinBytes = new TextEncoder().encode(pin);
        const lrv = lib.C_Login(hSession, CKU_USER, pinBytes, BigInt(pinBytes.length));
        if (!rvOk(lrv) && BigInt(lrv) !== CKR_USER_ALREADY_LOGGED_IN) throw new Error(`C_Login failed: ${lrv}`);
        loggedIn = true;
      }
      return body(lib, hSession);
    } finally {
      if (loggedIn) lib.C_Logout(hSession);
      lib.C_CloseSession(hSession);
      lib.C_Finalize(0n);
    }
  };

  return {
    getSealKey(): Uint8Array {
      throw new Error(
        "frost-share-adapter: PKCS#11 never releases the wrapping key. Wrapping is done on the " +
          "token. (Note this protects the WRAPPING key, not the share -- see the file header.)",
      );
    },

    /** Eager liveness check: prove the token is present and holds the wrapping key. */
    probe(): void {
      withSession((lib, hSession) => findKey(lib, hSession, keyLabel, pointerOf));
    },

    seal(plaintext: Uint8Array, _aad: Uint8Array): FrostShareSealBox {
      // _aad is deliberately unused: CKM_AES_CBC_PAD has no associated-data input.
      // The header binding is carried inside the plaintext by createSealedFileShareAdapter.
      return withSession((lib, hSession) => {
        const hKey = findKey(lib, hSession, keyLabel, pointerOf);
        const iv = new Uint8Array(nodeRandomBytes(16));
        const { mechanism } = buildCbcMechanism(iv, pointerOf);
        let rv = lib.C_EncryptInit(hSession, mechanism, hKey);
        if (!rvOk(rv)) throw new Error(`C_EncryptInit failed: ${rv}`);
        const outLen = new BigUint64Array([BigInt(plaintext.length + 32)]);
        rv = lib.C_Encrypt(hSession, plaintext, BigInt(plaintext.length), 0n, outLen);
        if (!rvOk(rv)) throw new Error(`C_Encrypt size query failed: ${rv}`);
        const buf = new Uint8Array(Number(outLen[0] ?? 0n));
        rv = lib.C_Encrypt(hSession, plaintext, BigInt(plaintext.length), buf, outLen);
        if (!rvOk(rv)) throw new Error(`C_Encrypt failed: ${rv}`);
        return {
          alg: PKCS11_SEAL_ALG,
          nonceB64: toB64(iv),
          ciphertextB64: toB64(buf.slice(0, Number(outLen[0] ?? 0n))),
        };
      });
    },

    unseal(box: FrostShareSealBox, _aad: Uint8Array): Uint8Array {
      if (box.alg !== PKCS11_SEAL_ALG) {
        throw new Error(`frost-share-adapter: PKCS#11 adapter refuses alg ${box.alg}`);
      }
      return withSession((lib, hSession) => {
        const hKey = findKey(lib, hSession, keyLabel, pointerOf);
        const { mechanism } = buildCbcMechanism(fromB64(box.nonceB64), pointerOf);
        let rv = lib.C_DecryptInit(hSession, mechanism, hKey);
        if (!rvOk(rv)) throw new Error(`C_DecryptInit failed: ${rv}`);
        const ct = fromB64(box.ciphertextB64);
        const outLen = new BigUint64Array([BigInt(ct.length)]);
        rv = lib.C_Decrypt(hSession, ct, BigInt(ct.length), 0n, outLen);
        if (!rvOk(rv)) throw new Error(`C_Decrypt size query failed: ${rv}`);
        const buf = new Uint8Array(Number(outLen[0] ?? 0n));
        rv = lib.C_Decrypt(hSession, ct, BigInt(ct.length), buf, outLen);
        if (!rvOk(rv)) throw new Error(`C_Decrypt failed: ${rv}`);
        return buf.slice(0, Number(outLen[0] ?? 0n));
      });
    },
  };
}

// ============================================================================
// TPM 2.0 (LINUX ONLY)
// ============================================================================
//
// Platform reality, stated plainly because a half-covered adapter presented as done
// is worse than a scoped one:
//
//   * Linux with a TPM 2.0 and tpm2-tools -- covered by this backend.
//   * Windows with a TPM 2.0 -- NOT covered (different tooling; no tpm2_unseal).
//   * macOS on Apple Silicon -- NOT COVERED AND CANNOT BE. Apple Silicon has the
//     Secure Enclave, not a TPM 2.0. There is no /dev/tpmrm0 and no tpm2_unseal.
//     The Secure Enclave is reached through the Keychain (kSecAttrTokenIDSecureEnclave),
//     is P-256 only, and exposes no AES key-wrapping primitive of this shape. It needs
//     its own adapter, which this file does not contain.
//
// So on an Apple Silicon machine the ONLY hardware tier available here is
// hardware-pkcs11 with an external token (for example a YubiKey via ykcs11.dylib).
//
// HONEST LIMIT ON THIS TIER: tpm2_unseal returns the unsealed bytes TO THE HOST. The
// AES-GCM seal is then performed in software with that key in process memory. This is
// at-rest protection bound to the chip and to the measured-boot state; it is NOT
// use-without-extract, not even for the wrapping key. The PKCS#11 tier is strictly
// better on that axis, because there the wrapping key never leaves the token.

export interface TpmSealEffectsOptions {
  readonly sealedKeyPath: string;
  readonly parentContext?: string;
  readonly tpm2UnsealCmd?: string;
  /**
   * Injected process runner. argv form, NEVER a shell string.
   *
   * The previous implementation interpolated the command and path into a shell string
   * passed to execSync. That was a command-injection sink, and it also let a test point
   * tpm2UnsealCmd at printf and obtain a share labelled as TPM-sealed. argv form closes
   * the injection; the tier/acknowledgement machinery above closes the masquerade.
   */
  readonly run?: (cmd: string, args: readonly string[]) => Uint8Array;
}

const defaultRun = (cmd: string, args: readonly string[]): Uint8Array =>
  new Uint8Array(execFileSync(cmd, [...args], { stdio: ["ignore", "pipe", "ignore"] }));

export function createTpmSealEffects(opts: TpmSealEffectsOptions): FrostShareSealEffects {
  const cmd = opts.tpm2UnsealCmd ?? "tpm2_unseal";
  const run = opts.run ?? defaultRun;
  const unsealKey = (): Uint8Array => {
    let out: Uint8Array;
    try {
      out = run(cmd, ["-c", opts.sealedKeyPath]);
    } catch (err) {
      throw new Error(`frost-share-adapter: ${cmd} failed: ${(err as Error).message}`);
    }
    if (out.length !== 32) {
      throw new Error(`frost-share-adapter: ${cmd} returned ${out.length} bytes, expected a 32-byte key`);
    }
    return out;
  };
  return {
    getSealKey: unsealKey,
    /** Eager liveness check: prove the TPM can actually open the sealed object. */
    probe(): void {
      unsealKey();
    },
  };
}

export function createPkcs11ShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: Pkcs11SealEffectsOptions,
): FrostShareAdapter {
  return createSealedFileShareAdapter(fx, sharesDir, ca, createPkcs11SealEffects(opts), "hardware-pkcs11");
}

export function createTpmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: TpmSealEffectsOptions,
): FrostShareAdapter {
  return createSealedFileShareAdapter(fx, sharesDir, ca, createTpmSealEffects(opts), "hardware-tpm2");
}

// ============================================================================
// no-silent-downgrade
// ============================================================================
//
// The proposal states this invariant for the GOVERNANCE plane: a key sovereignty
// class is declared at creation and is immutable-or-upward, loosened only by its
// owner, never silently downgraded by another party. This is the SEALING-plane
// analogue of that invariant, and it is labelled as an analogue rather than quoted
// as the same rule, because the proposal does not state it for sealing tiers.
//
// The rule enforced here:
//
//   The caller DECLARES the tier it requires. The factory returns an adapter at
//   exactly that tier or it THROWS. There is no fallback path, silent or otherwise.
//   Obtaining the fake requires naming the fake -- requireTier is
//   "INSECURE-SOFTWARE-FAKE-HSM", which cannot be read as innocuous.
//
// What this replaces, and why: the previous factory took allowSimulatorFallback,
// which on failure substituted a software simulator that reported the SAME kind as
// the real adapter, so the caller could not tell. That is the silent downgrade the
// invariant forbids. It was also inert -- the hardware constructors did no work, so
// the try/catch never fired and the flag changed nothing. Both defects are gone: the
// backends now probe eagerly at construction (so failure is real and early) and
// there is no substitution path at all.

export interface HsmShareAdapterOptions {
  /** Mandatory. No default: an undeclared security tier is how downgrades hide. */
  readonly requireTier: FrostSealTier;
  readonly pkcs11Opts?: Pkcs11SealEffectsOptions;
  readonly tpmOpts?: TpmSealEffectsOptions;
  readonly softwareSealFx?: FrostShareSealEffects;
  readonly fakeAck?: InsecureFakeHsmAcknowledgement;
}

export function createHsmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: HsmShareAdapterOptions,
): FrostShareAdapter {
  const adapter = buildForTier(fx, sharesDir, ca, opts);
  if (adapter.sealTier !== opts.requireTier) {
    throw new Error(
      `frost-share-adapter: no-silent-downgrade violation: caller required ` +
        `"${opts.requireTier}" but the built adapter is "${adapter.sealTier}".`,
    );
  }
  return adapter;
}

function buildForTier(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: HsmShareAdapterOptions,
): FrostShareAdapter {
  switch (opts.requireTier) {
    case "hardware-pkcs11": {
      if (!opts.pkcs11Opts) throw new Error("frost-share-adapter: pkcs11Opts required for hardware-pkcs11");
      // Any failure here (no token, no key, no FFI) propagates. That is the point.
      return createPkcs11ShareAdapter(fx, sharesDir, ca, opts.pkcs11Opts);
    }
    case "hardware-tpm2": {
      if (!opts.tpmOpts) throw new Error("frost-share-adapter: tpmOpts required for hardware-tpm2");
      return createTpmShareAdapter(fx, sharesDir, ca, opts.tpmOpts);
    }
    case "software-sealed": {
      if (!opts.softwareSealFx) throw new Error("frost-share-adapter: softwareSealFx required for software-sealed");
      return createSealedFileShareAdapter(fx, sharesDir, ca, opts.softwareSealFx, "software-sealed");
    }
    case "INSECURE-SOFTWARE-FAKE-HSM": {
      if (!opts.fakeAck) {
        throw new Error(
          "frost-share-adapter: the fake tier needs fakeAck ({ iUnderstandThisIsNotHardware: true })",
        );
      }
      return createInsecureFakeHsmShareAdapter(fx, sharesDir, ca, opts.fakeAck);
    }
    case "software-plaintext":
      return createSoftwareFileShareAdapter(fx, sharesDir, ca);
    default: {
      const never: never = opts.requireTier;
      throw new Error(`frost-share-adapter: unknown seal tier ${String(never)}`);
    }
  }
}

/**
 * Load all local shares for threshold signing.
 *
 * THIS IS THE EXTRACTION PATH. Every share it returns is a plaintext scalar in host
 * RAM. It is what makes usesWithoutExtract false for every adapter above. Keep the
 * returned array as short-lived as possible.
 */
export function loadFrostKeyShares(adapter: FrostShareAdapter, totalShares: number): FrostKeyShare[] {
  const out: FrostKeyShare[] = [];
  for (let x = 1; x <= totalShares; x++) {
    const rec = adapter.loadShare(x);
    if (rec) out.push({ x: rec.x, secretShare: rec.secretShare });
  }
  return out;
}

// ============================================================================
// PORT CHANGE REQUIRED FOR L1 COMPLETION
// ============================================================================
//
// Sealing the share at rest (what this file now does honestly) is NOT invariant 2.
// To reach use-without-extract the port must stop returning the scalar and start
// asking the chip to USE it:
//
//   interface FrostShareAdapter {
//     signPartial(x: number, ctx: FrostSigningContext): FrostPartialSignature;
//   }
//
// with loadShare removed, or demoted to an explicitly extract-capable sub-interface
// that hardware adapters do not implement. That change also has a hardware
// prerequisite that is not ours to wish away, and which the ladder proposal already
// records at L2: consumer HSMs and TPMs do not implement FROST partial signing in
// firmware. So a genuine use-without-extract tier needs either a token with a
// programmable applet, or the confidential-compute route at L3. Filing that as the
// next increment is honest; claiming this file achieved it would not be.
//
// This port also currently contradicts its own governing ADR
// (docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md),
// whose KeyCustody port contract reads "hold a private key; sign without exposing"
// and "private bytes never leave the custody boundary". loadShare exposes them.
