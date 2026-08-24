---
id: 081M0SX3R27087G0R002TJZTYJ
type: bug
state: done
priority: P2
slug: the-agent-identifies-a-wall-as-its-own-body-track-labelled-s
title: "The agent identifies a WALL as its own body: track labelled 'self static' sits on wall 1 at (32,10)"
created: 2026-08-24T12:49:47.591Z
completed: 2026-08-24T13:37:54.693Z
depends_on: []
composes_with: []
---

# The agent identifies a WALL as its own body: track labelled 'self static' sits on wall 1 at (32,10)

Found while verifying #14738 (the frozen-agent fix) against the live page. With
the agent finally able to *move*, the remaining half of the maintainer's report —
*"still had issues with the flee and hunt not really noticing"* — turned out not
to be a steering problem at all. The steering was fine. It was being computed
from the wrong body.

## Symptom

Live readout of the built bundle, merged `main` at `5b39e31b`:

```
#1 self     static 50%   31.25%     <- 50%*64 = x 32, 31.25%*32 = y 10
#2 scenery  static 50%   62.5%
#4 adversary static 64.06% 31.25%
#7 object   static 82.81% 31.25%
tracks that MOVED during the window: #4, #7
```

`(32,10)` is exactly where `chip8/games/mutual-sim.ts` draws wall 1
(`LD VA, 32` / `LD VB, 10`). The track the agent called its own body was a wall,
and it never moved for the whole run.

## Root cause — a clock standing in for a measurement

The same class of defect as the `maxProb > 0.4` gate removed in #14738: a
constant doing a job only evidence can do.

1. `pickSelf()` committed the body on a **clock** —
   `exploreTicksDone >= EXPLORE_TICKS`.
2. `mutual-sim.priors.ts` bakes `"exploreTicksDone": 240` into its snapshot, so
   that clock is **already expired before tick 0**.
3. The cart draws its two walls one frame before the player and the AI exist.
   Measured: tick 0 has no tracks, tick 1 has **only the two walls**, the player
   and AI first appear on tick 2.
4. So the election was final on tick 1, over a screen containing nothing but
   walls: `committedSelfId = 1`, `committedSelfColor = 1`.
5. That second field sealed it. `elect(committedSelfColor) ?? elect(null)` only
   falls through when the colour-filtered election finds **nothing**, and a wall
   is always on screen — so the unfiltered election was unreachable for the rest
   of the run.

At t239 the real player carried empowerment evidence **15.06** and was labelled
the *adversary*, while a wall with evidence **0.00** stayed "self".

A second, independent defect surfaced once the first was fixed: the empowerment
probe only read the **commanded** branch (`if (pressedKey === undefined) return`).
The AI in this cart *chases* the player, so when the player goes right the AI
goes right too and scores just as well on agreement. With agreement-only
evidence the agent then committed to its **opponent** as its body.

## Fix (PR: the-body-that-answers-to-my-keys)

Four changes, all the same correction — the probe, not a clock or a costume,
says which body is mine:

- commit only once `selfEvidence` is actually **positive**;
- colour is a tie-break **bonus**, never a filter, so a wrong commitment can be
  escaped;
- the latch is **revisable** — a challenger that out-scores the held body by
  `SELF_LATCH_MARGIN` takes it, and since the accumulator leaks (×0.95) a wrong
  self decays out on its own;
- `updateSelfEvidence` reads **both** branches: motion under the null action is
  full disagreement. Contingency, not correlation, is what distinguishes my body
  from something that follows it.

## Measured (6 seeds × 3000 ticks, ground truth = V0/V1 read for measurement only)

Every row below is under the **Thompson policy — the one the live arena runs**
(`swarm-controller.ts`). The policy label is load-bearing; see the correction
below it.

| | before | after |
|---|---|---|
| self is the actual player body | **0.0%** (0/2999, all six seeds) | **67.7%** |
| adversary is the actual opponent | 57.5% | 72.9% |
| distance from the **hunter** (want FAR) | 11.96 px | **23.37 px** |
| distance to the **prey** (want NEAR) | 36.74 px | 33.24 px |
| mode **label** correct | 91.0% | 79.1% |

So: **flee is decisively fixed** (the agent used to sit ~12 px from the thing
hunting it), **hunt is only nudged**, and the mode *label* got worse while the
*behaviour* improved — which is not a contradiction. Before this change the
agent held the correct label and moved the wrong way, and that is exactly what
was reported. A label is internal state; the distance is what the agent does.

