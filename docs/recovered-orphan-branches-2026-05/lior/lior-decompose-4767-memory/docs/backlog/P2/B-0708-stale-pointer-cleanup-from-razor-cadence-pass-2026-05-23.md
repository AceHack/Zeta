---
id: B-0708
priority: P2
status: open
title: "Stale-pointer cleanup across `.claude/rules/` — 87 candidates surfaced by razor-cadence pass 2026-05-23"
tier: governance
effort: M
created: 2026-05-23
last_updated: 2026-05-23
depends_on: []
composes_with: []
tags: [hygiene, rules, razor-cadence, stale-pointer-cleanup]
type: friction-reducer
---

# B-0708 — Stale-pointer cleanup across `.claude/rules/`

## What

The razor-cadence pass on 2026-05-23 (issue #3128 closed) ran `bun tools/hygiene/audit-rule-cross-refs.ts` across all 62 rule files and surfaced **87 stale-pointer candidates** (16% MISS rate on 543 total references).

Per the 9-variant taxonomy at `docs/hygiene-history/ticks/2026/05/14/1920Z.md`, ~5% MISSes are healthy (rule-acknowledged-transient / conditional / alternative-location / etc.). 16% is above the healthy floor — suggests **~70-80 real stale pointers** worth cleaning up.

## Why

Stale pointers in rules erode rule trustworthiness: when an auto-loaded rule cites a path that doesn't exist, future-Otto can't follow the pointer. Compounds over time as more rules cite each other.

## Acceptance criteria

- [ ] Run `bun tools/hygiene/audit-rule-cross-refs.ts --report stale-pointer-report.md` to capture full candidate list with file + reference context
- [ ] Apply 9-variant taxonomy classification to each candidate (concrete / glob / template-path / backlog-ID / legacy-noted / transient / anti-pattern / conditional / alternative-location)
- [ ] For each "real stale" candidate: fix the pointer OR remove the dead reference OR mark the reference as transient with explicit note
- [ ] Re-run audit; target ≤5% MISS rate (healthy-FP floor only)
- [ ] Land cleanup as a single PR or small slice of PRs (one per rule cluster if too large)

## Out of scope

- Authoring NEW rules — this is hygiene on EXISTING rule pointers
- Changing the rule-cross-refs audit tool — separate concern
- Adjusting the 9-variant taxonomy — that's its own substrate decision

## Composes with

- `tools/hygiene/audit-rule-cross-refs.ts` (the audit instrument that surfaced these)
- `docs/hygiene-history/ticks/2026/05/14/1920Z.md` (9-variant taxonomy reference)
- B-0192 (razor-cadence trigger mechanization — this row is a downstream finding of cadence operating correctly)
- `.claude/rules/encoding-rules-without-mechanizing.md` (cadence discipline that surfaced this gap)

## Substrate-honest framing

P2 because: stale pointers degrade rule discoverability but don't break factory operation. Naturally picked up by a hygiene-focused tick or paired with another rule-touching slice.

## Origin tick

Razor-cadence pass 2026-05-23 (issue #3128 closing comment). 9 days of cadence fires without a prior pass meant the stale-pointer count accumulated; this row captures the cleanup work that pass surfaced.
