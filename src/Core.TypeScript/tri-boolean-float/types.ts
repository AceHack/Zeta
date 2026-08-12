// Tri-boolean floating point -- v0 types (081KSV2WD0008QG0R00051XS0N slice 5, TS reference / distribution).
//
// PROPOSED v0 (middle-out, self-describing). Spec:
//   docs/research/2026-05-30-tri-boolean-float-v0-spec-middle-out-self-describing-decode-aaron-otto.md
// The bit-layout + decode semantics are a first draft for operator ratification; F#/C#/Rust parity
// impls wait for ratification.
//
// A tri-boolean float is built FROM the digital-qubit cell (081KSV2WD0008QG0R00051XS0N slices 1-4): every position is a
// `Tri` (True | False | N). Layout, MSB-first within each field:
//   [ high value: H trits ] [ decoder: D trits ] [ low value: L trits ]
// The MIDDLE decoder selects how the OUTER ends are read (read middle-out).
// Decoded number = V * 2^(mode - bias), bias = 2^(decoderWidth - 1), where V = intOf(high ++ low)
// and mode = intOf(decoder). N in a value trit => value-superposed; N in a decoder trit =>
// interpretation-superposed -- the qubit property at the interpretation level.

import { type Tri } from "../tri-boolean";

/** Field widths of a tri-boolean float (trits per field). */
export interface FloatShape {
  /** High (more-significant) value trits. */
  readonly highWidth: number;
  /** Middle decoder trits (the selector read first; v0: radix-point position). */
  readonly decoderWidth: number;
  /** Low (less-significant) value trits. */
  readonly lowWidth: number;
}

/** Reference v0 shape: 4/3/4 (8 value trits, mode in [0,8)). */
export const DEFAULT_SHAPE: FloatShape = { highWidth: 4, decoderWidth: 3, lowWidth: 4 };

/** A tri-boolean float. Each field is a `Tri[]` (MSB-first); the float is a composite of digital
 *  qubit cells, so any trit may be held (N). */
export interface TriFloat {
  readonly shape: FloatShape;
  readonly high: readonly Tri[];
  readonly decoder: readonly Tri[];
  readonly low: readonly Tri[];
}

/** Feedback when `measure` cannot collapse to a single number. The two held-states are distinct:
 *  the decode-instruction is held (`interpretation-superposed`, N in the decoder) vs the value is
 *  held (`value-superposed`, N in a value trit while the decoder is certain). */
export type FloatFeedback = { readonly reason: "interpretation-superposed" } | { readonly reason: "value-superposed" };

/** Result of `decode`/`measure`: Ok(number) iff fully certain; else which superposition is held. */
export type DecodeResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly feedback: FloatFeedback };

/** Feedback when a target value cannot be represented in the given shape (v0: unsigned + finite,
 *  and value*2^mode must be a non-negative integer that fits the value field for some mode). */
export type EncodeFeedback = { readonly reason: "not-representable"; readonly detail: string };

/** Result of `fromValue`. */
export type EncodeResult =
  | { readonly ok: true; readonly float: TriFloat }
  | { readonly ok: false; readonly feedback: EncodeFeedback };
