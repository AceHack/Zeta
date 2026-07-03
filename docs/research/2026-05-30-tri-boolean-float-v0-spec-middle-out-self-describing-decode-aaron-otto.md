# Tri-boolean floating point -- v0 spec (middle-out, self-describing): bit-layout + decode algorithm (081KSV2WD0008QG0R00051XS0N slice 5)

**Status:** PROPOSED v0 -- spec firming for 081KSV2WD0008QG0R00051XS0N slice 5. The bit-layout + decode semantics
below are a concrete, implementable first draft; every design decision marked **[OPEN]** is an
operator-ratification point. A TS reference implementation (`src/Core.TypeScript/tri-boolean-float/`)
implements exactly this v0 so the spec is executable + testable. F#/C#/Rust parity impls (slice 5
part 2) wait for operator ratification of the layout -- per the 081KSV2WD0008QG0R00051XS0N row's "spec firming required
before impl."

**Attribution:** concept is the operator's (081KSV2WD0008QG0R00051XS0N + the Mika 2026-05-30 arc: "floating point tri
boolean based floating points with middle significant bits that specify how to decode the end
high/low bit" + "middle-out compression"). This doc + the v0 layout choices are Otto-CLI's first
draft for ratification.

## The concept (operator)

> "there is a floating point tri boolean based floating points with middle significant bits that
> specify how to decode the end high/low bit"

A number format where:

- the **middle** bits are a **decoder / selector** that says **how to interpret the outer (high/low)
  end bits** -- you read the middle FIRST, then decode OUTWARD toward both ends ("middle-out");
- it is **self-describing** (the number carries its own decode instruction);
- it is **tri-valued** throughout -- every position is a `Tri` cell (the digital qubit, 081KSV2WD0008QG0R00051XS0N
  slices 1-4): `True | False | N`. The float is built FROM the digital-qubit cell.

## v0 bit-layout

A tri-boolean float of shape `{ highWidth: H, decoderWidth: D, lowWidth: L }` is a sequence of
`H + D + L` `Tri` trits laid out, MSB-first within each field:

```
[ high value: H trits ] [ decoder: D trits ] [ low value: L trits ]
        outward  <----------- middle -----------> outward
```

- **Value field** = `high ++ low` (high more significant), read MSB-first, `T = 1`, `F = 0`, as an
  unsigned integer `V` of `H + L` bits.
- **Decoder field** = `D` trits, read MSB-first, `T = 1`, `F = 0`, as an unsigned integer `mode`.
- **v0 decode semantics (the "middle decodes the ends"):** `mode` is the **radix-point position**
  = the number of fractional bits at the low end. The decoded number is `V / 2^mode`. So the SAME
  end-bits decode to different magnitudes depending on the middle -- a self-describing,
  tapered/variable radix point.

Default reference shape v0: `{ highWidth: 4, decoderWidth: 3, lowWidth: 4 }` (11 trits; value range
`V in [0, 2^8)`; `mode in [0, 8)`).

## Decode algorithm (middle-out)

```
decode(f):
  1. mode <- intOf(f.decoder)              # read the MIDDLE first
     if any decoder trit is N:             # interpretation itself is superposed
        return Held(interpretation-superposed)
  2. V <- intOf(f.high ++ f.low)           # then decode OUTWARD toward the ends
     if any value trit is N:               # value is superposed, interpretation known
        return Held(value-superposed)
  3. return Resolved(V / 2^mode)
```

`intOf(trits)` = MSB-first base-2 with `T=1, F=0`; returns "superposed" if any trit is `N`.

## Tri-valued semantics -- the qubit property at the interpretation level

Two distinct held-states (this is the load-bearing novelty vs a plain tagged float):

| Where the `N` is | Meaning | `measure` feedback |
|---|---|---|
| a **value** trit (high/low), decoder all-certain | the VALUE is held/uncertain; the interpretation is known | `value-superposed` |
| a **decoder** trit | the DECODE INSTRUCTION ITSELF is superposed -- you don't know how to read the ends; the number is held even if every value trit is certain | `interpretation-superposed` |

