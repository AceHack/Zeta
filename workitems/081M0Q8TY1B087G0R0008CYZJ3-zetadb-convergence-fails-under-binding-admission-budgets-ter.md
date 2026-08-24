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

## Progress 2026-08-24 - the policy boundary is now executable

The current choice is no longer buried in the admission loop. `src/Core.TypeScript/zetadb/admission-policy.ts`
defines an injected `ZetaDbAdmissionPolicyPort`, and `runZetaDbNodeTick` plus
`runConvergentZetaDbNodeTick` execute the supplied policy. The built-in
`noForgetBackpressureAdmissionPolicy` preserves the existing behavior exactly: a candidate that
crosses either the retained-event or checkpoint-byte bound is refused without displacing an
admitted event.

Focused tests pin exact-boundary admission, both typed capacity refusals, custom-policy injection,
and forwarding through the bounded-retry runner. The existing BIND witness remains unchanged and
green as a witness of the known limitation.

This extraction does **not** resolve terminal replica divergence. A policy that promises convergence
while a finite bound is binding must explicitly choose and test one of the costs named above:
coordination/refusal, history displacement with a heat receipt, or a weaker convergence contract.
The no-forget policy cannot provide unbounded, order-independent availability from finite storage.

## Progress 2026-08-24 - hard limits remain kernel facts

The injected policy is advisory inside the caller's hard envelope: it may reserve capacity or
backpressure earlier, but it cannot admit a proposal whose retained-event count or encoded
checkpoint bytes exceed `ZetaDbTickLimits`. The kernel evaluates that ceiling before invoking the
policy, so an always-admit plugin cannot rewrite byte accounting.

The plugin boundary also contains thrown exceptions, unnamed implementations, and malformed
decisions as `database-admission-policy-failed` heat. No policy failure reaches persistence and no
exception escapes the tick API. This closes the safety precondition for experimenting with richer
policies; it still does not change the BIND convergence boundary above.

## Progress 2026-08-24 - reserved headroom has an executable receipt

`createReservedCapacityAdmissionPolicy` now turns fixed retained-event and checkpoint-byte
reservations into a production policy. Reservations are non-negative safe integers, capped at the
caller's hard limit for each proposal, and configuration failures are typed results rather than
exceptions. A reservation can only lower the effective limit; the kernel-owned hard-limit guard
still executes first.

Backpressure from this policy carries structured accounting through `ZetaDbFeedback`: policy ID,
resource, current and candidate amounts, hard and effective limits, and the amount actually
reserved. The kernel validates that receipt against the proposal and rejects inconsistent plugin
accounting as `database-admission-policy-failed` heat. Scheduled runs, browser wakes, and the
browser content-addressed storage adapter can all receive the same owned policy port.

This remains capacity planning, not a fix for terminal replica divergence. It reserves deterministic
headroom without evicting history or making an order-dependent admitted prefix converge.
