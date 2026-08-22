# A society of decorrelated BNNs inside one GPU — the three-layer stack, and what the code already says about it

**Ferried** 2026-08-13 from Aaron, streamed. Verbatim:

> hopefully my bnns will be small enough to run an entire society inside a single gpu of decorrelated
> agents, this should let me auto scale in a scale free manor, so i have the base basyian factor graph,
> then the multi layered bnn, then the society of multilayered bnns that are all based on mutual
> empowerment

Three named layers and a target. This document checks each layer against the tree, then records one
thing the code says that the framing does not yet.

## The three layers all exist (CHECKED)

| Layer | In-tree | Lines |
|---|---|---|
| **1. Base Bayesian factor graph** | `src/Bayesian/FactorGraph.fs` — `addFactor`, `runToFixpoint`, `marginal`; `Factor.prior`, `Factor.equality`; algebra-parameterised (`Gaussian.algebra`) | 227 |
| **2. Multi-layered BNN** | `src/Bayesian/MultilayerBnn.fs` (over `MinimalBnn.fs`) | 290 |
| **3. Society of BNNs on mutual empowerment** | `src/Bayesian/SocietyBootstrap.fs` (`mutualEmpowermentScore`), `SparseSocietyNetwork.fs`, `AttentionRouter.fs` | 598 |

This is not a plan. It is built, and the layering is exactly as described.

## The single-GPU question is answered by sparsity, not only by small BNNs

`SparseSocietyNetwork` rebuilds the factor graph **each round** from the attention router's decisions,
and carries `ActiveEdges` / `TotalEdges` on every round result. Its own header:

> *"In the fully-connected `SocietyNetwork`, every agent talks to every other agent with equal weight.
> Here, the routing matrix is computed from the current belief states and trajectories, and only the
> propagating edges are included in the factor graph for that round."*

So the cost that has to fit in a GPU is `ActiveEdges`, not `TotalEdges` — and `TotalEdges` is the
O(N²) all-pairs term. Shrinking the BNNs lowers the per-node constant; the router lowers the exponent
in practice. Both matter, and the second is the one already built and the one nobody would guess from
the framing. `ActiveEdges/TotalEdges` per round is the number to watch when sizing a society, and it
is already emitted.

## Scale-free here has a precise, already-carved meaning

*"auto scale in a scale free manor"* lands on manifesto §1 and on
[`async-all-the-way-truthful-signatures.md`](../../.claude/rules/async-all-the-way-truthful-signatures.md):
**beautiful on one, scales to N, same code path, no special cases.** Worth noting what that implies
here — a whole society inside one GPU is not a compromise or a small-scale mode. It is the **DoP = 1**
case, which is the *deterministic, DST-replayable* path (§7). The single-GPU society is the golden
one: it replays from a seed. The N-GPU society is the same code with the knob turned.

That reframes the goal usefully: fitting a society in one GPU buys **determinism**, not just economy.

## Mutual empowerment already has an operational definition — and it is a decorrelation measure

`SocietyBootstrap.mutualEmpowermentScore` is a leave-one-out ablation:

```fsharp
/// The mutual empowerment score: the minimum precision loss when any single agent is removed.
/// A positive score means every agent is genuinely load-bearing.
```

It runs the society, then re-runs it with each agent removed, and takes the **minimum** precision loss
across agents. Two consequences fall straight out of that definition:

