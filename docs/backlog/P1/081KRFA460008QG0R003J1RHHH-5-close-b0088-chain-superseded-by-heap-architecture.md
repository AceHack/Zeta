---
id: B-0423.5
zetaid: 081KRFA460008QG0R003J1RHHH
priority: P1
class: substrate-architecture
status: closed
closed: 2026-05-13
closed_by: "B-0088, B-0088.1, B-0088.2 closed as superseded; B-0088.3 left open (different scope: memory-reference-existence-lint.yml)"
title: Close B-0088 chain as superseded by B-0423 heap architecture
created: 2026-05-13
last_updated: 2026-05-13
parent: B-0423
depends_on: [B-0423.4]
composes_with: [B-0423, B-0423.4, B-0088, B-0088.1, B-0088.2, B-0088.3]
effort: XS
tier: factory-hygiene
authors: [otto]
---

# B-0423.5 — Close B-0088 chain superseded by B-0423

## Carved sentence

> B-0088, B-0088.1, B-0088.2, B-0088.3 asked "promote or weaken
> the paired-edit lint?" B-0423 answers definitively: remove the
> synchronous paired-edit architecture entirely. Close the B-0088
> chain as superseded; update each row's frontmatter.

## Context

B-0088 (2026-04-28) opened a decision gate: should the
`memory-index-integrity.yml` check be promoted to a required status
check (Option A) or have its message weakened to advisory (Option B)?

B-0088.2 was the maintainer decision gate: locked waiting for the
maintainer to pick A or B.

B-0423 (2026-05-12) introduced a third option that supersedes both:
replace the synchronous paired-edit architecture with a heap-state
model and cadence reindexer. This is architecturally stronger than
either Option A or Option B:

- Option A would have made the serialization point more rigid
- Option B would have accepted the serialization point as advisory
- B-0423 removes the serialization point entirely

After B-0423.4 lands, B-0088's question is moot. This slice closes
the chain cleanly to prevent orphan open items.

## Acceptance criteria

For each of the following files, add `superseded_by:` frontmatter
and a `## Resolution` section:

### `docs/backlog/P2/B-0088-paired-edit-lint-advisory-not-enforcement-promote-to-required-check-otto-2026-04-28.md`

- [ ] Add `superseded_by: B-0423.4` to frontmatter
- [ ] Add `status: closed` to frontmatter
- [ ] Add `## Resolution` section:
  > B-0423 (2026-05-12) resolved this question by removing the
  > synchronous paired-edit architecture entirely. B-0423.4 replaces
  > the paired-edit gate with a frontmatter-completeness gate and
  > wires cadence-based reindexing into the autonomous loop. Neither
  > Option A nor Option B was needed — the architecture was changed
  > instead. Closed as superseded by B-0423.4.

### `docs/backlog/P2/B-0088.1-verify-paired-edit-job-in-required-status-checks-riven-2026-05-11.md`

- [ ] Add `superseded_by: B-0423.4` to frontmatter
- [ ] Add `status: closed`
- [ ] Add `## Resolution`: closed by B-0423.4 superseding the
  paired-edit check

### `docs/backlog/P2/B-0088.2-decide-promote-vs-weaken-for-memory-paired-lint-riven-2026-05-11.md`

- [ ] Add `superseded_by: B-0423.4` to frontmatter
- [ ] Add `status: closed`
- [ ] Add `## Resolution`: B-0423.4 implemented a third option
  (remove the architecture). The decision gate is moot.

### `docs/backlog/P2/B-0088.3-audit-memory-reference-existence-lint-advisory-status-riven-2026-05-11.md`

- [ ] Read B-0088.3 to determine if it is also fully superseded
  or only partially affected by B-0423. (The B-0088.3 scope
  may differ from the paired-edit check specifically.)
- [ ] Update status appropriately.

### Update B-0423 parent row

- [ ] Add `children: [B-0423.1, B-0423.2, B-0423.3, B-0423.4,
  B-0423.5]` to B-0423 frontmatter
- [ ] Update B-0423 `status` from `open` to `decomposed`

## Why P1

Orphan open items in the B-0088 chain will re-surface in backlog
scans and create confusion about whether the paired-edit check is
still a decision gate. Closing them cleanly removes that confusion.
This is low-effort (frontmatter + resolution text) and has high
hygiene value.

## Implementation notes

Read B-0088.3 before writing its resolution — its scope may differ
from the others. If B-0088.3 covers a different lint (e.g.
`memory-reference-existence-lint.yml`) that is NOT affected by
B-0423.4, close it independently with a narrower note.

## Composes with

- B-0423 (parent; this is slice 5 of 5)
- B-0423.4 (must land before this slice; the closure is logically
  downstream of the actual CI change)
- B-0088, B-0088.1, B-0088.2, B-0088.3 (the rows being closed)
