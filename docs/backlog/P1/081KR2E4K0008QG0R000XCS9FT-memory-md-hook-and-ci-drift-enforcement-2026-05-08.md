---
id: 081KR2E4K0008QG0R000XCS9FT
priority: P1
status: closed
title: "MEMORY.md marker-vs-index - hook and CI drift enforcement"
created: 2026-05-08
last_updated: 2026-05-14
parent: 081KQ8P5D0008QG0R003KFRGJ0
depends_on: [081KR2E4K0008QG0R001E27DDV]
classification: blocked-on-generator
decomposition: atomic
closed_by: "feat/b0259-memory-index-drift-ci-hook-2026-05-14"
---

# 081KR2E4K0008QG0R000XCS9FT - MEMORY.md hook and CI drift enforcement

Wire generator usage into developer flow and CI so drift is
caught mechanically rather than by reviewer memory.

## Work scope

- Add pre-commit behavior for memory-file changes.
- Add CI check mode for generated-index drift.
- Document failure and remediation workflow.

## Acceptance criteria

- Memory-file edits trigger deterministic index regeneration.
- CI fails when generated output is stale.
- Developer instructions explain how to fix drift.
- No cutover behavior changes in this row.

## Pre-start checklist (completed 2026-05-14)

Prior-art search:

- `tools/memory/reindex-memory-md.ts` — generator with `--check` flag (081KR2E4K0008QG0R001E27DDV/081KRCQQF0008QG0R0037YYP1A,
  merged). Exit 0 = current; exit 2 = stale.
- `memory-index-integrity.yml` — existing workflow enforces frontmatter completeness
  but does NOT enforce MEMORY.md drift. 081KR2E4K0008QG0R000XCS9FT adds the drift check.
- `backlog-index-integrity.yml` — canonical pattern for `--check`-based CI gate.
  Comment notes "there is no pre-commit-hook framework currently wired up in this
  repo — the CI surface is the equivalent enforcement point." 081KR2E4K0008QG0R000XCS9FT adds BOTH the
  CI surface AND the harness hook (they compose).
- No duplicate drift-check workflow found in `.github/workflows/`.

Dependency walk:

- 081KR2E4K0008QG0R001E27DDV (index generator implementation): CLOSED ✓ (PR #3098)
- 081KQ8P5D0008QG0R003KFRGJ0 (parent): open (081KR2E4K0008QG0R000XCS9FT closure advances it)

## Implementation (PR feat/b0259-memory-index-drift-ci-hook-2026-05-14)

Three deliverables:

1. **`.github/workflows/memory-index-drift.yml`** — CI workflow. Triggers on
   `memory/**` changes. Runs `bun tools/memory/reindex-memory-md.ts --check`.
   Fails with remediation instructions when MEMORY.md is stale (exit 2 → exit 1).

2. **`.claude/hooks/post-write-memory-reindex.ts`** — PostToolUse hook. Fires
   after any `Write` or `Edit` to `memory/*.md` heap files (excludes MEMORY.md,
   CURRENT-*.md, README.md, persona/**). Runs reindexer synchronously; non-blocking
   on reindex failure (CI is the hard gate).

3. **Settings wiring (post-merge manual step)**: The hook script is committed but
   CANNOT be wired automatically (`.claude/settings.json` is a self-modification
   surface). After PR merges, add to `.claude/settings.json` `PostToolUse` array:

   ```json
   {
     "matcher": "Write",
     "hooks": [
       {
         "type": "command",
         "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-write-memory-reindex.ts"
       }
     ]
   },
   {
     "matcher": "Edit",
     "hooks": [
       {
         "type": "command",
         "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-write-memory-reindex.ts"
       }
     ]
   }
   ```
