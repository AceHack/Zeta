# docs/backlog/ — per-row backlog files

Source of truth for individual backlog rows. Each row is one
markdown file with YAML frontmatter. The top-level
`docs/BACKLOG.md` is a read-only legacy stockpile during the
Phase 2 migration window (see "Current state" below); it
collapses to an auto-generated pointer index only **after**
migration completes.

See `tools/backlog/README.md` for the full schema, scaffolder,
generator, and phase plan.

## Quick reference

- **Add a row:** `tools/backlog/new-row.sh --priority P2 --slug your-slug`
  (Phase 1b; manual file creation works in the interim).
- **Regenerate index:** `tools/backlog/generate-index.sh`.
- **Check for drift:** `tools/backlog/generate-index.sh --check`.

## Directory layout

```text
docs/backlog/
  README.md               ← this file
  P0/B-<NNNN>-<slug>.md   ← critical / blocking rows
  P1/B-<NNNN>-<slug>.md   ← within 2-3 rounds
  P2/B-<NNNN>-<slug>.md   ← research-grade
  P3/B-<NNNN>-<slug>.md   ← convenience / deferred
```

## Current state — Phase 2 in progress

Tooling + schema landed (Phase 1a complete). Phase 2 row
migration is **in progress, not finished**: at the time of
this README refresh (2026-04-28) there are ~58 per-row files
under `P1/`/`P2/`/`P3/` while `docs/BACKLOG.md` still carries
~384 row markers, leaving roughly 326 rows un-migrated.

**Authoritative source:** the per-row files in this directory
are the authoritative source for everything that has been
migrated. New rows MUST be added here as
`docs/backlog/PN/B-<next-NNNN>-<slug>.md`. Do **NOT** add new
rows to `docs/BACKLOG.md`.

**Legacy stockpile:** `docs/BACKLOG.md` remains as a
read-only archive of un-migrated rows during the migration
window. Its top-of-file warning header points at this README
and the migration-tracking row (B-0061). Once migration
completes, the monolith collapses to an auto-generated
pointer index via `tools/backlog/generate-index.sh`.

**Tracking the migration itself:**
[`P1/B-0061-finish-monolith-to-per-row-migration-no-residue-aaron-2026-04-28.md`](./P1/B-0061-finish-monolith-to-per-row-migration-no-residue-aaron-2026-04-28.md)
owns the audit + batched-migration + cutover. Aaron 2026-04-28 explicit framing:
*"don't miss anyting make sure it's all accounted for, and
make sure not BACKLOG.md residue is left over in the
substrate for next you."*