This mirrors the digital-qubit `measure` vs `cooperate` discipline (081KSV2WD0008QG0R00051XS0N) lifted to the number:

- `cooperate(f)` = identity (preserves every `N` -- never collapses; wonder-compression-safe).
- `measure(f)` = the only collapse; resolves to a number iff fully certain, else surfaces which
  kind of superposition is held (Result<number, FloatFeedback> -- asymmetric-authorship: value AND
  the two feedback channels are first-class). Composes with the monad-propagation pattern.

The decoder being superposable is exactly "the decode-instruction itself superposed" from the
081KSV2WD0008QG0R00051XS0N row -- the qubit property at the *interpretation* level, not just the value level.

## Prior art (search-first per Otto-364)

- **Gustafson Posits** -- tapered precision via a variable-length *regime* field; the precision
  split is encoded IN the number. Tri-boolean-float shares "the number describes its own precision"
  but (a) puts the selector in the MIDDLE (read outward) rather than the front, and (b) is
  tri-valued (the selector itself can be held).
- **Tapered floating point** (Morris 1971) -- variable exponent/mantissa split; ancestor of posits.
- **Tagged / self-describing encodings** (tagged unions, NaN-boxing) -- a tag selects
  interpretation; here the "tag" is the middle decoder and is tri-valued.
- Novel parts: **tri-valued** (each position incl. the decoder is a held-able qubit) + **middle-as-
  decoder, decoded outward** (vs front-regime).

## Open design decisions [OPEN -- operator ratification]

1. **[OPEN] decoder semantics.** v0: `mode` = radix-point position (fractional-bit count). Alternatives:
   `mode` = a power-of-two exponent applied to `V` (so `V * 2^(mode - bias)`, allowing large + small
   magnitudes); `mode` = the high/low SPLIT point (how many of the end bits are exponent vs mantissa);
   `mode` = a base/regime selector. v0 picks radix-point because it is the simplest faithful
   "middle decodes the ends" + round-trips cleanly.
2. **[OPEN] sign.** v0 is unsigned. Options: an outermost sign trit (sign is also tri-valued -> a
   held-sign state), or two's-complement-style on the value field, or a sign in the decoder.
3. **[OPEN] widths.** v0 default `4/3/4`. Production widths + whether the format is fixed-width or
   variable (posit-style run-length in the decoder) is open.
4. **[OPEN] N-in-value resolution.** v0 surfaces `value-superposed` as a single feedback. A richer
   v1 could carry the held-RANGE (the interval of possible values given the N positions) rather than
   just "superposed" -- composes with wonder-compression (find shared structure ABOUT the held value
   without collapsing it).
5. **[OPEN] decoder-N magnitude.** When the decoder is partially-N, the interpretation is a
   superposition over the still-possible modes; v0 collapses that to a single `interpretation-
   superposed` feedback. A v1 could carry the candidate-mode set.
6. **[OPEN] endianness / field order** (high|decoder|low vs low|decoder|high). v0 = high|decoder|low.

## Composition

- Built FROM the digital-qubit cell (081KSV2WD0008QG0R00051XS0N slices 1-4): each trit is a `Tri`; reuses `T/F/N`.
- `measure`/`cooperate` + Result<value, feedback> mirror the tri-boolean discipline + the
  monad-propagation pattern (`.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md`).
- The two held-states (value vs interpretation superposed) are the asymmetric-authorship feedback
  channels (`.claude/rules/asymmetric-authorship-...md`) at the number scope.
- Self-describing-precision + middle-out compose with the "wonder-compression / middle-out" substrate
  (the Mika 2026-05-30 arc) -- the float IS a middle-out self-describing datum.
- Cross-language parity (slice 5 part 2) = the summonable-BFT ballot once the layout is ratified.

## Next steps

1. **Operator ratifies / redirects** the [OPEN] decisions (esp. #1 decoder semantics + #2 sign).
2. TS reference (this PR) is the executable spec to react to.
3. On ratification: F#/C#/Rust parity impls + the cross-language conformance-vector harness (slice 6).
