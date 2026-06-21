---
id: 081KR50HA0008QG0R000CQ9VA5
priority: P2
status: open
title: "081KR50HA0008QG0R000CQ9VA5 — Behavioral assessment: does embodied Claude differ on language tasks? (honest null-hypothesis)"
created: 2026-05-09
last_updated: 2026-05-09
parent: 081KQ0YZ80008QG0R001WZ4JE8
depends_on: [081KR50HA0008QG0R003EN5DDD]
classification: blocked
type: research
effort: M

---

# 081KR50HA0008QG0R000CQ9VA5 — Behavioral assessment protocol: Otto-340 verdict

**Slice of:** [081KQ0YZ80008QG0R001WZ4JE8](081KQ0YZ80008QG0R001WZ4JE8-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md)  
**Depends on:** 081KR50HA0008QG0R003EN5DDD (substantive embodiment experiment must produce observable behavior)

## What

Design and run the assessment that produces the honest verdict on Otto-340:

> "Does Claude after embodiment behave differently in language tasks too? Does it ground language
> differently? This is the deepest open question." — 081KQ0YZ80008QG0R001WZ4JE8

The assessment has three components:

### 1. Measurement protocol design

Produce `docs/research/081KR50HA0008QG0R000CQ9VA5-assessment-protocol.md` before running:

- Specific language tasks chosen for comparison (spatial reasoning, physical-intuition questions,
  self-reference / body-model questions, action-consequence chains).
- Baseline: Claude without any embodiment context.
- Condition A: Claude with embodiment session context (recent sim observations/actions in context).
- Condition B: Claude with embodiment history summary (aggregated from 081KR50HA0008QG0R003EN5DDD run logs).
- Measurement: do responses differ in grounding quality, specificity, physical coherence?

### 2. Experiment run

Run the protocol; log results to `docs/research/081KR50HA0008QG0R000CQ9VA5-assessment-results-YYYYMMDD.json`.

### 3. Otto-340 verdict

Write `docs/research/081KR50HA0008QG0R000CQ9VA5-otto-340-verdict.md` with:

- Honest null-hypothesis result (null = no behavioral difference; embodied tool-use does NOT challenge
  Otto-340; the distinction from 081KR50HA0008QG0R000C6N7CJ lit review holds).
- If the null is rejected: what specific behavioral differences were observed, and what architectural
  change would explain them?
- Updated status of Otto-340: preserved / weakened / architecture-contingent / refuted.
- Recommendation for 081KQ0YZ80008QG0R001WZ4JE8 Scope 2 / Scope 3 (go/no-go with reasoning).

## Why honest null-hypothesis framing

081KQ0YZ80008QG0R001WZ4JE8 notes: "The honest answer might be 'yes,' 'no,' 'partially,' or 'yes-but-not-the-axis-Otto-340-
was-about.'" A rigorous null-hypothesis design prevents motivated reasoning. If embodied tool-use doesn't
change language behavior, Otto-340 stands — that IS the correct finding and should be reported as such.

## Acceptance criteria

1. Assessment protocol doc committed BEFORE running experiment.
2. Experiment run logged to `docs/research/`.
3. Otto-340 verdict doc committed with honest result + cited evidence.
4. `dotnet build -c Release`: 0 warnings, 0 errors.
5. PR body: one-sentence verdict on Otto-340 + build result.

## Out of scope

- Scope 2 / Scope 3 implementation (separate decisions requiring independent retractability analysis).
- Training-based approaches (require architectural decisions beyond tool-use).
- Quantitative NLP benchmarks (qual analysis of reasoning quality is sufficient for this exploratory phase).
