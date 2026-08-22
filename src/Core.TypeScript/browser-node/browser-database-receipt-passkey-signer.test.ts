import { describe, expect, test } from "bun:test";
import { proposalChallenge, sha256Hex, toBase64url, type ProposalIntent } from "../planning/proposal-envelope";
import type { BrowserDatabaseReceiptHandoffBatch } from "./browser-database-receipt-handoff";
import type {
  BrowserDatabaseReceiptProposalArtifact,
  BrowserDatabaseReceiptProposalResult,
  BrowserDatabaseReceiptProposalSigningRequest,
} from "./browser-database-receipt-proposal";
import { createNativeBrowserDatabaseReceiptPasskeySigner } from "./browser-database-receipt-passkey-signer";

const credentialBytes = new Uint8Array(new ArrayBuffer(32)).fill(7);
const credentialId = toBase64url(credentialBytes);
const patch = "diff --git a/example b/example\n";
const intent: ProposalIntent = {
  schema: "zeta.proposal.v2",
  proposalId: "123e4567-e89b-42d3-a456-426614174000",
  repository: "Lucent-Financial-Group/Zeta",
  baseRef: "main",
  baseSha: "a".repeat(40),
  createdAt: "2026-08-14T03:00:00.000Z",
  expiresAt: "2026-08-14T03:05:00.000Z",
  nonce: toBase64url(new Uint8Array(new ArrayBuffer(32)).fill(11)),
  changeDigest: sha256Hex(patch.trim()),
  authorCredentialId: credentialId,
  authorRegistrySequence: 3,
};

const artifact: BrowserDatabaseReceiptProposalArtifact = {
  schema: "zeta.browser-database-receipt-proposal-artifact.v1",
  contentHash: `blake3:${"c".repeat(64)}`,
  targetPath: `db/receipts/browser/v1/${"c".repeat(64)}.json`,
  document: "{}\n",
  patch,
};

const batch = {
  schema: "zeta.browser-database-receipt-handoff-batch.v1",
  databaseNodeId: "browser/global",
  archiveNodeId: "browser/global:receipts",
  archiveRevision: 1,
  firstSequence: 1,
  highWaterSequence: 1,
  receiptCount: 1,
  receipts: [],
  contentHash: artifact.contentHash,
} satisfies BrowserDatabaseReceiptHandoffBatch;

const signingRequest: BrowserDatabaseReceiptProposalSigningRequest = { artifact, batch };

function accepted<T>(value: T): BrowserDatabaseReceiptProposalResult<T> {
  return { ok: true, value };
}

class FakeAssertionResponse {
  readonly authenticatorData = Uint8Array.of(1, 2).buffer;
  readonly clientDataJSON = Uint8Array.of(3, 4).buffer;
  readonly signature = Uint8Array.of(5, 6).buffer;
  readonly userHandle = Uint8Array.of(7, 8).buffer;
}

class FakePublicKeyCredential {
  readonly type = "public-key";
  readonly rawId: ArrayBuffer;
  readonly response: FakeAssertionResponse;

  constructor(rawId: ArrayBuffer, response: FakeAssertionResponse) {
    this.rawId = rawId;
    this.response = response;
  }
}

function rootWith(get: (options: CredentialRequestOptions) => Promise<Credential | null>, origin = "https://lucent-financial-group.github.io") {
  return {
    location: { origin },
    navigator: { credentials: { get } },
    crypto: { subtle: globalThis.crypto.subtle },
    PublicKeyCredential: FakePublicKeyCredential,
    AuthenticatorAssertionResponse: FakeAssertionResponse,
    atob: globalThis.atob.bind(globalThis),
    btoa: globalThis.btoa.bind(globalThis),
  };
}

function createSigner(root: unknown) {
  return createNativeBrowserDatabaseReceiptPasskeySigner({
    root,
    expectedOrigin: "https://lucent-financial-group.github.io",
    rpId: "lucent-financial-group.github.io",
    timeoutMs: 60_000,
    now: () => Date.parse("2026-08-14T03:01:00.000Z"),
    intents: { create: () => Promise.resolve(accepted(intent)) },
  });
}

