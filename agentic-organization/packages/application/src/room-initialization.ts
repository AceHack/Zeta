/**
 * Room initialization — port of `full-ai-cluster/PROVISIONING.md`
 * "6 values per box" cookie-cutter provisioning (Merge1 §09).
 *
 * Each room is initialized with 6 configuration values, split by content class
 * (mirroring §08 `RestoredCredential.contentClass`):
 *   1. Node hostname               — public_identifier
 *   2. Operator SSH pubkey         — public_identifier
 *   3. zeta user password (hash)   — secret_material
 *   4. WiFi credentials            — secret_material
 *   5. Cluster join token          — secret_material
 *   6. Agent vendor API keys       — secret_material
 *
 * Secret material is injected via the credential proxy (§08) and never visible
 * to the agent. This module provides the config shape + pure, testable
 * classification / validation; the full `initializeRoom` (restore credentials →
 * create SPIFFE identity → real room → self-register) is deferred to the §04/§08
 * integration layer (transport + credential bootstrap + createRealRoom), matching
 * the new-modules-first precedent of the prior sections.
 */

export interface RoomInitializationConfig {
  readonly hostname: string;
  readonly operatorSshPubkey: string;
  // Secret material — injected via the credential proxy, never visible to the agent.
  readonly zetaUserPasswordHash: string;
  readonly wifiCredentials?: { readonly ssid: string; readonly psk: string };
  readonly clusterJoinToken?: string;
  readonly vendorApiKeys?: Readonly<Record<string, string>>;
}

export type ProvisioningValueClass = "public_identifier" | "secret_material";

export type ClassifiedProvisioningValue = {
  readonly field: string;
  readonly contentClass: ProvisioningValueClass;
  readonly present: boolean;
};

/**
 * Classify the 6 provisioning values into public vs secret (pure). Used to drive
 * which values go to the credential proxy (secret) vs which may be logged /
 * exposed to the agent (public).
 */
export function classifyProvisioningValues(config: RoomInitializationConfig): readonly ClassifiedProvisioningValue[] {
  return [
    { field: "hostname", contentClass: "public_identifier", present: config.hostname !== "" },
    { field: "operatorSshPubkey", contentClass: "public_identifier", present: config.operatorSshPubkey !== "" },
    { field: "zetaUserPasswordHash", contentClass: "secret_material", present: config.zetaUserPasswordHash !== "" },
    { field: "wifiCredentials", contentClass: "secret_material", present: config.wifiCredentials !== undefined },
    { field: "clusterJoinToken", contentClass: "secret_material", present: config.clusterJoinToken !== undefined },
    { field: "vendorApiKeys", contentClass: "secret_material", present: config.vendorApiKeys !== undefined },
  ];
}

export type InitializationError =
  | { readonly kind: "missing_hostname" }
  | { readonly kind: "missing_operator_pubkey" }
  | { readonly kind: "missing_password_hash" };

export type ValidateInitializationResult =
  | { readonly outcome: "ok"; readonly value: RoomInitializationConfig }
  | { readonly outcome: "feedback"; readonly error: InitializationError };

/**
 * Validate the minimum required provisioning values (the 3 always-required
 * fields). Result-shaped (MP-7), never thrown.
 */
export function validateRoomInitializationConfig(config: RoomInitializationConfig): ValidateInitializationResult {
  if (config.hostname === "") {
    return { outcome: "feedback", error: { kind: "missing_hostname" } };
  }
  if (config.operatorSshPubkey === "") {
    return { outcome: "feedback", error: { kind: "missing_operator_pubkey" } };
  }
  if (config.zetaUserPasswordHash === "") {
    return { outcome: "feedback", error: { kind: "missing_password_hash" } };
  }
  return { outcome: "ok", value: config };
}
