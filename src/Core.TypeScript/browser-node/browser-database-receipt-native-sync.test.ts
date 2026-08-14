import { webcrypto } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { createNativeBrowserDatabaseReceiptSync } from "./browser-database-receipt-native-sync";

const origin = "https://lucent-financial-group.github.io";

class AssertionResponse {}
class PublicKeyCredential {
  readonly rawId = new ArrayBuffer(0);
  readonly response = new AssertionResponse();
}

function root() {
  return {
    location: { origin },
    localStorage: { getItem: (): string | null => null },
    crypto: {
      randomUUID: (): string => "123e4567-e89b-42d3-a456-426614174000",
      getRandomValues: (target: Uint8Array): Uint8Array => target.fill(1),
      subtle: webcrypto.subtle,
    },
    navigator: { credentials: { get: (): Promise<null> => Promise.resolve(null) } },
    PublicKeyCredential,
    AuthenticatorAssertionResponse: AssertionResponse,
    atob: (value: string): string => Buffer.from(value, "base64").toString("binary"),
    btoa: (value: string): string => Buffer.from(value, "binary").toString("base64"),
    fetch: (): Promise<Response> => Promise.resolve(new Response(null, { status: 404 })),
    open: (): unknown => ({ location: { href: "" }, opener: null, close: (): void => undefined }),
  };
}

function options(browserRoot: unknown = root()) {
  return {
    root: browserRoot,
    baseUrl: `${origin}/Zeta/hall/room/`,
    expectedOrigin: origin,
    rpId: "lucent-financial-group.github.io",
    databaseNodeId: "browser/global",
    archiveNodeId: "browser/global:receipts",
    targetNodeId: "git:Lucent-Financial-Group/Zeta",
    archive: {
      read: () => Promise.reject(new Error("not called during composition")),
      compactGeneration: () => Promise.reject(new Error("not called during composition")),
    },
    hasher: { hash: (): string => `blake3:${"1".repeat(64)}` },
    handoffLimits: { minimumReceipts: 1, maxReceipts: 8, maxBatchBytes: 32 * 1024 },
    limits: {
      pagesIndexBytes: 64 * 1024,
      pagesRecords: 128,
      pagesAuthors: 32,
      recordBytes: 64 * 1024,
      patchBytes: 128 * 1024,
      issueUrlBytes: 256 * 1024,
      passkeyTimeoutMs: 60_000,
      proposalLifetimeMs: 60_000,
    },
    now: (): number => Date.parse("2026-08-14T10:00:00.000Z"),
  };
}

describe("native browser database receipt synchronization", () => {
  test("composes the passkey, issue, Pages, acceptance, and archive ports without network access", () => {
    const opened = createNativeBrowserDatabaseReceiptSync(options());

    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(typeof opened.value.read).toBe("function");
      expect(typeof opened.value.submitFromUserActivation).toBe("function");
      expect(typeof opened.value.pollAcceptance).toBe("function");
      expect(opened.value.read()).toMatchObject({
        status: "idle",
        databaseNodeId: "browser/global",
        archiveNodeId: "browser/global:receipts",
      });
    }
  });

  test("fails closed when the host lacks the credential-free Pages transport", () => {
    const browserRoot = root();
    const { fetch: _fetch, ...withoutFetch } = browserRoot;

    expect(createNativeBrowserDatabaseReceiptSync(options(withoutFetch))).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "receipt-sync-configuration-invalid",
        detail: "The native receipt synchronization edge requires browser fetch.",
      },
    });
  });
});
