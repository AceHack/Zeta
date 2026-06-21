# Skill Routing Budget — why description length is load-bearing

## The constraint

Every AI harness that routes skills by description has a
**context budget** for the skill listing. The listing competes
with the conversation, the system prompt, and the codebase
context for the same finite window.

In Claude Code, the knob is `skillListingBudgetFraction`
(default 1% of context). Other harnesses have equivalent
limits — Cursor's `.cursorrules` competes with file context;
Codex's system prompt has a hard token cap; any harness that
lists capabilities at session start pays the same cost.

## The math (Claude Code, 200K effective context)

| Budget fraction | Token budget | Avg tokens/skill | Skills that fit |
|---|---|---|---|
| 1% (default) | ~2,000 | 50 (paragraph) | ~40 |
| 1% | ~2,000 | 15 (carved sentence) | ~133 |
| 2% (current Zeta setting) | ~4,000 | 50 (paragraph) | ~80 |
| 2% | ~4,000 | 15 (carved sentence) | ~266 |
| 3% | ~6,000 | 50 (paragraph) | ~120 |

**Budget fraction is a lever; description length is the
multiplier.** Raising the fraction costs context everywhere.
Shortening descriptions costs nothing.

With 200+ skills, paragraph-length descriptions at 1% budget
means 80% of skills are invisible to the router — dropped
before the agent even sees them. `/doctor` reports this as
"descriptions dropped."

## The fix: carved-sentence descriptions

The `description:` frontmatter field in each SKILL.md has
one job: **trigger correct routing**. It is not a README.
It is not documentation. It is a search key.

### Rules

1. One sentence, under 120 characters preferred
2. Name the domain and 3-7 key routing terms
3. No boilerplate ("Capability skill (hat)", "Owns the...")
4. No citation chains or "Defers to..." — body content
5. Test: cold-start agent + ambiguous task → correct match?

### Example

```yaml
# Before (truncated/dropped by router):
description: >
  Capability skill ("hat") — Elasticsearch / OpenSearch
  narrow. Owns the distributed engine layer above Lucene:
  cluster topology, shard allocation, ILM, ingest pipeline,
  dynamic mappings, Query DSL, aggregations, kNN search,
  hybrid search with RRF, reindex API, snapshot/restore,
  cross-cluster search/replication, index templates, roles,
  role-mappings, API keys, security model, data-streams,
  Watcher, ES|QL, search-application, behavioural-analytics,
  OpenSearch fork divergence...

# After (fits budget, routes correctly):
description: >
  Elasticsearch / OpenSearch — shards, ILM, Query DSL,
  aggregations, kNN, cross-cluster, security.
```

## Harness-specific notes

| Harness | Budget mechanism | Diagnostic |
|---|---|---|
| Claude Code | `skillListingBudgetFraction` in settings.json | `/doctor` |
| Cursor | `.cursorrules` size limit (~6K chars) | manual |
| Codex | system prompt token cap | manual |

The carved-sentence discipline applies to ALL harnesses.
The budget fraction knob is Claude Code specific. Other
harnesses need their own equivalent tuning.

## Diagnostic

```bash
# Claude Code: run /doctor to check skill listing health
# Look for:
#   "descriptions exceed the per-entry cap"
#   "descriptions dropped"
```

## Tracked at

- 081KR50HA0008QG0R002ZNFQBZ (carved-sentence skill descriptions)
- `skillListingBudgetFraction` raised to 0.02 as immediate
  mitigation (2026-05-09)
