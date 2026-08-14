import {
  PROPOSAL_ORIGIN,
  PROPOSAL_PASSKEY_ENROLLMENT_SCHEMA,
  PROPOSAL_REPOSITORY,
  PROPOSAL_RP_ID,
  type ProposalPasskeyEnrollment,
} from "../planning/proposal-contract";
import { BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY } from "./browser-database-receipt-native-intent-source";

export interface NativeBrowserDatabaseReceiptPasskeyEnrollmentOptions {
  readonly root: unknown;
  readonly expectedOrigin: typeof PROPOSAL_ORIGIN;
  readonly rpId: typeof PROPOSAL_RP_ID;
  readonly timeoutMs: number;
  readonly now: () => number;
  readonly credentialStorageKey?: string;
}

export interface BrowserDatabaseReceiptPasskeyEnrollmentFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "receipt-passkey-enrollment-configuration-invalid"
    | "receipt-passkey-enrollment-present-credential"
    | "receipt-passkey-enrollment-cancelled"
    | "receipt-passkey-enrollment-failed"
    | "receipt-passkey-enrollment-storage-failed";
  readonly detail: string;
}

export type BrowserDatabaseReceiptPasskeyEnrollmentResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptPasskeyEnrollmentFeedback };

export interface BrowserDatabaseReceiptPasskeyEnrollmentRuntime {
  enrollFromUserActivation(): Promise<BrowserDatabaseReceiptPasskeyEnrollmentResult<ProposalPasskeyEnrollment>>;
}

interface NativeEnrollmentHost {
  readonly origin: string;
  readonly createCredential: (options: CredentialCreationOptions) => Promise<Credential | null>;
  readonly publicKeyCredential: abstract new (...arguments_: never[]) => PublicKeyCredential;
  readonly attestationResponse: abstract new (...arguments_: never[]) => AuthenticatorAttestationResponse;
  readonly randomBytes: (target: Uint8Array) => Uint8Array;
  readonly getCredentialId: (key: string) => string | null;
  readonly setCredentialId: (key: string, value: string) => void;
  readonly btoa: (value: string) => string;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptPasskeyEnrollmentResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserDatabaseReceiptPasskeyEnrollmentFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptPasskeyEnrollmentFeedback["severity"] = "heat",
): BrowserDatabaseReceiptPasskeyEnrollmentResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
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

function constructor(value: unknown, name: string): (abstract new (...arguments_: never[]) => object) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as abstract new (...arguments_: never[]) => object) : null;
  } catch {
    return null;
  }
}

function nativeHost(root: unknown): NativeEnrollmentHost | null {
  if (!isRecord(root)) return null;
  try {
    const location = Reflect.get(root, "location");
    const navigatorValue = Reflect.get(root, "navigator");
    const credentials = isRecord(navigatorValue) ? Reflect.get(navigatorValue, "credentials") : null;
    const cryptoValue = Reflect.get(root, "crypto");
    const storage = Reflect.get(root, "localStorage");
    const origin = isRecord(location) ? Reflect.get(location, "origin") : null;
    const create = method(credentials, "create");
    const random = method(cryptoValue, "getRandomValues");
    const getItem = method(storage, "getItem");
    const setItem = method(storage, "setItem");
    const btoa = method(root, "btoa");
    const publicKeyCredential = constructor(root, "PublicKeyCredential");
    const attestationResponse = constructor(root, "AuthenticatorAttestationResponse");
    if (
      typeof origin !== "string" ||
      create === null ||
      random === null ||
      getItem === null ||
      setItem === null ||
      btoa === null ||
      publicKeyCredential === null ||
      attestationResponse === null
    ) {
      return null;
    }
    return {
      origin,
      createCredential: (options) => Reflect.apply(create, credentials, [options]) as Promise<Credential | null>,
      publicKeyCredential: publicKeyCredential as abstract new (...arguments_: never[]) => PublicKeyCredential,
      attestationResponse: attestationResponse as abstract new (
        ...arguments_: never[]
      ) => AuthenticatorAttestationResponse,
      randomBytes: (target) => Reflect.apply(random, cryptoValue, [target]) as Uint8Array,
      getCredentialId: (key) => Reflect.apply(getItem, storage, [key]) as string | null,
      setCredentialId: (key, value) => {
        Reflect.apply(setItem, storage, [key, value]);
      },
      btoa: (value) => Reflect.apply(btoa, root, [value]) as string,
    };
  } catch {
    return null;
  }
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}

