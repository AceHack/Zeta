# The number that knows what it doesn't know — two registers; and yes, UniversalNumber IS our bigint

Aaron 2026-06-11: "what about TriBooleanFloat or BigFloat — something that knows what it does NOT
know, so it's not just truncated; ties to TriBoolean." And: "we already have what is basically
bigint, right?"

## Bigint: yes — and it's already the hexagonal port

`src/Core/UniversalNumber.fs` IS the answer, by its own design: the number PORT (one interface,
many adapters) whose FIRST adapter is `bigint` (arbitrary-precision integer, always exact), with
`BitsUsed`/`IsExact` resolution accounting built into the port — and the doc already names
TriBoolean's middle-out Float as the BigFloat adapter slot, with MPFR/GMP/BigDecimal/posits as
prior-art adapters that double as differential-test oracles. Aaron's instinct = the file's plan.

## "Knows what it doesn't know" — TWO registers, one existing, one to build

1. **STRUCTURAL unknowns (EXISTS, four-oracle ratified — 081KSV2WD0008QG0R00051XS0N):** `TriBoolean.Float` — a float
   composed of trits where any trit may be HELD (`Tri.N`), and `measure` names WHICH kind of
   unknown you hold: ValueSuperposed (a value trit held) vs InterpretationSuperposed (the decode
   instruction itself held). Not truncation — held structure.
2. **METRIC unknowns (TO BUILD — the ball adapter, 081KTSZN10008QG0R003PHDV1C):** a number carrying its own error
   BOUND: center ± radius (ball arithmetic — Arb, Johansson 2017; interval arithmetic, Moore
   1966; unums/valids, Gustafson). THE LAW THAT ANSWERS "not just truncated": **a lossy operation
   must WIDEN the radius, never silently round** — exactness is `radius = 0` (our milli-exact
   ints embed losslessly; `IsExact` is already in the port). **The TriBoolean tie:** comparing
   two balls whose intervals OVERLAP returns `Tri.N` — predicates on uncertain numbers refuse to
   lie, exactly like the display's third state. Built as an `IUniversalNumber` ADAPTER (the port
   exists; no new architecture), comparisons surfaced in the TriBoolean project where `Tri` lives.

SoftValue stays distinct (a third register): radius is a BOUND (hard, propagated), confidence is
a BELIEF (soft, Bayesian) — shape-softvalue vs shape-triboolean's edge line says the same split.

## Pointers

- UniversalNumber.fs (the port; bigint adapter live) · Core.FSharp.TriBoolean/Float.fs (register 1)
- 081KTSZN10008QG0R003PHDV1C (the ball adapter) · db/shapes/cartridges/triboolean.lines (the display's third state,
  now drawn — wish-list item 1 landed)
