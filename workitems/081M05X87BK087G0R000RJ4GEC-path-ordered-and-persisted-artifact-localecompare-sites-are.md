---
id: 081M05X87BK087G0R000RJ4GEC
type: task
state: backlog
priority: P3
slug: path-ordered-and-persisted-artifact-localecompare-sites-are
title: "Path-ordered and persisted-artifact localeCompare sites are ordering migrations, not sweep lines"
created: 2026-08-16T18:27:25.683Z
depends_on: []
composes_with: []
---

# Path-ordered and persisted-artifact localeCompare sites are ordering migrations, not sweep lines

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05X87BK087G0R000RJ4GEC-*.md` glob. -->

## Why these are migrations and not sweep lines

The culture-invariant sweep converted the sites whose **key domain was measured to
be divergence-free**, so no existing ordering changed. The sites listed in
`src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.baseline.json`
under the categories `ordering-change-migration` and
`persisted-artifact-migration` are the ones where conversion **does** change the
emitted order.

## The measurement that makes this concrete

Locale order vs code-point order, counted over pairs, on the domains that actually
occur here:

| domain | mismatching pairs | verdict |
|---|---|---|
| lowercase hex digests | 0 / 40 000 | safe — converted |
| uppercase Crockford ZetaIds | 0 / 40 000 | safe — converted |
| fixed-width ISO-8601 instants | 0 / 90 000 | safe — converted |
| agent-bus cursor `ISO\|32hex` | 0 / 40 000 | safe — converted |
| ragged ISO variants (`.sssZ` vs `+00:00`) | 2 / 93 025 | narrow; named |
| **real tracked `src/` paths** | **548 / 360 000** | **live divergence — migration** |
| mixed-case identifiers | ~11% of pairs | migration |

The path row is the one that matters: it is measured on the **actual repo tree**,
not a synthetic alphabet. Example: `ICheckpointReader.cs` vs `ICheckpointable.cs`
— locale order ignores case at the primary level and puts `able` first; code-point
order puts `R` (0x52) before `a` (0x61). So any path-ordered output changes the
moment it is converted.

## What has to happen per site

1. Identify whether the ordering reaches a **committed artifact** (a generated
   index, a shard, a `SHA256SUMS` file, a memory index) or only a transient
   report.
2. If committed: convert **and regenerate the artifact in the same commit**, so
   the diff shows the reorder once, deliberately, rather than as drift.
3. If a golden vector or byte-lock pins the order, regenerate it as a named
   byte-lock change — never quietly.

## Named instances

`persisted-artifact-migration`: `src/Core.TypeScript/observe/tick-shards.ts`,
`src/Core.TypeScript/memory/reindex-memory-md.ts`,
`src/Core.TypeScript/hygiene/healers/memory-reindex-certified.ts`,
`vocab/gen/MasterIndex.ts`, `vocab/gen/Reify.ts`,
`src/Core.TypeScript/installer/multiboot/sha256sums.ts`,
`src/Core.TypeScript/installer/multiboot/assemble.ts`,
`src/Core.TypeScript/installer/uefi-keyfile-esp.ts`, the two `migrations/b026*`
ruleset scripts.

`ordering-change-migration`: the `hygiene/audit-*` path sorters,
`src/Core.TypeScript/lint/doc-comment-history-audit.ts`,
`src/Core.TypeScript/planning/society-event-index-rebuild.ts`,
`src/Core.TypeScript/forge-host/github/archive-pr-reviews.ts`,
`src/Core.TypeScript/observe/surface-dsl.ts`,
`tests/cross-verification/*`,
`src/Core.TypeScript/playwright/github-ui/feature-diff.ts`,
`src/Core.TypeScript/skill-catalog/backfill_dv2_frontmatter.ts`.

## Secondary, and smaller than it sounds

There is also a **doc-level** defect worth folding in here: two helpers named
`ordinalCompare` — `src/Core.TypeScript/ace/build-graph.ts:191-203` and
`src/Core.TypeScript/forge-host/github/pr-manifest-shards.ts:336-344` — describe
themselves as *"the repo's canonical collation"*. They are `<`/`>`, i.e. UTF-16
**code unit**, and the canonical collation is code **point**. The comparison is
correct and locale-free; only the claim is wrong, and it is wrong only above the
BMP. Same class as the `pairKey` item.
