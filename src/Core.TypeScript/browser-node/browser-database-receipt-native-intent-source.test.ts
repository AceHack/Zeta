import { createHash, webcrypto } from "node:crypto";
import { describe, expect, test } from "bun:test";
import type { BrowserDatabaseReceiptPagesIndex } from "./browser-database-receipt-pages-contract";
import {
  BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY,
  createNativeBrowserDatabaseReceiptIntentSource,
} from "./browser-database-receipt-native-intent-source";
import type { BrowserDatabaseReceiptProposalSigningRequest } from "./browser-database-receipt-proposal";
import type { BrowserDatabaseReceiptPagesSource } from "./browser-database-receipt-pages-source";

const origin = "https://lucent-financial-group.github.io";
const rpId = "lucent-financial-group.github.io";
const revision = "a".repeat(40);
const now = Date.parse("2026-08-14T10:00:00.000Z");
const proposalId = "123e4567-e89b-42d3-a456-426614174000";
const patch = "diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -0,0 +1 @@\n+receipt\n";

function index(credentialId = "credential-a"): BrowserDatabaseReceiptPagesIndex {
  return {
    schema: "zeta.browser-database-receipt-pages-index.v2",
    repository: "Lucent-Financial-Group/Zeta",
    ref: "main",
    revision,
    proposalAuthority: {
      registrySequence: 7,
      authors: [{ credentialId, origin, rpId }],
    },
    records: [],
  };
}

function pages(value: BrowserDatabaseReceiptPagesIndex | null = index()): BrowserDatabaseReceiptPagesSource {
  return {
    readIndex: () => Promise.resolve({ ok: true, value }),
    read: () => Promise.resolve({ ok: true, value: null }),
  };
}

function request(): BrowserDatabaseReceiptProposalSigningRequest {
  return {
    artifact: {
      schema: "zeta.browser-database-receipt-proposal-artifact.v1",
      contentHash: `blake3:${"1".repeat(64)}`,
      targetPath: `db/receipts/browser/v1/${"1".repeat(64)}.json`,
      document: "{}\n",
      patch,
    },
    batch: {
      schema: "zeta.browser-database-receipt-handoff-batch.v1",
      databaseNodeId: "browser/global",
      archiveNodeId: "browser/global:receipts",
      archiveRevision: 1,
      firstSequence: 0,
      highWaterSequence: 0,
      receiptCount: 1,
      receipts: [],
      contentHash: `blake3:${"1".repeat(64)}`,
    },
  };
}

function root(credentialId: string | null = "credential-a") {
  return {
    location: { origin },
    localStorage: {
      getItem: (key: string): string | null =>
        key === BROWSER_DATABASE_RECEIPT_PASSKEY_CREDENTIAL_STORAGE_KEY ? credentialId : null,
    },
    crypto: {
      randomUUID: (): string => proposalId,
      getRandomValues: (target: Uint8Array): Uint8Array => target.fill(11),
      subtle: webcrypto.subtle,
    },
    btoa: (value: string): string => Buffer.from(value, "binary").toString("base64"),
  };
}

function open(source = pages(), credentialId: string | null = "credential-a") {
  const result = createNativeBrowserDatabaseReceiptIntentSource({
    root: root(credentialId),
    expectedOrigin: origin,
    rpId,
    now: () => now,
    expiresInMs: 60_000,
    pages: source,
  });
  if (!result.ok) throw new Error(result.feedback.detail);
  return result.value;
}

describe("native browser database receipt intent source", () => {
  test("binds fresh browser entropy and the exact Pages authority revision", async () => {
    const result = await open().create(request());

    expect(result).toEqual({
      ok: true,
      value: {
        schema: "zeta.proposal.v2",
        proposalId,
        repository: "Lucent-Financial-Group/Zeta",
        baseRef: "main",
        baseSha: revision,
        createdAt: "2026-08-14T10:00:00.000Z",
        expiresAt: "2026-08-14T10:01:00.000Z",
        nonce: Buffer.alloc(32, 11).toString("base64url"),
        changeDigest: createHash("sha256").update(patch.trim()).digest("hex"),
        authorCredentialId: "credential-a",
        authorRegistrySequence: 7,
      },
    });
  });

  test("refuses absent or unauthorized local enrollment before WebAuthn", async () => {
    expect(await open(pages(), null).create(request())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-signer-rejected" },
    });
    expect(await open(pages(index("credential-b"))).create(request())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-signer-rejected" },
    });
  });

  test("preserves typed Pages backpressure and refuses an undeployed authority snapshot", async () => {
    const unavailable: BrowserDatabaseReceiptPagesSource = {
      readIndex: () =>
        Promise.resolve({
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "receipt-handoff-acceptance-pages-transport-failed",
            detail: "offline",
          },
        }),
      read: () => Promise.resolve({ ok: true, value: null }),
    };
    expect(await open(unavailable).create(request())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", detail: expect.stringContaining("offline") },
    });
    expect(await open(pages(null)).create(request())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", detail: expect.stringContaining("not deployed") },
    });
  });
});
