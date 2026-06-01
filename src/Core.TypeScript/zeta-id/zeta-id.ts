import type { ZetaObservation, ZetaId, Authority, Momentum } from "./types";

const AUTHORITY_VALUES: Record<string, number> = {
  Simulated: 3,
  BestEffort: 8,
  Standard: 15,
  TrustedAgent: 20,
  HumanVerified: 31,
};

const MOMENTUM_VALUES: Record<string, number> = {
  Background: 32,
  Normal: 96,
  Elevated: 160,
  High: 224,
  Critical: 248,
};

const BIT_MASKS = {
  version: { offset: 123n, width: 5n },
  timestamp: { offset: 75n, width: 48n },
  chromosome: { offset: 70n, width: 5n },
  category: { offset: 65n, width: 4n },
  firefly: { offset: 64n, width: 1n },
  authority: { offset: 59n, width: 5n },
  persona: { offset: 51n, width: 8n },
  momentum: { offset: 43n, width: 8n },
  location: { offset: 35n, width: 8n },
  randomness: { offset: 0n, width: 32n },
};

function setBits(value: bigint, offset: bigint, width: bigint, fieldValue: bigint): bigint {
  const mask = (1n << width) - 1n;
  return value | ((fieldValue & mask) << offset);
}

function getBits(value: bigint, offset: bigint, width: bigint): bigint {
  const mask = (1n << width) - 1n;
  return (value >> offset) & mask;
}

export interface SimulationEnvironment {
  nextInt64(): bigint;
}

/**
 * Deterministic environment that always returns 0 randomness.
 *
 * EXPLICIT opt-in for the cross-verification harness where deterministic
 * hex is required. NEVER use in production — collapses observations with
 * identical semantic fields to identical IDs (randomness collision risk).
 */
export const DETERMINISTIC_ENV: SimulationEnvironment = {
  nextInt64: () => 0n,
};

/**
 * Default crypto-quality environment using globalThis.crypto.
 *
 * Falls back to a deterministic-time-based scheme only if crypto is
 * unavailable (very rare; e.g. obscure Node builds). The fallback is
 * marked deprecated and logs a warning.
 */
export const DEFAULT_ENV: SimulationEnvironment = {
  nextInt64: () => {
    const g = globalThis as { crypto?: { getRandomValues?: (a: BigUint64Array) => BigUint64Array } };
    if (g.crypto?.getRandomValues) {
      const buf = new BigUint64Array(1);
      g.crypto.getRandomValues(buf);
      return buf[0]!;
    }
    // Fallback (should not be reached in modern runtimes)
    console.warn("ZetaId: no crypto.getRandomValues — falling back to Date.now + Math.random");
    return BigInt(Date.now()) ^ (BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n);
  },
};

/**
 * Pack a ZetaObservation into a 128-bit canonical ZetaId.
 *
 * `env` MUST be provided. Pass `DETERMINISTIC_ENV` only for cross-verification
 * harness use; pass `DEFAULT_ENV` (or your own SimulationEnvironment) in
 * production. The explicit choice prevents the silent-zero-randomness mode
 * where repeated observations with identical semantic fields collapse to
 * identical IDs.
 */
export function pack(obs: ZetaObservation, env: SimulationEnvironment): ZetaId {
  let bits = 0n;

  bits = setBits(bits, BIT_MASKS.version.offset, BIT_MASKS.version.width, BigInt(obs.version));
  bits = setBits(bits, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width, BigInt(obs.timestamp));
  bits = setBits(bits, BIT_MASKS.chromosome.offset, BIT_MASKS.chromosome.width, BigInt(obs.chromosome));
  bits = setBits(bits, BIT_MASKS.category.offset, BIT_MASKS.category.width, BigInt(obs.category));
  bits = setBits(bits, BIT_MASKS.firefly.offset, BIT_MASKS.firefly.width, BigInt(obs.firefly));
  bits = setBits(bits, BIT_MASKS.persona.offset, BIT_MASKS.persona.width, BigInt(obs.persona));
  bits = setBits(bits, BIT_MASKS.location.offset, BIT_MASKS.location.width, BigInt(obs.location));

  let authValue: bigint;
  if (obs.authority.type === "Raw") {
    authValue = BigInt(obs.authority.value);
  } else {
    const mapped = AUTHORITY_VALUES[obs.authority.type];
    if (mapped === undefined) {
      throw new Error(
        `ZetaId.pack: unknown authority tag '${obs.authority.type}' — must be a named case or { type: 'Raw', value }`,
      );
    }
    authValue = BigInt(mapped);
  }
  bits = setBits(bits, BIT_MASKS.authority.offset, BIT_MASKS.authority.width, authValue);

  let momValue: bigint;
  if (obs.momentum.type === "Raw") {
    momValue = BigInt(obs.momentum.value);
  } else {
    const mapped = MOMENTUM_VALUES[obs.momentum.type];
    if (mapped === undefined) {
      throw new Error(
        `ZetaId.pack: unknown momentum tag '${obs.momentum.type}' — must be a named case or { type: 'Raw', value }`,
      );
    }
    momValue = BigInt(mapped);
  }
  bits = setBits(bits, BIT_MASKS.momentum.offset, BIT_MASKS.momentum.width, momValue);

  const rand = env.nextInt64() & 0xffffffffn;
  bits = setBits(bits, BIT_MASKS.randomness.offset, BIT_MASKS.randomness.width, rand);

  return bits as ZetaId;
}

export function unpack(id: ZetaId): ZetaObservation {
  const version = Number(getBits(id, BIT_MASKS.version.offset, BIT_MASKS.version.width));
  const timestamp = Number(getBits(id, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width)) as any;
  const chromosome = Number(getBits(id, BIT_MASKS.chromosome.offset, BIT_MASKS.chromosome.width));
  const category = Number(getBits(id, BIT_MASKS.category.offset, BIT_MASKS.category.width));
  const firefly = Number(getBits(id, BIT_MASKS.firefly.offset, BIT_MASKS.firefly.width));
  const persona = Number(getBits(id, BIT_MASKS.persona.offset, BIT_MASKS.persona.width));
  const location = Number(getBits(id, BIT_MASKS.location.offset, BIT_MASKS.location.width));

  const authValue = Number(getBits(id, BIT_MASKS.authority.offset, BIT_MASKS.authority.width));
  const authority = getAuthorityFromValue(authValue);

  const momValue = Number(getBits(id, BIT_MASKS.momentum.offset, BIT_MASKS.momentum.width));
  const momentum = getMomentumFromValue(momValue);

  return {
    version: version as any,
    timestamp,
    chromosome: chromosome as any,
    category: category as any,
    firefly: firefly as any,
    authority,
    persona: persona as any,
    momentum,
    location: location as any,
  };
}

function getAuthorityFromValue(value: number): Authority {
  const entry = Object.entries(AUTHORITY_VALUES).find(([, v]) => v === value);
  return entry ? { type: entry[0] as any } : { type: "Raw", value };
}

function getMomentumFromValue(value: number): Momentum {
  const entry = Object.entries(MOMENTUM_VALUES).find(([, v]) => v === value);
  return entry ? { type: entry[0] as any } : { type: "Raw", value };
}
