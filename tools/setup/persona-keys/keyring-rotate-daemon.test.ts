import { describe, expect, it } from "bun:test";
import { rotateKeyringAndSyncVault, syncKeyringToVault } from "./keyring-rotate-daemon.js";

const GOLDEN_SEED = "test test test test test test test test test test test junk";

describe("keyring rotation & Vault sync daemon", () => {
  it("executes dry-run rotation without network calls", async () => {
    const res = await rotateKeyringAndSyncVault({
      user: "zeta",
      seed: GOLDEN_SEED,
      dryRun: true,
    });

    expect(res.status).toBe("dry-run-success");
    expect(res.vaultPath).toContain("/v1/secret/data/maintainers/zeta");
  });

  it("syncs keyring data to mock Vault KV v2 store", async () => {
    const originalFetch = globalThis.fetch;
    let postedBody: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (url.toString().includes("/v1/secret/data/maintainers/zeta")) {
        postedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ data: { created_time: "2026-07-31T22:00:00Z" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const res = await syncKeyringToVault("zeta", GOLDEN_SEED, {
        vaultAddr: "http://127.0.0.1:8200",
        vaultToken: "s.mocktoken",
      });

      expect(res.success).toBe(true);
      expect(res.path).toBe("/v1/secret/data/maintainers/zeta");
      expect(postedBody.data.public.ssh.public).toContain("ssh-ed25519");
      expect(postedBody.data.public.nostr.npub).toContain("npub1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
