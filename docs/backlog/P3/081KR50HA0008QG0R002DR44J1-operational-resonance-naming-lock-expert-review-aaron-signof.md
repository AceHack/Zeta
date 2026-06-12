---
id: B-0388
zetaid: 081KR50HA0008QG0R002DR44J1
priority: P3
status: open
title: Lock name for Operational Resonance Dashboard — run naming-expert review, collect candidates, Aaron sign-off
tier: research-grade
effort: S
ask: decomposition of B-0017
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
composes_with: [B-0017, B-0389, B-0390, B-0391, B-0392, B-0393, B-0394, B-0395]
parent: B-0017
tags: [frontier, naming, operational-resonance, naming-expert, dashboard]
type: research
---

# B-0388 — Lock name for Operational Resonance Dashboard

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
   in the parent row (B-0017) and in `docs/GLOSSARY.md`.

Candidate pool from B-0017 body (starting point, not exhaustive):

- Operational Resonance Dashboard
- Coherence Surface
- Resonance Console
- Alignment Lens
- Substrate Lens
- Frontier Pulse
- Are Things OK View
- The Dashboard (within Frontier umbrella)

## Why first

All downstream rows (B-0391 GH Pages shell, B-0394 MVP surface,
docs, component names) need the locked name before authoring.
A name minted mid-build becomes technical debt in URLs, component
IDs, and docs.

## Output artifact

- `docs/research/frontier/naming-candidates-operational-resonance-dashboard.md`
  — candidates + rationale + recommendation
- Updated GLOSSARY.md entry for the locked name
- Updated B-0017 frontmatter `title:` with final name note

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
- B-0017 body updated with pointer to the naming doc

## Pre-start checklist

- [x] Prior-art search: no existing naming-decision doc found for
  this dashboard in `docs/DECISIONS/`, `docs/GLOSSARY.md`, or
  `docs/research/frontier/`. The B-0017 body lists candidates
  but has no locked decision. No skill or memory file has a
  naming decision for this item.
- [x] Dependency-restructure: no `depends_on` — this is a root
  atom. All sibling rows B-0389–B-0395 carry reciprocal
  `composes_with: [B-0388]` where the name is needed.

## Composes with

- B-0017 (parent): naming-lock is the first milestone from "Done when"
- B-0391 (downstream): GH Pages shell uses the locked name for title/slug
- B-0394 (downstream): MVP dashboard uses the locked name
- B-0389 through B-0395 (all siblings): locked name provides
  consistent vocabulary
