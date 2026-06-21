---
id: 081KRHWGX0008QG0R0005PJNAB
parent: 081KQ3HBZ0008QG0R002S674CG
priority: P1
status: open
title: AI ethics + safety research track — retractibility-and-log check
tier: substrate-foundational-discipline
effort: S
created: 2026-05-14
last_updated: 2026-05-14
depends_on: []
tags: [ai-ethics, safety, retractibility, alignment]
type: friction-reducer
---

# 081KRHWGX0008QG0R0005PJNAB — Retractibility-and-log check

## The Drift

Extracted from 081KQ3HBZ0008QG0R002S674CG umbrella. This implements the first check: verifying that any candidate adoption preserves retractibility.

## Core Mandate

Per math-safety memory, the gate's job is to verify that any candidate adoption preserves retractibility (additive rewrite, git-tracked, one-commit removable) and lands in the log.

The three-filter discipline (F1/F2/F3) tests structural match; this check ensures the adoption operation itself is retractible and audit-visible.

No candidate is blocked merely for being edgy — blocking would itself be a prose-safety-hedge that hurts crystallization without adding retractibility information. Blocking is reserved for operations that break retractibility (e.g., force-publication to a distribution channel we cannot rescind).

## Implementation

- Document the retractibility gate verification criteria.
- Integrate into the `alignment-auditor` skill checks.
