---
id: 081KSNY2Z0008QG0R0004ZF85W
priority: P2
status: open
title: Heterogeneous auto-reviewer ensemble audit — diversity without correlated blind spots (multi-model + static analysis + formal tools + specialized prompts)
effort: M
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on: []
composes_with:
  - 081KSNY2Z0008QG0R000K3ETGB
  - 081KSNY2Z0008QG0R000HENSVM
tags:
  - heterogeneous-auto-reviewer-ensemble
  - diversity-without-correlated-blind-spots
  - multi-model-claude-gpt-gemini-grok
  - specialization-security-performance-architecture-style
  - non-ai-reviewers-sonar-codeql-semgrep-formal-tools
  - audit-existing-coverage
  - identify-blindspot-gaps
  - composes-with-error-class-extraction
  - potential-extension-not-committed
---

## What this row tracks

Audit the existing auto-reviewer ensemble for diversity gaps + propose additions where coverage is correlated (same-model multiple-times) or absent (no reviewer covers a known failure-mode class).

Per Kestrel 2026-05-28: *"The auto-reviewers need to be diverse enough that they don't share blind spots. If all your AI reviewers are the same underlying model, they have correlated failure modes — they'll all miss the same kinds of errors. The value comes from diversity: different models (Claude, GPT, Gemini, Grok), different prompting strategies, different specialization (one focused on security, one on performance, one on architecture, one on style), and crucially the non-AI reviewers (Sonar, static analyzers, formal tools) that have completely different failure modes than any AI."*

## Current state (rough audit)

- **AI reviewers** active on PRs: Copilot (multiple positions), Codex (when peer-call invoked), occasionally Grok/Gemini via cross-substrate ferry
- **Static analysis**: CodeQL, Semgrep, Sonar (where wired), warnings-as-errors via tsc/dotnet
- **Formal tools**: TLA+ (specs), Z3 (per claim), FsCheck (property tests), Stryker (mutation), Lean (where applicable)
- **Test runs**: build-and-test on ubuntu/macos
- **Specialized lint**: ~20 lint jobs (markdownlint, actionlint, shellcheck, tick-history-order, backlog-id-uniqueness, etc.)

## Acceptance criteria

- `tools/reviewer-audit/audit.ts` — produces a markdown report listing:
  - Current reviewers by class (AI-model / static-analysis / formal-tool / specialized-lint)
  - Per-class diversity assessment
  - Identified gaps: failure-mode classes with no reviewer; failure-mode classes covered by only one reviewer of same family
- Audit report at `docs/research/2026-XX-XX-auto-reviewer-ensemble-diversity-audit.md`
- Proposals (if gaps found) for additions: new reviewer types, prompting variations on existing models for specialization
- Composes with 081KSNY2Z0008QG0R000K3ETGB (error-class extraction) — known error classes from extraction inform what reviewers SHOULD cover

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2 — substantive but small scope; the audit itself is the deliverable, additions are follow-up rows.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-trajectory-push-vs-pr-review-split-error-class-extraction-as-benchmark-training-data-clifford-space-uniqueness-emit-observe-limit-simulate-aaron-forwarded.md` § "What auto-review structurally needs to work well"
