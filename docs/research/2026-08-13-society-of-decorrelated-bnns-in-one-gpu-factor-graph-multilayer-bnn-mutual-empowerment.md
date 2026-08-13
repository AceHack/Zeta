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
