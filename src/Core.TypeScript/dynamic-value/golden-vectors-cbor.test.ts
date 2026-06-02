import { test, expect } from "bun:test";
import vectors from "./golden-vectors-cbor.json";

// DynamicValue canonical-CBOR byte-lock — the TS oracle agrees on the shared seed
// (golden-vectors-cbor.json). CBOR is the TOTAL form (all 8 shapes), so this is where
// Float (RFC 8949 §4.2.2 shortest-float) and Bytes (major-type-2) lock — the two cases
// canonical JSON deferred. The seed was generated + RFC-8949-Appendix-A-anchored
// independently; `cbor float matches RFC 8949 Appendix A` re-anchors the float logic
// against the RFC directly so the lock is not circular. "The compilers don't lie."
//
// Object map keys stay in INSERTION order (NOT §4.2.1 bytewise-sorted) — Object is
// order-significant, same call v1 made for canonical JSON. value.v for float is the
// IEEE-754 f64 bit pattern (16 hex, big-endian); for int a decimal string; for bytes
// a hex string.

type Tagged =
  | { t: "null" }
  | { t: "bool"; v: boolean }
  | { t: "int"; v: string }
  | { t: "float"; v: string }
  | { t: "str"; v: string }
  | { t: "bytes"; v: string }
  | { t: "arr"; v: Tagged[] }
  | { t: "obj"; v: [string, Tagged][] };

interface Vector {
  name: string;
  value: Tagged;
  cbor: string;
  note?: string;
}

// --- bit helpers (DataView is the only portable way to get IEEE bit patterns in JS) ---

function f32Bits(v: number): number {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, v, false);
  return dv.getUint32(0, false);
}

function f64Bits(v: number): bigint {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, v, false);
  return dv.getBigUint64(0, false);
}

function f64FromBitsHex(hex: string): number {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setBigUint64(0, BigInt("0x" + hex), false);
  return dv.getFloat64(0, false);
}

// --- hand-rolled float16 (no native f16 in JS), mirroring the Rust oracle ---

// Right shift with round-to-nearest-even.
function roundShift(value: number, shift: number): number {
  if (shift === 0) return value;
  const result = value >>> shift;
  const roundBit = 1 << (shift - 1);
  const rem = value & ((1 << shift) - 1);
  if (rem > roundBit || (rem === roundBit && (result & 1) === 1)) return result + 1;
  return result;
}

// f32 -> float16 bits, round-to-nearest-even. Only the exact path (no rounding) affects
// canonical output, since non-exact results are rejected by the round-trip gate.
function f32ToF16Round(value: number): number {
  const x = f32Bits(value);
  const sign = (x >>> 16) & 0x8000;
  const expField = (x >>> 23) & 0xff;
  const mant = x & 0x007fffff;
  if (expField === 0xff) {
    return mant !== 0 ? sign | 0x7e00 : sign | 0x7c00;
  }
  const exp = expField - 127 + 15;
  if (exp >= 0x1f) return sign | 0x7c00;
  if (exp <= 0) {
    if (exp < -10) return sign;
    const m = mant | 0x00800000;
    return sign | roundShift(m, 14 - exp);
  }
  const m10 = roundShift(mant, 13);
  if (m10 === 0x400) {
    const e = exp + 1;
    if (e >= 0x1f) return sign | 0x7c00;
    return sign | (e << 10);
  }
  return sign | (exp << 10) | m10;
}

// float16 bits -> f32 bits (exact; every float16 value is exactly representable in f32).
function f16ToF32Bits(bits: number): number {
  const sign = (bits & 0x8000) !== 0 ? -1 : 1;
  const exp = (bits >>> 10) & 0x1f;
  const mant = bits & 0x3ff;
  let val: number;
  if (exp === 0) val = mant * Math.pow(2, -24);
  else if (exp === 0x1f) val = mant === 0 ? Infinity : NaN;
  else val = (1 + mant / 1024) * Math.pow(2, exp - 15);
  return f32Bits(sign * val);
}

// bits iff `value` is EXACTLY representable in float16 (round-trip is bit-identical,
// including sign of zero); null otherwise. The exact gate means a rounding imperfection
// can never emit a non-canonical f16 — non-exact values fall through to float32.
function f16BitsIfExact(value: number): number | null {
  const bits = f32ToF16Round(value);
  return f16ToF32Bits(bits) === f32Bits(value) ? bits : null;
}

// --- CBOR encode ---

function pushBE(out: number[], arg: bigint, bytes: number): void {
  for (let i = bytes - 1; i >= 0; i--) out.push(Number((arg >> BigInt(i * 8)) & 0xffn));
}

// CBOR initial byte (major type in top 3 bits) + preferred/shortest argument (RFC 8949
// §3, §4.2.1). `arg` is a bigint to carry i64 ints (and small lengths) without overflow.
function cborHead(out: number[], major: number, arg: bigint): void {
  const mt = major << 5;
  if (arg <= 23n) out.push(mt | Number(arg));
  else if (arg <= 0xffn) {
    out.push(mt | 24);
    pushBE(out, arg, 1);
  } else if (arg <= 0xffffn) {
    out.push(mt | 25);
    pushBE(out, arg, 2);
  } else if (arg <= 0xffffffffn) {
    out.push(mt | 26);
    pushBE(out, arg, 4);
  } else {
    out.push(mt | 27);
    pushBE(out, arg, 8);
  }
}

