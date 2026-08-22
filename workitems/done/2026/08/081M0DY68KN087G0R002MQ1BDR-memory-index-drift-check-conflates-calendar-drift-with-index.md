---
id: 081M0DY68KN087G0R002MQ1BDR
type: bug
state: done
priority: P2
slug: memory-index-drift-check-conflates-calendar-drift-with-index
title: "memory-index-drift check conflates calendar drift with index drift -- daily false positive on any memory/** PR"
created: 2026-08-19T21:17:45.461Z
completed: 2026-08-20T12:23:18.982Z
depends_on: []
composes_with: []
---

# memory-index-drift check conflates calendar drift with index drift -- daily false positive on any memory/** PR

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DY68KN087G0R002MQ1BDR-*.md` glob. -->

## Evidence (observed on PR #12537, 2026-08-19)

`check MEMORY.md generated-index drift` went red on a PR whose only `memory/**` change was
`memory/soraya/NOTEBOOK.md`.

Two independent facts make the failure a **false positive**:

1. **The edited file is not in the index.** `grep -c "soraya/NOTEBOOK" memory/MEMORY.md`
   returns `0`. The index has 1631 entries and this is not one of them, so the edit could
   not have caused index drift by construction.
2. **The staleness comparison includes a date stamp.** `reindex-memory-md.ts:176` embeds
   `new Date().toISOString().slice(0,10)` into the generated header ("Last reindex: ..."),
   and `--check` compares the full generated text against the file on disk. The script's own
   header comment (lines 48-50) acknowledges output is only "identical output within a
   calendar day".

Regenerating produced a **one-line diff — the date only**:

    -... Last reindex: 2026-08-18.
    +... Last reindex: 2026-08-19.

## Why this matters beyond the nuisance

The workflow triggers on `paths: memory/**`, so **any** PR touching **any** memory file on a
calendar day later than the last reindex goes red, whether or not the index actually drifted.
The remediation commit bumps a date string and verifies nothing.

The failure signal does not track the property the check names. That trains contributors to
regenerate reflexively on a red they have learned is meaningless — which is exactly the
condition under which a *real* index drift gets waved through. A check that cries wolf daily
is a check nobody reads.

## Candidate fixes (not routed here -- engineering call)

- Compare the content **between the AUTO-INDEX markers only**, excluding the header date, so
  `--check` measures index drift and nothing else. Cheapest, and it makes the check honest.
- Or: derive "Last reindex" from git metadata / the newest indexed entry rather than wall
  clock, so the generator is a pure function of the heap. This is also the
  `local-time-never-enters-the-shared-fold` shape -- an ambient clock leaking into a value
  that is supposed to be a function of content.
- Narrow the workflow `paths:` to the directories the reindexer actually walks, so edits to
  unindexed files (persona notebooks) do not trigger it at all.

Found while landing the forward-correlation routing review (PR #12537).