Falsifiers in `bnn-key-predictor.test.ts` §"which body is mine": 19 pass with the
fix, 2 fail without it.

### CORRECTION — the squash commit `bc2d43b3` carries superseded numbers

GitHub squash-merge took the **commit message**, not the corrected PR body, so
`git log` on main states:

> mean distance kept from the HUNTER 22.16 → 34.13 px
> mean distance to the PREY 35.88 → 23.06 px
> …picking the right label 97.5% of the time

Those readings are real but they are **one deterministic trajectory under the
`desiredKeyOf` steering policy** (what `train-priors.ts` and the integration
tests drive), not six seeds and not what the page does. The tell was that
running it over six seeds produced six *byte-identical* rows — that policy
consumes no randomness at all, so seeding cannot vary it.

Under the policy the arena actually runs, hunting is **not** fixed. The table
above supersedes the commit message; PR #14768's body carries the same
correction. Recorded here because this file, not the commit message, is the
durable record — and because a pile of agreeing numbers being a warning rather
than a confirmation is precisely the rule that caught it
(`.claude/rules/numerology-vs-number-theory.md` §"too many correlations").

### SECOND CORRECTION (2026-08-24, later) — the behavioural claim is WITHDRAWN

Everything above was measured through harnesses that did this:

```ts
const p = new BnnSocietyPredictor(3, seed);
(p as any).rng = createSeededStream(seed, 1);   // rewinds 51 draws
```

`initializeSociety()` consumes 3 agents × 17 keys = **51 draws**, so replacing
the stream afterwards rewinds it. Those are real deterministic trajectories but
not the arena's. Re-measured on the arena's exact construction
(`new BnnSocietyPredictor(3)` → COMMON_SEED, `importSnapshot(mutualSimPriors)`,
Thompson fusion) and with the fabricated-reward defect
`081M0TBAKC6087G0R001YB7C1D` fixed:

| | arena trajectory | sensitivity range |
|---|---|---|
| self is the actual player body | **74.2%** | 41.5 – 78.8% |
| adversary is the actual opponent | 76.1% | 67.8 – 76.1% |
| distance from the hunter | 21.85 px | 19.16 – 27.27 |
| distance to the prey | 32.55 px | 25.81 – 42.56 |
| reward events / real score changes | 3 / 3 | honest on every seed |

Two things follow, and the second is the important one.

**The self-identification result stands.** 74.2% against a predecessor that was
*structurally* 0% — a wall committed on tick 1, every run — and that 0% does not
depend on any instrument, so the comparison survives.

**The "flee is decisively fixed" claim does not, and is withdrawn.** On the
arena's own trajectory the agent sits nearer its hunter (21.85) than its prey
(32.55), on every seed measured.

But the sharper correction is that **the distance metric was never sound in
either direction.** When the AI is Cat it closes on the player; when it is Mouse
it runs away. So those distances are driven largely by the OPPONENT's policy,
and a do-nothing agent would show the same inversion. It cannot carry a verdict
about our steering — which means it should not have been used to claim the
improvement in the first place. The retraction is of the method, not just the
number.

What survives from this work-item: a real defect, found and fixed, with
self-identification demonstrably repaired — and **no demonstrated improvement in
how well the agent plays.**

## What this EXPOSED (not caused) — follow-on, not part of this item

The game score got **worse**: mean final player:ai went 1.00:0.50 → 0.17:0.83.
Retraining all three priors under the corrected perception did not recover it
(0.33:0.67 → 0.17:0.83), so it is not prior staleness.

The honest read is in the distance rows above: the agent now keeps roughly twice
the standoff from the thing hunting it, because it is genuinely fleeing for the
first time. Fleeing works; you score by **touching** the fleeing AI, and hunting
is the half that did not improve. The retired behaviour scored
better precisely because a body pinned to a wall produced a steering vector that
swept the arena at random, and a random walk in a tag game blunders into the
opponent more often than a competent escape does.

The mode split is ~50/50 hunt/flee both before and after — i.e. the mode learner
has learned nothing, because the reward it sees is roughly **one score event per
3000 ticks**. That is the next rung, and it is a reward-sparsity problem, not a
perception one.
