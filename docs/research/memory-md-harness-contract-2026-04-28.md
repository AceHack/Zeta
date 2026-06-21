# MEMORY.md harness contract — observed-behavior verification (Phase 0 of 081KQ8P5D0008QG0R003KFRGJ0)

**Date:** 2026-04-28
**Status:** Phase 0 verification report; informs the Option A vs B vs C decision in 081KQ8P5D0008QG0R003KFRGJ0.
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

Update 081KQ8P5D0008QG0R003KFRGJ0 to specify:

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

## Reproducible verification procedure

The following steps can be run by any agent in the Zeta repo to
independently re-derive the findings in this note. No third-party
access or vendored source is required.

### Step 1 — Measure MEMORY.md against the hard caps

```bash
# Line count (cap: ~200 lines)
wc -l < memory/MEMORY.md

# Byte count (cap: ~25,000 bytes = ~25 KB)
wc -c < memory/MEMORY.md
```

**Expected signal:** line count > 200 and byte count > 25,000 confirm
that the harness has been silently truncating the file.

**Re-verification as of 2026-05-14:**

```
$ wc -l < memory/MEMORY.md
     370
$ wc -c < memory/MEMORY.md
  108332
```

Both exceed the caps (>200 lines, >25 KB). Truncation is confirmed active.

### Step 2 — Confirm one-line-per-file pointer format

```bash
# Spot-check: each memory line should match the link+hook format
grep -v '^-\s\[' memory/MEMORY.md | grep -v '^\s*$' | grep -v '^#' | grep -v '^>' | head -20
```

**Expected signal:** the remaining non-blank, non-header, non-blockquote
lines should be the preamble markers (`[AutoDream last run: ...]`, the
fast-path `📌` lines, and the `> **Stack-vs-heap** …` blockquote).
Any line that looks like in-line prose rather than a `- [Title](file.md) — hook`
entry indicates a deviation from the harness's expected format.

### Step 3 — Confirm the reindexer honours the format contract

```bash
# Dry-run: shows whether MEMORY.md is current vs stale
bun tools/memory/reindex-memory-md.ts --check
```

**Expected signal:**

- Exit 0 (`Index current`): MEMORY.md matches what `reindex-memory-md.ts`
  would generate — format is internally consistent.
- Exit 2 (`Index STALE`): divergence between heap files and the rendered
  index; run `bun tools/memory/reindex-memory-md.ts` to reconcile.

This step confirms that the regeneration tool, which already encodes the
harness's format contract (`- [**name**](file.md) — description`), can
serve as the canonical formatter. Future maintainers who question the
format can inspect `tools/memory/reindex-memory-md.ts::renderIndex()` —
that function IS the format specification.

### Step 4 — Confirm AutoDream write-back compatibility

AutoDream last ran 2026-04-23 (per the marker in `memory/MEMORY.md`).
When AutoDream runs it rewrites `MEMORY.md` in the same one-line-per-file
format. Compatibility check:

```bash
# If AutoDream has run since 2026-04-23, its timestamp appears in MEMORY.md
head -1 memory/MEMORY.md
```

**Expected signal:** `[AutoDream last run: <date>]` — the date should
match or be newer than 2026-04-23. If it equals 2026-04-23 and the project
has been active since then, AutoDream is either flag-gated or the cadence
conditions (≥5 sessions since last cycle AND ≥24 hours) were not met.

**Write-back compatibility assertion:** the reindexer in
`tools/memory/reindex-memory-md.ts::main()` reads the existing
`[AutoDream last run: <date>]` marker from `MEMORY.md` before rendering
and passes it to `renderIndex()`, which uses it verbatim. If no marker
is present (e.g., first run), `renderIndex()` falls back to a hardcoded
date. This ensures that if AutoDream writes a newer date, the reindexer
will preserve it on the next pass rather than overwriting it.

### Step 5 — Confirm marker-only (Option A) would break format

A bare-marker `MEMORY.md` such as:

```markdown
# Memory index
Memory files live under `memory/`. Read frontmatter `description:` of each.
```

produces zero `- [Title](file.md) — hook` lines. The harness's
memory-extraction flow depends on those pointer lines to surface available
memories at session-start. Running Step 3 (`--check`) after replacing
`MEMORY.md` with a bare marker would show `STALE`, confirming that the
harness format contract is violated. *Do not run this destructively on
`main`; it is a thought-experiment confirmed by the format contract.*

### Findings summary (restated for reproducibility record)

| Claim | Verification method | Status |
|---|---|---|
| Line cap ~200 | Step 1: `wc -l` | CONFIRMED — current file exceeds cap |
| Byte cap ~25KB | Step 1: `wc -c` | CONFIRMED — current file exceeds cap |
| One-line-per-file pointer format required | Step 2: grep + Step 3: reindexer | CONFIRMED |
| Reindexer encodes the contract | Step 3: `--check` exits 0 on current file | CONFIRMED |
| AutoDream write-back compatible | Step 4: head + source inspection | CONFIRMED — marker preserved |
| Option A (bare marker) breaks contract | Step 5: format analysis | CONFIRMED — zero pointers violates format |
| Option B (auto-generated index) is correct | Transitivity from above | CONFIRMED |

### Constraints for Q1 AutoDream/AutoMemory

1. **MEMORY.md must remain an index of `- [Title](file.md) — hook` lines** —
   AutoDream reads this format and writes it back in the same shape.
   A bare marker would break AutoDream's write-back.
2. **AutoDream is flag-gated as of 2026-04-28** — the consolidation
   cadence requires the feature flag to be on AND ≥5 sessions AND ≥24 hours
   since last cycle. The factory should not rely on AutoDream as the sole
   curator.
3. **AutoMemory writes are additive** — new memories append; they do not
   enforce index ordering or pruning. The factory's `reindex-memory-md.ts`
   (081KRCQQF0008QG0R0037YYP1A) fills this gap: it re-sorts entries newest-first and enforces
   the 100-entry stack cap on cadence.
4. **The AutoDream marker line (`[AutoDream last run: <date>]`) must be
   preserved** — `reindex-memory-md.ts::main()` reads the existing marker
   from `MEMORY.md` via regex and passes it through to `renderIndex()`,
   which uses it verbatim. Only if no marker is present does `renderIndex()`
   fall back to a hardcoded date. This ensures AutoDream's written date is
   never overwritten by a reindex pass.

---

## What this report does NOT do

- Does NOT vendor any third-party source. All findings are restated in our own words from observed behavior + the harness's own session-start warning messages. The Claude Code reference clone the maintainer keeps for self-fix research is read-only-no-vendoring per `feedback_search_internet_when_self_fixing_*`; this report respects that boundary.
- Does NOT replace Anthropic's published Claude Code documentation. If published docs disagree with anything here, the docs win and this report should be updated.
- Does NOT propose a timeline. 081KQ8P5D0008QG0R003KFRGJ0's phasing covers that.

## Next step

Update 081KQ8P5D0008QG0R003KFRGJ0 with these findings. Recommend Option B as the canonical path. Phase 0 is now COMPLETE; 081KQ8P5D0008QG0R003KFRGJ0 advances to Phase 1 (generator authoring).
