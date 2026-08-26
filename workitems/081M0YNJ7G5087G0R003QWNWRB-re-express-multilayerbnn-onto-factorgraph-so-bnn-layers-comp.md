---
id: 081M0YNJ7G5087G0R003QWNWRB
type: task
state: backlog
priority: P2
slug: re-express-multilayerbnn-onto-factorgraph-so-bnn-layers-comp
title: "Re-express MultilayerBnn onto FactorGraph so BNN layers compose as a DAG, not a chain"
created: 2026-08-26T09:14:05.701Z
depends_on: []
composes_with: []
---

# Re-express MultilayerBnn onto FactorGraph so BNN layers compose as a DAG, not a chain

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix -- resolve cross-refs by `081M0YNJ7G5087G0R003QWNWRB-*.md` glob. -->

## Why

Aaron 2026-08-26: *"instead of having pure traditional BNN layers we allow multiple layers
to compose under higher layers so it's more of a graph/dag rather than linear chain. I'm
hoping capabilities can be swapped in eventually by composing different BNN layers together
for the given task/game."*

**The DAG engine already exists one layer down and `MultilayerBnn` does not use it.**

| module | topology | lines |
|---|---|---|
| `src/Bayesian/FactorGraph.fs` | **arbitrary**, generic over `IMessage<'M>` | 227 |
| `src/Bayesian/MultilayerBnn.fs` | `Sequential` \| `SkipConnections of (int*int) list` | 370 |

`MultilayerBnn`'s own docstring already names the gap and the fix:

> *"Under `SkipConnections` the graph is loopy: the forward sweep carries skip evidence but
> the backward sweep sends downward messages only along the sequential links, so the result
> is a first-order approximation rather than the exact marginal.
> `FactorGraph.runToFixpointDamped` is the upgrade path."*

So this is not new architecture. It is re-expressing a hand-rolled two-sweep chain onto a
general sum-product engine that is already in the tree and already generic in the message
algebra.

## Not blocked by the Clifford hold

`081M0R18878087G0R001XY5A2J` holds Clifford-GPU work. Nothing in this row touches Clifford:
it is topology and message scheduling over the existing Gaussian algebra.

## Acceptance criteria

- `MultilayerBnn` accepts an arbitrary parent set per layer, not `i-1` plus skips.
- Under a `Sequential` topology the result is **byte-identical** to the current two-sweep
  smoother -- the chain is a tree, sum-product is exact on it, so a correct generalisation
  cannot move those numbers. This is the falsifier that distinguishes a real generalisation
  from a rewrite that quietly changed the model.
- Under a loopy topology the fixpoint result differs from the current first-order
  approximation, and a test *names the difference* rather than asserting convergence.
- Idempotency (discipline #6) preserved: re-running a sweep does not re-count evidence.

## Pointers

- `docs/research/2026-08-26-cga-is-m2-of-the-in-tree-clifford-q4-answered-*.md` SS4 -- the survey
- `src/Bayesian/ThousandBrains.fs` -- the natural consumer of a DAG topology
