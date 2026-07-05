// Pluggable FROST share storage — software file (today) | HSM/TPM seal (stub).
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// Layer 1 of agent-native-key-custody: use-without-extract when HSM adapter lands.
// Slice 1: software adapter wraps existing ~/.config/zeta frost share files;
// HSM adapter is an honest stub (throws) until platform bindings exist.

import type { FrostCaCustodyEffects, FrostShareFileV1 } from "./frost-ca-custody.ts";
import { FROST_SHARE_SCHEMA, frostSharePath } from "./frost-ca-custody.ts";
import type { FrostKeyShare } from "./frost.ts";

export interface FrostShareRecord {
  readonly x: number;
  readonly secretShare: bigint;
  readonly threshold: number;
  readonly totalShares: number;
  readonly groupPublicKeyHex: string;
}

/** Read/write a participant's FROST share without exposing adapter details to custody logic. */
export interface FrostShareAdapter {
  readonly kind: "software-file" | "hsm-stub";
  loadShare(x: number): FrostShareRecord | null;
  storeShare(record: FrostShareRecord, ca: string): void;
}

export function createSoftwareFileShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
): FrostShareAdapter {
  return {
    kind: "software-file",
    loadShare(x: number): FrostShareRecord | null {
      const p = frostSharePath(sharesDir, x);
      if (!fx.exists(p)) return null;
      const body = JSON.parse(fx.readText(p)) as FrostShareFileV1;
      if (body.schema !== FROST_SHARE_SCHEMA || body.ca !== ca) return null;
      return {
        x: body.x,
        secretShare: BigInt(body.secretShare),
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
      };
    },
    storeShare(record: FrostShareRecord, caName: string): void {
      const body: FrostShareFileV1 = {
        schema: FROST_SHARE_SCHEMA,
        ca: caName,
        threshold: record.threshold,
        totalShares: record.totalShares,
        groupPublicKeyHex: record.groupPublicKeyHex,
        x: record.x,
        secretShare: record.secretShare.toString(10),
      };
      fx.writeText(frostSharePath(sharesDir, record.x), JSON.stringify(body, null, 2) + "\n", 0o600);
    },
  };
}

/** Honest stub — documents the HSM seam; does not pretend hardware exists. */
export function createHsmShareAdapterStub(): FrostShareAdapter {
  const err = (): never => {
    throw new Error(
      "frost-share-adapter: HSM/TPM seal not implemented — use software-file adapter or land 081KWPHRNFW HSM slice",
    );
  };
  return {
    kind: "hsm-stub",
    loadShare: err,
    storeShare: err,
  };
}

/** Load all local shares for threshold signing (software adapter). */
export function loadFrostKeyShares(
  adapter: FrostShareAdapter,
  totalShares: number,
): FrostKeyShare[] {
  const out: FrostKeyShare[] = [];
  for (let x = 1; x <= totalShares; x++) {
    const rec = adapter.loadShare(x);
    if (rec) out.push({ x: rec.x, secretShare: rec.secretShare });
  }
  return out;
}
