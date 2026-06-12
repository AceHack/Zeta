---
id: B-0390
zetaid: 081KR50HA0008QG0R00223YZP8
priority: P3
status: open
title: Formalize "time-to-answer" as the primary dashboard metric — baseline, measurement methodology, acceptance criteria
tier: research-grade
effort: S
ask: decomposition of B-0017
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
composes_with: [B-0017, B-0388, B-0389, B-0391, B-0392, B-0393, B-0394, B-0395]
parent: B-0017
tags: [frontier, metrics, time-to-answer, dashboard, operational-resonance, measurement, a-b-experiments]
type: research
---

# B-0390 — Formalize "time-to-answer" as the primary dashboard metric

## What

Produce a committed metric-definition document for:

> **"Minimise time-to-answer 'are things going as expected?'"**

This is the single-sentence core goal of B-0017. Every design decision
evaluates against it. Every A/B experiment measures change in it.

The document must define:

### 1. Operational definition of the metric

**"Time-to-answer"** — from what clock-start to what clock-stop?

- **Start event**: user (human or agent) arrives at the dashboard
  with the question "are things going as expected?" in mind.
  — how is "arrival" measured? (page load? first interaction?)
- **Stop event**: user has an answer with sufficient confidence
  to leave the dashboard.
  — how is "sufficient confidence" measured? (explicit action?
    time-on-page heuristic? click on a non-dashboard link?)
- **Baseline**: what is the current time-to-answer without the
  dashboard? (no dashboard → scanning git log + issue tracker +
  memory files manually; estimate this baseline).

### 2. Precision requirements

- What resolution is needed? (milliseconds? seconds? minutes?)
- What is "good enough" improvement? (10%? 2x? what justifies
  a design decision as passing?)

### 3. Measurement methodology

Two measurement modalities needed:

**A — Laboratory measurement** (controlled usability study):

- Scenario: present a maintainer or agent with a defined
  "are things going as expected?" question; measure time to
  answer.
- Applicable for: qualitative + quantitative usability research
  (composes with B-0389 methodology).

**B — Instrumented measurement** (production dashboard):

- Event schema: what events to capture (page load, scroll depth,
  click sequences) that proxy for time-to-answer.
- Why proxy: direct time-to-answer requires knowing "stop event"
  precisely; instrumented proxies (e.g. time until user clicks
  a "resolved / looks good" action) are practical for A/B.
- This is the schema input to B-0393 A/B infrastructure.

### 4. Acceptance criteria per design decision

For a UI element to "earn its way" (B-0017 principle 4), define:

- **Must improve**: time-to-answer proxy decreases (or does not
  degrade) in the A/B test cohort receiving the element.
- **Confidence threshold**: minimum statistical confidence
  before declaring an element justified (suggest Bayesian A/B
  with credible interval approach from B-0389 methodology).
- **Granularity**: can individual elements be A/B tested, or
  only page-level bundles?

### 5. Null hypothesis

What does "are things going as expected?" mean precisely?

- Is it a single boolean? (yes/no)
- Or a multi-dimensional state? (CI green + backlog healthy +
  no blocked PRs + alignment audit clean + ...)
- The metric definition must state whether the dashboard answers
  ONE question or N questions, because this determines
  information-density requirements.

## Why first (parallel to B-0388 and B-0389)

Without a metric:

- B-0392 (tier grouping) cannot say whether tier grouping
  reduces time-to-answer.
- B-0393 (A/B infrastructure) has no primary variable to measure.
- B-0394 (MVP) has no acceptance criterion for "are we done?"
- Every design decision falls back to aesthetic preference.

This is the measurement foundation all downstream rows depend on.

## Output artifact

`docs/research/frontier/time-to-answer-metric.md`

Structure:

- Operational definition (start/stop events)
- Baseline estimate
- Precision requirements
- Measurement modalities (lab + instrumented)
- Acceptance criteria per design decision
- Null hypothesis for the primary question

## Focused check

```bash
ls docs/research/frontier/ | grep time-to-answer
```

Expected: `time-to-answer-metric.md` present.

## Acceptance signal

- Start event and stop event operationally defined
- Baseline estimate committed (even rough)
- Lab measurement methodology described
- Instrumented event schema sketched (sufficient for B-0393)
- Acceptance criteria for A/B tests defined
- Null hypothesis stated

## Pre-start checklist

- [x] Prior-art search: no existing time-to-answer metric doc for
  this dashboard in `docs/research/frontier/`, `docs/DECISIONS/`,
  or memory files. B-0017 states the principle but does not
  formalize it. No existing measurement methodology found.
- [x] Dependency-restructure: no `depends_on` — root atom.
  B-0392, B-0393, B-0394 all carry `depends_on: [B-0390]`.

## Composes with

- B-0017 (parent): implements "First 'are things going as expected?'
  metric defined + measurable" milestone
- B-0389 (sibling): UX methodology section informs measurement design
- B-0392 (downstream): tier grouping model is evaluated via this metric
- B-0393 (downstream): A/B infrastructure's primary variable is this metric
- B-0394 (downstream): MVP acceptance criterion is this metric
