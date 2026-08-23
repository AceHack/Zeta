/**
 * game-priors.ts — learned society state, keyed by cart, committed in source.
 *
 * "Not always starting from 0 on every game": a deterministic headless
 * training run (train-priors.ts) plays a cart for N ticks and snapshots the
 * BNN society's EP posteriors + how much exploration was already performed.
 * The snapshot is committed under `priors/` as JSON — text, diffable,
 * reviewable (no binary in the proof lineage) — and the worker restores it at
 * boot for the matching cart, so the stream opens already knowing which keys
 * move it and roughly where the adversary lives.
 *
 * Keying: the cart's FNV-1a fingerprint (the same "spectral fingerprint" the
 * worker already logs on upload). Switching carts stays inside the soft
 * regime: a known fingerprint restores its priors; an unknown one starts from
 * the fresh prior — but the perception layers (objects/OCR/roles) are
 * structural, not learned, so they transfer to ANY cart for free. That split —
 * learned per-cart posteriors vs structural cross-cart layers — is the
 * continual-learning story this demo exists to show.
 *
 * Because training is fully deterministic (COMMON_SEED end to end), a priors
 * file is REPRODUCIBLE: re-running the trainer at the same ticks yields the
 * identical JSON, so a reviewer can verify a committed prior byte-for-byte.
 */

import type { SocietySnapshot } from "../bayesian/bnn-key-predictor";

/** FNV-1a over the ROM bytes — the cart's identity for priors lookup. */
export function romFingerprint(rom: Uint8Array): string {
  let hash = 2166136261;
  for (let i = 0; i < rom.length; i++) {
    hash ^= rom[i]!;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface GamePriorsFile {
  readonly schema: "zeta.chip8.game-priors.v1";
  /** Fingerprint of the cart these priors were trained on. */
  readonly fingerprint: string;
  /** Human name of the cart (informational only; the fingerprint decides). */
  readonly cart: string;
  /** Deterministic training provenance: ticks trained and the seed used. */
  readonly trainedTicks: number;
  readonly seed: number;
  readonly snapshot: SocietySnapshot;
}

/** A priors registry: fingerprint → priors. Built from imported JSON files. */
export type PriorsRegistry = ReadonlyMap<string, GamePriorsFile>;

export function buildPriorsRegistry(files: readonly GamePriorsFile[]): PriorsRegistry {
  const map = new Map<string, GamePriorsFile>();
  for (const f of files) {
    if (f.schema !== "zeta.chip8.game-priors.v1") continue;
    map.set(f.fingerprint, f);
  }
  return map;
}

/** Look up priors for a ROM; null = unknown cart, start from the fresh prior. */
export function priorsForRom(registry: PriorsRegistry, rom: Uint8Array): GamePriorsFile | null {
  return registry.get(romFingerprint(rom)) ?? null;
}