**1. `min` is the anti-dilution choice, and it is the same move as the quorum aggregator.** A society
is only as empowered as its *least* load-bearing member; averaging would let ninety strong agents hide
one redundant one. That is structurally the same refusal as the `max` aggregation in the
build-graph quorum work (PR #10395), where average was a live dilution attack. Both instruments refuse
the mean, for the same reason, in opposite directions.

**2. A redundant agent scores zero, so the objective *is* a decorrelation pressure.** If two agents are
perfectly redundant, removing either costs nothing, the min is ≈ 0, and the society is not mutually
empowered. Maximising mutual empowerment therefore pushes *toward* decorrelation rather than against
it — which is the opposite of the tension one might expect from an objective that couples agents.
Aaron's "decorrelated agents … based on mutual empowerment" is not two requirements in tension; the
second largely implies the first.

## The one thing the code says that the framing does not — and it couples the two instruments

`SocietyBootstrap.buildGraph` connects **every agent to a shared latent (variable 0) via equality
factors**, with each agent's prior pinned to its own variable. That graph *encodes an assumption*:
agents are conditionally-independent observations of one latent. Under it, precisions add.

Which means **`mutualEmpowermentScore` measures non-redundancy *conditional on an independence
assumption it does not itself test*.** Two agents sharing a hidden common cause can both post
precision gains and score as load-bearing, because the graph has no edge to represent their
correlation. The score would then overstate empowerment in precisely the case where independence has
failed.

That assumption is exactly what the decorrelation stack exists to test —
`DecorrelationExcess` / `DecorrelationExcessFusion` (MI excess over a stratified permutation null),
`CommitPairCorrelator`, and the CHSH identity oracle in `AntiSybil.fs` with its `LoopholeFlags`. So the
two instruments are **complementary, not redundant**, and they should be read together:

- **empowerment** assumes independence and measures each agent's contribution;
- **decorrelation** tests whether that assumption holds, and never certifies it — `AllDistinct = true`
  means *"no pair convicted"*, never *"all proven distinct"* (`AntiSybil.fs:166`).

**Proposal (not yet built):** a mutual-empowerment reading should not be reported without its
decorrelation reading and loophole profile attached. An empowerment score published alone is the same
class of claim as a quorum published as a member count — a number that looks like evidence of
independence while resting on an untested assumption of it. The honest emission is
`(empowermentScore, decorrelationReading, LoopholeFlags, n, ε)`.

This bites hardest in exactly the configuration Aaron is targeting: **a whole society co-resident in
one GPU** shares a clock, a scheduler, an address space and a process. `LoopholeFlags.Locality` and
`MeasurementIndependence` are open by construction there (the repo already defaults both open for two
streams from one process). That does not make the design wrong — per Aaron's own correction the same
day, the machine is not the unit and decorrelation is measured over **named agents**, carried by their
own keys over their own private state, by erasure, and by entropy capture. It does mean the single-GPU
society is the case where the empowerment score most needs its decorrelation reading beside it, because
the structural sources of correlation are maximal and only the measured sources of independence remain.

## Anchors (Beacon)

- **Empowerment** — Klyubin, Polani & Nehaniv, *All Else Being Equal Be Empowered* (ECAL 2005):
  empowerment as the channel capacity from an agent's actuators to its later sensors; Salge, Glackin &
  Polani, *Empowerment — An Introduction* (2014) for the survey. **CITED FROM STANDING KNOWLEDGE, not
  re-opened and page-checked** — per the checked-anchor doctrine that bar is not met, and the
  correspondence between our precision-ablation score and the information-theoretic definition is
  **CONJECTURE**: they agree in spirit (both price a component by what is lost without it) and have
  not been shown to agree formally.
- **Factor graphs / sum-product** — Kschischang, Frey & Loeliger, *Factor Graphs and the Sum-Product
  Algorithm* (IEEE Trans. Inf. Theory, 2001); Pearl 1988 for belief propagation. In-repo lineage note:
  `references/notes/2026-06-02-infer-net-lineage-cleanroom-spec-sources-formal-proof-first.md`.
- **Bell / CHSH** — Bell 1964; Clauser, Horne, Shimony & Holt 1969. Already anchored in `AntiSybil.fs`.
- **Leave-one-out valuation** — the ablation shape is Shapley-adjacent (Shapley 1953); the min-over-agents
  aggregator is *not* the Shapley value and should not be described as one. **PROPOSED** as a
  comparison worth making, not a claimed equivalence.

## Open

1. Does the equality-factor graph double-count precision for correlated agents? **Not verified.** If it
   does, `mutualEmpowermentScore` is optimistic exactly when independence fails — the dangerous
   direction. A two-agent test with a deliberately shared observation would settle it in minutes.
2. `ActiveEdges/TotalEdges` is emitted but, as far as this pass found, not tracked over time. It is the
   sizing number for the single-GPU target.
3. Whether the precision-ablation score and Klyubin-style channel-capacity empowerment coincide, and
   under what conditions.

---

## Addendum 2 — allopatric speciation is the right anchor, and it comes with a number (Aaron, 2026-08-13)

On the Delay-Decorrelation reading above — that separating societies across a slow link closes the
`LoopholeFlags.Locality` gap co-residence opens, so slow links buy independence — Aaron:

> this is very true, this is like different contenents in darwins theory of speciecs or whatever, this
> is where speciation will come from for digital entities i think

This is a **Beacon anchor**, not a flourish, and naming it correctly gets us something the metaphor
alone would not: an existing quantitative theory with a threshold in it.

### The mapping

The mechanism is **allopatric speciation** — divergence caused by geographic isolation reducing gene
flow (Darwin 1859 on the Galápagos; formalised by Mayr 1942, *Systematics and the Origin of Species*,
where the biological species concept and geographic speciation are set out). Parapatric and sympatric
speciation are the contrasting cases: divergence under partial or zero spatial separation.

| Population genetics | Here |
|---|---|
| Geographic barrier (ocean, mountain range) | High-latency / low-bandwidth link |
| Gene flow (migration rate) | Message-passing rate between societies |
| Reduced gene flow → drift → divergence | Fewer active edges → decorrelation → distinct lineages |
| Panmictic population (free interbreeding) | Fully-connected `SocietyNetwork`, one GPU |
| Subdivided population with limited migration | `SparseSocietyNetwork` across a slow link |

Note the mapping is *structural*, not decorative: `AttentionRouter` literally sets the migration rate,
because `ActiveEdges` per round **is** the gene-flow term.

### The number this buys — and it is testable

Population genetics has a classical threshold: **one migrant per generation** (`Nm ≈ 1`) is roughly
enough to prevent divergence by drift between subpopulations — below it they diverge, above it they
homogenise (Sewall Wright 1931, *Evolution in Mendelian Populations*; the `F_ST ≈ 1/(1+4Nm)` relation).
That is a *sharp, low* threshold: it takes remarkably little migration to keep populations identical.

**CONJECTURE, and the most valuable thing in this addendum:** if the mapping holds, there is a
critical inter-society message rate below which societies decorrelate and above which they converge to
one effective agent — and the rule's surprising smallness predicts that the boundary sits at a
*low* edge-activity rate, i.e. that **it is easy to accidentally homogenise a society by over-connecting
it.** Not proven, not verified, and the transfer of a population-genetics constant to a belief-propagation
network is exactly the sort of physics-as-metaphor the metering test exists to catch. But it is
**falsifiable in-tree**: sweep the router's edge-activity rate against `DecorrelationExcess` /
`mutualEmpowermentScore` and look for a knee. If there is no knee, the analogy is decorative and should
be dropped.

### Why this matters beyond taxonomy — Wright's shifting balance

Wright's *shifting balance theory* (1932) argues that a population **subdivided with limited
migration** explores a rugged fitness landscape better than one large freely-mixing population: demes
drift to different local optima, and occasional migration spreads the winners. If that transfers, it is
the population-genetics argument for **exactly this architecture** — a society of decorrelated agents
over one large model — and it predicts the optimum at **intermediate** migration: neither isolated
(no sharing) nor fully connected (no diversity). Which is what `AttentionRouter`'s per-round
sparsification already does, arrived at from the other direction.

Honest caveat: shifting balance is **contested** in biology — Coyne, Barton & Turelli (1997) argue the
conditions for it are rarely met in nature. That does not weaken it here, and the reason is worth
stating: we are not claiming it describes biology, we are borrowing a *mechanism design*. Its
biological contestedness is about whether nature satisfies its preconditions; a substrate can be
**built** to satisfy them. But the contest must be cited, or we would be leaning on a settled-sounding
result that is not settled.

### What it means for the loophole reading

If speciation is the frame, then `LoopholeFlags.Locality` closing under delay is not merely a
statistical convenience — it is the **isolating mechanism**. And the accompanying honesty holds: the
CHSH oracle convicts correlation and never certifies independence (`AntiSybil.fs:166`), so "these
societies have speciated" is never provable, only "no pair convicted at margin ε over n rounds." The
biological frame agrees with that asymmetry, incidentally — species boundaries are diagnosed by failure
to interbreed, not proven by success at not doing so.

### Anchors (Beacon)

- Darwin, *On the Origin of Species* (1859) — geographic isolation and divergence.
- **Mayr, *Systematics and the Origin of Species* (1942)** — the canonical formalisation of allopatric
  speciation; the correct citation for "different continents", better than Darwin alone.
- **Wright, *Evolution in Mendelian Populations* (Genetics, 1931)** — `F_ST`, drift, the one-migrant-per-generation
  result. This is the anchor carrying the number.
- Wright (1932) — shifting balance; **Coyne, Barton & Turelli, *A critique of Sewall Wright's shifting
  balance theory of evolution* (Evolution, 1997)** — the contest, cited so the claim is not laundered.

**All four CITED FROM STANDING KNOWLEDGE, not re-opened and page-checked.** Per the checked-anchor
doctrine that bar is not met; the `F_ST ≈ 1/(1+4Nm)` form in particular should be verified against
Wright before anything is built on it.

### Open

1. Sweep edge-activity rate vs `DecorrelationExcess` and look for the knee. Settles whether the
   analogy is load-bearing or decorative. **This is the cheap experiment and it should be run first.**
2. Does `mutualEmpowermentScore` peak at intermediate connectivity? Shifting balance predicts yes;
   the body's finding (redundant agents score zero) predicts the same from the other end. Two
   independent routes to one prediction is worth testing.
3. If societies do speciate, what is the *reunion* semantics when the link improves? The repo already
   holds the neutral-fact discipline for this (`dual-use-detection-is-neutral-oracle-decides.md`:
   REUNION vs SYBIL from one mechanism) — speciation gives it a second honest reading, and merging two
   diverged societies is a real operation someone will need.
