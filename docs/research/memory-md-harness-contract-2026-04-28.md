# MEMORY.md harness contract — leaked-source verification (Phase 0 of B-0066)

**Date:** 2026-04-28
**Status:** Phase 0 verification report; informs the Option A vs B vs C decision in B-0066.
**Source:** `../claude-code` (third-party Claude Code reference clone, read-only-no-vendoring per `feedback_search_internet_when_self_fixing_*`).
**Triggering ask:** Aaron 2026-04-28 — *"do the research [if needed] to see if [Option A bare-marker] works."*

---

## TL;DR

**Option A (pure marker) does NOT work** with the current harness. **Option B (auto-generated index, one-line-per-file format) IS the structurally-correct fix** AND is required by the harness's existing contract. **Option C (status quo + rerere) preserves the load-bearing format but does not address the deeper truth: the current MEMORY.md is already over the harness's caps and is being silently truncated.**

The decision is forced toward Option B by harness semantics, not just by Aaron's preference.

---

## Hard caps the harness enforces

From `../claude-code/src/memdir/memdir.ts:35-38`:

```typescript
export const MAX_ENTRYPOINT_LINES = 200
// ~125 chars/line at 200 lines. At p97 today; catches long-line indexes that
// slip past the line cap (p100 observed: 197KB under 200 lines).
export const MAX_ENTRYPOINT_BYTES = 25_000
```

**Both caps apply at session-start.** Whichever is hit first triggers truncation. From `claudemd.ts:381`:

```typescript
// Truncate MEMORY.md entrypoints to the line AND byte caps
```

The harness loads MEMORY.md verbatim, **truncates** to 200 lines / 25KB, and embeds that truncated content in the system prompt.

**Comparison to current state:**

| Metric | Cap | Current `memory/MEMORY.md` |
|---|---:|---:|
| Lines | 200 | 600+ |
| Bytes | 25,000 | ~376,000 |

The harness has been silently truncating us since the index passed line 200. The session-start system reminder even confirms this: *"WARNING: MEMORY.md is 563 lines and 376.2KB. Only part of it was loaded."* That's the harness telling us what it did.

**Implication:** the at-wake quick-scan service we *think* MEMORY.md is providing is **partially imaginary** — old entries past line 200 are not actually loaded into context. Future-Otto reads only the top 200 lines.

## The format the harness expects

From `../claude-code/src/services/extractMemories/prompts.ts:76-78`:

> **Step 2** — add a pointer to that file in `MEMORY.md`. `MEMORY.md` is an index, not a memory — each entry should be one line, under ~150 characters: `- [Title](file.md) — one-line hook`. It has no frontmatter. Never write memory content directly into `MEMORY.md`.
>
> - `MEMORY.md` is always loaded into your system prompt — lines after 200 will be truncated, so keep the index concise

Three load-bearing constraints from this:

1. **One line per memory file** with the format `- [Title](file.md) — hook`.
2. **Under ~150 characters per line** (not enforced by the harness, but advised).
3. **No frontmatter on MEMORY.md itself.**

A bare marker file like `# Memories live in memory/` violates constraint #1 (no per-file pointers). The harness's `extractMemories` service writes pointers in this format and expects to find them.

## The `memoryScan.ts` mechanism

From `../claude-code/src/memdir/memoryScan.ts:42`:

```typescript
const mdFiles = entries.filter(
  f => f.endsWith('.md') && basename(f) !== 'MEMORY.md',
)
```

The harness's memory-scanner walks `memory/`, **excludes** `MEMORY.md`, and reads each remaining `*.md`'s frontmatter (via `parseFrontmatter`). Memory files are independently discoverable through this scan — but only when the scan is invoked, which is not the default at session-start.

This is a key finding: **memory files DO have a route to discovery that bypasses MEMORY.md**, via the scan + the attachments mechanism described next.

## The `tengu_moth_copse` feature flag (the structural escape hatch)

From `../claude-code/src/utils/claudemd.ts:1136-1149` and `src/memdir/memdir.ts:422-426`:

```typescript
/**
 * When tengu_moth_copse is on, the findRelevantMemories prefetch surfaces
 * memory files via attachments, so the MEMORY.md index is no longer injected
 * into the system prompt.
 */
export function filterInjectedMemoryFiles(...)
```

