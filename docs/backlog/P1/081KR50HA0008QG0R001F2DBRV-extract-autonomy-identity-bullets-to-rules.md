---
id: 081KR50HA0008QG0R001F2DBRV
priority: P1
status: closed
title: "Extract autonomy/identity bullets to .claude/rules/"
created: 2026-05-09
last_updated: 2026-05-09
closed: 2026-05-09
closed_by: "All 6 original bullets already extracted before this item was worked"
depends_on:
  - 081KR50HA0008QG0R000ZKBHE4
decomposition: atomic
classification: buildable-now
type: friction-reducer
owners: [architect]
parent: 081KR2E4K0008QG0R001F0YB5S
---

# 081KR50HA0008QG0R001F2DBRV — Extract autonomy/identity bullets to `.claude/rules/`

## What

Extract the following CLAUDE.md bullets into standalone
`.claude/rules/<name>.md` files:

Target bullets (autonomy & identity — who the agent is):

1. **No directives** (~20 lines)
2. **Don't ask permission within authority scope** (~37 lines)
3. **Otto is an edge-runner** (~36 lines)
4. **Edge-defining work is NOT speculation** (~33 lines)
5. **No-op cadence is the failure mode** (~33 lines)
6. **Shard-cadence triumph** (~28 lines)

## Why

These 6 bullets account for ~190+ lines. They define agent
autonomy posture and identity framing. Extracting to
`.claude/rules/` preserves auto-load while shrinking CLAUDE.md.

## Acceptance criteria

1. 6 new `.claude/rules/<name>.md` files created.
2. Each follows the carved-sentence + operational-content
   structure.
3. CLAUDE.md bullets replaced with 1-2 line pointers.
4. Build gate passes.

## Effort

M — mechanical extraction, ~2 hours.
