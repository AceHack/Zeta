---
id: 081KRFA460008QG0R003J1RHHH
priority: P1
class: substrate-architecture
status: closed
closed: 2026-05-13
closed_by: "081KQ8P5D0008QG0R002FSTGXP, 081KRA5AR0008QG0R000GZ8ECC, 081KRA5AR0008QG0R0036JP9KM closed as superseded; 081KRA5AR0008QG0R002WVSEGW left open (different scope: memory-reference-existence-lint.yml)"
title: Close 081KQ8P5D0008QG0R002FSTGXP chain as superseded by 081KRCQQF0008QG0R0037YYP1A heap architecture
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KRCQQF0008QG0R0037YYP1A
depends_on: [081KRFA460008QG0R0035NKRHG]
composes_with: [081KRCQQF0008QG0R0037YYP1A, 081KRFA460008QG0R0035NKRHG, 081KQ8P5D0008QG0R002FSTGXP, 081KRA5AR0008QG0R000GZ8ECC, 081KRA5AR0008QG0R0036JP9KM, 081KRA5AR0008QG0R002WVSEGW]
effort: XS
tier: factory-hygiene
authors: [otto]
---

# 081KRFA460008QG0R003J1RHHH — Close 081KQ8P5D0008QG0R002FSTGXP chain superseded by 081KRCQQF0008QG0R0037YYP1A

## Carved sentence

> 081KQ8P5D0008QG0R002FSTGXP, 081KRA5AR0008QG0R000GZ8ECC, 081KRA5AR0008QG0R0036JP9KM, 081KRA5AR0008QG0R002WVSEGW asked "promote or weaken
> the paired-edit lint?" 081KRCQQF0008QG0R0037YYP1A answers definitively: remove the
> synchronous paired-edit architecture entirely. Close the 081KQ8P5D0008QG0R002FSTGXP
> chain as superseded; update each row's frontmatter.

## Context

081KQ8P5D0008QG0R002FSTGXP (2026-04-28) opened a decision gate: should the
`memory-index-integrity.yml` check be promoted to a required status
check (Option A) or have its message weakened to advisory (Option B)?

081KRA5AR0008QG0R0036JP9KM was the maintainer decision gate: locked waiting for the
maintainer to pick A or B.

081KRCQQF0008QG0R0037YYP1A (2026-05-12) introduced a third option that supersedes both:
replace the synchronous paired-edit architecture with a heap-state
model and cadence reindexer. This is architecturally stronger than
either Option A or Option B:

- Option A would have made the serialization point more rigid
- Option B would have accepted the serialization point as advisory
- 081KRCQQF0008QG0R0037YYP1A removes the serialization point entirely

After 081KRFA460008QG0R0035NKRHG lands, 081KQ8P5D0008QG0R002FSTGXP's question is moot. This slice closes
the chain cleanly to prevent orphan open items.

## Acceptance criteria

For each of the following files, add `superseded_by:` frontmatter
and a `## Resolution` section:

### `docs/backlog/P2/081KQ8P5D0008QG0R002FSTGXP-paired-edit-lint-advisory-not-enforcement-promote-to-required-check-otto-2026-04-28.md`

- [ ] Add `superseded_by: 081KRFA460008QG0R0035NKRHG` to frontmatter
- [ ] Add `status: closed` to frontmatter
- [ ] Add `## Resolution` section:
  > 081KRCQQF0008QG0R0037YYP1A (2026-05-12) resolved this question by removing the
  > synchronous paired-edit architecture entirely. 081KRFA460008QG0R0035NKRHG replaces
  > the paired-edit gate with a frontmatter-completeness gate and
  > wires cadence-based reindexing into the autonomous loop. Neither
  > Option A nor Option B was needed — the architecture was changed
  > instead. Closed as superseded by 081KRFA460008QG0R0035NKRHG.

### `docs/backlog/P2/081KRA5AR0008QG0R000GZ8ECC-verify-paired-edit-job-in-required-status-checks-riven-2026-05-11.md`

- [ ] Add `superseded_by: 081KRFA460008QG0R0035NKRHG` to frontmatter
- [ ] Add `status: closed`
- [ ] Add `## Resolution`: closed by 081KRFA460008QG0R0035NKRHG superseding the
  paired-edit check

### `docs/backlog/P2/081KRA5AR0008QG0R0036JP9KM-decide-promote-vs-weaken-for-memory-paired-lint-riven-2026-05-11.md`

- [ ] Add `superseded_by: 081KRFA460008QG0R0035NKRHG` to frontmatter
- [ ] Add `status: closed`
- [ ] Add `## Resolution`: 081KRFA460008QG0R0035NKRHG implemented a third option
  (remove the architecture). The decision gate is moot.

### `docs/backlog/P2/081KRA5AR0008QG0R002WVSEGW-audit-memory-reference-existence-lint-advisory-status-riven-2026-05-11.md`

- [ ] Read 081KRA5AR0008QG0R002WVSEGW to determine if it is also fully superseded
  or only partially affected by 081KRCQQF0008QG0R0037YYP1A. (The 081KRA5AR0008QG0R002WVSEGW scope
  may differ from the paired-edit check specifically.)
- [ ] Update status appropriately.

### Update 081KRCQQF0008QG0R0037YYP1A parent row

- [ ] Add `children: [081KRFA460008QG0R0006Q6BWP, 081KRFA460008QG0R000YPS21H, 081KRFA460008QG0R0034C2W0E, 081KRFA460008QG0R0035NKRHG,
  081KRFA460008QG0R003J1RHHH]` to 081KRCQQF0008QG0R0037YYP1A frontmatter
- [ ] Update 081KRCQQF0008QG0R0037YYP1A `status` from `open` to `decomposed`

## Why P1

Orphan open items in the 081KQ8P5D0008QG0R002FSTGXP chain will re-surface in backlog
scans and create confusion about whether the paired-edit check is
still a decision gate. Closing them cleanly removes that confusion.
This is low-effort (frontmatter + resolution text) and has high
hygiene value.

## Implementation notes

Read 081KRA5AR0008QG0R002WVSEGW before writing its resolution — its scope may differ
from the others. If 081KRA5AR0008QG0R002WVSEGW covers a different lint (e.g.
`memory-reference-existence-lint.yml`) that is NOT affected by
081KRFA460008QG0R0035NKRHG, close it independently with a narrower note.

## Composes with

- 081KRCQQF0008QG0R0037YYP1A (parent; this is slice 5 of 5)
- 081KRFA460008QG0R0035NKRHG (must land before this slice; the closure is logically
  downstream of the actual CI change)
- 081KQ8P5D0008QG0R002FSTGXP, 081KRA5AR0008QG0R000GZ8ECC, 081KRA5AR0008QG0R0036JP9KM, 081KRA5AR0008QG0R002WVSEGW (the rows being closed)
