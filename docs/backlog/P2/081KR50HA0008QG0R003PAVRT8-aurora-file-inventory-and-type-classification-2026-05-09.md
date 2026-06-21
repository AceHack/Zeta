---
id: 081KR50HA0008QG0R003PAVRT8
priority: P2
status: open
title: Inventory and classify every file under docs/aurora/** (current-state doc vs courier-ferry history import)
tier: research-grade
effort: S
ask: decomposition of 081KQ0YZ80008QG0R003GMGDRH
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
composes_with: [081KQ0YZ80008QG0R003GMGDRH, 081KR50HA0008QG0R0038HWCDT, 081KR50HA0008QG0R003C39GP0, 081KR50HA0008QG0R002HMCS5Y, 081KR50HA0008QG0R003DJ093T]
parent: 081KQ0YZ80008QG0R003GMGDRH
tags: [governance, directory-ontology, aurora, courier-ferry, BP-17, BP-18]
type: friction-reducer
---

# 081KR50HA0008QG0R003PAVRT8 — Inventory and classify every file under `docs/aurora/**`

## What

Produce a machine-readable classification table listing every
file under `docs/aurora/**` with its assigned type-class:

- **`current-state`** — Aurora-the-system docs (design notes,
  threat-model, runbooks, architecture descriptions) that should
  reflect current truth; no name-attribution per GOVERNANCE.md §2 /
  `docs/AGENT-BEST-PRACTICES.md` "No name attribution on current-state."
- **`history-import`** — courier-ferry transcripts, cross-AI reviews,
  Amara ferries, ChatGPT pastes, Codex transcripts. Append-only history;
  first-name attribution preserved per Otto-279;
  archive-header discipline per GOVERNANCE.md §33.
- **`meta`** — README, collaborators, index files that describe the
  directory itself (neutral; lifecycle depends on whether aurora
  stays as a directory or is split).

No file moves or edits in this step. Output only.

## Why (and why first)

This is the root atom. All downstream split work (081KR50HA0008QG0R0038HWCDT naming
decision, 081KR50HA0008QG0R003C39GP0 schema-doc update, 081KR50HA0008QG0R002HMCS5Y GOVERNANCE/copilot
update, 081KR50HA0008QG0R003DJ093T execution) depends on knowing *which files move
and which stay*. Without this inventory, mass-edit estimates are
wrong and the Path A vs Path B choice (081KR50HA0008QG0R0038HWCDT) lacks grounding.

Per `docs/AGENT-BEST-PRACTICES.md` BP-17 (Rule Zero — canonical-home
ontology) + BP-18 (the canonical home IS the type system): the
classification IS the type annotation. It must precede structural changes.

## Focused check

```bash
rg --files docs/aurora | sort
```

Expected: lists every `.md` file under `docs/aurora/`. Review manually and
produce the table below (filled in during implementation).

## Output artifact

A classification table appended to this row's body or written to
`docs/aurora/CLASSIFICATION.md` (the implementer decides which is
cleaner; if a separate file, add a pointer here):

| File | Type-class | Notes |
|------|-----------|-------|
| (to be filled in) | | |

## Acceptance signal

- Every file under `docs/aurora/**` appears in the table.
- Each file has exactly one type-class assigned.
- No files were moved or modified (this step is inventory-only).
- Focused check runs clean.

## Pre-start checklist

- [x] Prior-art search: no existing aurora classification table found in
  `tools/hygiene/LOST-FILES-LOCATIONS.md`, skills, or memory files.
- [x] Dependency-restructure: no `depends_on` — this is the root atom.
  `composes_with` edges to all sibling atoms added.
- [x] Reciprocal pointers: 081KR50HA0008QG0R0038HWCDT, 081KR50HA0008QG0R003C39GP0, 081KR50HA0008QG0R002HMCS5Y, 081KR50HA0008QG0R003DJ093T all carry
  `depends_on: [081KR50HA0008QG0R003PAVRT8]` or `composes_with: [081KR50HA0008QG0R003PAVRT8]`.

## Composes with

- 081KQ0YZ80008QG0R003GMGDRH (parent): this atom implements the "inventory" step described
  in the 081KQ0YZ80008QG0R003GMGDRH re-decomposition section.
- 081KR50HA0008QG0R0038HWCDT: naming-decision row; depends on this classification to
  count how many history-import files move.
- 081KR50HA0008QG0R003C39GP0: schema-doc update; depends on this to know what surfaces
  reference `docs/aurora/**` as a history surface.
- 081KR50HA0008QG0R002HMCS5Y: GOVERNANCE + copilot update; same dependency.
- 081KR50HA0008QG0R003DJ093T: execution atom; this table is its input manifest.
