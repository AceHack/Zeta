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
import {} from "../tri-boolean";
/** Reference v0 shape: 4/3/4 (8 value trits, mode in [0,8)). */
export const DEFAULT_SHAPE = { highWidth: 4, decoderWidth: 3, lowWidth: 4 };
