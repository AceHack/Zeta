---
id: B-0061
priority: P1
status: open
title: Finish docs/BACKLOG.md monolith → per-row migration — "don't miss anything, no residue for next-Otto" (Aaron 2026-04-28)
tier: factory-hygiene
effort: L
ask: maintainer Aaron 2026-04-28 ("docs/BACKLOG.md we had split this into multiple how did it get back to one?" + "don't miss anyting make sure it's all accounted for, and make sure not BACKLOG.md residue is left over in the substrate for next you")
created: 2026-04-28
last_updated: 2026-04-28
composes_with: [B-0060]
tags: [factory-hygiene, backlog, migration, beacon-safety, no-residue]
---

# Finish monolith → per-row migration so future-Otto can't slip

The split-target structure under `docs/backlog/PN/B-NNNN-<slug>.md`
is real and partially populated (~60 per-row files at the time of
filing — the count drifts as new per-row rows land in flight). The
~17K-line monolith `docs/BACKLOG.md` still has ~384 row markers, of
which several hundred have not yet been migrated to per-row files;
exact counts are intentionally approximate because they drift as
the migration proceeds. Aaron caught this 2026-04-28 when a new row landed
in the monolith instead of as a per-row file:

> *"docs/BACKLOG.md we had split this into multiple how did it
> get back to one?"*

Follow-up:

> *"don't miss anyting make sure it's all accounted for, and
> make sure not BACKLOG.md residue is left over in the substrate
> for next you."*

## Why

The monolith and split-target both being present is a footgun:

- Future-Otto reads CLAUDE.md → sees `docs/BACKLOG.md` → adds
  rows there → loses the structure benefit + duplicates
  per-row content.
- The README at `docs/backlog/README.md` says (stale)
  "Phase 1a: one placeholder row B-0001 exists" but the actual
  state has many real rows. The stale README sells the wrong
  story to future readers.
- A union-merge at commit `02bdc41` brought the monolith back
  to its full pre-split shape; that commit was a sync action
  not a migration-rollback decision, but its effect on the
  factory is to leave the split half-finished.

## Approach

1. **Audit (S, ~1 tick).** Build a coverage table: every row
   marker in `docs/BACKLOG.md` mapped to either an existing
   per-row file (if migrated) or `MIGRATION-PENDING`.
   Output: `docs/research/backlog-migration-coverage-2026-04-28.md`.
2. **Backfill (L, multi-tick).** For each MIGRATION-PENDING
   row: create `docs/backlog/PN/B-NNNN-<slug>.md` with the
   schema documented in `tools/backlog/README.md`. Copy
   substantive content. Pick `priority` based on the
   monolith section header it lived under. Pick the next
   available `B-NNNN` id. Tag rows in batches of 20-30 per
   commit so the migration is reviewable.
3. **Validate (M, ~1 tick).** Run
   `tools/backlog/generate-index.sh --check` after the
   migration. Spot-check 20 random per-row files vs original
   monolith content for round-trip fidelity.
4. **Collapse (S, ~1 tick).** Replace `docs/BACKLOG.md`
   content with `tools/backlog/generate-index.sh` output —
   a short pointer index, not duplicate prose. The file
   stays as a top-level entry point with a header pointing
   at `docs/backlog/`.
5. **Document the rule (M, ~1 tick).** Update CLAUDE.md +
   AGENTS.md + the docs/backlog/README.md (this last one
   needs full refresh) so future-Otto's wake-time
   bootstrap names the per-row format as authoritative.
   Update the schema docs at `tools/backlog/README.md` if
   anything during the migration surfaced edge cases.

## Done-criteria

- [ ] `docs/BACKLOG.md` is under 500 lines (auto-generated
      pointer index, no duplicate substantive content).
- [ ] Every row that was in the pre-migration monolith
      appears as a per-row file with content fidelity (or
      is explicitly marked as already-completed).
- [ ] The migration coverage report is committed under
      `docs/research/`.
- [ ] `tools/backlog/generate-index.sh --check` exits 0.
- [ ] `docs/backlog/README.md` accurately describes current
      state (no "Phase 1a placeholder row" stale claim).
- [ ] CLAUDE.md + AGENTS.md name the per-row format as
      authoritative.

## What this row does NOT do

- Does NOT delete monolith rows blindly. Every move must
  preserve substantive content.
- Does NOT proceed without the coverage table. The audit
  step is the safeguard against missing rows.
- Does NOT bypass review. Each batch of ~20-30 migrations
  ships as a separate PR for reviewability.

## Composes with

- **B-0060** — the human-lineage / external-anchor backfill
  task. That row is already filed in per-row form; this row
  is the substrate-hygiene cousin that protects the
  per-row substrate from regression.
- The original split design lives at
  `docs/research/backlog-split-design-otto-181.md` (per
  the generator script's header).
