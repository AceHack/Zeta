import type { WebAuthnAssertion } from "../planning/proposal-contract";
import type {
  BrowserDelegatedDeviceProposalResult,
  BrowserProposalPasskeyAuthorityPort,
} from "./browser-delegated-device-proposal-signer";

function failed<T>(
  detail: string,
  severity: "backpressure" | "heat" = "heat",
): BrowserDelegatedDeviceProposalResult<T> {
  return { ok: false, feedback: { severity, code: "device-proposal-passkey-refused", detail } };
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

function decodeBase64url(atob: (value: string) => string, value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function encodeBase64url(btoa: (value: string) => string, value: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(value), (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}

function cancelled(error: unknown): boolean {
  return isRecord(error) && (error.name === "NotAllowedError" || error.name === "AbortError");
}

/** Bind one root passkey assertion to an exact browser-safe challenge. */
export function createNativeBrowserProposalPasskeyAuthority(options: {
  readonly root: unknown;
  readonly expectedOrigin: string;
  readonly rpId: string;
  readonly timeoutMs: number;
}): BrowserDelegatedDeviceProposalResult<BrowserProposalPasskeyAuthorityPort> {
  if (!isRecord(options.root)) return failed("This runtime does not expose WebAuthn.", "backpressure");
  let location: unknown;
  let navigatorValue: unknown;
  try {
    location = Reflect.get(options.root, "location");
    navigatorValue = Reflect.get(options.root, "navigator");
  } catch {
    return failed("This runtime blocked access to WebAuthn.");
  }
  const credentials = isRecord(navigatorValue) ? Reflect.get(navigatorValue, "credentials") : null;
  const get = method(credentials, "get");
  const atobMethod = method(options.root, "atob");
  const btoaMethod = method(options.root, "btoa");
  const publicKeyCredential = constructor(options.root, "PublicKeyCredential");
  const assertionResponse = constructor(options.root, "AuthenticatorAssertionResponse");
  const origin = isRecord(location) ? location.origin : null;
  let expected: URL;
  try {
    expected = new URL(options.expectedOrigin);
  } catch {
    return failed("The expected WebAuthn origin is invalid.");
  }
  if (
    get === null ||
    atobMethod === null ||
    btoaMethod === null ||
    publicKeyCredential === null ||
    assertionResponse === null ||
    origin !== expected.origin ||
    expected.protocol !== "https:" ||
    options.rpId !== expected.hostname ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    options.timeoutMs > 120_000
  ) {
    return failed("Device authorization requires the canonical HTTPS origin, matching RP ID, and WebAuthn.");
  }
  const atob = (value: string): string => Reflect.apply(atobMethod, options.root, [value]) as string;
  const btoa = (value: string): string => Reflect.apply(btoaMethod, options.root, [value]) as string;

  return {
    ok: true,
    value: {
      async assert(input) {
        const credentialId = decodeBase64url(atob, input.credentialId);
        if (credentialId === null || input.challenge.byteLength !== 32) {
          return failed("Device authorization requires a canonical credential ID and SHA-256 challenge.");
        }
        let credential: Credential | null;
        try {
          credential = await (Reflect.apply(get, credentials, [
            {
              publicKey: {
                challenge: ownedBuffer(input.challenge),
                rpId: options.rpId,
                allowCredentials: [{ type: "public-key", id: ownedBuffer(credentialId) }],
                userVerification: "required",
                timeout: options.timeoutMs,
              },
            },
          ]) as Promise<Credential | null>);
        } catch (error) {
          return cancelled(error)
            ? failed("The user declined or cancelled device authorization.", "backpressure")
            : failed("The browser failed while requesting device authorization.");
        }
        if (!(credential instanceof publicKeyCredential)) {
          return failed("The browser returned no passkey assertion.", "backpressure");
        }
        const publicCredential = credential as PublicKeyCredential;
        if (!(publicCredential.response instanceof assertionResponse)) {
          return failed("The browser returned no passkey assertion.", "backpressure");
        }
        const response = publicCredential.response as AuthenticatorAssertionResponse;
        const assertion: WebAuthnAssertion = {
          credentialId: encodeBase64url(btoa, publicCredential.rawId),
          authenticatorData: encodeBase64url(btoa, response.authenticatorData),
          clientDataJSON: encodeBase64url(btoa, response.clientDataJSON),
          signature: encodeBase64url(btoa, response.signature),
          ...(response.userHandle === null ? {} : { userHandle: encodeBase64url(btoa, response.userHandle) }),
        };
        return { ok: true, value: assertion };
      },
    },
  };
}
