# Heat signals distinguish recoverability, not pruning mechanism

**Status:** Accepted
**Date:** 2026-08-14
**Owners:** Vera and Aaron

## Context

A complexity bound can omit a predicted branch in two materially different
ways. The branch may remain derivable from retained input and become available
after widening the bound, or the system may destroy the only information from
which it could be reconstructed. The first is admission pressure. The second is
information loss.

The existing heat vocabulary already expresses that distinction:
`Backpressure` is recoverable pressure and `Forgotten` is unrecoverable loss.
Adding a `Pruned` case would instead classify the implementation mechanism, even
though pruning can produce either outcome.

The WSet erasure law pack also establishes that the operation named by a
feature is not enough to infer heat. `WSet.negate` is reversible and erases zero
bits. `WSet.consolidate` is non-injective and erases information over the
committed finite reference domain. A meter attached to negation would therefore
remain zero by construction.

## Decision

No `HeatSignal` case is added for complexity-bound pruning.

- A policy-bound omission that can be regenerated from retained input is
  `Backpressure`, or cold when nothing observable was lost and no admission was
  refused.
- Destruction of information with no retained reconstruction input is
  `Forgotten`.
- Reversible operations emit no heat.
- WSet reference masses are explicitly labelled finite-reference-domain maxima.
  They classify operation shape and are not per-input physical-dissipation
  measurements.

Canonical kind examples are pinned in
`src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json`:
`prediction.complexity-bound.backpressure` and
`wset.consolidate.forgotten`.

## Consequences

Callers must answer a concrete reconstruction question before choosing a heat
signal: does sufficient retained input exist to reproduce the omitted value?
This avoids cross-language treaty churn and keeps the public alphabet focused on
observable consequences.

The temperature treaty must also prove every declared band reachable from at
least one committed vector. Merely listing cases is insufficient because a
classifier can otherwise make a band dead while the vocabulary test remains
green.

If a future consumer needs to distinguish pruning algorithms, that belongs in
structured diagnostic detail or a separate policy event. It does not change the
recoverability class.