When this feature flag is enabled, the harness:

1. Skips MEMORY.md injection entirely.
2. Uses `findRelevantMemories` (with file-attachment surfacing, up to 5 per session per `findRelevantMemories.ts:31`) to bring relevant memory files into context.
3. The bare-marker approach works in this mode because MEMORY.md isn't read at all.

**This is the long-horizon answer to Aaron's question.** When `tengu_moth_copse` becomes default-on, MEMORY.md ceases to be load-bearing — at which point a bare marker is fine.

Until then, MEMORY.md remains the at-wake quick-scan surface, capped at 200 lines / 25KB, with one-line-per-file format.

## The AutoDream / topic-file pattern

From `../claude-code/src/memdir/memdir.ts:322` and `prompts.ts:135`:

> A separate nightly process distills these logs into `MEMORY.md` and topic files.

There's an **AutoDream-style nightly distillation pipeline** that reads append-only date-named log files and distills them into MEMORY.md + topic files. This implies a workflow where MEMORY.md *is* periodically regenerated, not just appended to.

Project-level (in-repo) MEMORY.md is governed differently from auto-memory MEMORY.md — but the principle ("regenerate, don't hand-edit") transfers cleanly to the in-repo case.

## Recommendation: Option B with two operational changes

Update B-0066 to specify:

### 1. Auto-generate the index

Author `tools/memory/generate-memory-index.sh` modelled on `tools/backlog/generate-index.sh`:

- Walk `memory/*.md` (excluding `memory/MEMORY.md` itself).
- For each file, parse frontmatter, extract `name:` + `description:`.
- Emit one line per file: `- [{name}](filename.md) — {description-truncated-to-fit-150-chars}`.
- Sort by frontmatter `created:` field descending (newest first), with the existing per-row `- [...]` format preserved.
- **Cap output at 195 lines** (5-line headroom under the 200-line truncation).
- Pre-commit hook regenerates on any `memory/*.md` add or modify.
- CI drift-check workflow.

This satisfies all three harness constraints AND eliminates the git-hotspot.

### 2. Stop pretending the over-200-line content is loaded

Today's MEMORY.md has 600+ lines. Lines 201-600 are **dead substrate** at the harness layer — they're written and recorded but not in the agent's working context at session-start. Two fixes:

- **Truncate the in-tree file** to ~195 lines (newest-first; older entries continue to live in their `memory/*.md` files and are findable via memory-scan but not in the at-wake index).
- **Document the cap** in `memory/README.md` so future contributors understand why MEMORY.md is bounded.

### 3. Track the `tengu_moth_copse` graduation

Whenever the feature flag flips on (whether by Anthropic's default change, by a per-project setting, or by a future Q1 AutoDream/AutoMemory rollout), the entire MEMORY.md index becomes optional. At that point, Option A (bare marker) becomes viable. Add a TECH-RADAR row to track the flag's status.

## Why Option A (bare marker) was wrong as written

A bare marker file would:

- **Break `extractMemories`'s expected format.** The service writes pointers in `- [Title](file.md) — hook` shape and expects to find them. A bare marker has no pointers.
- **Lose the at-wake quick-scan service** without compensating mechanism (assuming `tengu_moth_copse` is OFF, which is the default).
- **Look like a regression** to the harness — MEMORY.md goes from "informative index" to "no information," and at-wake context becomes empty for the first ~200-line slot.

The right intuition Aaron had ("just point at memory/") is correct **for the long-horizon target** (post-`tengu_moth_copse` graduation). For now, the structural fix is the **auto-generated index** that produces the same format the harness already expects but eliminates manual editing.

## What this report does NOT do

- Does NOT clone or vendor the Claude Code source. The clone at `../claude-code` is read-only-no-vendoring per the boundary in `feedback_search_internet_when_self_fixing_*`.
- Does NOT replace Anthropic's published Claude Code documentation. If published docs disagree with anything here, the docs win and this report should be updated.
- Does NOT propose a timeline. B-0066's phasing covers that.

## Next step

Update B-0066 with these findings. Recommend Option B as the canonical path. Phase 0 is now COMPLETE; B-0066 advances to Phase 1 (generator authoring).
