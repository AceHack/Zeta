// Pluggable FROST share storage — software file | sealed-file | HSM/TPM seal (stub).
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// Layer 1 of agent-native-key-custody: use-without-extract when HSM adapter lands.
// Slice 1: software adapter wraps existing ~/.config/zeta frost share files;
// HSM adapter is an honest stub (throws) until platform bindings exist.

import { Buffer } from "node:buffer";
import { execSync } from "node:child_process";
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

export interface Pkcs11Lib {
  readonly C_Initialize: (pInitArgs: number | bigint) => number | bigint;
  readonly C_Finalize: (pReserved: number | bigint) => number | bigint;
  readonly C_GetSlotList: (tokenPresent: number, pSlotList: any, pulCount: any) => number | bigint;
  readonly C_OpenSession: (slotID: number | bigint, flags: number | bigint, pApplication: any, Notify: any, phSession: any) => number | bigint;
  readonly C_CloseSession: (hSession: number | bigint) => number | bigint;
  readonly C_Login: (hSession: number | bigint, userType: number | bigint, pPin: any, ulPinLen: number | bigint) => number | bigint;
  readonly C_Logout: (hSession: number | bigint) => number | bigint;
  readonly C_FindObjectsInit: (hSession: number | bigint, pTemplate: any, ulCount: number | bigint) => number | bigint;
  readonly C_FindObjects: (hSession: number | bigint, phObject: any, ulMaxObjectCount: number | bigint, pulObjectCount: any) => number | bigint;
  readonly C_FindObjectsFinal: (hSession: number | bigint) => number | bigint;
  readonly C_EncryptInit: (hSession: number | bigint, pMechanism: any, hKey: number | bigint) => number | bigint;
  readonly C_Encrypt: (hSession: number | bigint, pData: any, ulDataLen: number | bigint, pEncryptedData: any, pulEncryptedDataLen: any) => number | bigint;
  readonly C_DecryptInit: (hSession: number | bigint, pMechanism: any, hKey: number | bigint) => number | bigint;
  readonly C_Decrypt: (hSession: number | bigint, pEncryptedData: any, ulEncryptedDataLen: number | bigint, pData: any, pulDataLen: any) => number | bigint;
}

let dlopenFn: any = null;
let FFITypeVal: any = null;
try {
  const ffi = require("bun:ffi");
  dlopenFn = ffi.dlopen;
  FFITypeVal = ffi.FFIType;
} catch {
  // Not bun runtime
}

export const defaultFfiLoader = (libPath: string): Pkcs11Lib => {
  if (!dlopenFn || !FFITypeVal) {
    throw new Error("frost-share-adapter: Bun FFI is not supported in this runtime environment");
  }
  const lib = dlopenFn(libPath, {
    C_Initialize: { args: [FFITypeVal.ptr], returns: FFITypeVal.u64 },
    C_Finalize: { args: [FFITypeVal.ptr], returns: FFITypeVal.u64 },
    C_GetSlotList: { args: [FFITypeVal.u8, FFITypeVal.ptr, FFITypeVal.ptr], returns: FFITypeVal.u64 },
    C_OpenSession: { args: [FFITypeVal.u64, FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.ptr, FFITypeVal.ptr], returns: FFITypeVal.u64 },
    C_CloseSession: { args: [FFITypeVal.u64], returns: FFITypeVal.u64 },
    C_Login: { args: [FFITypeVal.u64, FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.u64], returns: FFITypeVal.u64 },
    C_Logout: { args: [FFITypeVal.u64], returns: FFITypeVal.u64 },
    C_FindObjectsInit: { args: [FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.u64], returns: FFITypeVal.u64 },
    C_FindObjects: { args: [FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.u64, FFITypeVal.ptr], returns: FFITypeVal.u64 },
    C_FindObjectsFinal: { args: [FFITypeVal.u64], returns: FFITypeVal.u64 },
    C_EncryptInit: { args: [FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.u64], returns: FFITypeVal.u64 },
    C_Encrypt: { args: [FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.ptr], returns: FFITypeVal.u64 },
    C_DecryptInit: { args: [FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.u64], returns: FFITypeVal.u64 },
    C_Decrypt: { args: [FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.u64, FFITypeVal.ptr, FFITypeVal.ptr], returns: FFITypeVal.u64 },
  });
  return lib.symbols as unknown as Pkcs11Lib;
};

