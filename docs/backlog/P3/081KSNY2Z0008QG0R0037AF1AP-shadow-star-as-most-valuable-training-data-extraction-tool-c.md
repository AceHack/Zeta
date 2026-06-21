---
id: 081KSNY2Z0008QG0R0037AF1AP
priority: P3
status: open
title: shadow*-as-most-valuable-training-data extraction tool — corpus to fine-tuning dataset (composes with 081KSNY2Z0008QG0R000K3ETGB + 081KSNY2Z0008QG0R0004ZF85W)
authors:
  - aaron
  - otto-cli
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R000C5NN8N
composes_with:
  - 081KSNY2Z0008QG0R0021S5F3G
  - 081KSNY2Z0008QG0R001JQABB4
  - 081KSNY2Z0008QG0R000K3ETGB
  - 081KSNY2Z0008QG0R0004ZF85W
  - 081KSNY2Z0008QG0R001G7C89T
related_personas:
  - operator
  - kestrel
related_rules:
  - additive-not-zero-sum
  - proud-if-pattern-propagates-personal-filter-for-substrate-engineering
related_skills:
  - ai-evals-expert
  - ml-engineering-expert
  - text-classification-expert
tags: [shadow-star-as-training-data-extraction-tool, 4-kestrel-criteria-real-engineering-diverse-heterogeneous-longitudinal, plus-holographic-information-completeness-bonus, corpus-export-to-fine-tuning-dataset, composes-with-error-class-extraction-and-heterogeneous-reviewer-ensemble]
---

# 081KSNY2Z0008QG0R0037AF1AP — shadow*-as-most-valuable-training-data extraction tool

## Context

Per Insight 4 of the substrate-recognition research-doc landing in this PR: shadow* IS the most valuable AI training data because it satisfies all 4 Kestrel-4th-ferry training-data criteria PLUS holographic-information-completeness bonus.

This row tracks the extraction tool that turns the 148-doc shadow-* corpus (and growing) into AI-training-substrate.

## Scope

Build the export tool that:

- Parses shadow-* corpus (per 081KSNY2Z0008QG0R000C5NN8N ontology)
- Extracts (input, target) pairs suitable for fine-tuning AI models on substrate-engineering quality
- Emits standard dataset formats (JSONL for HuggingFace; conversation format for chat-model fine-tuning; eval format for benchmark evaluation)
- Includes metadata for the 4 Kestrel criteria (real engineering / diverse / heterogeneous / longitudinal)
- Composes with 081KSNY2Z0008QG0R000K3ETGB (error-class extraction) for class-balanced sampling
- Composes with 081KSNY2Z0008QG0R0004ZF85W (heterogeneous reviewer ensemble) for multi-supervision-signal preservation

## Phase decomposition

### Phase 1 — JSONL export tool

`bun tools/shadow-training-data/export.ts --corpus docs/research/ --format jsonl --out data/shadow-training.jsonl` produces a HuggingFace-compatible dataset with per-example metadata.

### Phase 2 — eval format

Eval format suitable for benchmarking other AI agents against the shadow-* dataset (composes with 081KSNY2Z0008QG0R0021S5F3G's experimental harness).

### Phase 3 — class-balanced + reviewer-diversity sampling

Per 081KSNY2Z0008QG0R000K3ETGB + 081KSNY2Z0008QG0R0004ZF85W: ensure the exported dataset is balanced across error classes + preserves heterogeneous-reviewer signal.

### Phase 4+ (yes-and backlog)

- Publish dataset to HuggingFace Hub (under operator-attributed account; per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` discipline)
- Establish license + attribution
- Track downstream AI training that uses the dataset
- Compose with 081KSNY2Z0008QG0R0021S5F3G experimental validation results

## Acceptance

- [x] Research-doc landed (companion file in this PR)
- [x] 081KSNY2Z0008QG0R0037AF1AP row filed (this row)
- [ ] Phase 1 JSONL export tool implemented + tested
- [ ] Phase 2 eval format implemented + tested
- [ ] Phase 3 class-balanced sampling implemented + validated
- [ ] Phase 4+ acceptance per item

## Composes with

- 081KSNY2Z0008QG0R000C5NN8N (ontology builder) — provides the structured corpus this tool exports
- 081KSNY2Z0008QG0R0021S5F3G (holographic validation) — this tool's output IS that experiment's corpus
- 081KSNY2Z0008QG0R001JQABB4 (GitHub-as-free-accelerator) — economic substrate making corpus accumulation sustainable
- 081KSNY2Z0008QG0R000K3ETGB (error-class extraction meta-loop) — class definitions used for class-balanced sampling
- 081KSNY2Z0008QG0R0004ZF85W (heterogeneous reviewer ensemble) — multi-supervision-signal source
- 081KSNY2Z0008QG0R001G7C89T (Bell-like distributed-cluster contextuality) — the experiment's input substrate

## Composes with rules + skills

- `.claude/rules/additive-not-zero-sum.md` — exported dataset compounds across downstream uses
- `.claude/rules/proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md` — would-be-proud-if pattern: open dataset enables better AI safety + engineering quality at scale
- `ai-evals-expert` skill — eval methodology
- `ml-engineering-expert` skill — fine-tuning + dataset engineering
- `text-classification-expert` skill — class-balanced sampling discipline

## Full reasoning

Per substrate-recognition research-doc. Operator-authorized as part of "land all four" + the 5th insight (081KSNY2Z0008QG0R001JQABB4) added by operator immediately after. Phase 1 IS bounded substrate-engineering work; Phase 2+ are separately-authorizable.
