---
id: B-0880
zetaid: 081KSNY2Z0008QG0R000ED0ED8
priority: P2
status: open
title: Backlog-vs-tech-debt growth-rate ratio discipline — manage RATES not absolute values; both are infinite in AI-world
effort: M
ask: aaron via ani 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on: []
composes_with:
  - B-0869
  - B-0875
  - B-0875.1
  - B-0881
  - B-0882
tags:
  - growth-rate-ratio-discipline
  - backlog-vs-tech-debt-balance
  - both-infinite-in-ai-world
  - manage-rates-not-absolutes
  - dora-mandate-extension
  - operational-metric-not-product-metric
  - composes-with-error-class-extraction
  - composes-with-no-throttle-gardener-posture
  - potential-extension-not-committed
---

## Operator framing 2026-05-28 (Ani ferry)

> *"And then you just need a certain ratio to like backlog to tech debt and just keep that ratio going. And basically, you look at the rate of growth of the backlog and the 'cause tech debt and backlog is going to be infinite in AI world. And so basically you look at the rate of growth of the backlog and the rate of growth of the tech debt and you match it on the rate of growth of like which one you move forward."*

## What this row tracks

In AI-native operation both backlog and tech debt are unbounded — agents produce both at high velocity. The substrate-honest operating discipline is NOT "eliminate either" but "manage the GROWTH RATES so neither spirals." Specifically:

- Measure: rate-of-backlog-growth (rows added per day/week)
- Measure: rate-of-tech-debt-growth (debt items / known classes / change-failure events per day/week)
- Maintain healthy ratio between the two
- Allocate effort: if tech-debt-growth > backlog-growth → spend more effort on debt reduction; if backlog-growth > tech-debt-growth → spend more on backlog grinding

The metric is operational (system-health), distinct from DORA's product-metrics (deployment-frequency, lead-time, etc.).

## Acceptance criteria

- `tools/dora-classify/growth-rates.ts` extension that computes:
  - `backlogGrowthRate(window)` — rows added per window (days/weeks/months)
  - `techDebtGrowthRate(window)` — debt items + classes filed per window
  - `growthRatio(window)` = backlogGrowthRate / techDebtGrowthRate
- CLI report: `bun tools/dora-classify/growth-rates.ts --since 1week` shows the ratio + target band + recommendation (lean-backlog / lean-debt / balanced)
- Composes with B-0869 (DORA mandate) — adds growth-rate operational metric alongside DORA's product metrics
- Composes with B-0875 + B-0875.1 — tech-debt-class-extraction feeds the debt-growth-rate measurement

## Composition

- **B-0869** DORA mandate — this is an operational complement
- **B-0875** error-class extraction — feeds debt-growth-rate count
- **B-0875.1** code-review-as-tech-debt-detector — same feeder
- **B-0881** tech-debt-as-high-signal-training-data — composes; both reframe debt as managed-resource not waste
- **B-0882** no-throttle gardener-mode — this metric IS the steering at 300mph that no-throttle requires

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2; operational metric directly actionable; composes with existing DORA + extraction substrate.

## Full reasoning

`memory/persona/ani/conversations/2026-05-28-aaron-ani-grok-degenerate-in-best-way-possible-runbook-as-spec-two-path-interface-code-review-as-tech-debt-detector-no-throttle-gardener-ai-as-nature-aaron-forwarded.md` § item 14
