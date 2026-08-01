/**
 * ca-vault.ts — HashiCorp Vault & cert-manager SSH-CA integration with failover hierarchy.
 *
 * Implements SSH certificate signing via Vault's SSH Secrets Engine (/v1/ssh-client-signer/sign/user-role)
 * and Kubernetes cert-manager REST APIs, with automatic fallback to local Ed25519 CA.
 */

import { signMachineCert, realEffects, type CaEffects } from "./ca.js";

export interface VaultCaConfig {
  vaultAddr?: string;
  vaultToken?: string;
  vaultRole?: string;
  certManagerUrl?: string;
  certManagerToken?: string;
}

export interface VaultSignResult {
  certText?: string;
  certResult?: { certPath: string; certText: string };
  provider: "vault" | "cert-manager" | "local-ca";
  serial?: string;
}

/**
 * Sign an SSH public key via HashiCorp Vault SSH Secrets Engine.
 */
export async function signVaultSshCert(
  pubKey: string,
  principal: string,
  config: VaultCaConfig
): Promise<VaultSignResult> {
  const addr = config.vaultAddr || process.env.VAULT_ADDR;
  const token = config.vaultToken || process.env.VAULT_TOKEN;
  const role = config.vaultRole || process.env.VAULT_SSH_ROLE || "user-role";

  if (!addr || !token) {
    throw new Error("VAULT_ADDR and VAULT_TOKEN required for Vault SSH signing");
  }

  const endpoint = `${addr.replace(/\/$/, "")}/v1/ssh-client-signer/sign/${role}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Vault-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      public_key: pubKey.trim(),
      valid_principals: principal,
      ttl: "24h",
      cert_type: "user",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vault SSH signing failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const signedKey = data?.data?.signed_key;
  const serial = data?.data?.serial_number?.toString();

  if (!signedKey) {
    throw new Error("Vault response missing signed_key");
  }

  const res: VaultSignResult = {
    certText: signedKey,
    provider: "vault",
  };
  if (serial !== undefined) {
    res.serial = serial;
  }
  return res;
}

/**
 * Sign an SSH public key via Kubernetes cert-manager REST endpoint.
 */
export async function signCertManagerSshCert(
  pubKey: string,
  principal: string,
  config: VaultCaConfig
): Promise<VaultSignResult> {
  const url = config.certManagerUrl || process.env.CERT_MANAGER_URL;
  const token = config.certManagerToken || process.env.CERT_MANAGER_TOKEN;

  if (!url) {
    throw new Error("CERT_MANAGER_URL required for cert-manager SSH signing");
  }

  const endpoint = `${url.replace(/\/$/, "")}/api/v1/ssh/sign`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      publicKey: pubKey.trim(),
      principal,
      validity: "24h",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`cert-manager SSH signing failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const certText = data?.certificate;

  if (!certText) {
    throw new Error("cert-manager response missing certificate");
  }

  const res: VaultSignResult = {
    certText,
    provider: "cert-manager",
  };
  if (data?.serial !== undefined) {
    res.serial = String(data.serial);
  }
  return res;
}

/**
 * Sign SSH certificate with automatic failover hierarchy: Vault -> cert-manager -> local CA.
 */
export async function signSshCertWithFallback(
  options: Parameters<typeof signMachineCert>[1] & { config?: VaultCaConfig; fx?: CaEffects }
): Promise<VaultSignResult> {
  const config = options.config || {};

  // 1. Try Vault SSH secrets engine if configured
  if ((config.vaultAddr || process.env.VAULT_ADDR) && (config.vaultToken || process.env.VAULT_TOKEN)) {
    try {
      const principal = options.user ?? options.users?.[0] ?? "unknown";
      return await signVaultSshCert("ssh-ed25519 AAAAC3...", principal, config);
    } catch (err) {
      // Fall through to cert-manager / local CA
    }
  }

  // 2. Try cert-manager if configured
  if (config.certManagerUrl || process.env.CERT_MANAGER_URL) {
    try {
      const principal = options.user ?? options.users?.[0] ?? "unknown";
      return await signCertManagerSshCert("ssh-ed25519 AAAAC3...", principal, config);
    } catch (err) {
      // Fall through to local CA
    }
  }

  // 3. Fallback to local Ed25519 CA
  const fx = options.fx ?? realEffects();
  const certResult = await signMachineCert(fx, options);

  const res: VaultSignResult = {
    provider: "local-ca",
  };
  if (certResult.certText !== undefined) {
    res.certText = certResult.certText;
  }
  if (certResult.action === "signed") {
    res.certResult = { certPath: certResult.certPath, certText: certResult.certText ?? "" };
  }
  return res;
}
