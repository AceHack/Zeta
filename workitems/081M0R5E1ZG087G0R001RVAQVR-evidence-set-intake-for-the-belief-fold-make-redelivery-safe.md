---
id: 081M0R5E1ZG087G0R001RVAQVR
type: task
state: backlog
priority: P2
slug: evidence-set-intake-for-the-belief-fold-make-redelivery-safe
title: "Evidence-set intake for the belief fold: make redelivery safety structural instead of a caller obligation"
created: 2026-08-23T20:36:45.168Z
depends_on: []
composes_with: []
---

# Evidence-set intake for the belief fold: make redelivery safety structural instead of a caller obligation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R5E1ZG087G0R001RVAQVR-*.md` glob. -->

**Origin.** Aaron, 2026-08-23: *"we preserve uncertainty with Bayesian inference, we never collapse,
and we also have ECC to correct missed messages with adinkras … Please verify me correct — **if not,
we need to work towards this.**"* Verification is `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §13. This item is the "if not" half.

## The gap, stated exactly

Two parts of the claim are shipped and metered: the belief fold genuinely never collapses (no
argmax; unnormalized distribution retained), and the Adinkra `[8,4,4]` erasure code genuinely
recovers dropped packets (`src/Core.TypeScript/discovery/udp-lossy-transport.ts`, chaos-tested).

**What is not true is that they are connected.** The ECC protects **packets**. Nothing protects the
**fold**. `src/Core/BeliefConvergence.fs` references `AdinkraCode` only for the
Hadamard/MacWilliams duality — a mathematical bridge, not error correction — and states in its own
docstring that the fold's guard against duplication is a **caller-supplied dedup key**:

> *"the evidence must be DEDUPLICATED before it gets here … redelivery double-counts … The dedup key
> must be supplied by the caller; the operator's algebra does not provide one, and no fold over a
> non-idempotent operator can."*

So a packet the ECC recovered is then folded by a non-idempotent operator, and a duplicate arriving
by any other route is still double-counted. Over Reticulum — store-and-forward with opportunistic
retransmit — **redelivery is the ordinary case, not the exception.**

## Why the fix cannot be a better operator

The same file carries the theorem that closes that door:

> *"An idempotent group is trivial — `a + a = a ⇒ a = e` — so a single operator cannot be both
> redelivery-safe and retraction-capable."*

`observe` is pointwise multiplication: commutative, associative, **not idempotent**. It cannot be
made idempotent while remaining retraction-capable. **Do not attempt to fix the operator.**

## The change: fold a set, not a list

Put a **G-Set of uniquely-tagged evidence** in front of the fold. Merge evidence by **set union** —
idempotent, commutative, associative, hence monotone, hence **coordination-free by CALM** (Ameloot,
Neven & Van den Bussche, JACM 2013, in its lattice form) — and fold the resulting *set* into the
belief. This is the free construction of §12 T2 and the `OrSet` pattern already in
`src/Core/Crdt.fs`; nothing new is invented.

What it buys, all four at once:

1. **Redelivery safety becomes structural**, not a caller obligation the type system cannot check.
2. **Order independence at intake**, matching the order-independence `observe` already has.
3. **Out-of-order −1s become evidence rather than removal** — a retraction is a *new tagged element*,
   so the both-held reading of `anti-babel-preserve-reconcilability` becomes true of the belief lane
   and not only of the delta log.
4. **The monotone object becomes the retained object**, which is what would actually put the belief
   lane on CALM's coordination-free side. §13.2 measured that it currently is not.

## The cost, named up front

State grows with evidence count — `O(#evidence)` instead of `O(#candidates)` (measured in
`docs/research/scripts/2026-08-23-geometry-as-root-pushforward-vs-crdt-verify.py` T3: 500 ops → 500
G-Set entries vs 3 G-Counter entries). **That is presumably why this was not done**, and it makes
the compression question of `081M0R34AZY087G0R001H9N6YS` D5b — when does a tagged-op G-Set compress
to a bounded summary the way a G-Counter does — the load-bearing prerequisite rather than a
curiosity.

## Smallest shippable slice

An `EvidenceSet` carrying `(tag, likelihood)` with union-merge and a `fold` into
`BeliefConvergence.observeAll`, **plus the falsifier first**: the same tagged evidence delivered
twice leaves the belief unchanged. **That test fails today**, and its failure is the honest measure
of the gap — write it before the fix so the fix is earned rather than asserted.

## Also worth deciding, and separable

`observe` is `Array.map2 (*)` over a **fixed** candidate set, so the hypothesis space is closed at
construction and a candidate driven to weight `0` can never return (`0 × l = 0` absorbs). That is a
second, different kind of "collapse" from the one Aaron's claim is about, and for an open-world
naming registry it is the binding limitation. **Not in this item's scope** — recorded so it is not
discovered twice.

## Register

`aspirational` — the design is derived, nothing is built. Do not describe the belief lane as
redelivery-safe until the falsifier above passes.
