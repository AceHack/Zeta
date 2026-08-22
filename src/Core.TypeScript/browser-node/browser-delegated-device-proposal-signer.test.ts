import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { deviceBytesToBase64url } from "../planning/delegated-device-proposal-contract";
import { verifyDelegatedDeviceProposal } from "../planning/delegated-device-proposal";
import { toBase64url } from "../planning/proposal-envelope";
import type { ProposalAuthorRegistry } from "../planning/proposal-verifier";
import {
  createNativeBrowserProposalDeviceCrypto,
  type BrowserProposalDeviceKeyStore,
  type BrowserStoredProposalDeviceKey,
} from "./browser-delegated-device-key";
import { openNativeIndexedDbProposalDeviceKeyStore } from "./browser-delegated-device-key-indexeddb";
import { createNativeBrowserProposalPasskeyAuthority } from "./browser-delegated-device-passkey-authority";
import { createBrowserDelegatedDeviceProposalRelayHttpHandler } from "./browser-delegated-device-proposal-relay-http";
import {
  createBrowserDelegatedDeviceProposalSigner,
  type BrowserProposalPasskeyAuthorityPort,
} from "./browser-delegated-device-proposal-signer";

const ORIGIN = "https://lucent-financial-group.github.io";
const RP_ID = "lucent-financial-group.github.io";
const BASE_SHA = "a".repeat(40);
const NOW = Date.parse("2026-08-14T14:00:00.000Z");
const ROOT_CREDENTIAL_ID = toBase64url(Buffer.alloc(32, 21));
const PATCH =
  "diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1 +1 @@\n-old\n+new\n";

function authenticatorData(): Buffer {
  const output = Buffer.alloc(37);
  createHash("sha256").update(RP_ID).digest().copy(output, 0);
  output[32] = 0x05;
  output.writeUInt32BE(1, 33);
  return output;
}

function memoryStore(): {
  readonly store: BrowserProposalDeviceKeyStore;
  readonly retained: () => BrowserStoredProposalDeviceKey | null;
} {
  let value: BrowserStoredProposalDeviceKey | null = null;
  return {
    retained: () => value,
    store: {
      load: () => Promise.resolve({ ok: true, value }),
      retain: (candidate) => {
        value ??= candidate;
        return Promise.resolve({ ok: true, value });
      },
    },
  };
}

