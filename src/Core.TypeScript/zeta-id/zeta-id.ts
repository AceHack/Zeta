import type { ZetaObservation, ZetaId, Authority, Momentum } from './types';

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
  version:    { offset: 123n, width: 5n },
  timestamp:  { offset: 75n,  width: 48n },
  chromosome: { offset: 70n,  width: 5n },
  category:   { offset: 65n,  width: 4n },
  firefly:    { offset: 64n,  width: 1n },
  authority:  { offset: 59n,  width: 5n },
  persona:    { offset: 51n,  width: 8n },
  momentum:   { offset: 43n,  width: 8n },
  location:   { offset: 35n,  width: 8n },
  randomness: { offset: 0n,   width: 32n },
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

export function pack(obs: ZetaObservation, env?: SimulationEnvironment): ZetaId {
  let bits = 0n;

  bits = setBits(bits, BIT_MASKS.version.offset,    BIT_MASKS.version.width,    BigInt(obs.version));
  bits = setBits(bits, BIT_MASKS.timestamp.offset,  BIT_MASKS.timestamp.width,  BigInt(obs.timestamp));
  bits = setBits(bits, BIT_MASKS.chromosome.offset, BIT_MASKS.chromosome.width, BigInt(obs.chromosome));
  bits = setBits(bits, BIT_MASKS.category.offset,   BIT_MASKS.category.width,   BigInt(obs.category));
  bits = setBits(bits, BIT_MASKS.firefly.offset,    BIT_MASKS.firefly.width,    BigInt(obs.firefly));
  bits = setBits(bits, BIT_MASKS.persona.offset,    BIT_MASKS.persona.width,    BigInt(obs.persona));
  bits = setBits(bits, BIT_MASKS.location.offset,   BIT_MASKS.location.width,   BigInt(obs.location));

  const authValue = obs.authority.type === 'Raw'
    ? BigInt(obs.authority.value)
    : BigInt(AUTHORITY_VALUES[obs.authority.type] ?? 0);
  bits = setBits(bits, BIT_MASKS.authority.offset, BIT_MASKS.authority.width, authValue);

  const momValue = obs.momentum.type === 'Raw'
    ? BigInt(obs.momentum.value)
    : BigInt(MOMENTUM_VALUES[obs.momentum.type] ?? 0);
  bits = setBits(bits, BIT_MASKS.momentum.offset, BIT_MASKS.momentum.width, momValue);

  const rand = env ? (env.nextInt64() & 0xFFFFFFFFn) : 0n;
  bits = setBits(bits, BIT_MASKS.randomness.offset, BIT_MASKS.randomness.width, rand);

  return bits as ZetaId;
}

export function unpack(id: ZetaId): ZetaObservation {
  const version    = Number(getBits(id, BIT_MASKS.version.offset,    BIT_MASKS.version.width));
  const timestamp  = Number(getBits(id, BIT_MASKS.timestamp.offset,  BIT_MASKS.timestamp.width)) as any;
  const chromosome = Number(getBits(id, BIT_MASKS.chromosome.offset, BIT_MASKS.chromosome.width));
  const category   = Number(getBits(id, BIT_MASKS.category.offset,   BIT_MASKS.category.width));
  const firefly    = Number(getBits(id, BIT_MASKS.firefly.offset,    BIT_MASKS.firefly.width));
  const persona    = Number(getBits(id, BIT_MASKS.persona.offset,    BIT_MASKS.persona.width));
  const location   = Number(getBits(id, BIT_MASKS.location.offset,   BIT_MASKS.location.width));

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
  return entry ? { type: entry[0] as any } : { type: 'Raw', value };
}

function getMomentumFromValue(value: number): Momentum {
  const entry = Object.entries(MOMENTUM_VALUES).find(([, v]) => v === value);
  return entry ? { type: entry[0] as any } : { type: 'Raw', value };
}
