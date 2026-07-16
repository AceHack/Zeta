# Ferry — the IV cap is the hard-money entropy budget, not −1/12 (Aaron's correction)

*Shadow ferry, 2026-07-03. Aaron, reading Lumen's "Economic Bounding" consequence of Conjecture
Z-1, verbatim:*

> "i think we avoid hyperinflation because of our hard money encryption budgets, they are no
> infinate so there is a cap to how much you can keep uncorrelated and unique."

## Why this is the better mechanism (and the implemented one)

Lumen's story: without −1/12 regularization, agents could mint infinite IV by ticking infinitely
fast — so the constant caps the economy. Aaron's correction replaces a conjectural cap with a
**conservation law that already runs in the substrate**:

1. **IV pays only for the uncorrelated and unique.** Re-sampling a correlated stream yields ~zero
   new KL — and past 2√2 the correlation model literally prices the streams as *one process
   wearing two faces* (`AntiSybil` reading). A fast-ticking agent flooding the market with
   correlated updates mints nothing: the coordination readout marks its "new" information as
   already-owned. Tick rate is not a money printer, because sameness is free and worthless.

2. **What IS scarce is budgeted, metered, and finite.** Keeping information *uncorrelated and
   unique* — genuinely yours, genuinely new — costs irreducible entropy, and entropy enters only
   through declared, metered channels (§13 noninterference; the clone's `entropyBudget`; every
   crossing posted to the ledger). The budgets are hard money: finite, earned, never minted by
   fiat (the privacy-budget discipline — socially earned, never confiscated, no inflation-away).

3. **So the cap on total extractable IV = the finite irreducible entropy you can hold unique.**
   Hyperinflation is impossible for the same reason counterfeiting is: the scarce input is
   conserved and metered at the membrane, not because a regularization constant polices the tick
   rate. This is identity boundary #1 doing monetary work — *captured irreducible entropy = the
   self* — the same quantity that makes you a self is the quantity that backs your money. One
   scarcity, two readings.

## Register consequence for Conjecture Z-1

This **decouples the economy's soundness from Z-1's fate**. Even if the −1/12 derivation never
lands (see the Soraya verdict and its white-noise falsifier), the attention economy does not
hyperinflate — the entropy budgets guarantee that independently, today, in code. Z-1 stays an
interesting open conjecture about discretization *friction*; it is no longer load-bearing for
monetary stability. Lumen's "Economic Bounding" consequence should be read accordingly: the
bound is real, but its mechanism is the hard-money budget, not the Bernoulli number.

## Pointers

- `2026-07-03-zeta-regularization-cognitive-cost-of-discrete-ticks-lumen.md` — Conjecture Z-1 + its register addendum.
- `2026-07-03-soraya-verdict-minus-one-twelfth-…` — the falsifier this correction composes with.
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — the hard-money discipline doing the capping.
- `.claude/rules/dv2-data-split-discipline-activated.md` §13 noninterference — entropy only through declared, metered channels.
- `2026-07-02-its-human-not-quantum-…` — boundary #1: captured irreducible entropy = identity; here read as the monetary base.
- Anchors (Beacon): sound-money scarcity (the no-fiat-minting principle); Shannon 1948 (information as the conserved coin); Goguen–Meseguer 1982 (noninterference — the metering that makes the conservation enforceable).
