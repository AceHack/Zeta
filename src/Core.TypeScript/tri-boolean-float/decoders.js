// Tri-boolean float -- decoder-semantics EXPLORATION (B-0944 slice 5, "try a few designs").
//
// The operator ratified v0 = radix-point + unsigned, AND asked to "try a few different designs
// unless it's obviously right." It is NOT obviously right (genuine tradeoff), so this module
// implements three decoder semantics side-by-side so they are concretely comparable. The held-state
// logic is IDENTICAL across all three (N in decoder => interpretation-superposed; N in a value trit
// => value-superposed); only the certain-case arithmetic of "how the middle decodes the ends"
// differs. The ratified v0 `decode` in ./tri-boolean-float.ts is unchanged (radix-point default);
// this is additive exploration. Comparison + recommendation:
//   docs/research/2026-05-31-tri-boolean-float-decoder-semantics-comparison-radix-point-biased-exponent-high-low-split-aaron-otto.md
import {} from "../tri-boolean";
import {} from "./types";
/** MSB-first base-2 read of a trit field (T=1, F=0); null if any trit is held (N). */
const intOf = (trits) => {
    let v = 0;
    for (const t of trits) {
        if (t.s === "N")
            return null;
        v = v * 2 + (t.s === "T" ? 1 : 0);
    }
    return v;
};
/** The certain-case arithmetic for each semantics (the only part that differs across designs). */
export const applyDecoder = (V, mode, valueBits, decoderWidth, sem) => {
    switch (sem) {
        case "radix-point":
            return V / 2 ** mode;
        case "biased-exponent": {
            const bias = 2 ** (decoderWidth - 1);
            return V * 2 ** (mode - bias);
        }
        case "high-low-split": {
            const e = Math.min(mode, valueBits); // exponent bits taken from the high end
            const mantBits = valueBits - e;
            // Arithmetic (NOT bitwise): JS >>> / << coerce to uint32 and mask the shift count mod 32,
            // which silently mis-decodes shapes with mantBits >= 32. Division/modulo is correct for any
            // width within Number's 2^53 integer precision. (mantBits===0 => scale 1 => exponent V,
            // mantissa 0 => value 0, the degenerate all-exponent case.)
            const scale = 2 ** mantBits;
            const exponent = Math.floor(V / scale);
            const mantissa = V % scale;
            return mantissa * 2 ** exponent;
        }
    }
};
/** decode under a chosen semantics (middle-out; shared held-state logic, per-semantics arithmetic). */
export const decodeWith = (f, sem) => {
    const mode = intOf(f.decoder);
    if (mode === null)
        return { ok: false, feedback: { reason: "interpretation-superposed" } };
    const valueBits = f.high.length + f.low.length;
    const V = intOf([...f.high, ...f.low]);
    if (V === null)
        return { ok: false, feedback: { reason: "value-superposed" } };
    return { ok: true, value: applyDecoder(V, mode, valueBits, f.decoder.length, sem) };
};
/** Brute-force characterize a (shape, semantics) pair over all certain bit-patterns. */
export const characterize = (shape, sem) => {
    const valueBits = shape.highWidth + shape.lowWidth;
    const modes = 2 ** shape.decoderWidth;
    const vCount = 2 ** valueBits;
    const values = new Set();
    for (let mode = 0; mode < modes; mode++) {
        for (let V = 0; V < vCount; V++) {
            values.add(applyDecoder(V, mode, valueBits, shape.decoderWidth, sem));
        }
    }
    // Single-pass reduce (NOT Math.max(...set)/Math.min(...set)): for larger shapes `values` can hold
    // hundreds of thousands of entries, and spreading that many args overflows the call stack
    // (RangeError: Maximum call stack size exceeded). Iterating is O(n) with no arg-spread.
    let maxValue = Number.NEGATIVE_INFINITY;
    let minPositive = Number.POSITIVE_INFINITY;
    let integersOnly = true;
    for (const x of values) {
        if (x > maxValue)
            maxValue = x;
        if (x > 0) {
            if (x < minPositive)
                minPositive = x;
            if (!Number.isInteger(x))
                integersOnly = false;
        }
    }
    return {
        semantics: sem,
        maxValue,
        minPositive,
        distinctCount: values.size,
        totalPatterns: modes * vCount,
        integersOnly,
    };
};
