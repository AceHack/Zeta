---
id: 081KR50HA0008QG0R001VHE0FQ
priority: P1
status: closed
title: "Class 4 empirical analysis: Wolfram shadow taxonomy doc (30 catches, 8 classes)"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
resolved: 2026-05-09
resolved_by: "docs(081KR50HA0008QG0R001VHE0FQ): Class 4 empirical analysis — shadow taxonomy, 30 catches, 8 classes"
depends_on: [081KR50HA0008QG0R001AW7R6R]
parent: 081KR50HA0008QG0R002R3NVGS
classification: done
decomposition: atomic
owners: [architect]
type: research
tags: [class-4, wolfram, shadow-log, taxonomy, empirical, consensus-smoothness]
---

# 081KR50HA0008QG0R001VHE0FQ — Class 4 empirical analysis doc

## What

Write the Class 4 empirical analysis research doc that
applies the Wolfram Class 4 framing to the full 30-catch
shadow log.

**Status: BLOCKED** on 081KR50HA0008QG0R001AW7R6R (shadow log backfill to
catch 30 must land first so the analysis has the complete
dataset).

## The Wolfram Class 4 claim

Class 4 behavior (Wolfram, *A New Kind of Science*, 2002):

- Complex structures — neither simple (Class 1/2) nor random (Class 3)
- Recurring patterns coexist with a long tail of novel structures
- Locally determined, globally unpredictable

The shadow log exhibits Class 4:

- **Recurring:** `confident-fabrication` (6+ catches), `narration-over-action` (3+ catches), `archivist-curation` (3+ catches)
- **Novel:** `consensus-smoothness` (catch #30 area, first appearance 2026-05-09)
- **Pattern:** recurring patterns are stable training targets; novel patterns prove taxonomy never complete (Rice's theorem corollary)

## Pre-start checklist

- **Prior-art search:** No existing Class 4 analysis doc
  for the shadow log. The Rice's theorem proof sketch at
  `docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md`
  already has a "Relationship to Class 4" section — this
  doc expands that into the full empirical analysis.
- **Dependency restructure:** `depends_on: [081KR50HA0008QG0R001AW7R6R]` —
  need the complete 30-catch log.

## Deliverable

`docs/research/2026-05-09-class4-empirical-analysis-shadow-taxonomy-wolfram.md`

Sections:

1. The claim: shadow log exhibits Wolfram Class 4
2. Evidence: full taxonomy table (8 classes × {recurrence_count, severity, status})
3. The recurring layer: patterns that keep returning
4. The novel layer: consensus-smoothness as exhibit A
5. Why this matters: Rice's theorem explains the tail (pointer)
6. What this implies: the taxonomy is a sustainable resource

## Acceptance criteria

- [ ] Document exists at path above
- [ ] Taxonomy table covers all 8 classes with recurrence
      counts drawn from the complete 30-catch log
- [ ] consensus-smoothness is documented as the canonical
      novel-class exhibit
- [ ] Wolfram Class 4 claim is labeled CONJECTURED (not PROVEN)
      per razor discipline
- [ ] Pointer to Rice's theorem proof sketch for the
      theoretical complement
- [ ] "What was cut" subsection documents that Wolfram full
      irreducibility was cut (too strong, Rice suffices)

## Composes with

- 081KR50HA0008QG0R001AW7R6R (complete shadow log — prerequisite)
- `docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md`
  (the theoretical complement — already exists)
- 081KR50HA0008QG0R0016X7VQP (synthesis)
