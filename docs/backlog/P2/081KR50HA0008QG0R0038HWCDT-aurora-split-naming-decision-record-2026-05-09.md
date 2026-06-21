---
id: 081KR50HA0008QG0R0038HWCDT
priority: P2
status: open
title: Architect decision record — canonical name for named-entity-conversation-imports directory
tier: research-grade
effort: S
ask: decomposition of 081KQ0YZ80008QG0R003GMGDRH
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R003PAVRT8]
composes_with: [081KQ0YZ80008QG0R003GMGDRH, 081KR50HA0008QG0R003PAVRT8, 081KR50HA0008QG0R003C39GP0, 081KR50HA0008QG0R002HMCS5Y, 081KR50HA0008QG0R003DJ093T]
parent: 081KQ0YZ80008QG0R003GMGDRH
tags: [governance, directory-ontology, aurora, courier-ferry, cross-ai-imports]
type: friction-reducer
---

# 081KR50HA0008QG0R0038HWCDT — Architect decision record: canonical name for named-entity-conversation-imports home

## What

Write and commit an Architect decision record (ADR) under
`docs/DECISIONS/` that:

1. Chooses one canonical directory name for the
   **named-entity-conversation-imports** category from the
   four options in 081KQ0YZ80008QG0R003GMGDRH:
   - `docs/courier/**` — references the courier-ferry pattern
   - `docs/cross-ai-imports/**` — explicit about origin class
   - `docs/imported-conversations/**` — explicit about artifact shape
   - `docs/conversations/**` — generic; matches append-only-history-of-named-entities

2. Chooses **Path A vs Path B** from 081KQ0YZ80008QG0R003GMGDRH §"Two paths to consider":
   - **Path A**: `docs/aurora/**` keeps only current-state system docs;
     history imports move to the new directory.
   - **Path B**: `docs/aurora/system/**` (current-state) vs
     `docs/aurora/imports/**` (history imports) — lower migration cost.

3. Keeps 081KQ0YZ80008QG0R003GMGDRH frontmatter `status: decomposed` and adds a pointer
   to the ADR without reactivating the parent row.

**No file moves in this step.**

## Why (and why second)

The naming choice gates every downstream write: 081KR50HA0008QG0R003C39GP0 must know
the new directory name to update the enumeration; 081KR50HA0008QG0R002HMCS5Y must
know the name to update GOVERNANCE §33; 081KR50HA0008QG0R003DJ093T needs the name
to `git mv` files to the right place. All three are unblocked
only after this decision lands.

This is a decision-record atom, not a code-execution atom — the
output is a committed ADR that resolves ambiguity for all downstream steps.
Keeping it separate from execution (081KR50HA0008QG0R003DJ093T) ensures the decision
is reviewable before any mass edits happen.

## Focused check

```bash
ls docs/DECISIONS/ | grep aurora
```

Expected: the new ADR file appears. Verify it contains both a
directory-name choice AND a Path A/B choice.

## Acceptance signal

- A committed ADR under `docs/DECISIONS/YYYY-MM-DD-aurora-split-naming.md`
  with both choices made (directory name + path).
- 081KQ0YZ80008QG0R003GMGDRH frontmatter remains `status: decomposed` and is updated to
  reference the ADR.
- No files under `docs/aurora/**` modified.

## Pre-start checklist

- [x] Prior-art search: no existing `docs/DECISIONS/` ADR for aurora split
  found; no memory file with a resolved naming choice.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R003PAVRT8]` — the inventory must
  confirm how many files move before the cost estimate in the ADR is accurate.
- [x] Reciprocal pointer: 081KR50HA0008QG0R003PAVRT8 `composes_with: [081KR50HA0008QG0R0038HWCDT]` is set.

## Composes with

- 081KQ0YZ80008QG0R003GMGDRH (parent): resolves the "Decision deferred" section.
- 081KR50HA0008QG0R003PAVRT8 (dep): inventory provides the file-count/type context the
  ADR uses to assess migration cost.
- 081KR50HA0008QG0R003C39GP0 (downstream): consumes the chosen directory name.
- 081KR50HA0008QG0R002HMCS5Y (downstream): consumes the chosen directory name.
- 081KR50HA0008QG0R003DJ093T (downstream): the execution atom runs Path A or Path B as decided here.
