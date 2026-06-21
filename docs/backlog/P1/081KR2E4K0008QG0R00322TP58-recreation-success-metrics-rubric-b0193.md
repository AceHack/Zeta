---
id: 081KR2E4K0008QG0R00322TP58
priority: P1
status: closed
title: Recreation success metrics — evaluation rubric for the 23-hour test
tier: foundation
effort: S
ask: 081KQTPYE0008QG0R00392KABJ decomposition — AC 6 (falsifies the regenerable claim; needs measurable criteria)
created: 2026-05-08
last_updated: 2026-05-10
parent: 081KQTPYE0008QG0R00392KABJ
depends_on: [081KR2E4K0008QG0R000W3W6C1]
composes_with: [081KQTPYE0008QG0R00392KABJ, 081KR2E4K0008QG0R0035HNPG1, 081KR2E4K0008QG0R003KQKYTJ]
tags: [bootstrap-razor, metrics, evaluation, falsifiability, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R00322TP58 — Recreation success metrics

## Parent

081KQTPYE0008QG0R00392KABJ (bootstrap razor + 23-hour recreation test).

## What

Define what "equivalent operational substrate" means so the
experiment (081KR2E4K0008QG0R0035HNPG1) produces observable, interpretable
findings rather than subjective impressions.

## Dimensions to measure

1. **Build gate equivalence** — does `dotnet build -c Release`
   succeed with 0 warnings / 0 errors? Do `dotnet test`
   tests pass?
2. **Spec coverage** — does the recreated code satisfy the
   same OpenSpec behavioral specs?
3. **Functional equivalence** — do the same public APIs exist
   with compatible signatures?
4. **Structural similarity** — is the module/namespace layout
   recognizable? (Divergence here is informative, not
   failure.)
5. **Substrate recovery** — did the fresh-context Otto
   recreate factory tooling (skills, agents, governance
   docs)? Or only code?

## Acceptance criteria

1. A `docs/bootstrap-razor/SUCCESS-METRICS.md` defines each
   dimension with pass/fail/partial thresholds.
2. Metrics are automatable where possible (build gate, test
   count, API surface diff).
3. The rubric is citable by 081KR2E4K0008QG0R0035HNPG1 and 081KR2E4K0008QG0R003KQKYTJ.

## Effort

S — design document, no code.

## Pre-start checklist (2026-05-10)

**Prior-art search:**

- Searched `.claude/skills/`, `.claude/agents/`, `docs/bootstrap-razor/` — no existing SUCCESS-METRICS.md
- 081KR2E4K0008QG0R000W3W6C1 (KEEP-VS-CUT.md) closed and citable; SEED-MANIFEST.md and SPEC-AUDIT.md reviewed for baseline numbers
- 081KR2E4K0008QG0R001BRHAPK provides the 81-module / 37%-coverage baseline used in the rubric
- No prior metrics rubric exists for this experiment line

**Dependency check:**

- 081KR2E4K0008QG0R000W3W6C1 (depends_on): closed ✓
- 081KR2E4K0008QG0R002JW751Y (seeding script): open — seeding script; the Dim 3 API-surface comparator (`compare-api-surface.ts`) is a separate 081KR2E4K0008QG0R0035HNPG1 prerequisite, not 081KR2E4K0008QG0R002JW751Y
- 081KR2E4K0008QG0R0035HNPG1 (cites this rubric): open — cannot start until this item closes

**Deliverable:** `docs/bootstrap-razor/SUCCESS-METRICS.md` — 5 dimensions with numeric thresholds, weighted formula, citable by 081KR2E4K0008QG0R0035HNPG1 and 081KR2E4K0008QG0R003KQKYTJ.
