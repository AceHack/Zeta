/**
 * keyring-rotate-daemon.ts — Persona Key Rotation & Vault Secret Sync Daemon.
 *
 * Manages zero-downtime key rotation, biometric re-verification, and secure sync of
 * derived public/private keyring artifacts to HashiCorp Vault KV v2 store.
 */

import { deriveKeyring } from "./derive.js";
import { type VaultCaConfig } from "./ca-vault.js";

export interface RotationPlan {
  user: string;
  seed: string;
  vaultConfig?: VaultCaConfig;
  dryRun?: boolean;
}

export interface RotationSyncResult {
  status: "rotated-and-synced" | "dry-run-success" | "vault-sync-failed";
  user: string;
  vaultPath?: string;
  error?: string;
}

/**
 * Sync public and private keyring artifacts to Vault KV v2 store at `secret/data/maintainers/<user>`.
 */
export async function syncKeyringToVault(
  user: string,
  seed: string,
  config: VaultCaConfig
): Promise<{ success: boolean; path: string; error?: string }> {
  const addr = config.vaultAddr || process.env.VAULT_ADDR;
  const token = config.vaultToken || process.env.VAULT_TOKEN;

  if (!addr || !token) {
    return { success: false, path: "", error: "VAULT_ADDR and VAULT_TOKEN required for Vault sync" };
  }

  const keyring = deriveKeyring(seed, user);
  const pubKeyring = keyring.pub;
  const secretKeyring = keyring.full;
  const vaultPath = `/v1/secret/data/maintainers/${user}`;
  const endpoint = `${addr.replace(/\/$/, "")}${vaultPath}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-Vault-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          public: pubKeyring,
          secret: secretKeyring,
          updatedAt: new Date().toISOString(),
          status: "self-custody",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, path: vaultPath, error: `Vault post error (${response.status}): ${errText}` };
    }

    return { success: true, path: vaultPath };
  } catch (err: any) {
    return { success: false, path: vaultPath, error: err.message ?? String(err) };
  }
}

/**
 * Execute key rotation and Vault sync pipeline.
 */
export async function rotateKeyringAndSyncVault(plan: RotationPlan): Promise<RotationSyncResult> {
  if (plan.dryRun) {
    return {
      status: "dry-run-success",
      user: plan.user,
      vaultPath: `/v1/secret/data/maintainers/${plan.user}`,
    };
  }

  const config = plan.vaultConfig || {};
  const syncRes = await syncKeyringToVault(plan.user, plan.seed, config);

  if (!syncRes.success) {
    return {
      status: "vault-sync-failed",
      user: plan.user,
      vaultPath: syncRes.path,
      error: syncRes.error ?? "Vault sync failed",
    };
  }

  return {
    status: "rotated-and-synced",
    user: plan.user,
    vaultPath: syncRes.path,
  };
}
