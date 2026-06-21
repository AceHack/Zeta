// Tri-boolean floating point -- v0 operations (081KSV2WD0008QG0R00051XS0N slice 5, TS reference / distribution).
// PROPOSED v0; see ./types.ts + the spec doc. Reuses the digital-qubit cell (081KSV2WD0008QG0R00051XS0N).

import { type Tri, T, F, N } from "../tri-boolean";
import { type FloatShape, type TriFloat, type DecodeResult, type EncodeResult, DEFAULT_SHAPE } from "./types";

/** MSB-first base-2 read of a trit field (T=1, F=0). Returns null if ANY trit is held (N). */
const intOf = (trits: readonly Tri[]): number | null => {
  let v = 0;
  for (const t of trits) {
    if (t.s === "N") return null;
    v = v * 2 + (t.s === "T" ? 1 : 0);
  }
  return v;
};

/** MSB-first encode of an unsigned integer into `width` certain trits (T=1, F=0). */
const intToTrits = (v: number, width: number): Tri[] => {
  const out: Tri[] = [];
  for (let i = width - 1; i >= 0; i--) out.push(((v >> i) & 1) === 1 ? T : F);
  return out;
};

/** decode (middle-out): read the MIDDLE decoder first, then decode OUTWARD toward the ends.
 *  - N in the decoder  => the decode instruction itself is superposed (interpretation-superposed).
 *  - N in a value trit => the value is superposed, interpretation known    (value-superposed).
 *  - else              => intOf(high ++ low) / 2^mode  (mode = radix-point position). */
export const decode = (f: TriFloat): DecodeResult => {
  const mode = intOf(f.decoder);
  if (mode === null) return { ok: false, feedback: { reason: "interpretation-superposed" } };
  const v = intOf([...f.high, ...f.low]);
  if (v === null) return { ok: false, feedback: { reason: "value-superposed" } };
  const bias = 2 ** (f.decoder.length - 1);
  return { ok: true, value: v * 2 ** (mode - bias) };
};

/** measure: the ONLY collapsing operation -- resolves to a number iff fully certain, else surfaces
 *  which superposition is held (the digital-qubit measure/cooperate discipline at the number scope).
 *  Identical to decode; named `measure` for parity with the tri-boolean primitive. */
export const measure = decode;

/** cooperate: engage WITHOUT collapsing -- identity, preserving every held (N) trit. The
 *  wonder-compression-safe operation at the number scope. */
export const cooperate = (f: TriFloat): TriFloat => f;

/** True iff the float cannot be collapsed to a single number (any value or decoder trit is held). */
export const isHeld = (f: TriFloat): boolean => !decode(f).ok;

/** fromValue (biased-exponent canonical encode): find a (mode, V) with V * 2^(mode-bias) = value,
 *  V a non-negative integer fitting the value field and mode in the decoder field. Picks the
 *  smallest mode that works (a canonical representation). Surfaces feedback when not representable. */
export const fromValue = (value: number, shape: FloatShape = DEFAULT_SHAPE): EncodeResult => {
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, feedback: { reason: "not-representable", detail: "v0 is unsigned + finite" } };
  }
  const valueBits = shape.highWidth + shape.lowWidth;
  const maxMode = (1 << shape.decoderWidth) - 1;
  const maxV = 2 ** valueBits;
  const bias = 2 ** (shape.decoderWidth - 1);
  for (let mode = 0; mode <= maxMode; mode++) {
    const scaled = value / 2 ** (mode - bias);
    if (Number.isInteger(scaled) && scaled >= 0 && scaled < maxV) {
      const bits = intToTrits(scaled, valueBits);
      return {
        ok: true,
        float: {
          shape,
          high: bits.slice(0, shape.highWidth),
          decoder: intToTrits(mode, shape.decoderWidth),
          low: bits.slice(shape.highWidth),
        },
      };
    }
  }
  return {
    ok: false,
    feedback: {
      reason: "not-representable",
      detail: `no (mode,V) with mode<=${maxMode} and V<${maxV} represents ${value}`,
    },
  };
};

/** Construct a float directly from trit fields (for tests / advanced use). */
export const fromTrits = (high: readonly Tri[], decoder: readonly Tri[], low: readonly Tri[]): TriFloat => ({
  shape: { highWidth: high.length, decoderWidth: decoder.length, lowWidth: low.length },
  high,
  decoder,
  low,
});

/** Re-export the held cell for convenience when hand-building superposed floats. */
export const heldTrit: Tri = N;
