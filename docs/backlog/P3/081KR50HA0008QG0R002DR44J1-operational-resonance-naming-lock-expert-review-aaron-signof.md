---
id: 081KR50HA0008QG0R002DR44J1
priority: P3
status: open
title: Lock name for Operational Resonance Dashboard — run naming-expert review, collect candidates, Aaron sign-off
tier: research-grade
effort: S
ask: decomposition of 081KQ0YZ80008QG0R0003GAYYN
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
composes_with: [081KQ0YZ80008QG0R0003GAYYN, 081KR50HA0008QG0R000TQKYGM, 081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, 081KR50HA0008QG0R003BM7FNK, 081KR50HA0008QG0R001DX165X, 081KR50HA0008QG0R002NZENZJ, 081KR50HA0008QG0R0019KYAAS]
parent: 081KQ0YZ80008QG0R0003GAYYN
tags: [frontier, naming, operational-resonance, naming-expert, dashboard]
type: research
---

# 081KR50HA0008QG0R002DR44J1 — Lock name for Operational Resonance Dashboard

## What

Run the naming-expert review workflow (GOVERNANCE.md §10 + Otto-310
cohort) for the Operational Resonance Dashboard and get Aaron sign-off.

Produce a committed doc with:

1. **Candidate list** (minimum 5) — each with:
   - Name
   - Reasoning for fit (composes-with existing vocabulary? evokes
     the right mental model? survives Rodney's Razor?)
   - Reasoning against (failure modes, overclaims, confusion vectors)

2. **Recommendation** from naming-expert with justification.

3. **Aaron sign-off** — once received, mark the canonical name
   in the parent row (081KQ0YZ80008QG0R0003GAYYN) and in `docs/GLOSSARY.md`.

Candidate pool from 081KQ0YZ80008QG0R0003GAYYN body (starting point, not exhaustive):

- Operational Resonance Dashboard
- Coherence Surface
- Resonance Console
- Alignment Lens
- Substrate Lens
- Frontier Pulse
- Are Things OK View
- The Dashboard (within Frontier umbrella)

## Why first

All downstream rows (081KR50HA0008QG0R0036HGEJ5 GH Pages shell, 081KR50HA0008QG0R002NZENZJ MVP surface,
docs, component names) need the locked name before authoring.
A name minted mid-build becomes technical debt in URLs, component
IDs, and docs.

## Output artifact

- `docs/research/frontier/naming-candidates-operational-resonance-dashboard.md`
  — candidates + rationale + recommendation
- Updated GLOSSARY.md entry for the locked name
- Updated 081KQ0YZ80008QG0R0003GAYYN frontmatter `title:` with final name note

## Focused check

```bash
grep -r "Operational Resonance Dashboard\|Frontier Pulse\|Coherence Surface\|Resonance Console\|Alignment Lens" docs/GLOSSARY.md
```

Expected: locked name appears in GLOSSARY.md after this row completes.

## Acceptance signal

- At least 5 candidates documented with for/against
- Naming-expert recommendation recorded
- Aaron sign-off noted in the doc (or in the PR description)
- GLOSSARY.md updated with the locked name
- 081KQ0YZ80008QG0R0003GAYYN body updated with pointer to the naming doc

## Pre-start checklist

- [x] Prior-art search: no existing naming-decision doc found for
  this dashboard in `docs/DECISIONS/`, `docs/GLOSSARY.md`, or
  `docs/research/frontier/`. The 081KQ0YZ80008QG0R0003GAYYN body lists candidates
  but has no locked decision. No skill or memory file has a
  naming decision for this item.
- [x] Dependency-restructure: no `depends_on` — this is a root
  atom. All sibling rows 081KR50HA0008QG0R000TQKYGM–081KR50HA0008QG0R0019KYAAS carry reciprocal
  `composes_with: [081KR50HA0008QG0R002DR44J1]` where the name is needed.

## Composes with

- 081KQ0YZ80008QG0R0003GAYYN (parent): naming-lock is the first milestone from "Done when"
- 081KR50HA0008QG0R0036HGEJ5 (downstream): GH Pages shell uses the locked name for title/slug
- 081KR50HA0008QG0R002NZENZJ (downstream): MVP dashboard uses the locked name
- 081KR50HA0008QG0R000TQKYGM through 081KR50HA0008QG0R0019KYAAS (all siblings): locked name provides
  consistent vocabulary