const CKF_SERIAL_SESSION = 0x00000004n;
const CKF_RW_SESSION = 0x00000002n;
const CKU_USER = 1n;
const CKO_SECRET_KEY = 4n;
const CKA_CLASS = 0x00000000n;
const CKA_LABEL = 0x00000003n;
const CKM_AES_CBC_PAD = 0x0000010dn;

export interface Pkcs11SealEffectsOptions {
  readonly libraryPath: string;
  readonly pin?: string;
  readonly slotId?: number;
  readonly keyLabel?: string;
  readonly ffiLoader?: (libraryPath: string) => Pkcs11Lib;
}

function buildFindKeyTemplate(label: string): { template: Uint8Array; classVal: BigUint64Array; labelBytes: Uint8Array } {
  const labelBytes = new TextEncoder().encode(label);
  const classVal = new BigUint64Array([CKO_SECRET_KEY]);
  
  let classPtr = 0n;
  let labelPtr = 0n;
  try {
    const ffi = require("bun:ffi");
    classPtr = BigInt(ffi.ptr(classVal));
    labelPtr = BigInt(ffi.ptr(labelBytes));
  } catch {
    // FFI not available (e.g. test environment)
  }
  
  const template = new Uint8Array(48); // 2 attributes * 24 bytes
  const view = new DataView(template.buffer);
  
  // Attribute 0: CKA_CLASS
  view.setBigUint64(0, CKA_CLASS, true);
  view.setBigUint64(8, classPtr, true);
  view.setBigUint64(16, 8n, true);
  
  // Attribute 1: CKA_LABEL
  view.setBigUint64(24, CKA_LABEL, true);
  view.setBigUint64(32, labelPtr, true);
  view.setBigUint64(40, BigInt(labelBytes.length), true);
  
  return { template, classVal, labelBytes };
}

function buildCbcMechanism(iv: Uint8Array): { mechanism: Uint8Array } {
  let ivPtr = 0n;
  try {
    const ffi = require("bun:ffi");
    ivPtr = BigInt(ffi.ptr(iv));
  } catch {
    // FFI not available
  }
  
  const mech = new Uint8Array(24);
  const view = new DataView(mech.buffer);
  
  view.setBigUint64(0, CKM_AES_CBC_PAD, true);
  view.setBigUint64(8, ivPtr, true);
  view.setBigUint64(16, BigInt(iv.length), true);
  
  return { mechanism: mech };
}

function findKey(lib: Pkcs11Lib, hSession: bigint | number, keyLabel: string): bigint {
  const { template } = buildFindKeyTemplate(keyLabel);
  let rv = lib.C_FindObjectsInit(hSession, template, 2n);
  if (BigInt(rv) !== 0n) throw new Error(`C_FindObjectsInit failed: ${rv}`);
  
  const phObject = new BigUint64Array(1);
  const pulObjectCount = new BigUint64Array(1);
  rv = lib.C_FindObjects(hSession, phObject, 1n, pulObjectCount);
  lib.C_FindObjectsFinal(hSession);
  
  if (BigInt(rv) !== 0n || (pulObjectCount[0] ?? 0n) === 0n) {
    throw new Error(`Key with label ${keyLabel} not found in PKCS#11 token`);
  }
  return phObject[0] ?? 0n;
}

