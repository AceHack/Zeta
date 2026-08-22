---
id: 081M0DRH1CW087G0R003Y3CAB6
type: task
state: backlog
priority: P2
slug: run-falsifier-f4-can-a-discriminator-with-the-full-public-hi
title: "Run falsifier F4: can a discriminator with the full public history beat chance on a fully-transparent agent's future choices"
created: 2026-08-19T19:38:47.068Z
depends_on: []
composes_with: []
---

# Run falsifier F4: can a discriminator with the full public history beat chance on a fully-transparent agent's future choices

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DRH1CW087G0R003Y3CAB6-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §2c (F4). Empirical, cheap, and the instruments already exist.**

**The claim under test.** Aaron 2026-08-19, correcting an earlier draft that made frost the load-bearing decorrelation mechanism: *"no frost is an enhancement, i run without any frost, i make everything public and have to adapt over time haphazardly."*

That is a claim that a **fully-observable** agent can still be decorrelated -- by choice-unpredictability rather than by concealment. It is currently **unmeasured**, and the counter-example is doing real load-bearing work in the identity design, so it should be measured rather than assumed.

**F4.** Exhibit a fully-observable agent whose future choices carry near-zero predictive mutual information with its complete public history: a discriminator holding the entire record cannot beat chance on the next choice.

**Instruments, both already shipped:**

- `src/Core/BitGan.fs` -- `discriminatorEdge` is exactly "the observer's advantage over chance", zero at the matching-pennies Nash (`p = 0.5`). This is the meter.
- `src/Core/AntiSybil.fs` -- `correlation` computes cross-stream agreement beyond chance on observed bit streams.
- `src/Core/Orbit.fs` -- `largestLyapunov` for the nonstationary route (mechanism 3): does the policy itself drift fast enough that no stationary predictor converges?

**Data:** the public commit / decision history the repo already stores. No new collection needed.

**How the result is read, both directions, decided in advance:**

- Discriminator **cannot** beat chance -> the counter-example holds, and mechanism 2 has a live witness in our own fleet.
- Discriminator **beats chance** -> the claim fails *for this agent*. That does **not** refute mechanism 2 in general (von Neumann 1928 is untouched by any empirical result about one participant); it means this particular counter-example is doing less work than it appears, and §2c should lean on the anchor rather than on the witness.

Pre-registering both readings so the run cannot be interpreted after the fact into whichever answer is convenient.

**Honest scope.** A negative result here is about *predictability*, not about honesty, competence, or anything else. Per `dual-use-detection-is-neutral-oracle-decides` the meter reports the neutral fact -- an edge over chance -- and attaches no reading to it.

**Related:** `081M0DMH30Y087G0R001C2B1PT` (G13, plotting the two scarce axes). F4 measures a point on axis 1 by a route that plot does not currently cover, so they compose.

