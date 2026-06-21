import { test, expect } from "bun:test";
import vectors from "./golden-vectors-cbor.json";
import { canonicalCbor, toHex, f64ToBitsHex } from "./cbor";
const floatHex = (x) => {
    const enc = canonicalCbor({ t: "float", v: f64ToBitsHex(x) });
    if (!enc.ok)
        throw new Error("Encode failed: " + enc.error);
    return toHex(enc.value);
};
const seed = vectors;
test("seed identifies as DynamicValue canonical-cbor", () => {
    expect(seed.primitive).toBe("DynamicValue");
    expect(seed.format).toBe("canonical-cbor");
    expect(seed.vectors.length).toBeGreaterThan(0);
});
for (const v of seed.vectors) {
    test(`cbor byte-lock: ${v.name}`, () => {
        const enc = canonicalCbor(v.value);
        expect(enc.ok).toBe(true);
        expect(toHex(enc.ok ? enc.value : [])).toBe(v.cbor);
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
