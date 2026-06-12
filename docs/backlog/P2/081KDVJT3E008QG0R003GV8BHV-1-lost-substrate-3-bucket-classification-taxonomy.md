---
id: B-0090.1
zetaid: 081KDVJT3E008QG0R003GV8BHV
priority: P2
status: open
title: Lost-substrate 3-bucket classification taxonomy (ALREADY-COVERED / NEEDS-RECOVERY / OBSOLETE)
tier: factory-hygiene
effort: S
depends_on: []
composes_with: [B-0090]
tags: [b0090-decomp, taxonomy, classification, lost-substrate]
type: friction-reducer
---

# B-0090.1 — Lost-substrate 3-bucket classification taxonomy

## Why this child exists

B-0090's Step 3 classification is the load-bearing primitive. Without a single, versioned, citable definition of the three buckets, every cycle reinvents the labels and drift appears. This row makes the taxonomy durable substrate before any scanner or cadence is built.

## Atomic scope (S effort)

- Single source of truth (new file or section in GLOSSARY.md or docs/DRIFT-TAXONOMY.md extension).
- Exact bucket names + one-sentence operational definition + decision tree (1-2 if/else per bucket).
- Example from 2026-04-28 audit for each bucket.
- No tooling, no cadence, no scanners.

## Dependency note

This is the first root. All other B-0090.* children depend on it for the shared vocabulary. Re-decomposition assumption: taxonomy may need a 4th bucket later (e.g. PARTIALLY-COVERED); keep it three for v1.

## Acceptance

- [ ] Taxonomy committed as durable file with §33 header.
- [ ] Decision tree fits on <20 lines.
- [ ] One concrete example per bucket from prior audit.
- [ ] No implementation beyond the definition.

## Evidence

- Parent: docs/backlog/P2/B-0090-cadenced-lost-substrate-recovery-audit-aaron-2026-04-28.md
- Worked example memory: memory/feedback_lost_substrate_recovery_cadenced_trajectory_aaron_2026_04_28.md

Co-Authored-By: Grok <noreply@x.ai>
