import { test, expect } from "bun:test";
import { T, F, N } from "../tri-boolean";
import { DEFAULT_SHAPE } from "./types";
import { fromTrits } from "./tri-boolean-float";
import { decodeWith, characterize, applyDecoder } from "./decoders";
const ALL = ["radix-point", "biased-exponent", "high-low-split"];
test("all three share the held-state logic (N in decoder => interpretation; N in value => value)", () => {
    const decoderN = fromTrits([F, F, F, F], [F, N, F], [F, F, F, T]);
    const valueN = fromTrits([F, F, F, N], [F, F, F], [F, F, F, T]);
    for (const sem of ALL) {
        const di = decodeWith(decoderN, sem);
        expect(di.ok).toBe(false);
        if (!di.ok)
            expect(di.feedback.reason).toBe("interpretation-superposed");
        const dv = decodeWith(valueN, sem);
        expect(dv.ok).toBe(false);
        if (!dv.ok)
            expect(dv.feedback.reason).toBe("value-superposed");
    }
});
test("radix-point: value bits 1, mode picks the radix point (matches v0)", () => {
    const v1 = fromTrits([F, F, F, F], [F, F, T], [F, F, F, T]); // V=1, mode=1
    expect(decodeWith(v1, "radix-point")).toEqual({ ok: true, value: 0.5 });
});
test("biased-exponent: mode is a biased power-of-two exponent (bias = 2^(D-1) = 4)", () => {
    // V=1; mode=4 => exponent 0 => 1*2^0 = 1; mode=5 => 1*2^1 = 2; mode=3 => 1*2^-1 = 0.5
    const at = (mode) => decodeWith(fromTrits([F, F, F, F], mode, [F, F, F, T]), "biased-exponent");
    expect(at([T, F, F])).toEqual({ ok: true, value: 1 }); // mode 4
    expect(at([T, F, T])).toEqual({ ok: true, value: 2 }); // mode 5
    expect(at([F, T, T])).toEqual({ ok: true, value: 0.5 }); // mode 3
});
test("high-low-split: mode = exponent-bit count; value = mantissa * 2^exponent (huge range)", () => {
    // valueBits=8. mode(e)=7 => exponent = top 7 bits of V, mantissa = bottom 1 bit.
    // V = 1000_0001 = 129 => exponent = floor(129/2) = 64, mantissa = 129 % 2 = 1 => 1 * 2^64.
    const f = fromTrits([T, F, F, F], [T, T, T], [F, F, F, T]); // V=129, e=7
    const r = decodeWith(f, "high-low-split");
    expect(r.ok).toBe(true);
    if (r.ok)
        expect(r.value).toBe(2 ** 64);
    // e=0 => pure integer V (no exponent bits; all 8 bits mantissa)
    const intF = fromTrits([F, F, F, F], [F, F, F], [F, F, T, F]); // V=2, e=0
    expect(decodeWith(intF, "high-low-split")).toEqual({ ok: true, value: 2 });
});
test("high-low-split: wide shapes (mantBits >= 32) decode correctly (arithmetic, not 32-bit bitwise)", () => {
    // Reviewer's case: applyDecoder(1, 1, 33, 1) => e=1, mantBits=32, exponent floor(1/2^32)=0,
    // mantissa 1 % 2^32 = 1 => 1. A 32-bit `V >>> 32` / `(1 << 32)` would wrongly yield 0.
    expect(applyDecoder(1, 1, 33, 1, "high-low-split")).toBe(1);
    // Another wide shape: valueBits=40, e=0 => pure integer (mantBits=40).
    expect(applyDecoder(2 ** 35, 0, 40, 1, "high-low-split")).toBe(2 ** 35);
    // mantBits=40, exponent from a high bit: V = 2^39 + 5, e=1 => mantBits=39,
    // exponent = floor((2^39+5)/2^39) = 1, mantissa = (2^39+5) % 2^39 = 5 => 5 * 2^1 = 10.
    expect(applyDecoder(2 ** 39 + 5, 1, 40, 1, "high-low-split")).toBe(10);
});
test("comparison profiles differ meaningfully (the reason none is obviously right)", () => {
    const rp = characterize(DEFAULT_SHAPE, "radix-point");
    const be = characterize(DEFAULT_SHAPE, "biased-exponent");
    const sp = characterize(DEFAULT_SHAPE, "high-low-split");
    // radix-point: fractions, modest range, max = 255.
    expect(rp.maxValue).toBe(255);
    expect(rp.minPositive).toBe(1 / 128);
    expect(rp.integersOnly).toBe(false);
    // biased-exponent: fractions + wider range than radix-point, but redundant reps.
    expect(be.maxValue).toBeGreaterThan(rp.maxValue);
    expect(be.minPositive).toBeLessThan(1); // sub-unit precision exists
    expect(be.distinctCount).toBeLessThan(be.totalPatterns); // redundancy
    // high-low-split: enormous range, but integer-only (no sub-unit precision in the unsigned-exp v0).
    expect(sp.maxValue).toBeGreaterThan(be.maxValue);
    expect(sp.integersOnly).toBe(true);
    // The three occupy genuinely different range/precision regimes => operator pick, not obvious.
    expect(rp.maxValue).toBeLessThan(be.maxValue);
    expect(be.maxValue).toBeLessThan(sp.maxValue);
});
