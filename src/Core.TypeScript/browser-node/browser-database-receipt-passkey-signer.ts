import { canonicalBytes } from "../ace/canonical";
import {
  PROPOSAL_BASE_REF,
  PROPOSAL_MAX_FUTURE_SKEW_MS,
  PROPOSAL_MAX_LIFETIME_MS,
  PROPOSAL_REPOSITORY,
  PROPOSAL_SCHEMA,
  type ProposalIntent,
  type SignedProposal,
} from "../planning/proposal-contract";
import type {
  BrowserDatabaseReceiptProposalResult,
  BrowserDatabaseReceiptProposalSigner,
  BrowserDatabaseReceiptProposalSigningRequest,
} from "./browser-database-receipt-proposal";

export interface BrowserDatabaseReceiptProposalIntentSource {
  create(
    request: BrowserDatabaseReceiptProposalSigningRequest,
  ): Promise<BrowserDatabaseReceiptProposalResult<ProposalIntent>>;
}

export interface NativeBrowserDatabaseReceiptPasskeySignerOptions {
  readonly root: unknown;
  readonly expectedOrigin: string;
  readonly rpId: string;
  readonly timeoutMs: number;
  readonly now: () => number;
  readonly intents: BrowserDatabaseReceiptProposalIntentSource;
}

