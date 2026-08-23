---
id: 081M0Q8TY1B087G0R0008CYZJ3
type: bug
state: backlog
priority: P1
slug: zetadb-convergence-fails-under-binding-admission-budgets-ter
title: "ZetaDB convergence fails under binding admission budgets: terminal replica divergence"
created: 2026-08-23T12:16:58.411Z
depends_on: []
composes_with: []
---

# ZetaDB convergence fails under binding admission budgets: terminal replica divergence

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q8TY1B087G0R0008CYZJ3-*.md` glob. -->

## The finding (Soraya, 2026-08-22 — recorded here, deliberately NOT fixed)

The ZetaDB semilattice convergence law holds **only while the admission budgets are
slack**. Once a budget binds, the same union of deltas in opposite arrival order leaves
two replicas in states neither of which is a superset of the other.

Witnessed with `maxEntries: 3`:

```
A then B -> ["e1","e2","e3"]
B then A -> ["e1","e3","e4"]     commutative? false
```

The divergence is **terminal**: the ledger is full, so no retry recovers `e2` or `e4`.
That is permanent silent replica divergence, not eventual consistency.

## Why it is not fixed here

It is a design decision about budget semantics — what a no-forget ledger should do when
it is full — not a defect with an obvious correct patch. Candidate directions all trade
something real: refuse the whole tick (availability), evict (breaks no-forget), or make
admission a deterministic function of the delta set rather than arrival order (changes
what "budget" means).

## Where it is pinned

`src/Core.TypeScript/zetadb/zeta-db-node.property.test.ts`:

- **PERM-A / PERM-B** state permutation invariance **conditioned on slack budgets**, and
  count the budget-binding cases they skip. The counts are asserted with a hard minimum,
  so the precondition is proved to be doing real work rather than silently accepting
  everything — a generator that only ever produced slack budgets would pass having
  checked nothing.
- **BIND** carries the deterministic witness above.

So the boundary of the convergence claim is now visible in the test output instead of
being an unstated assumption.
