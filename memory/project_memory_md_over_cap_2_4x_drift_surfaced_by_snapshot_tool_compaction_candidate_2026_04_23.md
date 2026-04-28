---
name: memory/MEMORY.md in-repo file is 58842 bytes (2.4x over the 24976-byte cap per FACTORY-HYGIENE row #11); surfaced by Otto-70 snapshot-pinning tool first-run; compaction candidate but needs careful scoping (Amara's generated-view answer is the real long-term fix)
description: Otto-70 snapshot-pinning tool (PR #223) first fire surfaced memory/MEMORY.md at 58842 bytes. The FACTORY-HYGIENE row #11 cap is 24976 bytes (≈200 lines worth ≈ 750 cold-load tokens). Current file is 2.4x over. Active session has been appending memories aggressively; index has grown accordingly. Three compaction options: (1) retire old rows to MEMORY-ARCHIVE-YYYY.md, (2) shorten row descriptions, (3) subject-split (MEMORY-aaron.md / MEMORY-amara.md / ...). Per Amara's 4th-ferry thesis (PR #221), the real long-term answer is option 0 — GENERATED index from typed memory facts rather than manual maintenance. Compaction is a bridge move, not the destination. Not fixed this tick; this memory documents the drift for future-session Otto pickup when queue / capacity permits.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# MEMORY.md cap-drift surfaced Otto-70 — compaction candidate

## Observation (2026-04-24 Otto-70/71)

`tools/hygiene/capture-tick-snapshot.sh` first fire
(Otto-70, PR #223) reported:

```
memory_index_sha: f2799a35808f79ccb924641aaa1a04db73163be3
memory_index_bytes: 58842
```

**58,842 bytes.** The in-repo `memory/MEMORY.md` index.

FACTORY-HYGIENE row #11 (CLAUDE.md auto-memory section)
sets the cap at **24,976 bytes** (≈200 lines worth ≈ 750
tokens at cold-load). File is **2.36x over the cap**.

## Why this matters

The MEMORY.md index is **always loaded into context** at
session-open per the CLAUDE.md auto-memory wake-up flow.
Every new Claude session pays the cold-load cost up front.

At 58KB:

- Cold-load token cost is elevated for every new session
- Wake-briefing self-check (FACTORY-HYGIENE row #26, ≤10s
  cap) has less budget for actual reading
- The newest-first ordering invariant still holds, but the
  tail has grown longer than the cold-reader can scan
  before a session needs to get productive

## Why the drift happened

Session-to-date: I've appended ~25+ rows to `memory/MEMORY.md`
since this session started (every tick with a significant
memory write added an index entry). Each row is detailed —
typically 150-250 words — because the description field
tries to capture the memory's key signals so future readers
don't need to open the file to judge relevance.

The detail is useful; the aggregate is over cap.

## Compaction options (scored)

Three approaches, with Amara's long-term answer as a
fourth:

### Option 1 — Archive older rows (conservative)

Move rows older than N days (candidate: 7) to
`memory/MEMORY-ARCHIVE-YYYY-MM.md` or similar. Keep
`memory/MEMORY.md` focused on recent + perennially-
relevant entries.

**Pros:** reversible; low-risk; preserves all signal;
matches hygiene-history / round-history append-then-
archive pattern.

**Cons:** "older" is a fuzzy boundary for factory
memory; some old memories are still load-bearing
(CURRENT distillation pointers, architectural
principles); pure age-based cut loses that signal.

### Option 2 — Shorten row descriptions (medium)

Compress each row's description to ~50 words. Loses some
signal but preserves structure.

**Pros:** doesn't move rows; no file-boundary changes;
immediate cap-fit.

**Cons:** risks losing the "which memory is relevant to
THIS question" value the longer descriptions provide;
error-prone hand-edit across 200+ rows.

### Option 3 — Subject-split (structural)

`MEMORY-aaron.md`, `MEMORY-amara.md`, `MEMORY-factory.md`,
etc. Each file focuses on its maintainer / surface.

**Pros:** natural axis; composes with CURRENT-aaron.md /
CURRENT-amara.md; allows per-subject cap that's generous
within its scope.

**Cons:** requires classifying every existing row;
introduces cross-subject indexing problem; breaks the
"one canonical index" promise; cold-load has to pull
multiple files.

### Option 0 — Generated index (Amara's long-term answer)

Per Amara's 4th ferry (PR #221): the real answer is to
**generate the index deterministically** from typed
memory-fact records rather than maintain it by hand. Each
memory file gets parsed for its frontmatter + description;
the index is emitted as a derived view with consistent
formatting + bounded size.

**Pros:** matches the "deterministic reconciliation"
framing (Otto-67 endorsement); removes manual-drift class
entirely; re-runnable on any schedule.

**Cons:** L-effort (requires typed memory-fact schema +
frontmatter normalization + generation tool + integration
with current prose-maintained memory files); Amara's
Determinize-stage work, not Stabilize.

## Recommendation

**Bridge:** Option 1 (archive) as a short-term cap-fit,
done carefully. Keep:

- All perennially-relevant memories (principles / framings /
  ADR pointers)
- Recent 7-14 days of session memories (currently
  in-force)

Archive to `memory/MEMORY-ARCHIVE-2026-04.md` (by-month)
for pre-window rows. Preserve newest-first ordering
in both files.

**Destination:** Option 0 (generated index) — stands as
L-effort BACKLOG row, part of Amara's Determinize-stage
roadmap.

## Why not fix this tick

- Reviewer capacity saturated; 10+ PRs awaiting approval
- Compaction is delicate — losing a pointer to a
  load-bearing memory file is a discoverability defect
  (exactly what Amara's memory-index-integrity CI, PR
  #220, prevents for new memories)
- Needs per-row judgment about "perennially relevant" vs.
  "session-specific" — not mechanical enough for a one-
  tick win
- Proper scope: research doc comparing the three options,
  classification pass on existing rows, then a single
  migration PR

## Action items (next tick or later)

1. File BACKLOG row on AceHack (experimentation-frontier
   per Amara authority-axis): "MEMORY.md compaction + long-
   term generated-index path"
2. Draft per-row classification pass in per-user memory
   (low-cost prep; no PR overhead)
3. When a quiet window opens: migration PR with
   careful retention decisions + archive file creation +
   newest-first preservation

## Composes with

- `feedback_current_memory_per_maintainer_distillation_
  pattern_prefer_progress_2026_04_23.md` — CURRENT-*
  files are already one class of compression; this is a
  sibling layer (index compression)
- `project_amara_4th_ferry_...` memory (PR #221 absorb) —
  generated-view path is Amara's long-term answer
- FACTORY-HYGIENE row #11 — the cap this is drifting from
- PR #220 memory-index-integrity CI — prevents new
  dangling pointers; does NOT address size
- PR #223 snapshot-pinning (this tick) — the tool that
  surfaced the drift

## What this memory is NOT

- **Not a commitment to compact this session.** Reviewer
  capacity constraint is real; the work needs a quiet
  window.
- **Not a compaction plan.** Just the observation +
  options + directional recommendation.
- **Not authorization to delete memory rows.** Archive
  ≠ delete; archive preserves signal at a different
  file.
- **Not a retraction of any landed memory.** Every row
  stays a live pointer until archived; nothing lost
  in the tail.

## Attribution

Otto-70 snapshot-pinning tool (PR #223) surfaced the
drift at `memory_index_bytes: 58842`. Otto (loop-agent
PM hat, Otto-71) filed this observation + options memo
without landing a compaction PR this tick (queue
saturated). Future-session Otto or any quiet-window
Otto takes pickup when capacity permits.
