import { describe, expect, it } from "bun:test";
import { signSshCertWithFallback, signVaultSshCert, signCertManagerSshCert } from "./ca-vault.js";

describe("ca-vault integration", () => {

  it("falls back to local CA when Vault & cert-manager are unconfigured", async () => {
    const mockFx = {
      exists: () => true,
      readText: () => "ssh-ed25519 AAAAC3... mock-pubkey",
      writeText: () => {},
      mkdirp: () => {},
      genCa: () => "ssh-ed25519 AAAAC3... mock-ca-pubkey",
      signCert: () => ({ certPath: "/tmp/cert.pub", certText: "ssh-ed25519-cert-v01@openssh.com AAAAC3..." }),
    };

    const res = await signSshCertWithFallback({
      machineId: "test-host",
      devicePubPath: "/tmp/machines/test-host.pub",
      user: "alice",
      config: {},
      fx: mockFx,
    } as any);

    expect(res.provider).toBe("local-ca");
    expect(res.certResult).toBeDefined();
  });

  it("issues cert via mock Vault endpoint", async () => {
    const mockSignedKey = "ssh-ed25519-cert-v01@openssh.com AAAAC3... mock-vault-cert";
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (url.toString().includes("/v1/ssh-client-signer/sign")) {
        return new Response(
          JSON.stringify({
            data: {
              signed_key: mockSignedKey,
              serial_number: 12345,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const res = await signVaultSshCert("ssh-ed25519 AAAAC3... key", "alice", {
        vaultAddr: "http://127.0.0.1:8200",
        vaultToken: "s.mocktoken",
        vaultRole: "user-role",
      });

      expect(res.provider).toBe("vault");
      expect(res.certText).toBe(mockSignedKey);
      expect(res.serial).toBe("12345");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("issues cert via mock cert-manager endpoint", async () => {
    const mockSignedKey = "ssh-ed25519-cert-v01@openssh.com AAAAC3... mock-cert-manager";
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (url.toString().includes("/api/v1/ssh/sign")) {
        return new Response(
          JSON.stringify({
            certificate: mockSignedKey,
            serial: "cm-999",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const res = await signCertManagerSshCert("ssh-ed25519 AAAAC3... key", "alice", {
        certManagerUrl: "http://127.0.0.1:8080",
        certManagerToken: "bearer-token",
      });

      expect(res.provider).toBe("cert-manager");
      expect(res.certText).toBe(mockSignedKey);
      expect(res.serial).toBe("cm-999");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
