---
id: 081KR50HA0008QG0R000239VTZ
priority: P1
status: closed
title: "Concept search index — pre-built term→file mapping for instant lookups"
effort: S
created: 2026-05-09
last_updated: 2026-05-10
resolved: 2026-05-09
resolved_by: "PR #2322 feat(081KR50HA0008QG0R000239VTZ): smallest safe slice — concept search index (curated regex term→file); PR #2323 feat(081KR50HA0008QG0R000239VTZ): concept search index — build-index.ts, lookup.ts, AND semantics, tests"
depends_on: [081KR2E4K0008QG0R003DS2XHJ]
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [search, index, concept-registry, performance]

---

# 081KR50HA0008QG0R000239VTZ — Concept search index

## What

Build a pre-computed term→file index over memory/, docs/,
and .claude/ so concept lookups are instant instead of
grep-slow.

### Problem

`grep -rn "Confucius" memory/ docs/ .claude/` scans ~1500
files every time. With 930 in-repo memory files, 200+ skills,
and hundreds of docs, this takes seconds. Agents do this
lookup frequently (prior-art search, concept discovery,
lineage tracing).

### Solution

`tools/search/build-index.ts` — pre-builds a JSON index:
```json
{
  "confucius": ["memory/feedback_confucius_unfolding_*.md", ...],
  "pearl": ["reference_formal_methods_literature_map_*.md", ...],
  "shield": ["docs/backlog/P2/081KR50HA0008QG0R003B2V26J-*.md", ...]
}
```

`tools/search/lookup.ts <term>` — queries the index, returns
file paths in <1ms.

Index rebuilt on commit (or on-demand via `bun tools/search/build-index.ts`).

## Acceptance criteria

- [x] `bun tools/search/build-index.ts` builds index in <5s — measured 2.55s (2026-05-10)
- [x] `bun tools/search/lookup.ts <term>` returns results in <100ms — measured 0.6ms (2026-05-10)
- [x] Index covers memory/, docs/, .claude/skills/, .claude/rules/, .claude/agents/
- [x] Supports multi-word queries (AND semantics) — implemented via `words.every()` filter

## Resolution

Shipped in two PRs merged 2026-05-09:

- PR #2322 `feat(081KR50HA0008QG0R000239VTZ): smallest safe slice — concept search index (curated regex term→file)` — introduced curated-not-corpus design (Vera 2026-05-09 guardrails), 8 concept-query classes
- PR #2323 `feat(081KR50HA0008QG0R000239VTZ): concept search index — build-index.ts, lookup.ts, AND semantics, tests` — full implementation: `tools/search/build-index.ts`, `tools/search/lookup.ts`, `tools/search/concept-index.ts`, 13 passing tests

Verified 2026-05-10: all acceptance criteria met. Status updated to closed.

## Origin

Aaron 2026-05-09: "why did this grep take so long? we need
to have an index"

## Composes with

- 081KR2E4K0008QG0R003DS2XHJ (concept-registry — structured concept IDs)
- 081KR50HA0008QG0R001G4QHQF (anchor to human lineage — needs fast lookup)
- 081KR2E4K0008QG0R002FRQZN4 (load-bearing classifier — needs to scan references)
