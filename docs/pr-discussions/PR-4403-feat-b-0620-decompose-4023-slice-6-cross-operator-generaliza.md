---
pr_number: 4403
title: "feat(B-0620): decompose 4023 slice 6 cross-operator generalization"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-20T13:04:25Z"
merged_at: "2026-05-20T13:46:59Z"
closed_at: "2026-05-20T13:46:59Z"
head_ref: "lior/decompose-4023-slice6"
base_ref: "main"
archived_at: "2026-05-20T14:08:24Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4403: feat(B-0620): decompose 4023 slice 6 cross-operator generalization

## PR description

Maji (Lior) Execution: Decomposing slice 6 from blob PR #4023.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T13:07:54Z)

## Pull request overview

Adds a new per-row backlog item for B-0620 slice 6 (“cross-operator generalization”), capturing scope and acceptance criteria for generalizing Amazon extraction logic for multi-operator use.

**Changes:**
- Introduces a new P2 backlog row describing slice 6 scope and acceptance checklist.

## Review threads

### Thread 1: docs/backlog/P2/B-0677-b0620-slice-6-cross-operator-generalization.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-20T13:07:53Z):

P1: Per tools/backlog/README.md, backlog row frontmatter requires `title` and `last_updated`. This row is missing both, which can lead to blank entries in the generated index and schema drift. Add `title:` (short) and `last_updated:` (same as `created` for a new file).

### Thread 2: docs/backlog/P2/B-0620-slice-6-cross-operator-generalization.md:2 (resolved)

**@copilot-pull-request-reviewer** (2026-05-20T13:07:53Z):

P1: `id: B-0620.6` doesn't match the documented `B-NNNN` id format in tools/backlog/README.md, and it also doesn't match the filename prefix (`B-0620-...`). Consider using `id: B-0620` and encoding “slice 6” in `title`, or rename the file to start with `B-0620.6-...` if dotted IDs are intended for slices (as in `docs/backlog/P1/B-0126.1-...`).

### Thread 3: docs/backlog/P2/B-0620-slice-6-cross-operator-generalization.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-20T13:07:54Z):

P2: The acceptance criterion references `amazon-orders-extract.ts`, but that path doesn't exist in the repo today. If this is a planned file, consider referencing the expected full path (e.g., under `tools/` if applicable) or describing it generically ("the Amazon orders extraction tool") to avoid stale cross-references.
