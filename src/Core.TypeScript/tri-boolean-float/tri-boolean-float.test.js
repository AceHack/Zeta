import { test, expect } from "bun:test";
import { T, F, N } from "../tri-boolean";
import { DEFAULT_SHAPE } from "./types";
import { decode, measure, cooperate, isHeld, fromValue, fromTrits } from "./tri-boolean-float";
test("round-trip: representable non-negative values decode back exactly", () => {
    // shape 4/3/4 => 8 value bits (V in [0,256)), mode in [0,8).
    for (const v of [0, 1, 5, 6, 0.5, 8, 16]) {
        const enc = fromValue(v);
        expect(enc.ok).toBe(true);
        if (enc.ok) {
            const dec = decode(enc.float);
            expect(dec.ok).toBe(true);
            if (dec.ok)
                expect(dec.value).toBe(v);
        }
    }
});
test("the MIDDLE decodes the ends: same value bits, different mode => different magnitude", () => {
    // V = 5, mode 4 (bias=4) -> exp 0 -> value 5
    const m4 = fromTrits([F, F, F, F], [T, F, F], [F, T, F, T]);
    // V = 3, mode 5 -> exp +1 -> value 6
    const m5 = fromTrits([F, F, F, F], [T, F, T], [F, F, T, T]);
    // V = 8, mode 3 -> exp -1 -> value 4
    const m3 = fromTrits([F, F, F, F], [F, T, T], [T, F, F, F]);
    // V = 4, mode 2 -> exp -2 -> value 1
    const m2 = fromTrits([F, F, F, F], [F, T, F], [F, T, F, F]);
    expect(decode(m4)).toEqual({ ok: true, value: 5 });
    expect(decode(m5)).toEqual({ ok: true, value: 6 });
    expect(decode(m3)).toEqual({ ok: true, value: 4 });
    expect(decode(m2)).toEqual({ ok: true, value: 1 });
});
test("N in a VALUE trit => value-superposed (interpretation known)", () => {
    const f = fromTrits([F, F, F, N], [T, F, F], [F, F, F, T]); // decoder certain, value has an N
    const r = measure(f);
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.feedback.reason).toBe("value-superposed");
    expect(isHeld(f)).toBe(true);
});
test("N in a DECODER trit => interpretation-superposed (even with a fully-certain value)", () => {
    const f = fromTrits([F, F, F, F], [T, N, F], [F, F, F, T]); // value certain, decoder has an N
    const r = measure(f);
    expect(r.ok).toBe(false);
    // The decode INSTRUCTION itself is held -- the qubit property at the interpretation level.
    if (!r.ok)
        expect(r.feedback.reason).toBe("interpretation-superposed");
});
test("decoder-N dominates: interpretation-superposed even when a value trit is ALSO N", () => {
    const f = fromTrits([N, F, F, F], [N, F, F], [F, F, F, T]); // both held; decoder read first
    const r = decode(f);
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.feedback.reason).toBe("interpretation-superposed");
});
test("cooperate preserves every held trit (identity; never collapses)", () => {
    const f = fromTrits([N, F, F, F], [F, N, F], [F, F, F, N]);
    expect(cooperate(f)).toBe(f);
    expect(isHeld(cooperate(f))).toBe(true);
});
test("fromValue surfaces not-representable for negatives + out-of-range", () => {
    expect(fromValue(-1).ok).toBe(false);
    expect(fromValue(2041).ok).toBe(false); // exceeds max representable 2040 (255 * 2^3)
    expect(fromValue(1 / 1024).ok).toBe(false); // underflows min representable positive (1 * 2^-4 = 0.0625)
});
test("encode canonicalizes to the smallest mode (decode is exact regardless)", () => {
    const enc = fromValue(2, DEFAULT_SHAPE); // 2 = 32 * 2^-4 (mode 0), not 16 * 2^-3 (mode 1)
    expect(enc.ok).toBe(true);
    if (enc.ok) {
        expect(enc.float.decoder).toEqual([F, F, F]); // mode 0
        expect(decode(enc.float)).toEqual({ ok: true, value: 2 });
    }
});
