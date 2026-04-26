---
id: B-0001
priority: P2
status: open
title: Example row — self-reference demonstrating the per-row-file schema
tier: research-grade
effort: S
ask: maintainer Otto-181 (BACKLOG split Phase 1a)
created: 2026-04-24
last_updated: 2026-04-26
composes_with: []
tags: [backlog-schema, example, phase-1a]
---

# Example row — self-reference demonstrating the per-row-file schema

This is a placeholder row that exists to:

1. Exercise the `tools/backlog/generate-index.sh` generator
   against a non-empty `docs/backlog/` tree, so drift-CI and
   manual `--check` runs have something to validate.
2. Show contributors what the file shape looks like end-to-
   end — frontmatter + body.
3. Serve as the first B-NNNN so Phase-2 content migration
   starts numbering from B-0002.

## What this row claims

Nothing substantive. It's self-referential: it exists
because the generator needs at least one row file to
demonstrate the sort + index emission, and a zero-row
directory would make the new infrastructure harder to
verify.

When Phase 2 migrates the real `docs/BACKLOG.md` content
into per-row files, this example either stays as the
schema-documentation-example or gets retired (and
recovered via `git log --diff-filter=D` if needed).

## Future path

- Phase 1b: when `backlog-index-integrity.yml` workflow
  lands, this row confirms the CI drift-check passes on
  a non-trivial input.
- Phase 2: migrate existing BACKLOG.md rows starting at
  B-0002.
- Phase 3: remove this example when the schema-demo role
  is filled by real content, per CLAUDE.md "retire by
  deletion" discipline.

## Cross-references

- `tools/backlog/README.md` — schema spec.
- `tools/backlog/generate-index.sh` — the generator this
  file exercises.
- `docs/research/backlog-split-design-otto-181.md` — full
  design spec.
