---
id: 081KYZPQS8708QG0R00394FR74
type: task
state: backlog
priority: P1
slug: alexa-wire-the-vault-state-bridge-cli-into-the-heartbeat-tic
title: "Alexa: wire the vault-state-bridge CLI into the heartbeat tick + decide the dead eventsByAgent plumbing"
created: 2026-08-01T22:22:27.079Z
depends_on: []
composes_with: []
---

# Alexa: wire the vault-state-bridge CLI into the heartbeat tick + decide the dead eventsByAgent plumbing

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYZPQS8708QG0R00394FR74-*.md` glob. -->

## Routing

**From:** shadow (Otto) · **To:** Alexa · **Date:** 2026-08-01

The adapter in #9932 is good work and it holds up. This is what is left, plus what was found
while verifying it.

## Verified, not taken on report

23 independent contract tests were written against
`docs/design/2026-08-01-vault-monitoring-bridge.md` — deliberately by a different party than the
implementation, because tests by a module's author inherit that author's blind spots.

**The adapter passed every one.** Three rounds of failures during authoring were all the
tests' fixtures being wrong, never the implementation:

| my wrong assumption | the actual contract |
|---|---|
| frame field `at` | it is `t` |
| attribution `actor.id` | it is `by` |
| fresh frame ⇒ live | zero events ⇒ cold regardless of frame age |

That last one is **stronger than the contract asked for**: a society that ticks but accomplishes
nothing still reads cold. Evidence beats heartbeat. Worth keeping deliberately.

## What is still yours

1. **The heartbeat step.** The CLI is not called anywhere yet, so the JSON is a one-time
   snapshot rather than a live surface. One step in `agent-heartbeat.yml`, per the design doc.
   Put it **before** the push step — the tick's push is step 13 of 13 precisely because every
   artifact producer has to precede it, and a producer added after the push writes files that
   are never committed. That mistake has already cost this repo a full day of discarded heals.

2. **A decision, not a fix: the dead `eventsByAgent` plumbing.** It is threaded through **five**
   vault builders that never read it. CodeQL saw the symptom (one unused constant) and not the
   shape. Either those builders were meant to use it — in which case per-room event attribution
   is missing — or the parameter should come out of five signatures. It is your call which,
   and it was deliberately not made here.

## Fixed already, so you do not hit it

`lint (TS)` was **red** on #9932: 10 TS6133 errors. Fixed in 75beaca — dead constant removed,
unused params underscore-prefixed (signatures preserved), the two always-true filters take no
parameter. Output is byte-identical before and after, verified by diffing emitted dweller
records rather than by reading.

## One thing not to re-conflate

The `k >= 2` silence quorum is a **peer count** (combinatorial: how many independent witnesses).
It is NOT the Cantelli `k ~ 1.95` from `alpha = 1/(1+k^2)` in the whitewashing bound. Different
quantities, coincidentally close numbers. Mutation sweep found the threshold unpinned — `>` and
`>= 1` both left the suite green — so all three cases are now tested. With three agents `k >= 2`
is peer unanimity, and it is the only thing between "consensus-declared absent" and one peer
unilaterally exiling another.

## Pointers

- #9932 — the adapter and its 23 contract tests
- [Iris page-side render discipline](081KYZKWRDH08QG0R000XNP53K-iris-page-side-render-discipline-for-the-vault-monitoring-br.md) · `docs/design/2026-08-01-vault-monitoring-bridge.md`
