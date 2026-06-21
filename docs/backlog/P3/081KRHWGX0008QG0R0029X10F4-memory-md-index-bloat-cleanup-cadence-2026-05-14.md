---
id: 081KRHWGX0008QG0R0029X10F4
priority: P3
status: open
title: "MEMORY.md index bloat cleanup + entry-length enforcement cadence"
tier: substrate-hygiene
effort: M
created: 2026-05-14
last_updated: 2026-05-14
depends_on: []
composes_with: [081KQ0YZ80008QG0R001V0XCYZ]
tags: [memory, MEMORY.md, fast-path, index-hygiene, razor-cadence, user-scope]
type: chore
---

# MEMORY.md index bloat cleanup + entry-length enforcement cadence

## Origin

Otto-CLI 2026-05-14T19:27Z razor-cadence item 5 (MEMORY.md index audit) investigation found:

- **`~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/MEMORY.md` has grown to 242 lines / 66KB / 237 entries** (the user-scope MEMORY.md, NOT the repo-scope one).
- Cold-boot loads the first 200 lines / 25KB only; **~37 lines (15%) past the cutoff are unreachable at fast-path** for new sessions.
- **Average entry size: 275 chars** — well over the 200-char "one line" guidance in the auto-memory system prompt.
- **10+ entries exceed 500 chars** — each is a paragraph rather than an index line; the bloat is concentrated in recent additions.

## Examples of over-long entries

```
620 chars: [Reverse-engineer Gates physical ECCs for minimalist memory storage...]
613 chars: [Devil + god play within universal logic...]
608 chars: [Dialectical viewpoint = Aaron's natural operation...]
582 chars: [NEVER A CAGE — binding alignment force of attention...]
575 chars: [Constraints as self-binding against acknowledged temptation...]
```

## Why this matters

Per the auto-memory system: "MEMORY.md is always loaded into your conversation context — lines after 200 will be truncated, so keep the index concise." The current state silently drops the most recent ~37 entries from cold-boot visibility. The bloat compounds: each oversized entry's "tail" prose duplicates content that already lives in the topic file's frontmatter `description:` field and body.

## Proposed work

Two phases:

### Phase 1 — bulk cleanup (one-time)

For each entry exceeding 200 chars:

1. Read the underlying topic file
2. Verify the topic file's body + frontmatter `description:` contain the full detail (no information loss from trimming the index)
3. Rewrite the MEMORY.md entry to: `- [Short Title](filename.md) — one-line hook (~50-100 chars).`

Roughly 100-130 entries need trimming. Manageable in 3-5 ticks.

### Phase 2 — mechanized enforcement (cadence)

Add `tools/hygiene/audit-user-scope-memory-index.ts` that:

- Reads the user-scope MEMORY.md
- Reports total line count, byte count, entry count
- Flags entries over 200 chars
- Computes truncation risk (lines past 200)
- Exits 0 always (detect-only); future ticks consume the report

This parallels `tools/hygiene/audit-rule-cross-refs.ts` (PR #3202) — same shape, different surface. Could compose with 081KRHWGX0008QG0R002DPG02X (worktree-prune cadence) as one of several factory-hygiene CI crons.

## Composes with

- 081KQ0YZ80008QG0R001V0XCYZ (memory-md hub compression — prior cleanup work on MEMORY.md)
- `tools/hygiene/audit-rule-cross-refs.ts` (PR #3202 — parallel mechanization)
- Razor-cadence #3128 daily fire (item 5 is the MEMORY.md index audit)
- `encoding-rules-without-mechanizing.md` rule

## Substrate-honest framing

Cleanup is invasive (touching ~130 entries in user-scope memory) but each individual edit is mechanical: replace the long description with the topic file's frontmatter-derived hook. The risk is semantic (does the trim preserve enough triage signal in cold-boot context?). Mitigation: phase 1 is reviewable per-entry; entries can be expanded back if the trim lost a load-bearing signal.

User-scope memory is not git-tracked, so this work doesn't go through PR in the usual sense. The Phase 2 mechanization tool IS git-tracked and follows the standard factory shape.

## Origin tick

`docs/hygiene-history/ticks/2026/05/14/1927Z.md` — this tick's shard documents the empirical observation.
