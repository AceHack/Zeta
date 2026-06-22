/**
 * Vault-backed credential proxy — port of
 * `full-ai-cluster/k8s/applications/vault/Application.yaml` (Merge1 §08).
 *
 * Given the room's authenticated identity (SPIFFE SVID) and the hats it wears,
 * returns the tool grants the agent may use. Each grant is a Vault-issued
 * dynamic secret with a short TTL. The agent never names a tool or holds a raw
 * secret — observe.ts invokes this proxy to turn a chosen slot into a scoped,
 * allowed tool grant.
 *
 * Vault I/O is inherently async, so this defines a SEPARATE async seam
 * (`AsyncCredentialProxyPort`) rather than the synchronous `CredentialProxyPort`
 * used by the deterministic in-memory room — keeping that back-compatible.
 * Secret-fetch failures are Result-shaped (MP-7).
 */

import type { AgentIdentity, ToolGrant } from "./room.ts";
import type { SpiffeSvid } from "./spiffe-identity.ts";

export type VaultSecret = {
  readonly leaseId: string;
  readonly leaseDurationSeconds: number;
  readonly data: Record<string, string>;
};

export type VaultError =
  | { readonly kind: "permission_denied"; readonly path: string }
  | { readonly kind: "secret_not_found"; readonly path: string }
  | { readonly kind: "lease_expired"; readonly leaseId: string };

export type VaultResult =
  | { readonly outcome: "ok"; readonly value: VaultSecret }
  | { readonly outcome: "feedback"; readonly error: VaultError };

/** Async credential-proxy seam (the Vault counterpart to `CredentialProxyPort`). */
export interface AsyncCredentialProxyPort {
  grantsFor(identity: AgentIdentity, hatIds: readonly string[]): Promise<readonly ToolGrant[]>;
}

export interface VaultCredentialProxyDeps {
  fetchSvid: () => Promise<SpiffeSvid>;
  requestSecret: (path: string, params: Record<string, string>) => Promise<VaultResult>;
}

/**
 * Build a Vault-backed async credential proxy. For each seated hat it requests
 * `zeta/hats/<hatId>/tool-grant` scoped to the identity's SPIFFE subject; only
 * successfully-issued leases become grants (a denied/missing secret is skipped,
 * not thrown). Grants are returned in sorted hat-id order for determinism.
 */
export function createVaultCredentialProxy(
  vaultAddr: string,
  deps: VaultCredentialProxyDeps,
): AsyncCredentialProxyPort {
  return {
    async grantsFor(identity: AgentIdentity, hatIds: readonly string[]): Promise<readonly ToolGrant[]> {
      void vaultAddr;
      void (await deps.fetchSvid());
      const grants: ToolGrant[] = [];
      const sorted = [...hatIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      for (const hatId of sorted) {
        const path = `zeta/hats/${hatId}/tool-grant`;
        const result = await deps.requestSecret(path, { spiffe_id: identity.subject });
        if (result.outcome === "ok") {
          grants.push({ tool: `tool:${hatId}`, credentialScope: `vault:${path}` });
        }
      }
      return grants;
    },
  };
}
