const AUTHORITY_VALUES = {
    Simulated: 3,
    BestEffort: 8,
    Standard: 15,
    TrustedAgent: 20,
    HumanVerified: 31,
};
const MOMENTUM_VALUES = {
    Background: 32,
    Normal: 96,
    Elevated: 160,
    High: 224,
    Critical: 248,
};
import { BIT_MASKS } from "./zeta-id.gen";
function setBits(value, offset, width, fieldValue) {
    const mask = (1n << width) - 1n;
    return value | ((fieldValue & mask) << offset);
}
function getBits(value, offset, width) {
    const mask = (1n << width) - 1n;
    return (value >> offset) & mask;
}
/**
 * Deterministic environment that always returns 0 randomness.
 *
 * EXPLICIT opt-in for the cross-verification harness where deterministic
 * hex is required. NEVER use in production — collapses observations with
 * identical semantic fields to identical IDs (randomness collision risk).
 */
export const DETERMINISTIC_ENV = {
    nextInt64: () => 0n,
};
/**
 * Default crypto-quality environment using globalThis.crypto.
 *
 * Falls back to a deterministic-time-based scheme only if crypto is
 * unavailable (very rare; e.g. obscure Node builds). The fallback is
 * marked deprecated and logs a warning.
 */
export const DEFAULT_ENV = {
    nextInt64: () => {
        const g = globalThis;
        if (g.crypto?.getRandomValues) {
            const buf = new BigUint64Array(1);
            g.crypto.getRandomValues(buf);
            return buf[0];
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
export function pack(obs, env) {
    if (obs.category >= 9) {
        throw new Error("ZetaObservation.category must be < 9 (0..8). Categories >= 9 are reserved for special layouts like ContentAddress.");
    }
    let bits = 0n;
    bits = setBits(bits, BIT_MASKS.version.offset, BIT_MASKS.version.width, BigInt(obs.version));
    bits = setBits(bits, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width, BigInt(obs.timestamp));
    bits = setBits(bits, BIT_MASKS.chromosome.offset, BIT_MASKS.chromosome.width, BigInt(obs.chromosome));
    bits = setBits(bits, BIT_MASKS.category.offset, BIT_MASKS.category.width, BigInt(obs.category));
    bits = setBits(bits, BIT_MASKS.firefly.offset, BIT_MASKS.firefly.width, BigInt(obs.firefly));
    bits = setBits(bits, BIT_MASKS.persona.offset, BIT_MASKS.persona.width, BigInt(obs.persona));
    bits = setBits(bits, BIT_MASKS.location.offset, BIT_MASKS.location.width, BigInt(obs.location));
    let authValue;
    if (obs.authority.type === "Raw") {
        authValue = BigInt(obs.authority.value);
    }
    else {
        const mapped = AUTHORITY_VALUES[obs.authority.type];
        if (mapped === undefined) {
            throw new Error(`ZetaId.pack: unknown authority tag '${obs.authority.type}' — must be a named case or { type: 'Raw', value }`);
        }
        authValue = BigInt(mapped);
    }
    bits = setBits(bits, BIT_MASKS.authority.offset, BIT_MASKS.authority.width, authValue);
    let momValue;
    if (obs.momentum.type === "Raw") {
        momValue = BigInt(obs.momentum.value);
    }
    else {
        const mapped = MOMENTUM_VALUES[obs.momentum.type];
        if (mapped === undefined) {
            throw new Error(`ZetaId.pack: unknown momentum tag '${obs.momentum.type}' — must be a named case or { type: 'Raw', value }`);
        }
        momValue = BigInt(mapped);
    }
    bits = setBits(bits, BIT_MASKS.momentum.offset, BIT_MASKS.momentum.width, momValue);
    const rand = env.nextInt64() & 0xffffffffn;
    bits = setBits(bits, BIT_MASKS.randomness.offset, BIT_MASKS.randomness.width, rand);
    return bits;
}
export function unpack(id) {
    const version = Number(getBits(id, BIT_MASKS.version.offset, BIT_MASKS.version.width));
    const timestamp = Number(getBits(id, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width));
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
        version: version,
        timestamp,
        chromosome: chromosome,
        category: category,
        firefly: firefly,
        authority,
        persona: persona,
        momentum,
        location: location,
    };
}
function getAuthorityFromValue(value) {
    const entry = Object.entries(AUTHORITY_VALUES).find(([, v]) => v === value);
    return entry ? { type: entry[0] } : { type: "Raw", value };
}
function getMomentumFromValue(value) {
    const entry = Object.entries(MOMENTUM_VALUES).find(([, v]) => v === value);
    return entry ? { type: entry[0] } : { type: "Raw", value };
}
export function packGeneric(version, category, payload) {
    let bits = 0n;
    bits = setBits(bits, BIT_MASKS.version.offset, BIT_MASKS.version.width, BigInt(version));
    bits = setBits(bits, BIT_MASKS.category.offset, BIT_MASKS.category.width, BigInt(category));
    // lower 65 bits of payload to bits 0..64
    const lowMask = (1n << 65n) - 1n;
    bits |= payload & lowMask;
    // upper 54 bits of payload (65..118) mapped to bits 69..122
    const highPart = (payload >> 65n) & ((1n << 54n) - 1n);
    bits |= highPart << 69n;
    return bits;
}
export function unpackGeneric(id) {
    const version = Number(getBits(id, BIT_MASKS.version.offset, BIT_MASKS.version.width));
    const category = Number(getBits(id, BIT_MASKS.category.offset, BIT_MASKS.category.width));
    const lowMask = (1n << 65n) - 1n;
    const lowPart = BigInt(id) & lowMask;
    const highPart = (BigInt(id) >> 69n) & ((1n << 54n) - 1n);
    const payload = lowPart | (highPart << 65n);
    return { version, category, payload };
}
export function packPayload(payload, env) {
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
            const _exhaustive = payload;
            throw new Error(`Unknown payload type: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
export function unpackPayload(id) {
    const { version, category, payload } = unpackGeneric(id);
    if (category < 9) {
        return { type: "Observation", value: unpack(id) };
    }
    else if (category === 9) {
        return { type: "ContentAddress", version, payload };
    }
    else {
        return { type: "Generic", version, category, payload };
    }
}
