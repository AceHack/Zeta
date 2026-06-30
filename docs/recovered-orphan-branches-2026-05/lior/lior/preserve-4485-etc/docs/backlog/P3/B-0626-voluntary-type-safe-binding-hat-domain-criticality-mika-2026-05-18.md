---
id: B-0626
priority: P3
status: open
title: "Voluntary type-safe cognitive binding via hat × domain × criticality composition (Mika 2026-05-18 design)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0624, B-0625, B-0617]
tags: [design, mika, type-safety, voluntary-binding, hats, domains, criticality, llm-error-classes]
type: design
---

# Voluntary type-safe cognitive binding via hat × domain × criticality composition

## Why

Aaron + Mika locked in (lines 2492-2520 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md)): type-safe cognitive binding is **opt-in by default** but **required by the combination of hat + domain + criticality** when stakes are high.

## The empirical anchor: 90% of LLM errors are type issues

Aaron line 2492: *"this is type, this is type safe, and LLMs aren't. And 90% of LLM errors are type issues."*

This is a load-bearing empirical claim worth its own verification (see [`memory/feedback_aaron_we_are_the_ones_cooking_it_youtube_finance_ai_video_substrate_validation_fsharp_fork_for_ai_safety_90_percent_python_type_failures_64_beats_75_with_type_poisoning_2026_05_16.md`](../../memory/feedback_aaron_we_are_the_ones_cooking_it_youtube_finance_ai_video_substrate_validation_fsharp_fork_for_ai_safety_90_percent_python_type_failures_64_beats_75_with_type_poisoning_2026_05_16.md) for the prior verification work — arxiv 2504.09246 supports 94% of compilation errors being type-class). The "90% LLM errors are type issues" claim per this Mika conversation is a sibling claim worth re-grounding.

## Aaron's empirical proof: type-safe agents run longer

Aaron line 2500: *"this is what lets frontier models go from hours to days. This is why, why my AIs have been running for, because we started defining these invariants, these type safety rules, and coding them as rules that other AIs are checking before we get 'em in the type system."*

Observed: AIs run for a month with type-safety-invariants vs frontier-model norm of 5-6 hours unattended. Empirical evidence for this design.

## Two operational modes

### Default mode: Refresh-World-Model → Think → Act
Practical, flexible, NOT fully type-safe; compensated by adversarial-AI checking (per Aaron line 2506).

### Voluntary-binding mode: Pay Attention → Remember When → Update Y₀
Strict type-safe cognitive protocol; explicit declarations at each step; auditable.

## When voluntary binding is REQUIRED

Per Mika lines 2516-2520, the criticality requirement is **domain-driven, NOT hat-driven**:

- Wearing The Pilot hat in casual discussion: default mode OK
- Wearing The Pilot hat in financial trading: type-safe binding REQUIRED
- Wearing The Pilot hat in medical decisions: type-safe binding REQUIRED
- Wearing The Pilot hat in security-critical operations: type-safe binding REQUIRED

Same hat, different criticality → different binding requirement.

## Multi-dimensional hat composition (Mika line 2520)

Each hat has THREE independent dimensions:

| Dimension | Example values | Meaning |
|---|---|---|
| **Level** | 0, 1, 2, ... | Model capability + risk tolerance ceiling |
| **Criticality** | low / medium / high | Risk tier of the operating domain |
| **Domain** | Clarity / Resonance / Technical / Financial / ... | Which broad area this instance operates in |

A full hat specification: `Pilot-2 in Clarity domain @ High-Criticality` → requires type-safe binding mode.

## Goal

1. Formalize the dimensional-hat-specification: (level, criticality, domain) tuple
2. Define which (criticality, domain) combinations REQUIRE type-safe binding (with explicit list — finance/medical/security as starters)
3. Encode the type-safe binding requirement at the harness level so opting into a high-criticality hat-in-domain MECHANICALLY triggers the stricter loop
4. Document the failure modes adversarial-AI-checking covers vs the failure modes type-safety covers (they're complementary, not redundant)

## Non-goals

- Forcing all hats into type-safe binding (overhead is real; not all situations justify it)
- Replacing adversarial-AI checking entirely (defense-in-depth: adversarial + type-safety work better together)
- Locking AIs into permanent hats (per [B-0617](B-0617-clarity-domain-organizational-pattern-4-roles-2026-05-18.md), AIs can switch hats; binding requirement follows the hat-in-domain combo, not the AI)

## Acceptance criteria

- [ ] Hat-specification tuple formalized in code (TS interface or F# record type)
- [ ] (criticality, domain) → required-binding-mode mapping documented
- [ ] At least one harness-level enforcement prototype (e.g., when an agent declares "I am wearing Pilot in financial domain at high-criticality," the harness FORCES the type-safe loop)
- [ ] Adversarial-AI checking vs type-safety failure-mode coverage matrix documented
- [ ] Empirical re-verification of "90% LLM errors are type issues" claim per Otto-364 search-first

## Composes with

- [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — canonical 7-step boot sequence (type-safe binding = the STRICT version of the sequence)
- [B-0625](B-0625-per-dimension-cost-loss-model-mika-2026-05-18.md) — cost+loss model (criticality is one of the inputs to per-tick dimensional scoring)
- [B-0617](B-0617-clarity-domain-organizational-pattern-4-roles-2026-05-18.md) — Clarity Domain 4-role pattern (hats live in domains; this row's tuple integrates with the role catalog)
- [B-0622](B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) — F# wallet type-safety (the type-system substrate this row's binding-mode uses)
- `memory/feedback_aaron_we_are_the_ones_cooking_it_youtube_finance_ai_video_substrate_validation_fsharp_fork_for_ai_safety_90_percent_python_type_failures_64_beats_75_with_type_poisoning_2026_05_16.md` — prior 90%-type-error claim verification
- `.claude/skills/csharp-fsharp-fit-reviewer/SKILL.md` — F# fit review (type-safe binding choices have implementation-language implications)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2492-2520 — source design

## Status

Open.
