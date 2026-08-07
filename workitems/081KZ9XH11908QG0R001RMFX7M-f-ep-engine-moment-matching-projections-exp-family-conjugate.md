---
id: 081KZ9XH11908QG0R001RMFX7M
type: task
state: backlog
priority: P1
slug: f-ep-engine-moment-matching-projections-exp-family-conjugate
title: "F# EP engine: moment-matching projections + exp-family conjugate updates over the DBSP semiring (Infer.NET rewrite slice)"
created: 2026-08-05T21:33:30.025Z
depends_on: []
composes_with: ["081KT2T2J0008QG0R000S7GHQ8"]
---

# F# EP engine: moment-matching projections + exp-family conjugate updates over the DBSP semiring (Infer.NET rewrite slice)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZ9XH11908QG0R001RMFX7M-*.md` glob. -->

**Assigned: Lior** — Aaron 2026-08-05 ("assign Lior option 1, split the EP/VMP falsifier").
**Composes with** the Infer.NET F# rewrite umbrella `081KT2T2J0008QG0R000S7GHQ8` (this is a slice of it,
not a new engine). **Files:** `src/Bayesian/FactorGraph.fs`, `src/Bayesian/Ep.fs`, `src/Bayesian/Message.fs`
(+ a new VMP path — see falsifier B; no VMP module exists yet).

## Design context — this is the core of a LIVE production system (Aaron, 2026-08-06/07)

Aaron confirmed directly that this EP/BP factor-graph engine is **not academic** — it is the core of his
shipping "mutual empowerment" AI, and it has real downstream consumers, so build it as load-bearing:

- **The system IS a Bayesian factor graph + EP/BP** ("our own version of Infer.NET, expectation propagation,
  belief propagation"), currently with a neural net on top, to be layered. **F# core + Q# in this repo**, and
  it has already been through **many rounds of formal analysis with the math team** (Soraya / BP-16; Lumen).
- **Primary downstream consumer — "TrueSkill for AIs":** *"for every job the AI does, I give that AI a true
  skill ranking for how well it does the position."* That is **TrueSkill** (Herbrich–Minka–Graepel 2007) — a
  Bayesian skill rating built on exactly this factor-graph/EP substrate. So the exp-family/conjugate `project`
  step this slice adds is what the AI-ranking layer runs on. It also composes with the **decorrelation-excess /
  anti-Sybil trust substrate** (`081KZ7H82J708QG0R002C1EBH1`) — same trust/ranking economy.
- **The product on top:** an "AI price oracle for DevOps" (rank *relativity* between AIs — Multi-Oracle — while
  the market sets absolute price; rank paid + free; meter the real electricity cost of "free").
- Provenance / the human-vernacular statement of the whole thing:
  `docs/books/you-born-at-the-hinge/RAW-restraint-the-felonies-the-cops-and-the-mutual-empowerment-math.md`
  (Threads 4/4b). Recorded per Aaron's standing authorization to add composes-with / workitem cleanups.

## Goal

Extend the F# Infer.NET rewrite engine with **moment-matching Expectation Propagation (EP) projections**
and **exponential-family conjugate updates** over the DBSP semiring substrate. Per `Ep.fs`, EP is **not a
new engine — it is a new factor type**: an EP factor's `ComputeMessages` runs cavity → tilt → project →
divide, driven by the existing `FactorGraph.runToFixpoint`. The `Message` algebra already gives the
group structure (product = natural-parameter add; divide = subtract → the EP cavity). This slice adds the
**project** step (moment-match the tilted distribution back to the exp-family) and the conjugate-update
closed forms for the standard families.

## Falsifiers (SPLIT — the load-bearing correction, Aaron 2026-08-05)

The two properties test **two different algorithms** and must NOT be conflated onto EP:

**A. Sum-product exactness on TREE graphs → the EP / exact-BP path.**
On a tree with conjugate factors, EP reduces to exact belief propagation (`Ep.fs`: "On a tree with
conjugate factors EP = exact BP"). FsCheck property: for a randomly-generated **tree** factor graph with
conjugate (exp-family) factors, the message-passing marginals equal the exact marginals (brute-force /
closed-form) to tolerance. This is the correct EP correctness oracle.

**B. ELBO monotonicity → the VMP path ONLY, NOT EP.**
Variational Message Passing (Winn & Bishop 2005) monotonically **increases a proper ELBO lower bound**
each update — that is a real convergence guarantee and a valid FsCheck property (ELBO non-decreasing
across sweeps). **EP has no such guarantee:** the EP free energy is *not* a bound, EP updates can increase
it, and EP is not guaranteed to converge (Minka 2001). Asserting "ELBO monotonicity for EP" would pass
for the wrong reason or fail spuriously — it tests VMP. So: **build/scope the VMP path and attach the
ELBO-monotonicity property to it**, keep it off the EP path.

**EP's own convergence oracle (use instead of ELBO for EP):** moment-match accuracy vs numerical
quadrature at a fixed point (`Ep.fs` already cross-checks the probit site against quadrature — extend this
pattern), and/or marginal/moment consistency at the EP fixed point. Do not borrow B for EP.

## Definition of done

- Moment-matching `project` for the standard exp-family sites + conjugate closed-form updates, in
  `Ep.fs`/`Message.fs`, DST-deterministic (seeded, no ambient entropy) and byte-lockable per the four-oracle
  discipline.
- Falsifier A (tree sum-product exactness) as an FsCheck property — green.
- Falsifier B (ELBO monotonicity) attached to the **VMP** path — green; explicitly NOT asserted on EP.
- EP fixed-point accuracy cross-checked against quadrature (the correct EP oracle).
- `dotnet build -c Release` 0/0; `dotnet test` green. Anchors cited (Minka 2001 EP; Winn & Bishop 2005 VMP;
  Kschischang–Frey–Loeliger 2001 sum-product; Rasmussen & Williams GPML §3.6 for the probit site).

## Why the split matters (the catch that prompted it)

The original Option-1 brief paired "EP" with "ELBO monotonicity for variational message passing" in one
falsifier line. EP and VMP are different algorithms with different guarantees; ELBO-monotonicity is VMP's,
not EP's. Splitting the falsifier keeps each property testing the algorithm that actually has the guarantee
— otherwise the suite green-lights for the wrong reason (the silent-false-pass failure mode).