describe("native browser receipt passkey signer", () => {
  test("requests user verification with the byte-exact verifier challenge and serializes the assertion", async () => {
    const requests: CredentialRequestOptions[] = [];
    const credential = new FakePublicKeyCredential(
      credentialBytes.slice().buffer,
      new FakeAssertionResponse(),
    );
    const opened = createSigner(
      rootWith((options) => {
        requests.push(options);
        return Promise.resolve(credential as unknown as Credential);
      }),
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw new Error(opened.feedback.detail);
    const signed = await opened.value.sign(signingRequest);
    expect(signed).toMatchObject({
      ok: true,
      value: {
        proposalId: intent.proposalId,
        assertion: { credentialId, authenticatorData: "AQI", clientDataJSON: "AwQ", signature: "BQY" },
      },
    });
    const publicKey = requests[0]?.publicKey;
    expect(publicKey?.rpId).toBe("lucent-financial-group.github.io");
    expect(publicKey?.userVerification).toBe("required");
    expect(new Uint8Array(publicKey?.challenge as ArrayBuffer)).toEqual(new Uint8Array(proposalChallenge(intent)));
  });

  test("rejects the wrong origin before spending credential authority", () => {
    let calls = 0;
    const opened = createSigner(
      rootWith(() => {
        calls++;
        return Promise.resolve(null);
      }, "https://example.com"),
    );
    expect(opened).toMatchObject({ ok: false, feedback: { code: "receipt-proposal-configuration-invalid" } });
    expect(calls).toBe(0);
  });

  test("rejects an intent for different patch bytes before spending credential authority", async () => {
    let calls = 0;
    const opened = createNativeBrowserDatabaseReceiptPasskeySigner({
      root: rootWith(() => {
        calls++;
        return Promise.resolve(null);
      }),
      expectedOrigin: "https://lucent-financial-group.github.io",
      rpId: "lucent-financial-group.github.io",
      timeoutMs: 60_000,
      now: () => Date.parse("2026-08-14T03:01:00.000Z"),
      intents: { create: () => Promise.resolve(accepted({ ...intent, changeDigest: "0".repeat(64) })) },
    });
    if (!opened.ok) throw new Error(opened.feedback.detail);
    expect(await opened.value.sign(signingRequest)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-signer-rejected" },
    });
    expect(calls).toBe(0);
  });

  test("rejects a malformed nonce and an expired intent before spending credential authority", async () => {
    let calls = 0;
    const root = rootWith(() => {
      calls++;
      return Promise.resolve(null);
    });
    const signerWith = (candidate: ProposalIntent, now: string) =>
      createNativeBrowserDatabaseReceiptPasskeySigner({
        root,
        expectedOrigin: "https://lucent-financial-group.github.io",
        rpId: "lucent-financial-group.github.io",
        timeoutMs: 60_000,
        now: () => Date.parse(now),
        intents: { create: () => Promise.resolve(accepted(candidate)) },
      });

    const malformed = signerWith({ ...intent, nonce: "short" }, "2026-08-14T03:01:00.000Z");
    if (!malformed.ok) throw new Error(malformed.feedback.detail);
    expect(await malformed.value.sign(signingRequest)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-signer-rejected" },
    });

    const expired = signerWith(intent, "2026-08-14T03:06:00.000Z");
    if (!expired.ok) throw new Error(expired.feedback.detail);
    expect(await expired.value.sign(signingRequest)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-signer-rejected" },
    });
    expect(calls).toBe(0);
  });

  test("reports user cancellation as backpressure and rejects a substituted credential", async () => {
    const cancelled = createSigner(
      rootWith(() => Promise.reject(new DOMException("cancelled", "NotAllowedError"))),
    );
    if (!cancelled.ok) throw new Error(cancelled.feedback.detail);
    expect(await cancelled.value.sign(signingRequest)).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-signer-rejected" },
    });

    const substituted = createSigner(
      rootWith(() =>
        Promise.resolve(
          new FakePublicKeyCredential(Uint8Array.of(9).buffer, new FakeAssertionResponse()) as unknown as Credential,
        ),
      ),
    );
    if (!substituted.ok) throw new Error(substituted.feedback.detail);
    expect(await substituted.value.sign(signingRequest)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-signer-rejected" },
    });
  });
});