// major 0 for >= 0; major 1 for < 0 (encodes -1 - n).
function cborInt(out: number[], v: bigint): void {
  if (v >= 0n) cborHead(out, 0, v);
  else cborHead(out, 1, -1n - v);
}

// RFC 8949 §4.2.2 shortest float: NaN -> 0xf97e00; else the shortest of
// float16 / float32 / float64 that decodes back to the exact same value. `Math.fround(v)
// === v` tests float32-exactness and rejects a float32 overflow-to-Inf (e.g. 1e300).
function cborFloat(out: number[], v: number): void {
  if (Number.isNaN(v)) {
    out.push(0xf9, 0x7e, 0x00);
    return;
  }
  const f32 = Math.fround(v);
  if (f32 === v) {
    const bits16 = f16BitsIfExact(f32);
    if (bits16 !== null) {
      out.push(0xf9, (bits16 >>> 8) & 0xff, bits16 & 0xff);
      return;
    }
    out.push(0xfa);
    pushBE(out, BigInt(f32Bits(f32)), 4);
    return;
  }
  out.push(0xfb);
  pushBE(out, f64Bits(v), 8);
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function writeCbor(out: number[], n: Tagged): void {
  switch (n.t) {
    case "null":
      out.push(0xf6);
      break;
    case "bool":
      out.push(n.v ? 0xf5 : 0xf4);
      break;
    case "int":
      cborInt(out, BigInt(n.v));
      break;
    case "float":
      cborFloat(out, f64FromBitsHex(n.v));
      break;
    case "str": {
      const b = utf8(n.v);
      cborHead(out, 3, BigInt(b.length));
      for (const x of b) out.push(x);
      break;
    }
    case "bytes": {
      const hex = n.v;
      const len = hex.length / 2;
      cborHead(out, 2, BigInt(len));
      for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
      break;
    }
    case "arr":
      cborHead(out, 4, BigInt(n.v.length));
      for (const it of n.v) writeCbor(out, it);
      break;
    case "obj":
      cborHead(out, 5, BigInt(n.v.length));
      for (const [k, val] of n.v) {
        const kb = utf8(k);
        cborHead(out, 3, BigInt(kb.length));
        for (const x of kb) out.push(x);
        writeCbor(out, val);
      }
      break;
  }
}

function canonicalCbor(n: Tagged): number[] {
  const out: number[] = [];
  writeCbor(out, n);
  return out;
}

const toHex = (bytes: number[]): string => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

const floatHex = (x: number): string => {
  const out: number[] = [];
  cborFloat(out, x);
  return toHex(out);
};

const seed = vectors as unknown as { primitive: string; format: string; vectors: Vector[] };

test("seed identifies as DynamicValue canonical-cbor", () => {
  expect(seed.primitive).toBe("DynamicValue");
  expect(seed.format).toBe("canonical-cbor");
  expect(seed.vectors.length).toBeGreaterThan(0);
});

for (const v of seed.vectors) {
  test(`cbor byte-lock: ${v.name}`, () => {
    expect(toHex(canonicalCbor(v.value))).toBe(v.cbor);
  });
}

// Independent RFC 8949 Appendix A anchor (anti-circularity): these canonical bytes come
// straight from the RFC, not from our encoder or the seed.
test("cbor float matches RFC 8949 Appendix A", () => {
  expect(floatHex(0.0)).toBe("f90000");
  expect(floatHex(1.0)).toBe("f93c00");
  expect(floatHex(1.5)).toBe("f93e00");
  expect(floatHex(65504.0)).toBe("f97bff");
  expect(floatHex(100000.0)).toBe("fa47c35000");
  expect(floatHex(3.4028234663852886e38)).toBe("fa7f7fffff");
  expect(floatHex(1.0e300)).toBe("fb7e37e43c8800759c");
  expect(floatHex(5.960464477539063e-8)).toBe("f90001");
  expect(floatHex(0.00006103515625)).toBe("f90400");
  expect(floatHex(-4.0)).toBe("f9c400");
  expect(floatHex(-4.1)).toBe("fbc010666666666666");
  expect(floatHex(Infinity)).toBe("f97c00");
  expect(floatHex(-Infinity)).toBe("f9fc00");
  expect(floatHex(NaN)).toBe("f97e00");
  expect(floatHex(-0.0)).toBe("f98000");
});

// Shortest-float tier selection (robust, no hard-coded f64 bit patterns).
test("cbor shortest-float tier selection", () => {
  expect(floatHex(1.5).startsWith("f9")).toBe(true); // float16
  expect(floatHex(100000.0).startsWith("fa")).toBe(true); // float32 (f16 overflow)
  expect(floatHex(1.1).startsWith("fb")).toBe(true); // float64 (not f32-exact)
  expect(floatHex(1.0e300).startsWith("fb")).toBe(true); // float64 (f32 overflow)
});