function bytesToBase64url(host: NativeEnrollmentHost, value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return host.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function entropy(host: NativeEnrollmentHost): Uint8Array | null {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  return host.randomBytes(bytes) === bytes ? bytes : null;
}

function validConfiguration(
  options: NativeBrowserDatabaseReceiptPasskeyEnrollmentOptions,
  host: NativeEnrollmentHost,
): boolean {
  const storageKey = options.credentialStorageKey ?? BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY;
  return (
    options.expectedOrigin === PROPOSAL_ORIGIN &&
    options.rpId === PROPOSAL_RP_ID &&
    host.origin === options.expectedOrigin &&
    Number.isSafeInteger(options.timeoutMs) &&
    options.timeoutMs >= 1 &&
    options.timeoutMs <= 120_000 &&
    typeof options.now === "function" &&
    storageKey.length >= 1 &&
    storageKey.length <= 1024
  );
}

function cancellation(error: unknown): boolean {
  if (!isRecord(error)) return false;
  try {
    const name = Reflect.get(error, "name");
    return name === "NotAllowedError" || name === "AbortError";
  } catch {
    return false;
  }
}

/** Create one privacy-preserving ES256 passkey package from an explicit browser gesture. */
export function createNativeBrowserDatabaseReceiptPasskeyEnrollment(
  options: NativeBrowserDatabaseReceiptPasskeyEnrollmentOptions,
): BrowserDatabaseReceiptPasskeyEnrollmentResult<BrowserDatabaseReceiptPasskeyEnrollmentRuntime> {
  const host = nativeHost(options.root);
  if (host === null || !validConfiguration(options, host)) {
    return failed(
      "receipt-passkey-enrollment-configuration-invalid",
      "Passkey enrollment requires the canonical HTTPS Pages origin, WebAuthn, Web Crypto, local credential storage, and a finite timeout.",
    );
  }
  const storageKey = options.credentialStorageKey ?? BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY;

  return succeeded({
    enrollFromUserActivation: async () => {
      try {
        const present = host.getCredentialId(storageKey);
        if (present !== null && present.length > 0) {
          return failed(
            "receipt-passkey-enrollment-present-credential",
            "This origin already retains a proposal passkey credential; rotation requires an explicit registry transition.",
            "backpressure",
          );
        }
      } catch {
        return failed(
          "receipt-passkey-enrollment-storage-failed",
          "The browser refused to inspect local passkey enrollment state.",
        );
      }

      let challenge: Uint8Array | null;
      let userId: Uint8Array | null;
      try {
        challenge = entropy(host);
        userId = entropy(host);
      } catch {
        return failed("receipt-passkey-enrollment-failed", "The browser failed to produce enrollment entropy.");
      }
      if (challenge === null || userId === null) {
        return failed("receipt-passkey-enrollment-failed", "The browser returned foreign enrollment entropy buffers.");
      }

      let credential: Credential | null;
      try {
        credential = await host.createCredential({
          publicKey: {
            challenge: ownedArrayBuffer(challenge),
            rp: { name: "Zeta proposal signer", id: options.rpId },
            user: {
              id: ownedArrayBuffer(userId),
              name: "zeta-proposal-signer",
              displayName: "Zeta proposal signer",
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
            attestation: "none",
            timeout: options.timeoutMs,
          },
        });
      } catch (error) {
        return cancellation(error)
          ? failed(
              "receipt-passkey-enrollment-cancelled",
              "The user declined or cancelled passkey enrollment.",
              "backpressure",
            )
          : failed("receipt-passkey-enrollment-failed", "The browser failed while creating the passkey.");
      }
      if (
        !(credential instanceof host.publicKeyCredential) ||
        !(credential.response instanceof host.attestationResponse)
      ) {
        return failed(
          "receipt-passkey-enrollment-cancelled",
          "The browser returned no passkey attestation after the enrollment prompt.",
          "backpressure",
        );
      }

      try {
        const credentialId = bytesToBase64url(host, credential.rawId);
        const createdAt = new Date(options.now()).toISOString();
        if (credentialId.length < 1 || credentialId.length > 2048) {
          return failed("receipt-passkey-enrollment-failed", "The browser returned no finite passkey credential ID.");
        }
        const enrollment: ProposalPasskeyEnrollment = Object.freeze({
          schema: PROPOSAL_PASSKEY_ENROLLMENT_SCHEMA,
          repository: PROPOSAL_REPOSITORY,
          credentialId,
          challenge: bytesToBase64url(host, challenge),
          clientDataJSON: bytesToBase64url(host, credential.response.clientDataJSON),
          attestationObject: bytesToBase64url(host, credential.response.attestationObject),
          origin: PROPOSAL_ORIGIN,
          rpId: PROPOSAL_RP_ID,
          createdAt,
        });
        host.setCredentialId(storageKey, credentialId);
        return succeeded(enrollment);
      } catch {
        return failed(
          "receipt-passkey-enrollment-storage-failed",
          "The browser created a passkey but could not retain its public enrollment package; investigate local storage before retrying.",
        );
      }
    },
  });
}
