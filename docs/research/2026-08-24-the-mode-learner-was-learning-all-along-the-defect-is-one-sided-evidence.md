# The mode learner was learning all along — the defect is one-sided evidence

**Date:** 2026-08-24
**Status:** measured. Every number below comes from the arena's own construction and
its own policy; the harness is `sparsity-clean.ts` and its provenance discipline is
stated in §5.
**Resolves:** the reward-sparsity question suspended earlier the same day, when its
instruments were found to be contaminated.

---

## 0. What this overturns, including my own framing

The investigation that produced the fabricated-reward fix was motivated by a premise I
had been carrying and never checked: *"the mode learner has learned nothing."*

**That premise is false.** On clean instruments every bucket the agent actually visits
has moved off its prior, on both carts. The learner has been learning the whole time.

Two corrections to my own work, stated before the findings because they are the reason
the findings are trustworthy:

1. **The earlier measurements were taken on a contaminated instrument.** The harnesses
   assigned `rng` *after* construction, and `initializeSociety()` consumes 51 draws, so
   they rewound the stream and measured a family of trajectories the arena never runs.
   This harness constructs `new BnnSocietyPredictor(3)` and touches nothing.
2. **The first version of this harness mislabelled the scoreboard and nearly produced a
   false bug report.** It printed `mine=v[5] theirs=v[9]`, read OCR `[0,1] [0,2] [0,3]`
   against true registers `1/0 2/0 3/0`, and concluded the OCR pair was reversed — that
   the agent was being *punished for winning*. It is not. `mutual-sim.ts` says plainly
   at lines 34 and 38 that **`V5` is the AI's score and `V9` is the player's**, the BNN
   agent plays the player, and the OCR is correct. The agent was not winning 3–0; it was
   **losing 0–3**, and the three `r = −1` rewards were right.

   The near-miss is the useful part. A dramatic finding ("the reward sign is inverted!")
   arrived from a variable name I had assigned without checking the cart, and it was
   coherent enough to write up. What killed it was reading the ROM source instead of
   trusting my own label. *A count that fits a story is not an identification.*

---

## 1. The reward channel is now honest

Post-fix, every reward event corresponds one-to-one with a real score change, with the
right sign and the right magnitude.

| cart | true score changes | reward events | agent points | AI points |
|---|---|---|---|---|
| normal | 3 | **3** | 0 | 3 |
| inverted | 5 | **4** | 0 | 5 |

Compare the pre-fix figure on the same cart and window: **3 true changes, 35 reward
events.** The fabrication is gone.

**The one apparent shortfall is correct behaviour, and was measured rather than assumed.**
On the inverted cart the fifth change is at `t1013` — the AI reaching 5, which is the
win condition (`score_check: SNE V5, 5`). The board flips to the win flood, the OCR
returns no reading for that digit, and `absorbScoreboardReward` skips a tick with a
missing reading rather than inventing a delta. That is the designed path working. It
also means the inverted cart's **live game is ~1013 ticks, not 4000** — the remainder is
post-game.

---

## 2. The learner is learning

Posterior means after 4000 ticks, against the cold-start priors (`PRIOR_MEAN = 0.2`):

**Normal cart**

| bucket | visits | hunt | flee |
|---|---|---|---|
| small/away | 1811 | 0.200 → **−0.518** | −0.200 → −0.200 |
| small/closing | 428 | 0.200 → **−0.220** | −0.200 → −0.200 |
| big/away | 971 | −0.200 → **−0.371** | 0.200 → **−0.732** |
| big/closing | 197 | −0.200 → **−0.291** | 0.200 → **−0.370** |

**Inverted cart**

| bucket | visits | hunt | flee |
|---|---|---|---|
| small/away | 562 | 0.200 → **−0.375** | −0.200 → **−0.473** |
| small/closing | 131 | 0.200 → **−0.385** | −0.200 → **−0.685** |
| big/away | **0** | −0.200 → −0.200 | 0.200 → 0.200 |
| big/closing | **0** | −0.200 → −0.200 | 0.200 → 0.200 |

Every visited cell moved. The channel reaches the learner and the learner integrates it.