describe("browser delegated-device proposal signer", () => {
  test("BDPS-1: one passkey delegation authorizes repeat device signatures accepted by the Action verifier", async () => {
    const root = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const memory = memoryStore();
    const native = createNativeBrowserProposalDeviceCrypto(globalThis, memory.store);
    expect(native.ok).toBeTrue();
    if (!native.ok) return;
    let passkeyCalls = 0;
    const passkeys: BrowserProposalPasskeyAuthorityPort = {
      assert(input) {
        passkeyCalls += 1;
        const authData = authenticatorData();
        const clientData = Buffer.from(
          JSON.stringify({
            type: "webauthn.get",
            challenge: deviceBytesToBase64url(input.challenge),
            origin: ORIGIN,
            crossOrigin: false,
          }),
        );
        const signature = sign(
          "sha256",
          Buffer.concat([authData, createHash("sha256").update(clientData).digest()]),
          root.privateKey,
        );
        return Promise.resolve({
          ok: true,
          value: {
            credentialId: input.credentialId,
            authenticatorData: toBase64url(authData),
            clientDataJSON: toBase64url(clientData),
            signature: toBase64url(signature),
          },
        });
      },
    };
    const signer = createBrowserDelegatedDeviceProposalSigner({
      now: () => NOW,
      keys: native.value.keys,
      digest: native.value.digest,
      passkeys,
    });
    expect(signer.ok).toBeTrue();
    if (!signer.ok) return;
    const delegation = await signer.value.authorizeFromUserActivation({
      authorityCredentialId: ROOT_CREDENTIAL_ID,
      authorRegistrySequence: 1,
      maxPatchBytes: 16 * 1024,
    });
    expect(delegation.ok).toBeTrue();
    if (!delegation.ok) return;

    const first = await signer.value.sign({ delegation: delegation.value, baseSha: BASE_SHA, payload: PATCH });
    const second = await signer.value.sign({ delegation: delegation.value, baseSha: BASE_SHA, payload: PATCH });
    expect(first.ok).toBeTrue();
    expect(second.ok).toBeTrue();
    expect(passkeyCalls).toBe(1);
    expect(memory.retained()?.privateKey.extractable).toBeFalse();
    expect(memory.retained()?.privateKey.usages).toEqual(["sign"]);
    if (!first.ok) return;

    const registry: ProposalAuthorRegistry = {
      schema: "zeta.proposal-author-registry.v2",
      repository: "Lucent-Financial-Group/Zeta",
      sequence: 1,
      issuedAt: "2026-08-14T13:55:00.000Z",
      authors: [
        {
          credentialId: ROOT_CREDENTIAL_ID,
          origin: ORIGIN,
          rpId: RP_ID,
          publicKeyJwk: root.publicKey.export({ format: "jwk" }),
        },
      ],
      revoked: {},
    };
    expect(
      verifyDelegatedDeviceProposal({
        submission: first.value,
        registry,
        currentMainSha: BASE_SHA,
        now: new Date(NOW),
      }),
    ).toMatchObject({ ok: true, paths: ["docs/example.md"] });

    let issueCalls = 0;
    const handler = createBrowserDelegatedDeviceProposalRelayHttpHandler({
      expectedOrigin: ORIGIN,
      authority: { load: () => Promise.resolve({ ok: true, value: { registry, currentMainSha: BASE_SHA } }) },
      issues: {
        publish: () => {
          issueCalls += 1;
          return Promise.resolve({
            ok: true,
            value: { issueUrl: "https://github.com/Lucent-Financial-Group/Zeta/issues/42" },
          });
        },
      },
      now: () => new Date(NOW),
    });
    const request = (): Request =>
      new Request("http://127.0.0.1:8787/v1/delegated-device-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
        body: JSON.stringify(first.value),
      });
    const preflight = await handler(
      new Request("http://127.0.0.1:8787/v1/delegated-device-proposals", {
        method: "OPTIONS",
        headers: { Origin: ORIGIN, "Access-Control-Request-Private-Network": "true" },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Private-Network")).toBe("true");
    expect((await handler(request())).status).toBe(202);
    expect((await handler(request())).status).toBe(409);
    expect(issueCalls).toBe(1);
  });

  test("BDPS-2: two tabs retain the first persistent key rather than rotating authority", async () => {
    const memory = memoryStore();
    const left = createNativeBrowserProposalDeviceCrypto(globalThis, memory.store);
    const right = createNativeBrowserProposalDeviceCrypto(globalThis, memory.store);
    expect(left.ok && right.ok).toBeTrue();
    if (!left.ok || !right.ok) return;

    const leftKey = await left.value.keys.loadOrCreate();
    const rightKey = await right.value.keys.loadOrCreate();

    expect(leftKey.ok && rightKey.ok).toBeTrue();
    if (leftKey.ok && rightKey.ok) expect(rightKey.value.deviceId).toBe(leftKey.value.deviceId);
  });

  test("BDPS-3: missing IndexedDB and a foreign passkey origin are typed failures", async () => {
    expect(await openNativeIndexedDbProposalDeviceKeyStore({})).toMatchObject({
      ok: false,
      feedback: { code: "device-proposal-key-unavailable", severity: "backpressure" },
    });
    expect(
      createNativeBrowserProposalPasskeyAuthority({
        root: {
          location: { origin: "https://attacker.example" },
          navigator: { credentials: { get: () => Promise.resolve(null) } },
          PublicKeyCredential: class {},
          AuthenticatorAssertionResponse: class {},
          atob,
          btoa,
        },
        expectedOrigin: ORIGIN,
        rpId: RP_ID,
        timeoutMs: 60_000,
      }),
    ).toMatchObject({ ok: false, feedback: { code: "device-proposal-passkey-refused" } });
  });
});
