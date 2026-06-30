---
id: B-0528
priority: P1
status: open
title: Class-level verify-before-state-claim lesson from Kenji-era pre-substrate work
created: 2026-05-16
last_updated: 2026-05-16
parent: B-0139
---

# B-0528 — Class-level verify-before-state-claim lesson

**Priority:** P1 (extracted from B-0139 blob)

**Effort:** S

## What
Encode the verify-before-state-claim audit lesson from B-0139. When filing a backlog row for new formalization or engineering work, the agent must grep the codebase for existing implementations BEFORE asserting "TRACTABLE START" or similar clean-start framing.

## Why
This is a class-level lesson explicitly required by B-0139 (Acceptance Criterion 6) to prevent lineage-discontinuity failure modes.

## Acceptance Criteria
1. Add a rule to `.claude/rules/` or `docs/research/` detailing the grep-before-claim lesson.
2. Ensure B-0130 audit-suite is aware of this specific class-level verify pattern.