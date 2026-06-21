---
id: 081KSNY2Z0008QG0R000K3ETGB
priority: P2
status: open
title: Error-class extraction meta-loop — turn auto-reviewer findings into named classes into machine-checkable rules with before/after effectiveness measurement
effort: M
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on: []
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R000HENSVM
  - 081KSNY2Z0008QG0R003KG3JTG
tags:
  - error-class-extraction
  - meta-loop-turning-review-findings-into-rules
  - named-patterns-recurring-across-multiple-prs
  - rule-could-plausibly-catch
  - machine-checkable-rule-encoding
  - before-after-effectiveness-measurement
  - compounds-system-improvement
  - benchmark-training-data-generator
  - sonar-static-analysis-warnings-as-errors-formal-tools
  - heterogeneous-reviewer-ensemble-diversity
  - potential-extension-not-committed
---

## What this row tracks

A meta-loop running periodically (daily/weekly) that:

1. Reads recent PR review threads (Copilot + CodeQL + Semgrep + Sonar + auto-reviewer findings)
2. Extracts findings with categories (P0/P1/P2 severity if Copilot, severity if Sonar, etc.)
3. Clusters findings by similarity
4. Outputs a list of candidate error classes ranked by frequency
5. (Operator-review) Decides which warrant formalization as rules
6. Encodes formalized classes as machine-checkable rules (Sonar custom rule, AST-based linter, test pattern, or `.claude/rules/` entry that agents actually read)
7. Measures before/after: error class X appeared in Y% of PRs before rule; Z% after. If Z < Y meaningfully, rule worked.

Per Kestrel 2026-05-28: *"The sweet spot is probably 'named patterns that recur across multiple PRs and that a rule could plausibly catch.' Patterns that appear once are findings; patterns that appear three times are classes worth naming."*

## Operator framing

> *"we have bunches of agenst that auto review and then we find error classes and save the error classes as rules so we don't make them again. I also have don't of formal analysis static aanalysis like sonar and much others and warnings as errors etc. this all generates high signal training data for this benchmark itself."*

## Acceptance criteria

- `tools/error-class-extract/extract.ts` — reads recent closed PRs (configurable window), aggregates review threads via GitHub GraphQL, normalizes finding shape across reviewer sources
- `tools/error-class-extract/cluster.ts` — clusters findings by similarity (string-similarity + AST-shape + rule-id), outputs candidate classes with frequency-ranked recurrence count
- `tools/error-class-extract/effectiveness.ts` — for each landed rule, computes before/after error rate per class
- CLI report: `bun tools/error-class-extract/extract.ts --since 1week` produces markdown summary of (a) candidate classes ranked by recurrence, (b) effectiveness of rules landed since last run
- Composes with 081KSNY2Z0008QG0R003KG3JTG (Clifford-space embedding) — when that lands, clustering switches from string-similarity to geometric-distance in Clifford space
- Composes with 081KSNY2Z0008QG0R000HENSVM (DORA mandate) — error class extraction feeds change-failure-rate metric per class

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2 — operationally near-term; the highest-leverage substrate per Kestrel's framing: *"If extraction isn't already running, that's probably the highest-leverage next thing to build."*

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-trajectory-push-vs-pr-review-split-error-class-extraction-as-benchmark-training-data-clifford-space-uniqueness-emit-observe-limit-simulate-aaron-forwarded.md` § "The auto-review pipeline as training data generator" + § "The error class extraction as its own pipeline"
