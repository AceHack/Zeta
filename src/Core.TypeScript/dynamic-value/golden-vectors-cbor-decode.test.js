import { test, expect } from "bun:test";
import vectors from "./golden-vectors-cbor.json";
import { fromCanonicalCbor, fromHex } from "./cbor";
const decodeErr = (bytes) => {
    const r = fromCanonicalCbor(bytes);
    if (r.ok)
        throw new Error("expected decode failure");
    return r.error;
};
const seed = vectors;
for (const v of seed.vectors) {
    test(`cbor decode round-trip: ${v.name}`, () => {
        const r = fromCanonicalCbor(fromHex(v.cbor));
        // ok ⟹ the decoder's internal fixed-point check passed (canonicalCbor(decoded) == input),
        // i.e. the byte-lock holds against the already-verified encoder.
        expect(r.ok).toBe(true);
        if (r.ok) {
            // structural: decoded tagged value equals the seed value
            expect(JSON.stringify(r.value)).toBe(JSON.stringify(v.value));
        }
    });
}
test("cbor decode rejects malformed input", () => {
    expect(decodeErr([])).toBe("UnexpectedEnd"); // empty
    expect(decodeErr([0x18])).toBe("UnexpectedEnd"); // uint8 head, payload truncated
    expect(decodeErr([0x43, 0x01, 0x02])).toBe("UnexpectedEnd"); // 3-byte bstr, 2 present
    expect(decodeErr([0xf6, 0x00])).toBe("TrailingData"); // null + extra byte
    expect(decodeErr([0xc0, 0x00])).toBe("Unsupported"); // tag (major 6)
    expect(decodeErr([0xf7])).toBe("Unsupported"); // undefined (major 7, ai 23)
    expect(decodeErr([0x9f])).toBe("Unsupported"); // indefinite-length array (ai 31)
    expect(decodeErr([0xa1, 0x00, 0x00])).toBe("NonTextKey"); // int map key
});
test("cbor decode rejects non-canonical input", () => {
    expect(decodeErr([0x18, 0x00])).toBe("NonCanonical"); // non-shortest int (0 as uint8)
    expect(decodeErr([0x18, 0x17])).toBe("NonCanonical"); // 23 as uint8 (non-shortest width)
    expect(decodeErr([0x61, 0xff])).toBe("NonCanonical"); // text string, invalid UTF-8 (→ U+FFFD)
    expect(decodeErr([0xf9, 0x7e, 0x01])).toBe("NonCanonical"); // non-canonical float16 NaN payload
    expect(decodeErr([0xfa, 0x3f, 0x80, 0x00, 0x00])).toBe("NonCanonical"); // 1.0 as float32
    expect(decodeErr([0xfb, 0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])).toBe("NonCanonical"); // 1.0 as float64
});
// number[] cannot enforce 0..255 bytes at the type level (the C#/F#/Rust oracles take
// byte[]/Vec<u8>); a non-byte element is not valid CBOR and must NOT throw (never-throws
// contract) — it returns NonCanonical, not a RangeError from BigInt(non-integer).
test("cbor decode rejects non-byte input without throwing", () => {
    expect(decodeErr([0x18, 1.5])).toBe("NonCanonical"); // non-integer byte (would throw BigInt(1.5))
    expect(decodeErr([0x18, NaN])).toBe("NonCanonical"); // NaN byte
    expect(decodeErr([0x18, Infinity])).toBe("NonCanonical"); // Infinity byte
    expect(decodeErr([0x18, 256])).toBe("NonCanonical"); // out-of-range high
    expect(decodeErr([0x18, -1])).toBe("NonCanonical"); // out-of-range low
});
