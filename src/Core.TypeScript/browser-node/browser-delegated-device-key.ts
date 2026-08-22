import {
  canonicalDevicePublicKeyBytes,
  deviceBytesToBase64url,
  deviceBytesToHex,
  type DevicePublicKeyJwk,
} from "../planning/delegated-device-proposal-contract";
import type {
  BrowserDelegatedDeviceProposalResult,
  BrowserProposalDeviceKey,
  BrowserProposalDeviceKeyPort,
  BrowserProposalDigestPort,
} from "./browser-delegated-device-proposal-signer";

export const BROWSER_PROPOSAL_DEVICE_KEY_SCHEMA = "zeta.browser-proposal-device-key.v1" as const;

export interface BrowserStoredProposalDeviceKey {
  readonly schema: typeof BROWSER_PROPOSAL_DEVICE_KEY_SCHEMA;
  readonly name: "active";
  readonly deviceId: string;
  readonly publicKeyJwk: DevicePublicKeyJwk;
  readonly privateKey: CryptoKey;
}

export interface BrowserProposalDeviceKeyStore {
  load(): Promise<BrowserDelegatedDeviceProposalResult<BrowserStoredProposalDeviceKey | null>>;
  retain(
    candidate: BrowserStoredProposalDeviceKey,
  ): Promise<BrowserDelegatedDeviceProposalResult<BrowserStoredProposalDeviceKey>>;
}

export interface NativeBrowserProposalDeviceCrypto {
  readonly keys: BrowserProposalDeviceKeyPort;
  readonly digest: BrowserProposalDigestPort;
}

