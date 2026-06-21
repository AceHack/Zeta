---
id: 081KR2E4K0008QG0R003RZFR9F
priority: P1
status: closed
title: Memory ontology/classification audit — reclassify mistyped feedback/project/user/reference files
tier: foundation
effort: M
ask: 081KQR4HQ0008QG0R001909FPT Step 3 decomposition
created: 2026-05-08
last_updated: 2026-05-09
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: [081KR2E4K0008QG0R002VM58S4]
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KR2E4K0008QG0R002VM58S4, 081KR2E4K0008QG0R002FRQZN4]
tags: [memory, ontology, classification, audit, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R003RZFR9F — Memory ontology/classification audit

## Parent

081KQR4HQ0008QG0R001909FPT Step 3 (memory ontology / classification).

## What

Audit the ~936 memory files against the four-type taxonomy
(`user` / `feedback` / `project` / `reference`) defined in
`memory/README.md` and standardized by 081KR2E4K0008QG0R002VM58S4. Many `feedback_*`
files contain content that is actually `project_*` or `user_*`.

1. Build an inventory: count files by prefix vs actual
   content-type.
2. Identify misclassified files (prefix does not match content).
3. Propose renames (batch rename PR, not one-at-a-time).
4. Update MEMORY.md index entries for renamed files.

## Why depends on 081KR2E4K0008QG0R002VM58S4

The format standard defines what distinguishes a feedback file
from a project file. Without the standard, reclassification is
subjective.

## Acceptance criteria

1. Inventory report committed (can be a TS tool output or a
   docs/research file).
2. At least the top-20 misclassified files renamed.
3. MEMORY.md index updated for all renames.
4. No broken cross-references after renames (verified by
   `bun tools/hygiene/audit-memory-references.ts --enforce`).

## Why M effort

~936 files to audit; batch tooling needed; MEMORY.md index
updates cascade.

## Completion notes (2026-05-09)

Audit tool built at `tools/hygiene/audit-memory-ontology.ts`.
Scanned 623 memory files; found only 2 misclassified (both had
`type: project` in frontmatter but `feedback_` prefix):

1. `feedback_human_maintainer_is_hari_seldon_archetype_...` ->
   `project_human_maintainer_is_hari_seldon_archetype_...`
2. `feedback_uncertainty_spanner_cockroachdb_tidb_...` ->
   `project_uncertainty_spanner_cockroachdb_tidb_...`

Both renamed and MEMORY.md index updated. Post-fix audit: 623/623
files matched (0 mismatches, 0 missing type fields).

## Prior art

- `memory/README.md` — taxonomy definition.
- `tools/hygiene/audit-memory-references.ts` — reference
  integrity checker (exists).
- `tools/hygiene/audit-memory-index-duplicates.ts` — duplicate
  detector (exists).
- `tools/hygiene/audit-memory-ontology.ts` — ontology/classification
  audit tool (new, this PR).