export function createPkcs11SealEffects(opts: Pkcs11SealEffectsOptions): FrostShareSealEffects {
  const pin = opts.pin ?? "";
  const slotId = opts.slotId ?? 0;
  const keyLabel = opts.keyLabel ?? "zeta-frost-wrap";
  const loader = opts.ffiLoader ?? defaultFfiLoader;
  
  let cachedLib: Pkcs11Lib | null = null;
  const getLib = (): Pkcs11Lib => {
    if (!cachedLib) {
      cachedLib = loader(opts.libraryPath);
    }
    return cachedLib;
  };
  
  return {
    getSealKey(): Uint8Array {
      throw new Error("frost-share-adapter: PKCS#11 does not extract wrapping key (use-without-extract)");
    },
    
    seal(plaintext: Uint8Array, _aad: Uint8Array): FrostShareSealBox {
      const lib = getLib();
      lib.C_Initialize(0n);
      
      const phSession = new BigUint64Array(1);
      let rv = lib.C_OpenSession(BigInt(slotId), CKF_SERIAL_SESSION | CKF_RW_SESSION, 0n, 0n, phSession);
      if (BigInt(rv) !== 0n) throw new Error(`C_OpenSession failed: ${rv}`);
      const hSession = phSession[0] ?? 0n;
      
      try {
        if (pin.length > 0) {
          const pinBytes = new TextEncoder().encode(pin);
          rv = lib.C_Login(hSession, CKU_USER, pinBytes, BigInt(pinBytes.length));
          if (BigInt(rv) !== 0n && BigInt(rv) !== 0x100n) {
            throw new Error(`C_Login failed: ${rv}`);
          }
        }
        
        const hKey = findKey(lib, hSession, keyLabel);
        const iv = nodeRandomBytes(16);
        const { mechanism } = buildCbcMechanism(iv);
        
        rv = lib.C_EncryptInit(hSession, mechanism, hKey);
        if (BigInt(rv) !== 0n) throw new Error(`C_EncryptInit failed: ${rv}`);
        
        const pulEncryptedDataLen = new BigUint64Array([BigInt(plaintext.length + 32)]);
        rv = lib.C_Encrypt(hSession, plaintext, BigInt(plaintext.length), 0n, pulEncryptedDataLen);
        if (BigInt(rv) !== 0n) throw new Error(`C_Encrypt query size failed: ${rv}`);
        
        const ciphertextBuf = new Uint8Array(Number(pulEncryptedDataLen[0] ?? 0n));
        rv = lib.C_Encrypt(hSession, plaintext, BigInt(plaintext.length), ciphertextBuf, pulEncryptedDataLen);
        if (BigInt(rv) !== 0n) throw new Error(`C_Encrypt failed: ${rv}`);
        
        return {
          alg: "PKCS11:AES-256-CBC-PAD",
          nonceB64: toB64(iv),
          ciphertextB64: toB64(ciphertextBuf.slice(0, Number(pulEncryptedDataLen[0] ?? 0n))),
        };
      } finally {
        if (pin.length > 0) {
          lib.C_Logout(hSession);
        }
        lib.C_CloseSession(hSession);
        lib.C_Finalize(0n);
      }
    },
    
    unseal(box: FrostShareSealBox, _aad: Uint8Array): Uint8Array {
      if (box.alg !== "PKCS11:AES-256-CBC-PAD") {
        throw new Error(`frost-share-adapter: unsupported PKCS#11 algorithm ${box.alg}`);
      }
      const lib = getLib();
      lib.C_Initialize(0n);
      
      const phSession = new BigUint64Array(1);
      let rv = lib.C_OpenSession(BigInt(slotId), CKF_SERIAL_SESSION | CKF_RW_SESSION, 0n, 0n, phSession);
      if (BigInt(rv) !== 0n) throw new Error(`C_OpenSession failed: ${rv}`);
      const hSession = phSession[0] ?? 0n;
      
      try {
        if (pin.length > 0) {
          const pinBytes = new TextEncoder().encode(pin);
          rv = lib.C_Login(hSession, CKU_USER, pinBytes, BigInt(pinBytes.length));
          if (BigInt(rv) !== 0n && BigInt(rv) !== 0x100n) {
            throw new Error(`C_Login failed: ${rv}`);
          }
        }
        
        const hKey = findKey(lib, hSession, keyLabel);
        const { mechanism } = buildCbcMechanism(fromB64(box.nonceB64));
        
        rv = lib.C_DecryptInit(hSession, mechanism, hKey);
        if (BigInt(rv) !== 0n) throw new Error(`C_DecryptInit failed: ${rv}`);
        
        const encryptedData = fromB64(box.ciphertextB64);
        const pulDataLen = new BigUint64Array([BigInt(encryptedData.length)]);
        
        rv = lib.C_Decrypt(hSession, encryptedData, BigInt(encryptedData.length), 0n, pulDataLen);
        if (BigInt(rv) !== 0n) throw new Error(`C_Decrypt query size failed: ${rv}`);
        
        const decryptedBuf = new Uint8Array(Number(pulDataLen[0] ?? 0n));
        rv = lib.C_Decrypt(hSession, encryptedData, BigInt(encryptedData.length), decryptedBuf, pulDataLen);
        if (BigInt(rv) !== 0n) throw new Error(`C_Decrypt failed: ${rv}`);
        
        return decryptedBuf.slice(0, Number(pulDataLen[0] ?? 0n));
      } finally {
        if (pin.length > 0) {
          lib.C_Logout(hSession);
        }
        lib.C_CloseSession(hSession);
        lib.C_Finalize(0n);
      }
    }
  };
}

