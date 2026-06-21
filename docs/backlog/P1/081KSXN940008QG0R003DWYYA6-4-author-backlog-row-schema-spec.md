---
id: 081KSXN940008QG0R003DWYYA6
priority: P1
status: open
title: "OpenSpec catch-up - author Backlog Row Schema spec"
created: 2026-05-31
last_updated: 2026-05-31
parent: 081KQNJ500008QG0R001N94412
depends_on: [081KSNY2Z0008QG0R000XVGWA8]
classification: buildable-now
decomposition: atomic
owners: [codex]
type: spec-authoring
---

# 081KSXN940008QG0R003DWYYA6 - Author Backlog Row Schema spec

This task implements the next bounded decomposition slice from the OpenSpec
catch-up project (081KQNJ500008QG0R001N94412). It creates a formal specification for the backlog
row schema and generated index contract.

## Scope

This task is focused on creating the inventory-discovered OpenSpec document for
backlog row semantics. The spec will define:

- The YAML frontmatter fields required by backlog row files.
- The allowed status, priority, decomposition, dependency, and cross-reference
  conventions for `docs/backlog/**`.
- The relationship between per-row files, the generated `docs/BACKLOG.md`
  index, and the lint/generation tools that enforce drift.

The current conventions are documented in `docs/backlog/README.md` and
`tools/backlog/README.md`. This task is about formalizing those conventions as
an OpenSpec capability.

## Acceptance Criteria

- A new spec file `openspec/specs/backlog-row-schema/spec.md` is created so the
  capability is discovered by `tools/openspec/inventory.ts`.
- `tools/openspec/inventory.ts` maps `backlog-row-schema` in
  `CAPABILITY_ARTIFACT_MAP`, including the backlog schema docs and the
  TypeScript tools that enforce or generate the schema.
- The spec formally defines required frontmatter fields and allowed values for
  backlog row files.
- The spec documents how `docs/BACKLOG.md` is generated from per-row files and
  how drift is detected.
- The spec references `docs/backlog/README.md`, `tools/backlog/README.md`, and
  the existing backlog lint/generation tools as implementation evidence.