**Second finding, visible in that table:** on the inverted cart the `big/*` buckets have
**zero visits**. The inverted cart's hunter is *small solid*, so `bigAdversary` is never
true there — half the learner's table is untrainable on that cart by construction. Any
claim about what the learner "knows" that averages over all four buckets is averaging
over two that were never observed.

---

## 3. The actual defect: the evidence is one-sided

**The agent scores zero points in 4000 ticks. On both carts.**

Every reward it has ever received is `−1`. There is no positive contrast anywhere in the
signal. That is a sharper and more actionable statement than "rewards are sparse":
rarity would be survivable, and one-sidedness is not, for a specific structural reason.

### Why one-sidedness breaks a contextual bandit specifically

With only negative rewards, credit lands **only on the arm that was executed**. The arm
that was *not* executed keeps its prior untouched. So `choose` comes to be decided by
which arm was recently played, not by which arm is better.

The worked instance is `small/away` on the normal cart:

- `hunt` was executed, was punished, and fell `0.200 → −0.518`.
- `flee` was **never executed there** and sits exactly at its prior, `−0.200`.
- `choose` compares `−0.518` against `−0.200` and now prefers **flee**.

The learner switched to flee. **Nothing about flee was ever measured.** It won by not
having been tried — the reward channel expressed no opinion about it whatsoever.

Generalised: under all-negative reward the learner ratchets *away* from whatever it just
did, regardless of merit. That is not a policy; it is an **anti-exploration oscillator**
wearing a policy's clothes. Worse, it is self-reinforcing — the newly-preferred arm gets
executed, gets punished, and hands the lead back.

This also explains the numbers honestly without appeal to sparsity. Three events is
plenty to move four posteriors. The problem was never how *many* there were.

---

## 4. What follows

The bandit cannot be repaired by tuning it. Something upstream must produce a non-zero
rate of positive outcomes, or the sign asymmetry must be removed:

- **Make the agent able to score at all.** The player's win condition is tagging the
  fleeing AI, and it never once achieved it in ~5000 combined live ticks. That is a
  competence question in the steering layer, not a learning-rate question.
- **Or give the unexecuted arm an honest zero** rather than an untouched prior, so a
  punished arm does not lose to an unmeasured one. Note this is a real design choice with
  a cost, not an obvious fix: it discards the prior, which is the retired rule and the
  thing that makes cold start behave.
- **Or reward shaping against a denser signal** (distance, contact-avoidance) — flagged
  with the standing caveat that the distance metric here is **not sound in either
  direction**, because both agents move; a do-nothing agent shows the same inversion.

I am not recommending one yet. The measurement says what is broken; picking the repair
needs a falsifier that the current instruments cannot yet supply.

---

## 5. Honest limits

- **n = 1 trajectory per cart.** The predictor is seeded from `COMMON_SEED` and the cart
  is deterministic, so the arena has exactly one trajectory per cart. This is *the*
  trajectory the arena runs, which makes it the relevant one — and it is not a
  distribution. Nothing here is a variance claim.
- **The inverted cart's live game is ~1013 ticks**, not 4000; its bucket counts are over
  the shorter window.
- **"The agent never scores" is measured over these two runs**, not proven impossible.
- The `big/*` rows on the inverted cart are unvisited, so their priors are reported for
  completeness and carry no evidence.

## Pointers

- `src/Core.TypeScript/bayesian/bnn-key-predictor.ts` — `absorbScoreboardReward`, the
  counter-arithmetic plausibility gate, and the comment recording the fabrication defect.
- `src/Core.TypeScript/bayesian/mode-value-learner.ts` — `choose`, `record`, `reward`;
  `PRIOR_MEAN`, `TRACE_DEPTH = 20`, `TRACE_DECAY = 0.9`.
- `src/Core.TypeScript/chip8/games/mutual-sim.ts` — lines 34/38 (which register is whose
  score) and 288–291 (who scores on a tag). The source that killed the false finding.
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — an unfalsified premise carried as fact is exactly the silent promotion this guards.
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md)
  — §"the test": what else has this number? Applied here to a variable name rather than
  a count, with the same outcome.
