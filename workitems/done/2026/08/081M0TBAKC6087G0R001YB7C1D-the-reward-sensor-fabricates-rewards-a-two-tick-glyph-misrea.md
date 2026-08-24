---
id: 081M0TBAKC6087G0R001YB7C1D
type: bug
state: done
priority: P2
slug: the-reward-sensor-fabricates-rewards-a-two-tick-glyph-misrea
title: "The reward sensor fabricates rewards: a two-tick glyph misread is certified as a score change"
created: 2026-08-24T14:52:00.000Z
completed: 2026-08-24T16:58:48.193Z
depends_on: []
composes_with: []
---

# The reward sensor fabricates rewards: a two-tick glyph misread is certified as a score change

Found while investigating why the mode learner has learned nothing. It is not
only that rewards are rare — some of the rewards it does receive **never
happened**.

## Symptom, reproduced

Inverted cart, seed 23, 4000 ticks, the arena's own Thompson policy:

| | value |
|---|---|
| score changes the cart actually made | **3** |
| reward events the learner absorbed | **35** |

Seed 31 shows the same shape (18 against 5). Both are on `main` today.

## Mechanism, measured

The OCR readout misreads **3 as 9** for exactly two ticks while a sprite
brushes the top-right digit. Captured live with the true score parked at `0:3`:

```
1727   truth 0:3     OCR  0 / 3
1728   truth 0:3     OCR  0 / 9      <- misread begins
1729   truth 0:3     OCR  0 / 9      *** REWARD   (seen twice -> accepted)
1730   truth 0:3     OCR  0 / 3      <- misread ends
1731   truth 0:3     OCR  0 / 3      *** REWARD   (seen twice -> accepted back)
```

That pattern repeated roughly every sixteen ticks for a thousand ticks.

`absorbScoreboardReward` guards with **two-tick agreement** — a reading becomes
the score only after being seen twice in a row. That catches a ONE-tick
flicker and is structurally blind to a TWO-tick one: a stable misread is
"seen twice" and is therefore certified.

Three things make it worse than a cosmetic misread:

- **The magnitude is wrong, not just the sign.** `r = mine − prevMine −
  (theirs − prevTheirs)` yields ±6 from a 3↔9 flip where a real tag is ±1.
- **The pair does not cancel.** It sums to zero, but each half is credited
  against different eligibility-trace contents.
- **A deeper trace amplifies it** — each fabricated reward smears across the
  whole trace.

`3` and `9` differ by one horizontal stroke in a 3×5 glyph, which is why that
pair is the one that surfaces.

## Fix

The guard is the cart's **own arithmetic**, not a tuned threshold. Both scores
are counters — `ADD V5, 1` / `ADD V9, 1` in `chip8/games/mutual-sim.ts` — never
reset and never decremented. So a delta outside `{0, +1}` did not come from the
game. Distrust the *reading* rather than believe an impossible score, and do
**not** let it become the new baseline, or the return to the true value reads as
a second impossible jump.

## Falsifier

`mode-value-learner.test.ts` §"the reward sensor does not invent rewards" —
asserts the invariant (`rewardEvents <= real score changes`) rather than the
anecdote. The sensor may *miss* a change; it may never report more than
happened. Without the fix: `Expected <= 3, Received 35`. With it: 3 and 3.

Two things the test had to get right, both learned the hard way here:

1. It must be driven by **Thompson sampling**, the arena's fusion path. Written
   first against `desiredKeyOf`, it passed with the bug still in place — the
   two policies produce different trajectories and that seed never brushed the
   digit under the steering policy.
2. The predictor must be constructed **plainly**. See below.

## A contaminated instrument, found in the same pass

The scratch harnesses used to measure all of this re-seeded the predictor after
construction:

```ts
const p = new BnnSocietyPredictor(3, seed);
(p as any).rng = createSeededStream(seed, 1);   // <- rewinds 51 draws
```

`initializeSociety()` consumes `3 agents × 17 keys = 51` draws from `this.rng`,
so replacing the stream afterwards **rewinds it 51 draws**. Those trajectories
are a legitimate deterministic family but they are *not* the one the arena
runs — and "what the arena runs" was exactly the claim being made about them.
Re-measured with plain construction, the fabricating seeds are different ones
(23 and 31, not 19), which is how the contamination was caught: the falsifier
built on the harness's seed would not fail on the arena's path.

Numbers previously reported from those harnesses — including the percentages in
`081M0SX3R27087G0R002TJZTYJ` and PR #14768 — were measured on the rewound
family. The qualitative findings there stand independently (the wall-as-self
defect was structural, and the fix was verified in the live browser bundle), but
the precise figures carry that caveat.
