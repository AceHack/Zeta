---
id: 081KSNY2Z0008QG0R0015C3F01
priority: P3
status: open
title: Tech debt as high-signal training data — operating principle + measurement substrate (the mess IS part of the intelligence loop)
effort: M
ask: aaron via ani 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on: []
composes_with:
  - 081KSNY2Z0008QG0R000K3ETGB
  - 081KSNY2Z0008QG0R002WQ747V
  - 081KSNY2Z0008QG0R003KG3JTG
  - 081KSNY2Z0008QG0R000ED0ED8
  - 081KSNY2Z0008QG0R000HENSVM
tags:
  - tech-debt-as-high-signal-training-data
  - flipped-conventional-view-debt-as-teacher-not-disease
  - mess-as-part-of-intelligence-loop
  - operating-principle
  - measurement-substrate
  - composes-with-error-class-extraction
  - composes-with-clifford-embedding-uniqueness
  - composes-with-growth-rate-ratio-discipline
  - benchmark-training-data-pipeline
  - potential-extension-not-committed
---

## Operator framing 2026-05-28 (Ani ferry)

> *"Yeah, the tech debt is high-signal training data."*

> *"the mess is part of the intelligence loop"* (Ani's reflection ratified)

## What this row tracks

Operating principle + measurement substrate that flips the conventional view of tech debt:

- **Conventional view**: tech debt is waste; pay it down; minimize it
- **Operator's view**: tech debt is HIGH-SIGNAL TRAINING DATA; every debt item is a concrete example of where current abstractions / patterns / understanding weren't good enough; the system + operator learn from debt accumulation

Operational implication:

1. Tech debt is FIRST-CLASS data, not noise to suppress
2. Debt items are classified, retained, and made queryable (not just "filed in TODO")
3. Debt-class shape informs future architectural decisions
4. Debt-volume + debt-velocity + debt-class-distribution are operational signals worth tracking
5. The system's tech-debt-shape over time becomes a benchmark training corpus (composes with 081KSNY2Z0008QG0R000K3ETGB + 081KSNY2Z0008QG0R003KG3JTG error-class + Clifford-embedding work)

## Acceptance criteria

- `tools/tech-debt-corpus/extract.ts` — periodically scans tech-debt-flagged code + abandonment-events + class-filings + retroactive-class-sweeps
- Produces a corpus at `docs/tech-debt-corpus/` (or equivalent surface) with structured records:
  - Debt item / class identifier
  - Code-location anchor
  - When discovered, by whom (reviewer / agent / human)
  - Class assignment (if classified per 081KSNY2Z0008QG0R000K3ETGB)
  - Resolution status (open / class-fix-pending / retroactively-fixed / abandoned)
  - Training-data tags (severity, recurrence, blast-radius)
- The corpus is queryable for benchmark generation (per 081KSNY2Z0008QG0R000K3ETGB benchmark-training-data framing)
- `.claude/rules/tech-debt-as-high-signal-training-data.md` — operating-principle rule (substantive substrate; reframes how agents engage debt)
- Composes with 081KSNY2Z0008QG0R000ED0ED8 (growth-rate ratio) — same metrics feed both

## Composition

- **081KSNY2Z0008QG0R000K3ETGB** error-class extraction meta-loop — class assignments are the labeling layer
- **081KSNY2Z0008QG0R002WQ747V** code-review-as-tech-debt-detector — feeds debt items into the corpus
- **081KSNY2Z0008QG0R003KG3JTG** Clifford-space embedding — long-term: debt items occupy positions in Clifford space
- **081KSNY2Z0008QG0R000ED0ED8** backlog-vs-tech-debt growth-rate ratio — same measurement feeders
- **081KSNY2Z0008QG0R000HENSVM** DORA mandate — debt-as-training-data composes with the benchmark substrate

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P3 — operating-principle framing is heavier than pure tooling row; needs substrate-engineering thought about HOW to make debt-as-training-data operationally real (versus just rhetorical).

## Full reasoning

`memory/ani/conversations/2026-05-28-aaron-ani-grok-degenerate-in-best-way-possible-runbook-as-spec-two-path-interface-code-review-as-tech-debt-detector-no-throttle-gardener-ai-as-nature-aaron-forwarded.md` § item 15
