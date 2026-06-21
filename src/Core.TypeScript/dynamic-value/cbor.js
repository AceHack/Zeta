// DynamicValue canonical CBOR (RFC 8949) codec — the TS oracle, shared by the encode +
// decode byte-lock tests. CBOR is the TOTAL canonical form (all 8 shapes), where canonical
// JSON is partial (Float/Bytes deferred). Float uses RFC 8949 §4.2.2 shortest-float; Bytes
// uses major-type-2. Object map keys stay in INSERTION order (NOT §4.2.1 bytewise-sorted) —
// Object is order-significant, the same call v1 made for JSON.
//
// `Tagged` is the language-neutral seed value form: float v = IEEE-754 f64 bit pattern
// (16 hex, big-endian); int v = decimal string; bytes v = hex string. JS has no native f16,
// so f64↔f16 is hand-rolled (mirroring the Rust oracle), with the encoder gated on an exact
// round-trip and the decoder gated on a fixed-point canonical check.
import { MAX_NESTING_DEPTH } from "./types";
export { MAX_NESTING_DEPTH };
// --- bit helpers (DataView is the only portable way to get IEEE bit patterns in JS) ---
function f32Bits(v) {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setFloat32(0, v, false);
    return dv.getUint32(0, false);
}
function f64Bits(v) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, v, false);
    return dv.getBigUint64(0, false);
}
function f64FromBitsHex(hex) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setBigUint64(0, BigInt("0x" + hex), false);
    return dv.getFloat64(0, false);
}
export function f64ToBitsHex(v) {
    return f64Bits(v).toString(16).padStart(16, "0");
}
// --- hand-rolled float16 (no native f16 in JS), mirroring the Rust oracle ---
// Right shift with round-to-nearest-even.
function roundShift(value, shift) {
    if (shift === 0)
        return value;
    const result = value >>> shift;
    const roundBit = 1 << (shift - 1);
    const rem = value & ((1 << shift) - 1);
    if (rem > roundBit || (rem === roundBit && (result & 1) === 1))
        return result + 1;
    return result;
}
// f32 -> float16 bits, round-to-nearest-even. Only the exact path (no rounding) affects
// canonical output, since non-exact results are rejected by the round-trip gate.
function f32ToF16Round(value) {
    const x = f32Bits(value);
    const sign = (x >>> 16) & 0x8000;
    const expField = (x >>> 23) & 0xff;
    const mant = x & 0x007fffff;
    if (expField === 0xff) {
        return mant !== 0 ? sign | 0x7e00 : sign | 0x7c00;
    }
    const exp = expField - 127 + 15;
    if (exp >= 0x1f)
        return sign | 0x7c00;
    if (exp <= 0) {
        if (exp < -10)
            return sign;
        const m = mant | 0x00800000;
        return sign | roundShift(m, 14 - exp);
    }
    const m10 = roundShift(mant, 13);
    if (m10 === 0x400) {
        const e = exp + 1;
        if (e >= 0x1f)
            return sign | 0x7c00;
        return sign | (e << 10);
    }
    return sign | (exp << 10) | m10;
}
// float16 bits -> f64 value (exact; every float16 value is exactly representable in f64).
function f16ToValue(bits) {
    const sign = (bits & 0x8000) !== 0 ? -1 : 1;
    const exp = (bits >>> 10) & 0x1f;
    const mant = bits & 0x3ff;
    if (exp === 0)
        return sign * mant * Math.pow(2, -24);
    if (exp === 0x1f)
        return mant === 0 ? sign * Infinity : NaN;
    return sign * (1 + mant / 1024) * Math.pow(2, exp - 15);
}
// float16 bits -> f32 bits (exact); used by the encoder's exact round-trip gate.
function f16ToF32Bits(bits) {
    return f32Bits(f16ToValue(bits));
}
// bits iff `value` is EXACTLY representable in float16 (round-trip is bit-identical,
// including sign of zero); null otherwise.
function f16BitsIfExact(value) {
    const bits = f32ToF16Round(value);
    return f16ToF32Bits(bits) === f32Bits(value) ? bits : null;
}
// --- CBOR encode ---
function pushBE(out, arg, bytes) {
    for (let i = bytes - 1; i >= 0; i--)
        out.push(Number((arg >> BigInt(i * 8)) & 0xffn));
}
// CBOR initial byte (major type in top 3 bits) + preferred/shortest argument (RFC 8949
// §3, §4.2.1). `arg` is a bigint to carry i64 ints (and small lengths) without overflow.
function cborHead(out, major, arg) {
    const mt = major << 5;
    if (arg <= 23n)
        out.push(mt | Number(arg));
    else if (arg <= 0xffn) {
        out.push(mt | 24);
        pushBE(out, arg, 1);
    }
    else if (arg <= 0xffffn) {
        out.push(mt | 25);
        pushBE(out, arg, 2);
    }
    else if (arg <= 0xffffffffn) {
        out.push(mt | 26);
        pushBE(out, arg, 4);
    }
    else {
        out.push(mt | 27);
        pushBE(out, arg, 8);
    }
}
// major 0 for >= 0; major 1 for < 0 (encodes -1 - n).
function cborInt(out, v) {
    if (v >= 0n)
        cborHead(out, 0, v);
    else
        cborHead(out, 1, -1n - v);
}
// RFC 8949 §4.2.2 shortest float: NaN -> 0xf97e00; else the shortest of
// float16 / float32 / float64 that decodes back to the exact same value.
function cborFloat(out, v) {
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
const utf8 = (s) => new TextEncoder().encode(s);
class CborEncodeError extends Error {
    error;
    constructor(error) {
        super(error);
        this.error = error;
    }
}
function writeCbor(out, n, depth) {
    if (depth > MAX_NESTING_DEPTH) {
        throw new CborEncodeError("NestingTooDeep");
    }
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
            for (const x of b)
                out.push(x);
            break;
        }
        case "bytes": {
            const hex = n.v;
            const len = hex.length / 2;
            cborHead(out, 2, BigInt(len));
            for (let i = 0; i < hex.length; i += 2)
                out.push(parseInt(hex.slice(i, i + 2), 16));
            break;
        }
        case "arr":
            cborHead(out, 4, BigInt(n.v.length));
            for (const it of n.v)
                writeCbor(out, it, depth + 1);
            break;
        case "obj":
            cborHead(out, 5, BigInt(n.v.length));
            for (const [k, val] of n.v) {
                const kb = utf8(k);
                cborHead(out, 3, BigInt(kb.length));
                for (const x of kb)
                    out.push(x);
                writeCbor(out, val, depth + 1);
            }
            break;
    }
}
export function canonicalCbor(n) {
    try {
        const out = [];
        writeCbor(out, n, 0);
        return { ok: true, value: out };
    }
    catch (e) {
        if (e instanceof CborEncodeError) {
            return { ok: false, error: e.error };
        }
        throw e;
    }
}
export const toHex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
// inverse of toHex — the seed carries CBOR bytes as a hex string; shared by the decode + manifest tests
export const fromHex = (hex) => {
    const out = [];
    for (let i = 0; i < hex.length; i += 2)
        out.push(parseInt(hex.slice(i, i + 2), 16));
    return out;
};
// --- CBOR decode (inverse of canonicalCbor) ---
// Internal control-flow carrier: a decode failure throws this and is caught at the
// fromCanonicalCbor boundary, so the public API returns a DecodeResult, never throws.
class CborDecodeError extends Error {
    error;
    constructor(error) {
        super(error);
        this.error = error;
    }
}
const I64_MAX = 9223372036854775807n;
function bytesEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
/**
 * Decode canonical CBOR bytes into a {@link Tagged} value — the inverse of {@link canonicalCbor}.
 * Strictly canonical: per-form readers stay lenient, and a single fixed-point check
 * (`canonicalCbor(decoded)` must equal the input) rejects every non-canonical form
 * (non-shortest int/length width, non-shortest float / non-canonical NaN, invalid UTF-8
 * repaired to U+FFFD) as `NonCanonical`. Never throws for malformed input.
 *
 * The input is typed `number[]` (the C#/F#/Rust oracles take `byte[]`/`Vec<u8>`, which
 * enforce 0..255 at the type level; JS cannot). Any element that is not an integer in
 * 0..255 is not a valid CBOR byte, so the input cannot be canonical CBOR → `NonCanonical`.
 * This boundary check also preserves the never-throws contract: without it a non-integer
 * element (e.g. `1.5`, `NaN`, `Infinity`) would reach `BigInt(...)` and throw `RangeError`.
 */