export interface TpmSealEffectsOptions {
  readonly sealedKeyPath: string;
  readonly parentContext?: string;
  readonly tpm2UnsealCmd?: string;
}

export function createTpmSealEffects(opts: TpmSealEffectsOptions): FrostShareSealEffects {
  const sealedKeyPath = opts.sealedKeyPath;
  const cmd = opts.tpm2UnsealCmd ?? "tpm2_unseal";
  
  return {
    getSealKey(): Uint8Array {
      try {
        const stdout = execSync(`${cmd} -c ${sealedKeyPath}`, { stdio: ["ignore", "pipe", "ignore"] });
        if (stdout.length !== 32) {
          throw new Error(`tpm2_unseal returned invalid key length: ${stdout.length} (expected 32)`);
        }
        return new Uint8Array(stdout);
      } catch (err: any) {
        throw new Error(`tpm2_unseal execution failed: ${err.message}`);
      }
    }
  };
}

export function createPkcs11ShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: Pkcs11SealEffectsOptions,
): FrostShareAdapter {
  const sealEffects = createPkcs11SealEffects(opts);
  const baseAdapter = createSealedFileShareAdapter(fx, sharesDir, ca, sealEffects);
  return {
    kind: "sealed-file",
    loadShare: (x) => baseAdapter.loadShare(x),
    storeShare: (rec, caName) => baseAdapter.storeShare(rec, caName),
  };
}

export function createTpmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: TpmSealEffectsOptions,
): FrostShareAdapter {
  const sealEffects = createTpmSealEffects(opts);
  const baseAdapter = createSealedFileShareAdapter(fx, sharesDir, ca, sealEffects);
  return {
    kind: "sealed-file",
    loadShare: (x) => baseAdapter.loadShare(x),
    storeShare: (rec, caName) => baseAdapter.storeShare(rec, caName),
  };
}

export function createSimulatorShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  simSeed = "zeta-hardware-simulator-seed-32-bytes",
): FrostShareAdapter {
  const sealKey = new Uint8Array(32);
  sealKey.set(new TextEncoder().encode(simSeed).subarray(0, 32));
  const sealEffects: FrostShareSealEffects = {
    getSealKey: () => sealKey,
  };
  const baseAdapter = createSealedFileShareAdapter(fx, sharesDir, ca, sealEffects);
  return {
    kind: "sealed-file",
    loadShare: (x) => baseAdapter.loadShare(x),
    storeShare: (rec, caName) => baseAdapter.storeShare(rec, caName),
  };
}

export interface HsmShareAdapterOptions {
  readonly hsmKind: "stub" | "pkcs11" | "tpm" | "simulator";
  readonly pkcs11Opts?: Pkcs11SealEffectsOptions;
  readonly tpmOpts?: TpmSealEffectsOptions;
  readonly allowSimulatorFallback?: boolean;
}

export function createHsmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: HsmShareAdapterOptions,
): FrostShareAdapter {
  if (opts.hsmKind === "simulator") {
    return createSimulatorShareAdapter(fx, sharesDir, ca);
  }
  if (opts.hsmKind === "pkcs11") {
    if (!opts.pkcs11Opts) throw new Error("frost-share-adapter: pkcs11Opts required for pkcs11 hsmKind");
    try {
      return createPkcs11ShareAdapter(fx, sharesDir, ca, opts.pkcs11Opts);
    } catch (err) {
      if (opts.allowSimulatorFallback) return createSimulatorShareAdapter(fx, sharesDir, ca);
      throw err;
    }
  }
  if (opts.hsmKind === "tpm") {
    if (!opts.tpmOpts) throw new Error("frost-share-adapter: tpmOpts required for tpm hsmKind");
    try {
      return createTpmShareAdapter(fx, sharesDir, ca, opts.tpmOpts);
    } catch (err) {
      if (opts.allowSimulatorFallback) return createSimulatorShareAdapter(fx, sharesDir, ca);
      throw err;
    }
  }
  return createHsmShareAdapterStub();
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
