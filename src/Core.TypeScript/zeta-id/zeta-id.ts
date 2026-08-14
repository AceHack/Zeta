import type { ZetaObservation, ZetaId, Authority, Momentum, Category, IdVersion, ZetaIdPayload } from "./types";

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

import { BIT_MASKS } from "./zeta-id.gen";
import type { Bits } from "./zeta-id.gen";


function setBits(value: bigint, offset: Bits, width: Bits, fieldValue: bigint): bigint {
  const mask = (1n << width) - 1n;
  return value | ((fieldValue & mask) << offset);
}

function getBits(value: bigint, offset: Bits, width: Bits): bigint {
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
  if (obs.category >= 9) {
    throw new Error("ZetaObservation.category must be < 9 (0..8). Categories >= 9 are reserved for special layouts like ContentAddress.");
  }

  let bits = 0n;

  bits = setBits(bits, BIT_MASKS.version.offset, BIT_MASKS.version.width, BigInt(obs.version));
  bits = setBits(bits, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width, BigInt(obs.timestamp));
  bits = setBits(bits, BIT_MASKS.chromosome.offset, BIT_MASKS.chromosome.width, BigInt(obs.chromosome));
  bits = setBits(bits, BIT_MASKS.category.offset, BIT_MASKS.category.width, BigInt(obs.category));
  // bit 64 is RESERVED (formerly Firefly, reclaimed NO-SHIFT 2026-08-11) — never written, stays zero
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
  // bit 64 is RESERVED (formerly Firefly) — ignored on read
  const persona =Number(getBits(id, BIT_MASKS.persona.offset, BIT_MASKS.persona.width));
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

/** The Generic layout carries 119 payload bits: id bits 0..64 plus id bits 69..122. */
export const MAX_GENERIC_PAYLOAD: bigint = (1n << 119n) - 1n;

/**
 * Pack a Generic-layout ZetaId (categories >= 9).
 *
 * BOUNDED SINCE 2026-08-14 — this used to SILENTLY TRUNCATE. The masks below keep
 * payload bits 0..64 and 65..118 and threw the rest away without a word, so an
 * oversized payload did not fail, it ALIASED. The concrete, dated failure that
 * motivated the bound, reproduced as a test in `sort-key.test.ts`:
 *
 *   `inventory/new-item.ts` builds `(BigInt(Date.now()) << 78n) | random78`. That is
 *   exactly 119 bits while `Date.now()` fits in 41 — i.e. ZERO headroom. At
 *   **2039-09-07T15:47:35.552Z** `Date.now()` reaches 2^41, the payload becomes 120
 *   bits, the top ms bit is masked off, and `packGeneric(ms = 2^41)` returns an id
 *   **byte-identical to `packGeneric(ms = 0)`** — a wrap to 1970 and a real
 *   collision with any zero-ms id, silently, forever.
 *
 * `packPayload` already enforced this cap before delegating here, so callers that
 * route through it are unaffected; the hole was direct callers. Negative payloads
 * are rejected for the same reason: BigInt masking makes `-1n` indistinguishable
 * from all-ones.
 */
export function packGeneric(version: number, category: number, payload: bigint): ZetaId {
  if (payload < 0n || payload > MAX_GENERIC_PAYLOAD) {
    throw new Error(
      `ZetaId.packGeneric: payload must be 0..2^119-1 (the Generic layout's capacity), got a ` +
        `${payload < 0n ? "negative value" : `${payload.toString(2).length}-bit value`}. ` +
        `Out-of-range payloads used to be silently truncated, which ALIASES distinct inputs to ` +
        `the same id rather than failing.`,
    );
  }
  let bits = 0n;
  bits = setBits(bits, BIT_MASKS.version.offset, BIT_MASKS.version.width, BigInt(version));
  bits = setBits(bits, BIT_MASKS.category.offset, BIT_MASKS.category.width, BigInt(category));

  // lower 65 bits of payload to bits 0..64
  const lowMask = (1n << 65n) - 1n;
  bits |= payload & lowMask;

  // upper 54 bits of payload (65..118) mapped to bits 69..122
  const highPart = (payload >> 65n) & ((1n << 54n) - 1n);
  bits |= highPart << 69n;

  return bits as ZetaId;
}

export function unpackGeneric(id: ZetaId): { version: IdVersion; category: Category; payload: bigint } {
  const version = Number(getBits(id, BIT_MASKS.version.offset, BIT_MASKS.version.width)) as IdVersion;
  const category = Number(getBits(id, BIT_MASKS.category.offset, BIT_MASKS.category.width)) as Category;

  const lowMask = (1n << 65n) - 1n;
  const lowPart = BigInt(id) & lowMask;

  const highPart = (BigInt(id) >> 69n) & ((1n << 54n) - 1n);
  const payload = lowPart | (highPart << 65n);

  return { version, category, payload };
}

export function packPayload(payload: ZetaIdPayload, env: SimulationEnvironment): ZetaId {
  switch (payload.type) {
    case "Observation":
      return pack(payload.value, env);
    case "ContentAddress": {
      const maxPayload = (1n << 119n) - 1n;
      if (payload.payload > maxPayload) {
        throw new Error("ContentAddress payload exceeds 119 bits.");
      }
      return packGeneric(payload.version, 9, payload.payload);
    }
    case "Generic": {
      if (payload.category < 9 || payload.category === 9) {
        throw new Error(`Generic payload category must be >= 10 (got ${payload.category}). Categories 0..8 are reserved for observations, and 9 is reserved for ContentAddress.`);
      }
      const maxPayload = (1n << 119n) - 1n;
      if (payload.payload > maxPayload) {
        throw new Error("Generic payload exceeds 119 bits.");
      }
      return packGeneric(payload.version, payload.category, payload.payload);
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown payload type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function unpackPayload(id: ZetaId): ZetaIdPayload {
  const { version, category, payload } = unpackGeneric(id);
  if (category < 9) {
    return { type: "Observation", value: unpack(id) };
  } else if (category === 9) {
    return { type: "ContentAddress", version, payload };
  } else {
    return { type: "Generic", version, category, payload };
  }
}
