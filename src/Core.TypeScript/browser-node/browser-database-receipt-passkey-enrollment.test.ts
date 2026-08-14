import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { encode } from "cborg";
import { verifyProposalPasskeyEnrollment } from "../planning/proposal-verifier";
import { createNativeBrowserDatabaseReceiptPasskeyEnrollment } from "./browser-database-receipt-passkey-enrollment";

const origin = "https://lucent-financial-group.github.io" as const;
const rpId = "lucent-financial-group.github.io" as const;
const now = Date.parse("2026-08-14T12:20:00.000Z");

class FakeAttestationResponse {
  readonly clientDataJSON: ArrayBuffer;
  readonly attestationObject: ArrayBuffer;

  constructor(clientDataJSON: ArrayBuffer, attestationObject: ArrayBuffer) {
    this.clientDataJSON = clientDataJSON;
    this.attestationObject = attestationObject;
  }
}

class FakePublicKeyCredential {
  readonly rawId: ArrayBuffer;
  readonly response: FakeAttestationResponse;

  constructor(rawId: ArrayBuffer, response: FakeAttestationResponse) {
    this.rawId = rawId;
    this.response = response;
  }
}

function base64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

function ownedBuffer(source: BufferSource | undefined): ArrayBuffer {
  if (source === undefined) return new ArrayBuffer(0);
  if (source instanceof ArrayBuffer) return source;
  const output = new ArrayBuffer(source.byteLength);
  new Uint8Array(output).set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
  return output;
}

function attestationObject(credentialId: Uint8Array): ArrayBuffer {
  const x = Buffer.alloc(32, 4);
  const y = Buffer.alloc(32, 5);
  const cose = encode(
    new Map<unknown, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, x],
      [-3, y],
    ]),
  );
  const authData = Buffer.alloc(55 + credentialId.byteLength + cose.byteLength);
  createHash("sha256").update(rpId).digest().copy(authData, 0);
  authData[32] = 0x45;
  authData.writeUInt32BE(1, 33);
  authData.writeUInt16BE(credentialId.byteLength, 53);
  Buffer.from(credentialId).copy(authData, 55);
  Buffer.from(cose).copy(authData, 55 + credentialId.byteLength);
  const encoded = encode(
    new Map<unknown, unknown>([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", authData],
    ]),
  );
  const output = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(output).set(encoded);
  return output;
}

function root(input?: { readonly credentialId?: string; readonly cancel?: boolean }) {
  const storage = new Map<string, string>();
  if (input?.credentialId !== undefined) storage.set("zeta-proposal-passkey-credential-id", input.credentialId);
  let creation: PublicKeyCredentialCreationOptions | null = null;
  let entropyByte = 0;
  const value = {
    location: { origin },
    localStorage: {
      getItem: (key: string): string | null => storage.get(key) ?? null,
      setItem: (key: string, stored: string): void => {
        storage.set(key, stored);
      },
    },
    crypto: {
      getRandomValues: (target: Uint8Array): Uint8Array => target.fill((entropyByte += 1)),
    },
    navigator: {
      credentials: {
        create: (options: CredentialCreationOptions): Promise<Credential | null> => {
          creation = options.publicKey ?? null;
          if (input?.cancel === true) return Promise.resolve(null);
          const challengeBytes = ownedBuffer(options.publicKey?.challenge);
          const clientData = new TextEncoder().encode(
            JSON.stringify({ type: "webauthn.create", challenge: base64url(challengeBytes), origin }),
          );
          const credentialId = Uint8Array.of(7, 8, 9);
          return Promise.resolve(
            new FakePublicKeyCredential(
              credentialId.buffer,
              new FakeAttestationResponse(clientData.buffer, attestationObject(credentialId)),
            ) as unknown as Credential,
          );
        },
      },
    },
    PublicKeyCredential: FakePublicKeyCredential,
    AuthenticatorAttestationResponse: FakeAttestationResponse,
    btoa: (text: string): string => Buffer.from(text, "binary").toString("base64"),
  };
  return { value, storage, creation: (): PublicKeyCredentialCreationOptions | null => creation };
}

function open(browserRoot: unknown) {
  return createNativeBrowserDatabaseReceiptPasskeyEnrollment({
    root: browserRoot,
    expectedOrigin: origin,
    rpId,
    timeoutMs: 60_000,
    now: () => now,
  });
}

describe("native browser database receipt passkey enrollment", () => {
  test("creates one ES256 package and retains only its public credential ID", async () => {
    const browser = root();
    const opened = open(browser.value);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const enrolled = await opened.value.enrollFromUserActivation();

    expect(enrolled).toMatchObject({
      ok: true,
      value: {
        schema: "zeta.proposal-passkey-enrollment.v1",
        repository: "Lucent-Financial-Group/Zeta",
        credentialId: Buffer.from([7, 8, 9]).toString("base64url"),
        origin,
        rpId,
        createdAt: "2026-08-14T12:20:00.000Z",
      },
    });
    expect(browser.storage.get("zeta-proposal-passkey-credential-id")).toBe(
      Buffer.from([7, 8, 9]).toString("base64url"),
    );
    expect(browser.creation()).toMatchObject({
      rp: { id: rpId },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      attestation: "none",
    });
    expect(enrolled.ok && Buffer.from(enrolled.value.challenge, "base64url").byteLength).toBe(32);
    if (enrolled.ok) {
      expect(verifyProposalPasskeyEnrollment(enrolled.value, new Date(now))).toMatchObject({
        ok: true,
        author: { credentialId: Buffer.from([7, 8, 9]).toString("base64url"), origin, rpId },
      });
    }
  });

  test("does not silently replace an existing local credential", async () => {
    const browser = root({ credentialId: "already-enrolled" });
    const opened = open(browser.value);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    expect(await opened.value.enrollFromUserActivation()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-passkey-enrollment-present-credential" },
    });
    expect(browser.creation()).toBeNull();
  });

  test("reports cancellation and missing native capabilities as typed feedback", async () => {
    const cancelledBrowser = root({ cancel: true });
    const opened = open(cancelledBrowser.value);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(await opened.value.enrollFromUserActivation()).toMatchObject({
        ok: false,
        feedback: { severity: "backpressure", code: "receipt-passkey-enrollment-cancelled" },
      });
    }
    expect(open({ location: { origin } })).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-passkey-enrollment-configuration-invalid" },
    });
  });
});
