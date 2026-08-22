# `db/tradition-density/` — the iterated tradition-density ledger

`ledger.jsonl` is an **append-only** record of a game that is meant to run indefinitely.

Each line is one iteration: a tradition drawn at random from an externally maintained corpus,
and what — specifically, by name — it connected to in this repo. A draw that connected to
nothing is recorded as a `null` with a stated reason. **The nulls are data**; they are the
denominator, and without them a corpus of pure noise would report universal connection.

## Why the probe exists

Our anchor set is citation-shoppable: we pick the traditions, so we pick the ones we already
know connect. Random draws from a corpus nobody here maintains removes that. The obvious
objection is that an LLM asked *"does tradition X connect to Zeta?"* will find something for
any X — which makes any single draw uninformative.

Aaron 2026-08-17 supplies the answer, and it is the design:

> *"this is the single request/response failure — iterated density connections over time is
> how you find the weak connections over the dense ones in an infinite iterated game"*

> *"for Zeta we are trying to map all coincidence space so it WILL connect, but it should not
> deeply — just in certain specialisations. Most will not be general connections. This is hub
> and agent … and also Kevin Bacon six degrees, scale free — everyone connects, but only a few
> do with deep connections, most are shallow"*

A pattern-matcher can manufacture *a* connection for any single draw. It cannot make the
**same** connection recur across independent draws unless there is real structure. So density
over iterations is the signal, and **iteration is the falsifier** — pre-registration is not
needed.

## The one invariant that must never slip

**Depth = recurrence across distinct drawn traditions. Depth is never a self-report.**

`selfReportedDepth` is captured on every target and is *never* read by the density fold. It is
the **fame** metric — and `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`
records why fame must not rank: Kevin Bacon is not the most connected actor, he is famous
because of the game. *"The named hub and the actual hub are different nodes. Appointment tracks
fame; emergence tracks use."* The report prints the two rankings side by side (Kendall tau) so
the gap is visible rather than assumed.

## Playing

```bash
# 1. the draw sheet — regenerable by anyone holding the seed, BEFORE any connecting happens
bun src/Core.TypeScript/tradition-density/probe.ts draw --seed 20260817 --draws 14

# 2. answer every line (a JSON array of ledger entries); nulls included, or the sample is not a sample
bun src/Core.TypeScript/tradition-density/probe.ts record --seed 20260817 --submissions answers.json

# 3. the distribution — no verdict attached
bun src/Core.TypeScript/tradition-density/probe.ts report
```

`record` refuses an entry whose tradition is not the one the seed drew at that iteration, whose
target does not resolve to a real path, or whose key is already present with different content.
A revision is never applied; the honest recourse is a fresh iteration.

## Reading the distribution

| observation | reading |
|---|---|
| near-universal connection with **power-law** depth | **expected** — the space is scale-free (Barabási–Albert 1999) |
| depth **uniform** across targets | **vacuity** — the framework does not discriminate |
| everything depth-1, no dense targets | no real structure found yet |

The report attaches **no threshold and no verdict**, on the same reasoning as
`src/Core.TypeScript/chip9/consult-census.ts`: "how uniform is too uniform" has no defensible
constant, and inventing one would smuggle in exactly the hidden oracle this probe exists to
expose.

## The seeding run (2026-08-17, seed 20260817, 14 draws)

The first 14 lines. Sample size 14 supports **nothing** on its own — it is a demonstration that
the instrument runs end to end, and the first 14 points of a game meant to run long. Its one
suggestive feature is that both depth-2 targets carry **zero** self-reported "deep" marks while
every self-reported deep target sits at depth 1, i.e. fame and use pointed in opposite
directions from the first handful of draws. Cost and campaign size are Aaron's to scale.

## Pointers

- `src/Core.TypeScript/tradition-density/` — corpus, draw, ledger, density, CLI, tests
- `workitems/081M08WYTMY087G0R0006RJ7MW-*` — the work item
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — emergent vs appointed; fame vs use
- `.claude/rules/numerology-vs-number-theory.md` — a coincidence is a generator, never a conclusion; this ledger is where coincidences are stored **with their register**
