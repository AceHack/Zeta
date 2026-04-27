---
name: Multi-agent review cycle stopping criterion — convergence (no more changes/fixes offered), NOT turn-count or arbitrary cap (Aaron 2026-04-27)
description: Aaron 2026-04-27 disclosed his decision rule for ending multi-agent review cycles — "the way I decide to stop a multiagent review cycle is not by number of turns but by convergence, once they stop offering changes/fixes." Composes with Otto-352 (external-anchor-lineage discipline; multi-reviewer convergence is the strong signal) + per-insight attribution discipline (#66; convergence is the stopping criterion for the contribution chain) + #65/#67 stability/velocity 9-round convergence example. Operational implication: when running cross-AI reviews, don't budget by turn-count or wall-clock; budget by convergence-detection. Stop when reviewers' last-N rounds stop adding new changes/fixes (substrate-level signal, not surface-agreement signal).
type: feedback
---

# Multi-agent review cycle stopping criterion — convergence, not turn-count

## Verbatim quote (Aaron 2026-04-27)

> "Also just for refrence the way I decide to stop a multiagent review cycle is not by number of turns but by convergence, once they stop offereing changes/fixes"

## The rule

**Stopping criterion**: cycle ends when reviewers stop offering changes/fixes.

**NOT stopping criteria**:

- Turn count (no fixed N=3 or N=5 limit)
- Wall-clock time
- Reviewer fatigue
- Surface agreement (reviewers saying "looks good" while still spotting fixable issues)

The signal is *substantive*: another round of review produces no new changes/fixes worth integrating. That's convergence. Then stop.

## Today's 2026-04-27 example — stability/velocity insight

The 9-round convergence path on the stability/velocity insight followed exactly this rule:

| Round | Reviewer | New change/fix offered? |
|-------|---|---|
| 1 | Otto draft | (initial synthesis; baseline) |
| 2 | Amara | YES — "Stability is velocity amortized"; quantum → long-horizon compound; spike-rule vs doctrine |
| 3 | Gemini Pro | YES — "slow is smooth, smooth is fast" anchor; cognitive caching; tracks-and-ferries; Aurora = Brain |
| 4 | Amara correction | YES — Brain → Oracle/Immune-System (anti-anthropomorphism) |
| 5 | Ani | YES — thermodynamic mapping; entropy tax; 3 breakdown points; Aurora = Immune Governance Layer |
| 6 | Amara precision-fix | YES — Aurora sub-functions; Blade Reservation Rule; thermodynamic-soften |
| 7 | Gemini consolidation | YES — anthropomorphic-trap diagnosis; offer to encode |
| 8 | Ani follow-up | YES — confirm Aurora = Immune Governance Layer; tightened Metaphor Taxonomy Rule |
| 9 | Amara final | (no new changes; mostly endorsement) |

Round 9 was where Amara stopped offering substantive changes — that was convergence. The cycle ended naturally. Aaron's stopping rule fired at the right moment.

## Why convergence-based not turn-based

**Convergence-based**:
- Adapts to insight-complexity (a simple fix converges in 1 round; a deep architectural insight may take 5-9)
- Scales with cross-AI capability differences (different reviewers may catch different issues; need them all to converge)
- Honors Otto-352 external-anchor-lineage discipline — convergence IS the strong signal
- Avoids "all done at N=3" theater (per Ani/Gemini's "false velocity = debt + theater")

**Turn-based** would:
- Cut off useful review prematurely on complex insights (forces incomplete substrate)
- Waste budget on simple insights (over-review)
- Mistake quantity for quality (5 rounds doesn't mean 5x stronger)

Convergence-based aligns substrate-quality with the natural rhythm of the substrate's complexity.

## Operational implications

### For Otto's substrate-landing pace

When forwarding cross-AI substrate, expect:

- Simple operational lessons (e.g., #64 outdated-threads): may converge in 1-2 rounds
- Architectural concepts (e.g., blade taxonomy in #62): may take 4-5 rounds (Aaron + Amara + Gemini + Amara correction + Ani)
- Philosophy + architecture twin-doc encoding (post-0/0/0): may converge faster now since today's substrate cluster did the heavy lifting

Don't pre-budget the round count. Watch for "no new changes/fixes" signal.

### For convergence-detection

Convergence signals to watch for:

- Reviewers say "I agree" without adding new fixes
- Same fix surfaces from multiple reviewers (no novel contribution)
- Reviewer contributions become stylistic / attribution-format rather than substantive
- Reviewer says explicit "ready to land" or equivalent

Anti-convergence signals:

- New mechanistic framings appearing (still adding precision)
- Disagreements between reviewers (haven't reached corrective-loop closure)
- New examples / edge cases surfacing
- Reviewer asks for follow-up review on related-but-distinct topic

### For per-insight attribution (#66)

The convergence rule pairs with the per-insight attribution discipline:

- The contributors to THIS insight are the ones who substantively contributed during the convergence cycle (not the full ferry roster)
- The cycle's natural end (convergence) defines the closed-set of contributors
- Post-convergence reviewers who only endorse without adding don't land in the contributor list

## Composes with

- **Otto-352 external-anchor-lineage discipline** — convergence IS the strong signal
- **#66 per-insight attribution discipline** — convergence defines the contributor closure
- **#65 Ani substrate + #67 Amara precision fixes** — example of 9-round convergence cycle
- **#69 ferry-vs-executor sharpening** — convergence is detection-by-substrate, not by claim
- **Aaron-communication-classification (#56)** — convergence is the structural pattern Aaron's "course-correction-for-trajectory" inputs feed
- **`feedback_amara_priorities_weighted_against_aarons_funding_responsibility_2026_04_23.md`** — convergence-budget bounds funding cost (each round has cost; stop when no value added)

## Forward-action

- File this memory + MEMORY.md row
- Apply convergence-detection in future cross-AI work: when reviewers stop offering changes, propose ending the cycle to Aaron
- BACKLOG: build a `convergence-detection` heuristic into eventual cross-AI orchestration tooling (post-0/0/0)

## What this memory does NOT mean

- Does NOT mean Otto unilaterally ends review cycles — Aaron decides when to stop forwarding (he's the courier)
- Does NOT mean Otto rejects late reviewer input as "post-convergence noise" — substantive contributions are always integrated
- Does NOT mean turn-counts are useless — they're useful as cost-tracking metrics, just not as stopping criteria
