---
id: 081M08WYTMY087G0R0006RJ7MW
type: task
state: backlog
priority: P2
slug: iterated-tradition-density-probe-externally-drawn-msc2020-tr
title: "Iterated tradition-density probe: externally-drawn MSC2020 traditions, append-only ledger, recurrence-not-self-report depth"
created: 2026-08-17T22:20:01.054Z
depends_on: []
composes_with: []
---

# Iterated tradition-density probe: externally-drawn MSC2020 traditions, append-only ledger, recurrence-not-self-report depth

## The problem

Our anchor set is citation-shoppable: we choose the traditions we compare Zeta against, so we
choose the ones we already know connect. Random draws from a corpus nobody here maintains
removes that degree of freedom.

The objection to random draws is that an LLM asked _"does tradition X connect to Zeta?"_ will
find something for any X — which makes the probe a confirmation machine and appears to demand
pre-registration.

## The correction that is the design (Aaron 2026-08-17)

> _"this is the single request/response failure — iterated density connections over time is how
> you find the weak connections over the dense ones in an infinite iterated game"_

> _"for Zeta we are trying to map all coincidence space so it WILL connect, but it should not
> deeply — just in certain specialisations. Most will not be general connections. This is hub
> and agent … and also Kevin Bacon six degrees, scale free — everyone connects, but only a few
> do with deep connections, most are shallow"_

A pattern-matcher can manufacture _a_ connection for any single draw. It cannot make the
**same** connection recur across independent draws unless there is real structure. Per-draw
confabulation scatters; genuine coupling lands on the same target repeatedly. **Iteration is
the falsifier**, so pre-registration is not needed.

## Shipped

- `src/Core.TypeScript/tradition-density/msc2020-corpus.ts` — the complete 63-class MSC2020
  top-level list (AMS + zbMATH), vendored whole. Chosen over arXiv categories and ANTLR grammar
  names because those are partitions of _activity_, and a uniform draw over them is weighted by
  popularity — the fame metric wearing a taxonomy's clothes.
- `draw.ts` — seeded, DST-replayable draw with per-iteration independent SplitMix64 substreams
  (so extending a campaign never renumbers answered draws) and Lemire rejection sampling.
- `ledger.ts` — append-only G-Set ledger. Revision under an existing key is refused, not applied.
  Nulls are first-class and carry a stated reason. Targets must resolve to real in-tree paths.
- `density.ts` — the fold. **Depth = distinct drawn traditions that named a target.** The
  self-report is captured and never ranked on. Reports Pielou evenness and a fame-vs-use Kendall
  tau, and attaches **no threshold and no verdict** (same reasoning as
  `src/Core.TypeScript/chip9/consult-census.ts`).
- `probe.ts` — `draw` / `record` / `report`.
- `db/tradition-density/` — the ledger and its README.

## Open

- Campaign size and cost are Aaron's to scale; 14 draws supports nothing on its own.
- A second corpus (a non-mathematical one) would test whether density concentrates on the same
  targets under a different partition of the space. Not started.
