# MEMORY.md harness contract — observed-behavior verification (Phase 0 of B-0066)

**Date:** 2026-04-28
**Status:** Phase 0 verification report; informs the Option A vs B vs C decision in B-0066.
**Source basis:** Empirical observation of the Claude Code harness's session-start behavior, plus the harness's own warning messages it emits when the contract is violated. Findings are restated in our own words; no third-party source is vendored.
**Triggering ask:** Aaron 2026-04-28 — *"do the research [if needed] to see if [Option A bare-marker] works."*

---

## TL;DR

**Option A (pure marker) does NOT work** with the current harness. **Option B (auto-generated index, one-line-per-file format) IS the structurally-correct fix** AND is required by the harness's existing contract. **Option C (status quo + rerere) preserves the load-bearing format but does not address the deeper truth: the current MEMORY.md is already over the harness's caps and is being silently truncated.**

The decision is forced toward Option B by harness semantics, not just by Aaron's preference.

---

## Hard caps the harness enforces

The harness applies two truncation caps on `MEMORY.md` at session-start:

- **A line cap of approximately 200 lines.**
- **A byte cap of approximately 25 KB.**

Whichever is hit first triggers truncation; content past either cap is silently dropped from the system-prompt injection.

**Comparison to current state:**

| Metric | Cap | Current `memory/MEMORY.md` |
|---|---:|---:|
| Lines | ~200 | 600+ |
| Bytes | ~25,000 | ~376,000 |

The harness has been silently truncating us since the index passed line 200. The session-start system reminder confirms this directly — when MEMORY.md is over-cap, the harness emits its own warning along the lines of: *"WARNING: MEMORY.md is N lines and KB. Only part of it was loaded."* That self-reported warning is the load-bearing evidence here, not any source-level inspection.

**Implication:** the at-wake quick-scan service we *think* MEMORY.md is providing is **partially imaginary** — old entries past line 200 are not actually loaded into context. Future-Otto reads only the top 200 lines.

## The format the harness expects

The harness's memory-extraction subsystem writes new memory pointers in a strict shape, and the at-wake injection assumes that shape. From observed behavior plus the harness's own author-time guidance:

- Each pointer is **one line** per memory file.
- Pointer format is `- [Title](file.md) — hook` (a Markdown link followed by a hook-phrase separated by an em-dash).
- Pointers should stay **concise** — roughly under 150 characters per line is a practical target so that more pointers fit within the line and byte caps.
- `MEMORY.md` itself **does not carry frontmatter** (frontmatter belongs in the per-memory `*.md` files).

Three load-bearing constraints follow from this:

1. **One line per memory file** with the format `- [Title](file.md) — hook`.
2. **Keep each line concise** so the index remains scannable and survives the truncation window; ~150 characters is a practical target.
3. **No frontmatter on MEMORY.md itself.**

A bare marker file like `# Memories live in memory/` violates constraint #1 (no per-file pointers). The harness's memory-extraction flow writes pointers in this shape and depends on `MEMORY.md` being an index rather than an inline memory document.

## The memory-scan mechanism

The harness has an explicit memory-scanner that walks the `memory/` directory, considers each `*.md` file *other than* `MEMORY.md` itself, and reads each file's frontmatter to learn what's there. Memory files are independently discoverable through this scan — but the scan is invoked only at certain points, not as the default at session-start.

This is a key finding: **memory files DO have a route to discovery that bypasses MEMORY.md**, via the scan + the per-file attachment surfacing described next.

## The feature-flag escape hatch

The harness has a feature flag (project-level / Anthropic-controlled) that, when enabled, changes the at-wake behavior:

1. **Skips `MEMORY.md` injection** entirely from the system prompt.
2. **Surfaces relevant memory files via attachments** through a separate "find relevant memories" prefetch (capped at a small number — observed behavior is on the order of 5 per session).
3. The bare-marker approach works in this mode because `MEMORY.md` isn't read at all.

**This is the long-horizon answer to Aaron's question.** When the feature flag becomes default-on, `MEMORY.md` ceases to be load-bearing — at which point a bare marker is fine.

Until then, `MEMORY.md` remains the at-wake quick-scan surface, capped at ~200 lines / ~25 KB, with one-line-per-file format.

## The AutoDream / topic-file pattern

The harness also implies an **AutoDream-style nightly distillation pipeline** — a separate process that reads append-only log files (date-named) and distills them into `MEMORY.md` + topic files. This implies a workflow where `MEMORY.md` *is* periodically regenerated, not just appended to.

Project-level (in-repo) `MEMORY.md` is governed differently from per-user auto-memory `MEMORY.md` — but the principle ("regenerate, don't hand-edit") transfers cleanly to the in-repo case.

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

Today's `MEMORY.md` has 600+ lines. Lines 201-600 are **dead substrate** at the harness layer — they're written and recorded but not in the agent's working context at session-start. Two fixes:

- **Truncate the in-tree file** to ~195 lines (newest-first; older entries continue to live in their `memory/*.md` files and are findable via memory-scan but not in the at-wake index).
- **Document the cap** in `memory/README.md` so future contributors understand why MEMORY.md is bounded.

### 3. Track the feature-flag graduation

Whenever the bare-marker-compatible feature flag flips on (whether by Anthropic's default change, by a per-project setting, or by a future Q1 AutoDream/AutoMemory rollout), the entire `MEMORY.md` index becomes optional. At that point, Option A (bare marker) becomes viable. Add a TECH-RADAR row to track the flag's status.

## Why Option A (bare marker) was wrong as written

A bare marker file would:

- **Break the harness's expected pointer format.** The memory-extraction flow writes pointers in `- [Title](file.md) — hook` shape and expects to find them. A bare marker has no pointers.
- **Lose the at-wake quick-scan service** without compensating mechanism (assuming the bare-marker-compatible feature flag is OFF, which is the default).
- **Look like a regression** to the harness — `MEMORY.md` goes from "informative index" to "no information," and at-wake context becomes empty for the first ~200-line slot.

The right intuition Aaron had ("just point at memory/") is correct **for the long-horizon target** (post-feature-flag graduation). For now, the structural fix is the **auto-generated index** that produces the same format the harness already expects but eliminates manual editing.

## What this report does NOT do

- Does NOT vendor any third-party source. All findings are restated in our own words from observed behavior + the harness's own session-start warning messages. The Claude Code reference clone the maintainer keeps for self-fix research is read-only-no-vendoring per `feedback_search_internet_when_self_fixing_*`; this report respects that boundary.
- Does NOT replace Anthropic's published Claude Code documentation. If published docs disagree with anything here, the docs win and this report should be updated.
- Does NOT propose a timeline. B-0066's phasing covers that.

## Next step

Update B-0066 with these findings. Recommend Option B as the canonical path. Phase 0 is now COMPLETE; B-0066 advances to Phase 1 (generator authoring).