function failed<T>(detail: string): BrowserDelegatedDeviceProposalResult<T> {
  return { ok: false, feedback: { severity: "heat", code: "device-proposal-key-unavailable", detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function method(value: unknown, name: string): ((...arguments_: readonly unknown[]) => unknown) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...arguments_: readonly unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

function publicKeyJwk(value: JsonWebKey): DevicePublicKeyJwk | null {
  return value.kty === "EC" &&
    value.crv === "P-256" &&
    typeof value.x === "string" &&
    typeof value.y === "string" &&
    value.ext === true &&
    value.d === undefined
    ? { kty: "EC", crv: "P-256", x: value.x, y: value.y, ext: true }
    : null;
}

function privateSigningKey(value: unknown): value is CryptoKey {
  if (!isRecord(value) || value.type !== "private" || value.extractable !== false || !Array.isArray(value.usages)) {
    return false;
  }
  const algorithm = value.algorithm;
  return (
    isRecord(algorithm) &&
    algorithm.name === "ECDSA" &&
    algorithm.namedCurve === "P-256" &&
    value.usages.length === 1 &&
    value.usages[0] === "sign"
  );
}

function storedKeyShape(value: BrowserStoredProposalDeviceKey): boolean {
  return (
    value.schema === BROWSER_PROPOSAL_DEVICE_KEY_SCHEMA &&
    value.name === "active" &&
    /^[0-9a-f]{64}$/u.test(value.deviceId) &&
    publicKeyJwk(value.publicKeyJwk) !== null &&
    privateSigningKey(value.privateKey)
  );
}

/** Create non-exportable P-256 device-key custody over an injected persistent store. */
export function createNativeBrowserProposalDeviceCrypto(
  root: unknown,
  store: BrowserProposalDeviceKeyStore,
): BrowserDelegatedDeviceProposalResult<NativeBrowserProposalDeviceCrypto> {
  if (!isRecord(root)) return failed("This runtime does not expose Web Crypto.");
  let cryptoValue: unknown;
  try {
    cryptoValue = Reflect.get(root, "crypto");
  } catch {
    return failed("This runtime blocked access to Web Crypto.");
  }
  const subtle = isRecord(cryptoValue) ? Reflect.get(cryptoValue, "subtle") : null;
  const getRandomValues = method(cryptoValue, "getRandomValues");
  const digest = method(subtle, "digest");
  const generateKey = method(subtle, "generateKey");
  const exportKey = method(subtle, "exportKey");
  const sign = method(subtle, "sign");
  if (
    getRandomValues === null ||
    digest === null ||
    generateKey === null ||
    exportKey === null ||
    sign === null ||
    typeof store.load !== "function" ||
    typeof store.retain !== "function"
  ) {
    return failed("Device-key custody requires Web Crypto P-256 support and one persistent key store.");
  }

  const sha256 = async (bytes: Uint8Array): Promise<BrowserDelegatedDeviceProposalResult<Uint8Array>> => {
    try {
      const output = await (Reflect.apply(digest, subtle, ["SHA-256", bytes]) as Promise<ArrayBuffer>);
      return { ok: true, value: new Uint8Array(output) };
    } catch {
      return failed("Web Crypto refused a device-proposal SHA-256 digest.");
    }
  };

  const asHandle = async (
    value: BrowserStoredProposalDeviceKey,
  ): Promise<BrowserDelegatedDeviceProposalResult<BrowserProposalDeviceKey>> => {
    if (!storedKeyShape(value)) return failed("The persisted proposal device key has an invalid shape.");
    let canonicalKey: Uint8Array;
    try {
      canonicalKey = canonicalDevicePublicKeyBytes(value.publicKeyJwk);
    } catch {
      return failed("The persisted proposal device public key is not canonical text.");
    }
    const identity = await sha256(canonicalKey);
    if (!identity.ok) return identity;
    if (deviceBytesToHex(identity.value) !== value.deviceId) {
      return failed("The persisted proposal device key ID differs from its public-key digest.");
    }
    return {
      ok: true,
      value: {
        deviceId: value.deviceId,
        publicKeyJwk: value.publicKeyJwk,
        async sign(bytes) {
          try {
            const signature = await (Reflect.apply(sign, subtle, [
              { name: "ECDSA", hash: "SHA-256" },
              value.privateKey,
              bytes,
            ]) as Promise<ArrayBuffer>);
            const encoded = new Uint8Array(signature);
            return encoded.byteLength === 64
              ? { ok: true, value: deviceBytesToBase64url(encoded) }
              : failed("Web Crypto returned a non-P1363 P-256 signature.");
          } catch {
            return failed("Web Crypto refused the delegated device signature.");
          }
        },
      },
    };
  };

  return {
    ok: true,
    value: {
      digest: {
        sha256,
        randomBytes(length) {
          if (!Number.isSafeInteger(length) || length < 1 || length > 65_536) {
            return failed("Device proposal entropy requests must be finite and no larger than 65,536 bytes.");
          }
          try {
            const bytes = new Uint8Array(new ArrayBuffer(length));
            const output = Reflect.apply(getRandomValues, cryptoValue, [bytes]);
            return output === bytes
              ? { ok: true, value: bytes }
              : failed("Web Crypto returned a foreign entropy buffer.");
          } catch {
            return failed("Web Crypto refused device proposal entropy.");
          }
        },
      },
      keys: {
        async loadOrCreate() {
          let present: Awaited<ReturnType<BrowserProposalDeviceKeyStore["load"]>>;
          try {
            present = await store.load();
          } catch {
            return failed("The persistent device-key store threw while loading authority.");
          }
          if (!present.ok) return present;
          if (present.value !== null) return asHandle(present.value);
          try {
            const pair = (await Reflect.apply(generateKey, subtle, [
              { name: "ECDSA", namedCurve: "P-256" },
              false,
              ["sign", "verify"],
            ])) as CryptoKeyPair;
            if (!privateSigningKey(pair.privateKey) || pair.publicKey.type !== "public") {
              return failed("Web Crypto generated an invalid P-256 key pair.");
            }
            const exported = (await Reflect.apply(exportKey, subtle, ["jwk", pair.publicKey])) as JsonWebKey;
            const publicKey = publicKeyJwk(exported);
            if (publicKey === null) return failed("Web Crypto exported a non-P-256 public key.");
            const identity = await sha256(canonicalDevicePublicKeyBytes(publicKey));
            if (!identity.ok) return identity;
            const retained = await store.retain({
              schema: BROWSER_PROPOSAL_DEVICE_KEY_SCHEMA,
              name: "active",
              deviceId: deviceBytesToHex(identity.value),
              publicKeyJwk: publicKey,
              privateKey: pair.privateKey,
            });
            return retained.ok ? asHandle(retained.value) : retained;
          } catch {
            return failed("Web Crypto could not create a non-exportable P-256 proposal device key.");
          }
        },
      },
    },
  };
}
