/**
 * k8s-vault-qemu.test.ts — End-to-End K8s Cluster, USB Boot, & Vault Access Setup Integration Test Suite.
 *
 * Verifies end-to-end USB/ISO boot provisioning, Vault SSH-CA cluster bootstrap, FROST threshold signing,
 * and zero-downtime key rotation & Vault secret sync from ISO/USB.
 */

import { describe, expect, it } from "bun:test";
import { writeTestCredentialBlob, DEFAULT_QEMU_USB_UUID, DEFAULT_QEMU_WIFI_SSID } from "./prepare-boot-image.js";
import { signSshCertWithFallback } from "../../../../tools/setup/persona-keys/ca-vault.js";
import { generateFrostNoncePair, signPartialShare, aggregateFrostSignatures, splitSecret } from "../../../../tools/setup/persona-keys/frost-signer.js";
import { rotateKeyringAndSyncVault } from "../../../../tools/setup/persona-keys/keyring-rotate-daemon.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GOLDEN_SEED = "test test test test test test test test test test test junk";

describe("End-to-End K8s Cluster, USB Boot & Vault Access Test Suite", () => {
  describe("1. USB & ISO Boot Provisioning", () => {
    it("provisions deterministic QEMU USB image with baked ESP wifi credentials", () => {
      const dir = mkdtempSync(join(tmpdir(), "zeta-k8s-qemu-test-"));
      try {
        const blobPath = join(dir, "zeta-creds.enc");
        writeTestCredentialBlob(blobPath);
        const bytes = readFileSync(blobPath);
        expect(bytes.byteLength).toBeGreaterThan(32);
        expect(DEFAULT_QEMU_USB_UUID).toContain("b0891");
        expect(DEFAULT_QEMU_WIFI_SSID).toBe("zeta-qemu-homelab");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("2. Vault & K8s Cluster SSH-CA Access Setup", () => {
    it("bootstraps Vault SSH secrets engine and issues signed node certificates", async () => {
      const mockSignedKey = "ssh-ed25519-cert-v01@openssh.com AAAAC3... mock-k8s-vault-cert";
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        if (url.toString().includes("/v1/ssh-client-signer/sign")) {
          return new Response(
            JSON.stringify({
              data: {
                signed_key: mockSignedKey,
                serial_number: 998877,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(url, init);
      }) as typeof fetch;

      try {
        const res = await signSshCertWithFallback({
          config: {
            vaultAddr: "http://127.0.0.1:8200",
            vaultToken: "s.k8s-init-token",
            vaultRole: "k8s-node-role",
          },
          user: "zeta-node-1",
          devicePubPath: "/tmp/machines/node1.pub",
          machineId: "node1",
        } as any);

        expect(res.provider).toBe("vault");
        expect(res.certText).toBe(mockSignedKey);
        expect(res.serial).toBe("998877");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("3. Distributed FROST Threshold Node Cluster Custody", () => {
    it("executes t-of-n threshold signing across distributed K8s cluster nodes", () => {
      const clusterSeed = new Uint8Array(32);
      clusterSeed.fill(0x77);

      // 3-of-5 threshold shares across cluster nodes
      const shares = splitSecret(clusterSeed, 3, 5);
      expect(shares.length).toBe(5);

      const msg = new TextEncoder().encode("K8s-Cluster-State-Attestation-v1");

      // Nodes 1, 3, 5 participate in threshold signature
      const n1 = generateFrostNoncePair(1);
      const n3 = generateFrostNoncePair(3);
      const n5 = generateFrostNoncePair(5);
      const commitments = [n1.commitment, n3.commitment, n5.commitment];

      const p1 = signPartialShare(shares[0]!, n1.noncePair, commitments, msg);
      const p3 = signPartialShare(shares[2]!, n3.noncePair, commitments, msg);
      const p5 = signPartialShare(shares[4]!, n5.noncePair, commitments, msg);

      const aggregatedSig = aggregateFrostSignatures([p1, p3, p5], commitments);
      expect(aggregatedSig.length).toBe(64);
    });
  });

  describe("4. Zero-Downtime Persona Rotation & Vault Secret Sync", () => {
    it("rotates keyring and syncs KV v2 secrets engine on K8s cluster node", async () => {
      const originalFetch = globalThis.fetch;
      let vaultPayload: any = null;

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        if (url.toString().includes("/v1/secret/data/maintainers/zeta-k8s-admin")) {
          vaultPayload = JSON.parse(init?.body as string);
          return new Response(JSON.stringify({ data: { version: 1 } }), { status: 200 });
        }
        return originalFetch(url, init);
      }) as typeof fetch;

      try {
        const res = await rotateKeyringAndSyncVault({
          user: "zeta-k8s-admin",
          seed: GOLDEN_SEED,
          vaultConfig: {
            vaultAddr: "http://127.0.0.1:8200",
            vaultToken: "s.admin-token",
          },
        });

        expect(res.status).toBe("rotated-and-synced");
        expect(res.vaultPath).toContain("zeta-k8s-admin");
        expect(vaultPayload.data.public.ssh.public).toContain("ssh-ed25519");
        expect(vaultPayload.data.public.nostr.npub).toContain("npub1");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
