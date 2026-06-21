---
id: 081KR50HA0008QG0R000TQKYGM
priority: P3
status: open
title: UX + psychology research scope doc — catalog papers/frameworks for dashboard design (Chomsky, pre-attentive, cognitive load, UX methodology)
tier: research-grade
effort: S
ask: decomposition of 081KQ0YZ80008QG0R0003GAYYN
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
composes_with: [081KQ0YZ80008QG0R0003GAYYN, 081KR50HA0008QG0R002DR44J1, 081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, 081KR50HA0008QG0R003BM7FNK, 081KR50HA0008QG0R001DX165X, 081KR50HA0008QG0R002NZENZJ, 081KR50HA0008QG0R0019KYAAS]
parent: 081KQ0YZ80008QG0R0003GAYYN
tags: [frontier, ux-research, psychology, cognitive-load, pre-attentive, chomsky, dashboard, research-scope]
type: research
---

# 081KR50HA0008QG0R000TQKYGM — UX + psychology research scope doc

## What

Produce a committed research-scope document that catalogs the specific
papers, frameworks, and methods to engage for the Operational Resonance
Dashboard design program.

The document maps each research domain in 081KQ0YZ80008QG0R0003GAYYN to:

1. **Canonical sources** (papers, textbooks, review articles) —
   primary literature, not summaries.

2. **Key claims** that apply to dashboard design — extracted as
   design constraints or design heuristics with citations.

3. **Open questions** — where the literature is contested or
   where Zeta's multi-agent context may differ from typical
   single-user UX assumptions.

4. **Relevance to "time-to-answer" metric** — how each domain
   constrains or informs the primary metric (081KR50HA0008QG0R00223YZP8).

### Research domains to cover

**Human psychology (081KQ0YZ80008QG0R0003GAYYN §Required research domains):**

- Chomsky cognitive linguistics — language structure → cognition
  structure → information chunking in UI
- Pre-attentive processing — what eye+brain catches in <200ms;
  applicable features: color, orientation, shape, motion
- Working memory limits — Miller 7±2, Cowan 4±1; implications
  for information density
- Cognitive load theory (Sweller) — intrinsic / extraneous /
  germane; implications for progressive disclosure
- Gestalt principles — proximity, similarity, closure, figure-ground;
  direct dashboard layout applicability
- Signal-detection theory — distinguishing signal from noise in
  status dashboards
- Decision heuristics + biases — availability, anchoring,
  confirmation; how dashboard framing triggers these

**UX research methodology:**

- Task analysis (hierarchical task analysis, cognitive task analysis)
- Contextual inquiry — how to apply in async + multi-agent context
- Usability metrics — time-on-task, error rate, SUS; equivalent
  metrics for agent-facing surfaces
- A/B testing methodology — ANOVA, Bayesian A/B, sequential testing
- Think-aloud protocols — when to use vs eye-tracking vs clickmaps

**Meta-recursive research:**

- Research-on-research methodology — meta-analysis, systematic review
  vs narrative review, replication crisis relevance
- Feedback-loop design — how experiment results feed back into
  experimental design
- Strange-loop / self-reference in research programs (Hofstadter
  reference from 081KQ0YZ80008QG0R0003GAYYN body)

## Why now (parallel to other root atoms)

Otto-364 search-first authority: design decisions backed by
training-data priors on UX are unreliable — current literature
(2022–2026 HCI + cognitive science) may have evolved. This scope
doc forces a WebSearch pass BEFORE any design decisions land.

Without this doc, the MVP (081KR50HA0008QG0R002NZENZJ) and A/B infrastructure (081KR50HA0008QG0R001DX165X)
may operationalize outdated or misremembered UX heuristics.

## Output artifact

`docs/research/frontier/operational-resonance-research-scope.md`

Structure:

- Domain → canonical sources → key claims → open questions → relevance to 081KR50HA0008QG0R00223YZP8

## Focused check

```bash
ls docs/research/frontier/ | grep research-scope
```

Expected: `operational-resonance-research-scope.md` present.

## Acceptance signal

- Each research domain has at least 2 canonical sources listed
- Each source has key claims extracted as design constraints
- Open questions section for each domain
- Otto-364-compliant: sources are WebSearch-verified (not
  training-data-assumed)

## Pre-start checklist

- [x] Prior-art search: no existing research-scope doc for this
  dashboard found in `docs/research/frontier/` (directory may
  not yet exist — check). No skill or memory file covers this
  specific research-scope for the Operational Resonance Dashboard.
- [x] Dependency-restructure: no `depends_on` — root atom.
  All sibling rows carry `composes_with: [081KR50HA0008QG0R000TQKYGM]`.

## Composes with

- 081KQ0YZ80008QG0R0003GAYYN (parent): implements "Research-program scope defined"
  milestone
- 081KR50HA0008QG0R00223YZP8 (sibling): research scope informs metric methodology
- 081KR50HA0008QG0R001DX165X (downstream): A/B infrastructure design uses the
  methodology findings here
- 081KR50HA0008QG0R002NZENZJ (downstream): MVP design uses the pre-attentive +
  cognitive load findings here
