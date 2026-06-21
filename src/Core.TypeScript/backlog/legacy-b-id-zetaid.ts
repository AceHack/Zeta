/**
 * Deterministic ZetaId for a legacy B-NNNN row (081KSXN940008QG0R002FWR9B2 backfill algorithm).
 * Stable per B-id — used only for alias-map entries when no living backlog row exists.
 */
import { pack, type SimulationEnvironment } from "../zeta-id/zeta-id";
import { format } from "../zeta-id/encoding";
import { Category, Chromosome, Firefly, type ZetaObservation } from "../zeta-id/types";

const M64 = 0xffffffffffffffffn;
const FALLBACK_BASE = Date.UTC(2026, 0, 1);

function mix64(x: bigint): bigint {
  let z = x & M64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M64;
  return z ^ (z >> 31n);
}

function detRand(s: string): bigint {
  let z = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    z = (z ^ BigInt(s.charCodeAt(i))) & M64;
    z = (z * 0x100000001b3n) & M64;
  }
  return mix64(z);
}

export function timestampForLegacyBId(bId: string, created: string | null): number {
  if (created) {
    const t = Date.parse(created);
    if (!Number.isNaN(t)) return t;
  }
  const num = Number((bId.match(/^B-(\d+)/) ?? [])[1] ?? 0);
  return FALLBACK_BASE + num * 60_000;
}

/** Canonical Crockford-base32 ZetaId derived from a legacy B-NNNN (including sub-items). */
export function legacyZetaIdFromBId(bId: string, createdMs: number): string {
  const env: SimulationEnvironment = { nextInt64: () => detRand(bId) };
  const obs: ZetaObservation = {
    version: 1,
    timestamp: createdMs as ZetaObservation["timestamp"],
    chromosome: Chromosome.MetaCoherence,
    category: Category.WorkItem,
    firefly: Firefly.NoDirective,
    authority: { type: "Standard" },
    persona: 0 as ZetaObservation["persona"],
    momentum: { type: "Normal" },
    location: 0 as ZetaObservation["location"],
  };
  return format(pack(obs, env));
}

export function parentBId(bId: string): string | null {
  const m = bId.match(/^(B-\d{4})(?:\.\d+)+$/);
  return m ? m[1]! : null;
}
