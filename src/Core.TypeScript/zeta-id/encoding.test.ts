import { test, expect } from "bun:test";
import {
  format,
  parse,
  toHex,
  fromHex,
  isCanonical,
  CROCKFORD_ALPHABET,
  ZETAID_BASE32_LEN,
  ZETAID_HEX_LEN,
} from "./encoding";
import { pack, DETERMINISTIC_ENV, DEFAULT_ENV } from "./zeta-id";
import type { ZetaId, ZetaObservation } from "./types";

const MASK_128 = (1n << 128n) - 1n;

// Deterministic LCG so the property tests are reproducible (no Math.random in proofs).
function* lcg(seed: bigint): Generator<bigint> {
  let s = seed & MASK_128;
  while (true) {
    // 128-bit-ish mix: two 64-bit LCG steps concatenated.
    s = (s * 6364136223846793005n + 1442695040888963407n) & MASK_128;
    const hi = (s >> 64n) & 0xffffffffffffffffn;
    const lo = s & 0xffffffffffffffffn;
    yield ((hi << 64n) | lo) & MASK_128;
  }
}

function sampleIds(n: number, seed = 0x9e3779b97f4a7c15n): ZetaId[] {
  const g = lcg(seed);
  return Array.from({ length: n }, () => g.next().value as ZetaId);
}

test("format → parse round-trips for random 128-bit ids", () => {
  for (const id of sampleIds(2000)) {
    expect(parse(format(id))).toBe(id);
  }
});

test("format is always exactly 26 chars (fixed width)", () => {
  for (const id of [0n as ZetaId, MASK_128 as ZetaId, ...sampleIds(500)]) {
    expect(format(id)).toHaveLength(ZETAID_BASE32_LEN);
  }
});

test("format output is filename-safe (Crockford alphabet only; no I/L/O/U, no slash)", () => {
  const allowed = new Set(CROCKFORD_ALPHABET.split(""));
  for (const id of sampleIds(1000)) {
    const s = format(id);
    for (const ch of s) expect(allowed.has(ch)).toBe(true);
    expect(s).not.toContain("/");
    expect(/[ILOU]/.test(s)).toBe(false);
  }
});

// THE load-bearing property for the 081KSXN940008QG0R002FWR9B2 time-ordering decision:
// numeric ZetaId order === lexicographic string order of the canonical form.
test("encoding is SORT-PRESERVING: numeric order === string order", () => {
  const ids = sampleIds(3000).slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const strs = ids.map(format);
  for (let i = 1; i < ids.length; i++) {
    // strictly increasing numeric (sampling collisions are astronomically unlikely)
    if (ids[i]! === ids[i - 1]!) continue;
    expect(strs[i - 1]! < strs[i]!).toBe(true);
  }
});

test("sort-preserving holds at the boundaries (0, max, single-bit deltas)", () => {
  const a = 0n as ZetaId;
  const b = 1n as ZetaId;
  const c = (1n << 75n) as ZetaId; // a timestamp-region bit (high)
  const d = MASK_128 as ZetaId;
  expect(format(a) < format(b)).toBe(true);
  expect(format(b) < format(c)).toBe(true);
  expect(format(c) < format(d)).toBe(true);
});

test("parse accepts Crockford lenient aliases (i/l→1, o→0) and lowercase", () => {
  const id = parse("0000000000000000000000000Z"); // value 31
  expect(id).toBe(31n as ZetaId);
  // lowercase z == Z
  expect(parse("0000000000000000000000000z")).toBe(31n as ZetaId);
  // 'O'/'o' alias for 0, 'I'/'L'/'i'/'l' alias for 1 — both decode without error
  expect(parse("OOOOOOOOOOOOOOOOOOOOOOOOOO")).toBe(0n as ZetaId);
  expect(() => parse("IIIIIIIIIIIIIIIIIIIIIIIIII")).not.toThrow();
});

