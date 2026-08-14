import {
  PROPOSAL_BASE_REF,
  PROPOSAL_MAX_LIFETIME_MS,
  PROPOSAL_REPOSITORY,
  PROPOSAL_SCHEMA,
  type ProposalIntent,
} from "../planning/proposal-contract";
import type {
  BrowserDatabaseReceiptProposalResult,
  BrowserDatabaseReceiptProposalSigningRequest,
} from "./browser-database-receipt-proposal";
import type { BrowserDatabaseReceiptProposalIntentSource } from "./browser-database-receipt-passkey-signer";
import type { BrowserDatabaseReceiptPagesSource } from "./browser-database-receipt-pages-source";

export const BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY = "zeta-proposal-passkey-credential-id" as const;

export interface NativeBrowserDatabaseReceiptIntentSourceOptions {
  readonly root: unknown;
  readonly expectedOrigin: string;
  readonly rpId: string;
  readonly now: () => number;
  readonly expiresInMs: number;
  readonly pages: BrowserDatabaseReceiptPagesSource;
  readonly credentialStorageKey?: string;
}

interface NativeIntentHost {
  readonly origin: string;
  readonly getCredentialId: (key: string) => string | null;
  readonly randomUuid: () => string;
  readonly randomBytes: (target: Uint8Array) => Uint8Array;
  readonly digest: SubtleCrypto["digest"];
  readonly btoa: (value: string) => string;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptProposalResult<T> {
  return { ok: true, value };
}

function failed(
  detail: string,
  severity: "backpressure" | "heat" = "heat",
): BrowserDatabaseReceiptProposalResult<never> {
  return { ok: false, feedback: { severity, code: "receipt-proposal-signer-rejected", detail } };
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

function nativeHost(root: unknown): NativeIntentHost | null {
  if (!isRecord(root)) return null;
  try {
    const location = Reflect.get(root, "location");
    const storage = Reflect.get(root, "localStorage");
    const cryptoValue = Reflect.get(root, "crypto");
    const subtle = isRecord(cryptoValue) ? Reflect.get(cryptoValue, "subtle") : null;
    const origin = isRecord(location) ? Reflect.get(location, "origin") : null;
    const getItem = method(storage, "getItem");
    const randomUuid = method(cryptoValue, "randomUUID");
    const getRandomValues = method(cryptoValue, "getRandomValues");
    const digest = method(subtle, "digest");
    const btoa = method(root, "btoa");
    if (
      typeof origin !== "string" ||
      getItem === null ||
      randomUuid === null ||
      getRandomValues === null ||
      digest === null ||
      btoa === null
    ) {
      return null;
    }
    return {
      origin,
      getCredentialId: (key) => Reflect.apply(getItem, storage, [key]) as string | null,
      randomUuid: () => Reflect.apply(randomUuid, cryptoValue, []) as string,
      randomBytes: (target) => Reflect.apply(getRandomValues, cryptoValue, [target]) as Uint8Array,
      digest: (algorithm, data) => Reflect.apply(digest, subtle, [algorithm, data]) as Promise<ArrayBuffer>,
      btoa: (value) => Reflect.apply(btoa, root, [value]) as string,
    };
  } catch {
    return null;
  }
}

function validConfiguration(options: NativeBrowserDatabaseReceiptIntentSourceOptions, host: NativeIntentHost): boolean {
  let expected: URL;
  try {
    expected = new URL(options.expectedOrigin);
  } catch {
    return false;
  }
  const storageKey = options.credentialStorageKey ?? BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY;
  return (
    expected.protocol === "https:" &&
    expected.origin === options.expectedOrigin &&
    host.origin === expected.origin &&
    options.rpId === expected.hostname &&
    Number.isSafeInteger(options.expiresInMs) &&
    options.expiresInMs >= 1 &&
    options.expiresInMs <= PROPOSAL_MAX_LIFETIME_MS &&
    storageKey.length >= 1 &&
    storageKey.length <= 1024 &&
    typeof options.now === "function" &&
    method(options.pages, "readIndex") !== null
  );
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}

function bytesToBase64url(host: NativeIntentHost, bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return host.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(host: NativeIntentHost, value: string): Promise<string> {
  const payload = new TextEncoder().encode(value);
  const digest = new Uint8Array(await host.digest("SHA-256", ownedArrayBuffer(payload)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Bind a local passkey enrollment to the immutable authority snapshot published by Pages. */
export function createNativeBrowserDatabaseReceiptIntentSource(
  options: NativeBrowserDatabaseReceiptIntentSourceOptions,
): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalIntentSource> {
  const host = nativeHost(options.root);
  if (host === null || !validConfiguration(options, host)) {
    return failed(
      "The native receipt intent source requires one HTTPS origin, local passkey enrollment, Web Crypto, and a bounded Pages authority source.",
    );
  }
  const storageKey = options.credentialStorageKey ?? BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY;

  return succeeded({
    create: async (
      request: BrowserDatabaseReceiptProposalSigningRequest,
    ): Promise<BrowserDatabaseReceiptProposalResult<ProposalIntent>> => {
      let index;
      try {
        index = await options.pages.readIndex();
      } catch {
        return failed("The Pages authority source threw before proposal signing.");
      }
      if (!index.ok) {
        return failed(`${index.feedback.code}: ${index.feedback.detail}`, index.feedback.severity);
      }
      if (index.value === null) {
        return failed("The Pages authority snapshot is not deployed yet.", "backpressure");
      }

      let credentialId: string | null;
      try {
        credentialId = host.getCredentialId(storageKey);
      } catch {
        return failed("The browser refused access to its local passkey enrollment.");
      }
      if (credentialId === null || credentialId.length < 1 || credentialId.length > 4096) {
        return failed("No finite local proposal passkey enrollment is available.", "backpressure");
      }
      const author = index.value.proposalAuthority.authors.find(
        (candidate) =>
          candidate.credentialId === credentialId &&
          candidate.origin === options.expectedOrigin &&
          candidate.rpId === options.rpId,
      );
      if (author === undefined) {
        return failed("The local proposal passkey is not authorized by this immutable Pages revision.", "backpressure");
      }

      try {
        const now = options.now();
        const proposalId = host.randomUuid();
        if (
          !Number.isSafeInteger(now) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proposalId)
        ) {
          return failed("The browser produced no finite proposal time or random UUID.");
        }
        const nonceBytes = new Uint8Array(new ArrayBuffer(32));
        const random = host.randomBytes(nonceBytes);
        if (random !== nonceBytes) return failed("The browser returned a foreign proposal nonce buffer.");
        const patch = request.artifact.patch.trim();
        if (patch.length === 0) return failed("The receipt proposal contains no finite patch.");
        return succeeded(
          Object.freeze({
            schema: PROPOSAL_SCHEMA,
            proposalId,
            repository: PROPOSAL_REPOSITORY,
            baseRef: PROPOSAL_BASE_REF,
            baseSha: index.value.revision,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + options.expiresInMs).toISOString(),
            nonce: bytesToBase64url(host, nonceBytes),
            changeDigest: await sha256Hex(host, patch),
            authorCredentialId: author.credentialId,
            authorRegistrySequence: index.value.proposalAuthority.registrySequence,
          }),
        );
      } catch {
        return failed("The browser failed while constructing fresh proposal entropy.");
      }
    },
  });
}
