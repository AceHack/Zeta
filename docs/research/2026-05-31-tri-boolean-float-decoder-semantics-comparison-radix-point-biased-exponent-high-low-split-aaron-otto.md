# Tri-boolean float -- decoder-semantics comparison: radix-point vs biased-exponent vs high-low-split (081KSV2WD0008QG0R00051XS0N slice 5)

**Status:** design exploration per the operator 2026-05-31: *"ratify v0 layout: radix-point decoder,
unsigned for now"* + *"lets try a few different designs unless it's obviously right."* It is NOT
obviously right -- the three designs occupy genuinely different range/precision regimes. This doc
compares them with **measured** profiles (computed by `characterize` in
`src/Core.TypeScript/tri-boolean-float/decoders.ts`; the numbers below are asserted by
`decoders.test.ts`, 13/13 pass). Recommendation at the end; the pick is the operator's. F#/C#/Rust
parity (slice 5 pt2) + the conformance harness (slice 6) follow the pick.

Shared across all three (unchanged from v0): middle-out read; built from the digital-qubit cell;
**N in the decoder => interpretation-superposed**; **N in a value trit => value-superposed**. Only
the certain-case arithmetic of "how the middle decodes the ends" differs.

## The three designs (the differ-only arithmetic)

Given shape `{high: H, decoder: D, low: L}`, `valueBits = H + L`, `V = intOf(high ++ low)`,
`mode = intOf(decoder)`:

1. **radix-point (v0, ratified baseline)** -- `value = V / 2^mode`. The middle sets where the binary
   point goes (self-describing fixed-point). Simplest; faithful to "the middle = the radix point."
2. **biased-exponent** -- `bias = 2^(D-1)`; `value = V * 2^(mode - bias)`. The middle is a signed
   power-of-two exponent (float-like scale; both large + small magnitudes).
3. **high-low-split (posit-spirit / tapered)** -- `mode` = how many of the value bits (from the high
   end) are the EXPONENT; the rest are the MANTISSA; `value = mantissa * 2^exponent`. The middle
   re-partitions the STRUCTURE of the ends (the strongest form of "the middle decodes the ends"),
   trading mantissa precision for exponent range -- exactly tapered precision (posits).

## Measured comparison (default shape 4/3/4: valueBits=8, mode in [0,8); 2048 bit-patterns)

| design | max | min positive | distinct values | redundancy | sub-unit precision (fractions) |
|---|---|---|---|---|---|
| radix-point | **255** | 1/128 (0.0078125) | 1152 / 2048 | yes (896 dup) | YES |
| biased-exponent | **2040** | 1/16 (0.0625) | 1152 / 2048 | yes (896 dup) | YES |
| high-low-split | **2^127 (~1.7e38)** | 1 | 577 / 2048 | high (1471 dup) | **NO (integer-only)** |

Readings:
- **radix-point**: modest range, fractions down to 1/128, uniform-per-mode absolute precision. The
  simplest faithful design. Best when values live in a known bounded range with sub-unit precision
  (probabilities, fixed-point-ish quantities).
- **biased-exponent**: ~8x the range of radix-point AND sub-unit precision (to 1/16), float-like.
  Same distinct-count as radix-point (the bias just slides the window). The balanced "wider range,
  still fractional" option. Redundant representations (canonicalization needed in encode).
- **high-low-split**: astronomically wide range (2^127) but -- with an UNSIGNED exponent -- it is
  **integer-only** (no value < 1 except 0): a fatal limitation if fractions/probabilities matter.
  Highest redundancy (only 577 distinct of 2048). To regain fractions it needs a signed/biased
  split-exponent (a v2). Closest to posits in spirit + the strongest "middle restructures the ends,"
  but not usable as a default where sub-unit precision is required.

## Recommendation (operator decides)

Not obviously-one-winner; they serve different regimes. Substrate-honest recommendation:

- **Keep radix-point as the v0 DEFAULT** (ratified). Simplest, fractional, faithful, clean round-trip.
- **Keep biased-exponent as a selectable MODE** for wider-range-still-fractional needs. It is the
  natural "more dynamic range" sibling and shares the held-state semantics exactly.
- **Document high-low-split as the posit-spirit option but NOT the default**, because the unsigned-exp
  v0 is integer-only. Revisit as a v2 with a signed split-exponent (regains fractions + keeps the
  tapered-range win) if huge dynamic range becomes a requirement.

The framework's likely consumers (Bayesian priors, probabilities, uncertainty-in-priors) want sub-unit
precision, which rules out high-low-split-as-default and favors radix-point (simplest) or
biased-exponent (wider). The `DecoderSemantics` type keeps all three first-class so the choice is a
parameter, not a rewrite -- and the conformance harness (slice 6) can ballot whichever the operator
picks across TS/F#/C#/Rust.

## Open follow-ons (for the chosen design)

- **sign** (still unsigned per ratification): a tri-valued sign trit -> a held-sign state; or
  two's-complement on the value field. Decide with the design pick.
- **canonical encode** for biased-exponent / split (radix-point already canonicalizes to smallest
  mode in `fromValue`).
- **held-RANGE** (v1): when value trits are N, carry the interval of possible values rather than a
  single `value-superposed` feedback (composes with wonder-compression -- structure ABOUT the held
  value without collapsing it).

## Composition

- All three reuse the digital-qubit cell (081KSV2WD0008QG0R00051XS0N slices 1-4) + the measure/cooperate + Result<value,
  feedback> discipline (monad-propagation; asymmetric-authorship feedback channels).
- `DecoderSemantics` is a parameter, so cross-language parity (slice 5 pt2) implements the SAME three
  (or the chosen subset); the conformance harness (slice 6) ballots them.
- Composes with the v0 spec doc (2026-05-30-...-tri-boolean-float-v0-spec-...) -- this refines its
  OPEN decision #1 (decoder semantics) with measured tradeoffs.