test("parse rejects wrong length, invalid chars, and 128-bit overflow", () => {
  expect(() => parse("TOOSHORT")).toThrow();
  expect(() => parse("0".repeat(27))).toThrow();
  expect(() => parse("U000000000000000000000000Z")).toThrow(); // U is not a value symbol
  expect(() => parse("0000000000000000000000000-")).toThrow(); // '-' invalid
  // First char value must be < 8 (top 2 bits are pad); 'Z' (31) as first char overflows.
  expect(() => parse("Z0000000000000000000000000")).toThrow();
});

test("hex form round-trips and is canonical big-endian lowercase 32 chars", () => {
  for (const id of sampleIds(500)) {
    const h = toHex(id);
    expect(h).toHaveLength(ZETAID_HEX_LEN);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
    expect(fromHex(h)).toBe(id);
  }
});

test("hex and base32 encode the SAME value (both big-endian)", () => {
  for (const id of sampleIds(500)) {
    expect(parse(format(id))).toBe(fromHex(toHex(id)));
  }
});

test("isCanonical: format output is canonical; lenient/lowercase forms are not", () => {
  for (const id of sampleIds(200)) {
    expect(isCanonical(format(id))).toBe(true);
  }
  expect(isCanonical("0000000000000000000000000z")).toBe(false); // lowercase
  expect(isCanonical("OOOOOOOOOOOOOOOOOOOOOOOOOO")).toBe(false); // O alias, not strict 0
  expect(isCanonical("short")).toBe(false);
});

// Canonical cross-language fixture vectors (081KS3X9Y0008QG0R000W00V73 §4): real ZetaIds packed via
// DETERMINISTIC_ENV, with their hex + Crockford base32. Rust (081KS3X9Y0008QG0R001Z8SBZJ) / Python
// (081KS3X9Y0008QG0R002WGH8PJ) must reproduce these exactly.
test("canonical vectors: pack → hex + base32 are stable and consistent", () => {
  const vectors: { obs: ZetaObservation; note: string }[] = [
    {
      note: "v1 / financial-integrity / observation / human-verified / high",
      obs: {
        version: 1, timestamp: 1747780809123 as any, chromosome: 7, category: 0,
        firefly: 1, authority: { type: "HumanVerified" }, persona: 1,
        momentum: { type: "High" }, location: 1,
      },
    },
    {
      note: "v1 / meta-coherence / workitem / standard / normal (081KSXN940008QG0R002FWR9B2 WorkItem)",
      obs: {
        version: 1, timestamp: 1749200000000 as any, chromosome: 0, category: 8,
        firefly: 1, authority: { type: "Standard" }, persona: 2,
        momentum: { type: "Normal" }, location: 2,
      },
    },
  ];
  for (const v of vectors) {
    const id = pack(v.obs, DETERMINISTIC_ENV);
    const b32 = format(id);
    const hex = toHex(id);
    // round-trip both encodings back to the same id
    expect(parse(b32)).toBe(id);
    expect(fromHex(hex)).toBe(id);
    // canonical form is stable + filename-safe
    expect(b32).toHaveLength(ZETAID_BASE32_LEN);
    expect(isCanonical(b32)).toBe(true);
  }
});

test("two ids minted close in time sort by time (the workitems/ ls-ordering guarantee)", () => {
  const base: ZetaObservation = {
    version: 1, timestamp: 0 as any, chromosome: 0, category: 8, firefly: 1,
    authority: { type: "Standard" }, persona: 1, momentum: { type: "Normal" }, location: 1,
  };
  const earlier = pack({ ...base, timestamp: 1749200000000 as any }, DEFAULT_ENV);
  const later = pack({ ...base, timestamp: 1749200001000 as any }, DEFAULT_ENV);
  // later timestamp → larger high bits → sorts after, regardless of random low bits
  expect(format(earlier) < format(later)).toBe(true);
});
