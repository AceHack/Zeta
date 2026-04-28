# docs/backlog/ — per-row backlog files

Source of truth for individual backlog rows. Each row is one
markdown file with YAML frontmatter. The top-level
`docs/BACKLOG.md` is auto-generated from this directory.

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

## Current state — Phase 1a

Tooling + schema landed. One placeholder row (`B-0001`)
exists to exercise the generator against non-empty input;
it is not substantive backlog content. Phase 2 will migrate
the existing single-file `docs/BACKLOG.md` content into per-row
files starting at `B-0002`. Until Phase 2 lands, the single-
file `docs/BACKLOG.md` remains the authoritative source of
substantive backlog rows; this directory + its generator
exist to provide the target structure + schema demonstration.
