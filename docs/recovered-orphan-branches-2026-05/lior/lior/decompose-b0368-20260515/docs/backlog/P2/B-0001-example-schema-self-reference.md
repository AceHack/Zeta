---
id: B-0001
priority: P2
status: closed
closed: 2026-05-10
closed_by: "claim(B-0001): all three stated purposes verified fulfilled — generator passes --check, backlog-index-integrity.yml CI gate exists, schema documented by real content"
title: Example row — self-reference demonstrating the per-row-file schema
tier: research-grade
effort: S
ask: maintainer Otto-181 (BACKLOG split Phase 1a)
created: 2026-04-24
last_updated: 2026-05-10
depends_on: []
composes_with: []
tags: [backlog-schema, example, phase-1a]
type: friction-reducer

---

# Example row — self-reference demonstrating the per-row-file schema

This is a placeholder row that exists to:

1. Exercise the `tools/backlog/generate-index.ts` generator
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

## Pre-start checklist (2026-05-10, claim)

Required by `.claude/rules/backlog-item-start-gate.md` before any work.

**Prior-art search:**

- Skill router: no overlapping skill covers "backlog example row" scope.
- `tools/backlog/`: `generate-index.ts`, `README.md` exist — generator
  is the tool this row exercises.
- `tools/hygiene/LOST-FILES-LOCATIONS.md`: no lost artifacts for B-0001.
- `docs/DECISIONS/2026-04-22-backlog-per-row-file-restructure.md`:
  Phase 1a/1b/1c phases documented; Phase 1c (`backlog-index-integrity.yml`)
  is landed (confirmed: `.github/workflows/backlog-index-integrity.yml`).
- `docs/BACKLOG.md --check`: `bun tools/backlog/generate-index.ts --check`
  returns exit 0 — no drift.

**Dependency-restructure:**

- `depends_on: []` — no dependencies.
- `composes_with: []` — standalone example row.
- No supersession history; this is the first backlog row.

**Closure rationale:**

All three stated purposes are fulfilled:

1. Generator exercises: `bun tools/backlog/generate-index.ts --check` → `ok` (exit 0).
2. Schema documentation: file shape is demonstrated and real rows (B-0002…B-0400+)
   now fill the per-row corpus, supplanting the need for this example.
3. Numbering anchor: B-0002+ exist; Phase 2 migration substantially complete.

Phase 1b milestone (CI drift-check gate) is landed as `backlog-index-integrity.yml`.
Phase 3 condition ("schema-demo role filled by real content") is satisfied by the
hundreds of real per-row files now in tree. Retiring this item per Phase 3 intent.

## Cross-references

- `tools/backlog/README.md` — schema spec.
- `tools/backlog/generate-index.ts` — the generator this
  file exercises.
- `memory/persona/otto/conversations/backlog-split-design-otto-181.md` — full
  design spec.
- `.github/workflows/backlog-index-integrity.yml` — Phase 1b CI gate
  (now landed; was cited as future work in this row's original body).
