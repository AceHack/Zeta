---
id: B-0377
zetaid: 081KR50HA0008QG0R003C39GP0
priority: P2
status: open
title: Update AGENT-BEST-PRACTICES.md BP-17/18 + Otto-279 memory file — replace docs/aurora/** history-surface ref with chosen name
tier: research-grade
effort: S
ask: decomposition of B-0005
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0375, B-0376]
composes_with: [B-0005, B-0375, B-0376, B-0378, B-0379]
parent: B-0005
tags: [governance, directory-ontology, aurora, BP-17, BP-18, otto-279, schema-doc]
type: friction-reducer
---

# B-0377 — Schema-doc update: AGENT-BEST-PRACTICES BP-17/18 + Otto-279 memory file

## What

Two targeted edits — no file moves:

### Edit 1: `docs/AGENT-BEST-PRACTICES.md`

Find the BP-17 (Rule Zero — canonical-home ontology) and/or BP-18
(the canonical-home map IS the repo's type system) sections that
enumerate history surfaces. Update:

- Replace any reference to `docs/aurora/**` as a history surface
  with the chosen directory name (from B-0376 ADR).
- If Path A was chosen: `docs/aurora/**` becomes current-state only;
  the new directory is added as the named-entity-conversation-imports
  history surface.
- If Path B was chosen: update to reflect `docs/aurora/imports/**`
  as the history sub-surface.

Verify the enumeration is complete and accurate after edit.

### Edit 2: `memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md`

This file (Otto-279) contains the canonical history-surface
enumeration. Update:

- Replace `docs/aurora/**` with the chosen directory name.
- Add a dated revision line at the top of the file noting the
  B-0005 split motivation.

### Focused check

```bash
rg "docs/aurora" docs/AGENT-BEST-PRACTICES.md
rg "docs/aurora" memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md
```

Expected after edit: no remaining unqualified `docs/aurora/**` references
on history-surface enumerations (or the reference is now qualified as
`docs/aurora/**` = current-state-only, not history).

## Why (and why third)

The Otto-279 enumeration is the primary gate for the "No name
attribution on current-state" discipline — if the enumeration
says `docs/aurora/**` is a history surface, reviewers continue
permitting first-name attribution on what should now be role-ref
prose. This update closes the permissioning gap.

BP-17/18 is the "type system" — updating it makes the split
structurally declared, not just executed.

Keeping this separate from execution (B-0379) allows the schema
update to be reviewed in isolation before mass file moves happen.

## Acceptance signal

- `docs/AGENT-BEST-PRACTICES.md` history-surface enumeration reflects
  the new split (no false permissions on current-state surface).
- Otto-279 memory file updated with a dated revision line.
- Focused check finds no stale `docs/aurora/**` history-surface refs.
- Build passes (`dotnet build -c Release` 0 warnings 0 errors).

## Pre-start checklist

- [x] Prior-art search: no existing PR touching both these files in context
  of this split; no memory file with a prior schema update for this.
- [x] Dependency-restructure: `depends_on: [B-0375, B-0376]` — need
  inventory (B-0375) to know what "history surface" means for aurora,
  and the naming decision (B-0376) to put the right dir name in.
- [x] Reciprocal pointer: B-0375 and B-0376 both carry
  `composes_with: [B-0377]`.

## Composes with

- B-0005 (parent): implements the "Update Otto-279 enumeration" acceptance
  signal in B-0005.
- B-0376 (dep): provides the chosen directory name used in both edits.
- B-0378 (sibling): both B-0377 and B-0378 update schema-level docs in
  parallel; neither depends on the other.
- B-0379 (downstream): this schema update is logically before the file
  moves — the type system should be declared correct before the migration
  executes.