interface NativePasskeyHost {
  readonly origin: string;
  readonly getCredential: (options: CredentialRequestOptions) => Promise<Credential | null>;
  readonly publicKeyCredential: abstract new (...arguments_: never[]) => PublicKeyCredential;
  readonly assertionResponse: abstract new (...arguments_: never[]) => AuthenticatorAssertionResponse;
  readonly digest: SubtleCrypto["digest"];
  readonly atob: (value: string) => string;
  readonly btoa: (value: string) => string;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptProposalResult<T> {
  return { ok: true, value };
}

function failed(
  code: "receipt-proposal-configuration-invalid" | "receipt-proposal-signer-threw" | "receipt-proposal-signer-rejected",
  detail: string,
  severity: "backpressure" | "heat" = "heat",
): BrowserDatabaseReceiptProposalResult<never> {
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

function nativeHost(root: unknown): NativePasskeyHost | null {
  if (!isRecord(root)) return null;
  try {
    const location = Reflect.get(root, "location");
    const navigatorValue = Reflect.get(root, "navigator");
    const credentials = isRecord(navigatorValue) ? Reflect.get(navigatorValue, "credentials") : null;
    const cryptoValue = Reflect.get(root, "crypto");
    const subtle = isRecord(cryptoValue) ? Reflect.get(cryptoValue, "subtle") : null;
    const get = method(credentials, "get");
    const digest = method(subtle, "digest");
    const atob = method(root, "atob");
    const btoa = method(root, "btoa");
    const publicKeyCredential = constructor(root, "PublicKeyCredential");
    const assertionResponse = constructor(root, "AuthenticatorAssertionResponse");
    const origin = isRecord(location) ? Reflect.get(location, "origin") : null;
    if (
      typeof origin !== "string" ||
      get === null ||
      digest === null ||
      atob === null ||
      btoa === null ||
      publicKeyCredential === null ||
      assertionResponse === null
    ) {
      return null;
    }
    return {
      origin,
      getCredential: (options) => Reflect.apply(get, credentials, [options]) as Promise<Credential | null>,
      publicKeyCredential: publicKeyCredential as abstract new (...arguments_: never[]) => PublicKeyCredential,
      assertionResponse: assertionResponse as abstract new (...arguments_: never[]) => AuthenticatorAssertionResponse,
      digest: (algorithm, data) => Reflect.apply(digest, subtle, [algorithm, data]) as Promise<ArrayBuffer>,
      atob: (value) => Reflect.apply(atob, root, [value]) as string,
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

function base64urlToBytes(host: NativePasskeyHost, value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = host.atob(padded);
    const output = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index++) output[index] = binary.charCodeAt(index);
    return output;
  } catch {
    return null;
  }
}

function bytesToBase64url(host: NativePasskeyHost, value: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(value), (byte) => String.fromCharCode(byte)).join("");
  return host.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function canonicalProposalIntentBytes(intent: ProposalIntent): Uint8Array {
  return canonicalBytes({
    schema: intent.schema,
    proposalId: intent.proposalId,
    repository: intent.repository,
    baseRef: intent.baseRef,
    baseSha: intent.baseSha,
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
    nonce: intent.nonce,
    changeDigest: intent.changeDigest,
    authorCredentialId: intent.authorCredentialId,
    authorRegistrySequence: intent.authorRegistrySequence,
  });
}

async function challenge(host: NativePasskeyHost, intent: ProposalIntent): Promise<ArrayBuffer> {
  return host.digest("SHA-256", ownedArrayBuffer(canonicalProposalIntentBytes(intent)));
}

async function sha256Hex(host: NativePasskeyHost, value: string): Promise<string> {
  const digest = new Uint8Array(await host.digest("SHA-256", ownedArrayBuffer(new TextEncoder().encode(value))));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validIntent(
  host: NativePasskeyHost,
  intent: ProposalIntent,
  request: BrowserDatabaseReceiptProposalSigningRequest,
  now: number,
): Promise<boolean> {
  const createdAt = Date.parse(intent.createdAt);
  const expiresAt = Date.parse(intent.expiresAt);
  const nonce = base64urlToBytes(host, intent.nonce);
  return (
    Number.isSafeInteger(now) &&
    intent.schema === PROPOSAL_SCHEMA &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(intent.proposalId) &&
    intent.repository === PROPOSAL_REPOSITORY &&
    intent.baseRef === PROPOSAL_BASE_REF &&
    /^[0-9a-f]{40}$/.test(intent.baseSha) &&
    Number.isFinite(createdAt) &&
    Number.isFinite(expiresAt) &&
    intent.createdAt === new Date(createdAt).toISOString() &&
    intent.expiresAt === new Date(expiresAt).toISOString() &&
    expiresAt > createdAt &&
    expiresAt - createdAt <= PROPOSAL_MAX_LIFETIME_MS &&
    createdAt - now <= PROPOSAL_MAX_FUTURE_SKEW_MS &&
    now <= expiresAt &&
    nonce !== null &&
    nonce.byteLength === 32 &&
    /^[0-9a-f]{64}$/.test(intent.changeDigest) &&
    intent.changeDigest === (await sha256Hex(host, request.artifact.patch.trim())) &&
    intent.authorCredentialId.length >= 1 &&
    intent.authorCredentialId.length <= 4096 &&
    Number.isSafeInteger(intent.authorRegistrySequence) &&
    intent.authorRegistrySequence >= 0
  );
}

function validConfiguration(options: NativeBrowserDatabaseReceiptPasskeySignerOptions, host: NativePasskeyHost): boolean {
  let expected: URL;
  try {
    expected = new URL(options.expectedOrigin);
  } catch {
    return false;
  }
  return (
    expected.protocol === "https:" &&
    expected.origin === options.expectedOrigin &&
    host.origin === expected.origin &&
    options.rpId === expected.hostname &&
    Number.isSafeInteger(options.timeoutMs) &&
    options.timeoutMs >= 1 &&
    options.timeoutMs <= 120_000 &&
    typeof options.now === "function" &&
    method(options.intents, "create") !== null
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

/** Create the browser edge that spends passkey authority only from an explicit caller action. */
export function createNativeBrowserDatabaseReceiptPasskeySigner(
  options: NativeBrowserDatabaseReceiptPasskeySignerOptions,
): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalSigner> {
  const host = nativeHost(options.root);
  if (host === null || !validConfiguration(options, host)) {
    return failed(
      "receipt-proposal-configuration-invalid",
      "The native proposal signer requires one HTTPS origin, its exact relying-party ID, WebAuthn, and finite timeout.",
    );
  }

  return succeeded({
    sign: async (request) => {
      let intentResult: BrowserDatabaseReceiptProposalResult<ProposalIntent>;
      try {
        intentResult = await options.intents.create(request);
      } catch {
        return failed("receipt-proposal-signer-threw", "The injected proposal-intent source threw before WebAuthn.");
      }
      if (!intentResult.ok) return intentResult;
      const intent = intentResult.value;
      try {
        if (!(await validIntent(host, intent, request, options.now()))) {
          return failed(
            "receipt-proposal-signer-rejected",
            "The proposal intent is not a finite envelope for the exact receipt patch.",
          );
        }
      } catch {
        return failed("receipt-proposal-signer-threw", "The browser could not validate the proposal intent digest.");
      }
      const credentialId = base64urlToBytes(host, intent.authorCredentialId);
      if (credentialId === null) {
        return failed("receipt-proposal-signer-rejected", "The proposal intent carries no canonical passkey credential ID.");
      }

      let credential: Credential | null;
      try {
        credential = await host.getCredential({
          publicKey: {
            challenge: await challenge(host, intent),
            rpId: options.rpId,
            allowCredentials: [{ type: "public-key", id: ownedArrayBuffer(credentialId) }],
            userVerification: "required",
            timeout: options.timeoutMs,
          },
        });
      } catch (error) {
        return cancellation(error)
          ? failed(
              "receipt-proposal-signer-rejected",
              "The user declined or cancelled the passkey signing request.",
              "backpressure",
            )
          : failed("receipt-proposal-signer-threw", "The browser failed while requesting a passkey assertion.");
      }
      if (!(credential instanceof host.publicKeyCredential) || !(credential.response instanceof host.assertionResponse)) {
        return failed("receipt-proposal-signer-rejected", "The browser returned no passkey assertion.", "backpressure");
      }
      const response = credential.response;
      const observedCredentialId = bytesToBase64url(host, credential.rawId);
      if (observedCredentialId !== intent.authorCredentialId) {
        return failed("receipt-proposal-signer-rejected", "The browser used a different passkey credential.");
      }
      const signed: SignedProposal = {
        ...intent,
        assertion: {
          credentialId: observedCredentialId,
          authenticatorData: bytesToBase64url(host, response.authenticatorData),
          clientDataJSON: bytesToBase64url(host, response.clientDataJSON),
          signature: bytesToBase64url(host, response.signature),
          ...(response.userHandle === null ? {} : { userHandle: bytesToBase64url(host, response.userHandle) }),
        },
      };
      return succeeded(Object.freeze({ ...signed, assertion: Object.freeze(signed.assertion) }));
    },
  });
}