export function fromCanonicalCbor(bytes) {
    for (const b of bytes) {
        if (!Number.isInteger(b) || b < 0 || b > 255)
            return { ok: false, error: "NonCanonical" };
    }
    let pos = 0;
    const fail = (e) => {
        throw new CborDecodeError(e);
    };
    const need = (n) => {
        if (pos + n > bytes.length)
            fail("UnexpectedEnd");
    };
    // big-endian uint of n bytes, as bigint (caller bounds-checked)
    const readBE = (n) => {
        let v = 0n;
        for (let i = 0; i < n; i++)
            v = (v << 8n) | BigInt(bytes[pos + i] ?? 0);
        pos += n;
        return v;
    };
    const argWidth = (ai) => {
        if (ai === 24)
            return 1;
        if (ai === 25)
            return 2;
        if (ai === 26)
            return 4;
        if (ai === 27)
            return 8;
        return -1;
    };
    const readArg = (ai) => {
        if (ai < 24)
            return BigInt(ai);
        const n = argWidth(ai);
        if (n < 0)
            fail("Unsupported");
        need(n);
        return readBE(n);
    };
    const readSimpleOrFloat = (ai) => {
        switch (ai) {
            case 20:
                return { t: "bool", v: false };
            case 21:
                return { t: "bool", v: true };
            case 22:
                return { t: "null" };
            case 25: {
                need(2);
                const bits = ((bytes[pos] ?? 0) << 8) | (bytes[pos + 1] ?? 0);
                pos += 2;
                return { t: "float", v: f64ToBitsHex(f16ToValue(bits)) };
            }
            case 26: {
                need(4);
                const dv = new DataView(new ArrayBuffer(4));
                for (let i = 0; i < 4; i++)
                    dv.setUint8(i, bytes[pos + i] ?? 0);
                pos += 4;
                return { t: "float", v: f64ToBitsHex(dv.getFloat32(0, false)) };
            }
            case 27: {
                need(8);
                const dv = new DataView(new ArrayBuffer(8));
                for (let i = 0; i < 8; i++)
                    dv.setUint8(i, bytes[pos + i] ?? 0);
                pos += 8;
                return { t: "float", v: f64ToBitsHex(dv.getFloat64(0, false)) };
            }
            default:
                return fail("Unsupported");
        }
    };
    const remaining = () => BigInt(bytes.length - pos);
    const readInt = (major, arg) => {
        if (arg > I64_MAX)
            return fail("IntegerOverflow");
        return { t: "int", v: major === 0 ? arg.toString() : (-1n - arg).toString() };
    };
    const readByteString = (arg) => {
        if (arg > remaining())
            return fail("UnexpectedEnd");
        const n = Number(arg);
        const hex = toHex(bytes.slice(pos, pos + n));
        pos += n;
        return { t: "bytes", v: hex };
    };
    const readTextString = (arg) => {
        if (arg > remaining())
            return fail("UnexpectedEnd");
        const n = Number(arg);
        // lenient (TextDecoder replaces invalid UTF-8 with U+FFFD); the fixed-point
        // check rejects it as NonCanonical on re-encode.
        const s = new TextDecoder().decode(new Uint8Array(bytes.slice(pos, pos + n)));
        pos += n;
        return { t: "str", v: s };
    };
    const readArray = (arg, depth) => {
        if (arg > remaining())
            return fail("UnexpectedEnd");
        const items = [];
        for (let i = 0n; i < arg; i++)
            items.push(readValue(depth + 1));
        return { t: "arr", v: items };
    };
    const readMap = (arg, depth) => {
        if (arg > remaining())
            return fail("UnexpectedEnd");
        const pairs = [];
        for (let i = 0n; i < arg; i++) {
            const key = readValue(depth + 1);
            if (key.t !== "str")
                return fail("NonTextKey");
            pairs.push([key.v, readValue(depth + 1)]);
        }
        return { t: "obj", v: pairs };
    };
    function readValue(depth) {
        if (depth > MAX_NESTING_DEPTH)
            fail("NestingTooDeep");
        need(1);
        const initial = bytes[pos] ?? 0;
        pos += 1;
        const major = initial >>> 5;
        const ai = initial & 0x1f;
        if (major === 7)
            return readSimpleOrFloat(ai);
        const arg = readArg(ai);
        switch (major) {
            case 0:
            case 1:
                return readInt(major, arg);
            case 2:
                return readByteString(arg);
            case 3:
                return readTextString(arg);
            case 4:
                return readArray(arg, depth);
            case 5:
                return readMap(arg, depth);
            default:
                return fail("Unsupported"); // major 6 = tags
        }
    }
    try {
        const value = readValue(0);
        if (pos !== bytes.length)
            return { ok: false, error: "TrailingData" };
        // canonical fixed-point: canonical bytes are exactly those `b` with canonicalCbor(decode b) == b
        const enc = canonicalCbor(value);
        if (!enc.ok || !bytesEqual(enc.value, bytes))
            return { ok: false, error: "NonCanonical" };
        return { ok: true, value };
    }
    catch (e) {
        if (e instanceof CborDecodeError)
            return { ok: false, error: e.error };
        throw e;
    }
}
