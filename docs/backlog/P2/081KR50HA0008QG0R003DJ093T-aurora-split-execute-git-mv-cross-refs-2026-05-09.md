---
id: B-0379
zetaid: 081KR50HA0008QG0R003DJ093T
priority: P2
status: open
title: Execute the docs/aurora split — mkdir new dir, git mv history-import files, update all cross-refs in memory/** and ROUND-HISTORY
tier: research-grade
effort: M
ask: decomposition of B-0005
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0377, B-0378]
composes_with: [B-0005, B-0375, B-0376, B-0377, B-0378]
parent: B-0005
tags: [governance, directory-ontology, aurora, courier-ferry, cross-ai-imports, BP-17, BP-18, git-mv]
type: friction-reducer
---

# B-0379 — Execute the split: mkdir, git mv, cross-ref cleanup

## What

The mechanical execution atom. By this point:

- B-0375 has produced the classification table (which files move where).
- B-0376 has the ADR with the chosen directory name + Path A/B.
- B-0377 has updated AGENT-BEST-PRACTICES + Otto-279.
- B-0378 has updated GOVERNANCE §33 + copilot-instructions.

This atom performs the structural changes:

### Step 1 — Create the new directory

```bash
mkdir -p docs/<chosen-name>
```

(Replace `<chosen-name>` with the directory from B-0376 ADR.)

Copy or create a `README.md` for the new directory that:

- States it is a history surface.
- Cites the four required archive-header fields (GOVERNANCE §33).
- Lists the file-types that belong here.

### Step 2 — git mv history-import files

For every file classified as `history-import` in B-0375's output table:

```bash
git mv docs/aurora/<file> docs/<chosen-name>/<file>
```

**Do NOT move:**

- `docs/aurora/README.md` — stays (update to reflect that aurora is now
  current-state only).
- `docs/aurora/collaborators.md` — this is meta; review classification
  from B-0375 to decide. If classified `meta`, keep; if `history-import`,
  move.
- Any file classified `current-state`.

### Step 3 — Update docs/aurora/README.md

Remove the history-surface scope from the aurora README. Update to reflect:

- `docs/aurora/**` is now current-state only.
- History imports moved to `docs/<chosen-name>/`.
- Add a one-line pointer to the new directory.

### Step 4 — Cross-reference sweep in memory/**

```bash
rg "docs/aurora" memory/ --files-with-matches
```

For each file found, check if the reference is to a file that moved.
If yes, update the path. If the reference is to a current-state aurora
file, leave it.

### Step 5 — ROUND-HISTORY.md mention

Add a one-line entry in `docs/ROUND-HISTORY.md` under the current round
noting the split landed and referencing B-0005 + the chosen Path.

### Focused checks

```bash
# 1. Build
dotnet build -c Release

# 2. No stale paths
rg "docs/aurora" docs/AGENT-BEST-PRACTICES.md  # Should show only current-state refs
rg "docs/aurora" GOVERNANCE.md | head -5         # Should show current-state refs only
rg "docs/aurora" .github/copilot-instructions.md

# 3. New dir populated
ls docs/<chosen-name>/ | head -5

# 4. Canonical-home-auditor (if available)
bun tools/hygiene/audit-canonical-homes.ts 2>/dev/null || echo "Auditor not yet available"
```

## Why (and why last)

This is the execution atom — it has the highest blast radius (file moves
touch all downstream cross-references in memory/**). Running it last,
after all schema-doc updates are in place, means the type system is
declared correct *before* the migration happens — not after.

If execution runs first and the schema docs are wrong, a reviewer
sees the moved files but the rules still say `docs/aurora/**` is a
history surface — ambiguity survives the PR.

## Acceptance signal

- New directory exists and contains all history-import files.
- `docs/aurora/**` contains only current-state files (+ README + possibly
  collaborators.md if classified `meta`).
- All cross-refs in `memory/**` updated (no 404 paths).
- `docs/ROUND-HISTORY.md` entry added.
- Focused checks pass (build clean, no stale history-surface aurora refs,
  new dir populated).
- BP-17/18 canonical-home-auditor passes clean (or the auditor is
  backlogged and a manual pass confirms the invariant).

## Effort note

Rated M (not S) because:

- The `memory/**` cross-ref sweep can touch 10+ files (B-0005 lists
  multiple memory files referencing `docs/aurora/**`).
- The git-mv step itself is S, but the cross-ref cleanup scales with
  reference count.
- If the move triggers additional cascade fixes (e.g., tools that
  reference aurora paths), effort may grow toward L — the implementer
  should log the actual count in the PR body.

## Pre-start checklist

- [x] Prior-art search: no prior PR executing this kind of split for aurora;
  no existing `docs/courier/**` or `docs/cross-ai-imports/**` directory;
  `tools/hygiene/LOST-FILES-LOCATIONS.md` checked — no orphaned aurora-split
  artifacts found.
- [x] Dependency-restructure: `depends_on: [B-0377, B-0378]` — both schema
  updates must land first. Also inherits the classification from B-0375
  and the naming decision from B-0376 (transitively through B-0377/B-0378).
- [x] Reciprocal pointer: B-0377 and B-0378 carry `composes_with: [B-0379]`.

## Composes with

- B-0005 (parent): implements "Execute the split" acceptance signals
  including the cross-ref sweep and ROUND-HISTORY entry.
- B-0377 (dep): schema docs must be updated first.
- B-0378 (dep): GOVERNANCE §33 must be updated first.
- B-0375 (transitive dep): the B-0375 classification table is this atom's
  input manifest — the list of files to move.
- B-0376 (transitive dep): the B-0376 ADR is this atom's path parameter.
