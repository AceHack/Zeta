---
id: 081KSRGFP0008QG0R001A43EC6
priority: P2
status: open
title: Redundancy-checks across satellites + rules — duplicate-content audit, mirror→beacon rhyme-retirement, hub-over-budget detector
tier: substrate-foundational-discipline
ask: Aaron 2026-05-29 ("we can likly start having redudantacy checks across satalites across rules and such")
created: 2026-05-29
last_updated: 2026-05-29
decomposition: leaf
depends_on: [081KSRGFP0008QG0R002F5KY8Y]
composes_with:
  - 081KR2E4K0008QG0R003MSVG42
  - 081KR2E4K0008QG0R002FRQZN4
  - docs/research/2026-05-29-agent-memory-architecture-design-record-loading-taxonomy-hub-satellite-mirror-beacon-convergence-aaron-otto.md
  - .claude/rules/claude-code-loading-taxonomy.md
  - .claude/rules/dv2-data-split-discipline-activated.md
tags: [hygiene, friction-reducer, memory-architecture, redundancy, mirror-beacon, auto-load-budget, audit-tool]
type: friction-reducer
---

# 081KSRGFP0008QG0R001A43EC6 — Redundancy-checks across satellites + rules (audit-time)

## Origin

Aaron 2026-05-29, after the 081KSRGFP0008QG0R002F5KY8Y hub/satellite split landed: *"we can likly
start having redudantacy checks across satalites across rules and such and you
can get ideas on how to structure you actual memories."*

The hub/satellite split (081KSRGFP0008QG0R002F5KY8Y) creates a new surface class (companion
satellites). As the pattern propagates, content can drift into multiple
surfaces. Authoring-time discipline
(`.claude/rules/verify-existing-substrate-before-authoring.md` +
`.claude/rules/skill-router-as-substrate-inventory.md`) reduces this but does
not catch it at audit-time across the accumulated corpus.

## What this row owns

A TS audit tool (per Rule-0; `tools/hygiene/` or `tools/memory/`) that scans
across `.claude/rules/`, satellite `docs/research/*companion*` docs, and
`memory/`, and surfaces:

1. **Duplicate content** — same anchor / table / quote present in 2+ surfaces.
   Candidate: single-home + pointer. (Composes with 081KR2E4K0008QG0R003MSVG42 cross-reference
   integrity.)
2. **Mirror-rhyme with an existing beacon equivalent** — a folklore/religion/
   physics rhyme (mirror-tier) that now has an exact-ontology beacon doc/code
   equivalent (per the mirror→beacon convergence in the design-record §3).
   Candidate: rhyme-retirement + beacon-pointer. (Requires a beacon-equivalence
   registry; may be a follow-up.)
3. **Orphaned satellite content** — satellite section that no hub points at.
   Candidate: re-link or retire.
4. **Hub-over-budget detector** — any direct-load `.claude/rules/*.md` (no
   `paths:` frontmatter) exceeding ~38k chars (warn BEFORE the 40k harness
   warning fires). Candidate: hub/satellite split per 081KSRGFP0008QG0R002F5KY8Y. This is the
   081KSRGFP0008QG0R002F5KY8Y trigger, mechanized so the next oversized rule is caught proactively.

## Acceptance Criteria

- A TS tool under `tools/` scans rules + satellites + memory and reports the
  four classes above (`--json` + human output; exit 0 clean / 2 error).
- The hub-over-budget detector (class 4) is the minimal-viable slice — it is
  self-contained (just `wc -c` + `paths:`-frontmatter check across
  `.claude/rules/*.md`) and would have caught 081KSRGFP0008QG0R002F5KY8Y proactively. Ship class 4
  first; classes 1-3 can follow.
- Output composes with the agent-memory-architecture design-record + the
  memory-substrate-engineering trajectory (081KQR4HQ0008QG0R001909FPT).

## Owner / effort

- **Owner:** Otto (hygiene / friction-reducer).
- **Effort:** M (class 4 alone is S; classes 1-3 add M).

## Notes

Class 4 (hub-over-budget detector) is the highest-value lowest-risk slice and
directly mechanizes the 081KSRGFP0008QG0R002F5KY8Y trigger. Classes 1-2 depend on heavier substrate
(content-similarity detection; a beacon-equivalence registry). Recommend
shipping class 4 first as a standalone lint, then the rest.
