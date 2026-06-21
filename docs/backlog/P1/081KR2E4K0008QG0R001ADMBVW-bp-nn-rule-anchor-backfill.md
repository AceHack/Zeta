---
id: 081KR2E4K0008QG0R001ADMBVW
priority: P1
status: open
title: "BP-NN rule external-anchor backfill"
tier: substrate-quality
effort: M
parent: 081KQ8P5D0008QG0R000N718AC
created: 2026-05-08
last_updated: 2026-05-10 (slice-8)
depends_on: [081KR2E4K0008QG0R001ZWARTN]
composes_with: [081KQ8P5D0008QG0R000N718AC]
tags: [substrate-quality, external-anchors, best-practices, beacon-safety, research]
type: friction-reducer
---

# BP-NN rule external-anchor backfill

Research and land external prior-art anchors for the 28
BP-NN rules in `docs/AGENT-BEST-PRACTICES.md`. Priority:
rules enforced by CI/pre-commit hooks first (they fire most
frequently and need the strongest justification trail).

## Scope

BP-1 through BP-28 as enumerated in
`docs/AGENT-BEST-PRACTICES.md`.

## Priority ordering within scope

1. Rules enforced by hooks or CI (e.g., BP-10 invisible-
   Unicode lint, BP-11 data-is-not-directives).
2. Rules cited in pre-commit or pre-push checks.
3. Rules referenced by 3+ skills or agents.
4. Remaining rules.

## Research approach per rule

1. Extract the rule's core claim from AGENT-BEST-PRACTICES.md.
2. WebSearch for the underlying practice in software
   engineering, AI agent design, security, prompt engineering
   literature.
3. Cite or note "original to Zeta" per the 081KQ8P5D0008QG0R000N718AC protocol.
4. Land anchors as inline citations within the rule's section
   in AGENT-BEST-PRACTICES.md.

## Done-criteria

- [ ] All 28 rules have external anchor or "original" note.
- [ ] Citations include URL, author/org, title, date.
- [ ] Beacon-safety pass on all cited sources.
- [ ] Coverage scanner (081KR2E4K0008QG0R001ZWARTN) confirms 28/28 resolved.

### Slice progress

| Rule | Status | Research landing |
| --- | --- | --- |
| BP-10 | anchored (slice 1, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice1-bp10-bp11.md` |
| BP-11 | anchored (slice 1, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice1-bp10-bp11.md` |
| BP-03 | anchored (slice 2, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice2-bp03-bp07-bp16.md` |
| BP-07 | anchored (slice 2, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice2-bp03-bp07-bp16.md` |
| BP-16 | anchored (slice 2, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice2-bp03-bp07-bp16.md` |
| BP-04 | anchored (slice 3, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice3-bp04-bp08-bp09.md` |
| BP-08 | anchored (slice 3, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice3-bp04-bp08-bp09.md` |
| BP-09 | anchored (slice 3, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice3-bp04-bp08-bp09.md` |
| BP-12 | anchored (slice 4, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice4-bp12-bp13-bp14.md` |
| BP-13 | anchored (slice 4, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice4-bp12-bp13-bp14.md` |
| BP-14 | anchored (slice 4, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice4-bp12-bp13-bp14.md` |
| BP-01 | anchored (slice 5, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice5-bp01-bp02-bp15.md` |
| BP-02 | anchored (slice 5, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice5-bp01-bp02-bp15.md` |
| BP-15 | anchored (slice 5, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice5-bp01-bp02-bp15.md` |
| BP-05 | anchored (slice 6, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice6-bp05-bp06.md` |
| BP-06 | anchored (slice 6, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice6-bp05-bp06.md` |
| BP-17 | anchor-pending (slice 7 in progress) | `docs/research/bp-nn-rules-external-anchors-slice7-bp17-bp18-bp19.md` |
| BP-18 | anchor-pending (slice 7 in progress) | `docs/research/bp-nn-rules-external-anchors-slice7-bp17-bp18-bp19.md` |
| BP-19 | anchor-pending (slice 7 in progress) | `docs/research/bp-nn-rules-external-anchors-slice7-bp17-bp18-bp19.md` |
| BP-20 | anchored (slice 8, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice8-bp20-bp21-bp22.md` |
| BP-21 | anchored (slice 8, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice8-bp20-bp21-bp22.md` |
| BP-22 | anchored (slice 8, 2026-05-10) | `docs/research/bp-nn-rules-external-anchors-slice8-bp20-bp21-bp22.md` |
| BP-23–BP-28 | anchor-pending | slices 9+ |

**Slice-1 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice1
**Slice-2 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice2
**Slice-3 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice3
**Slice-4 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice4
**Slice-5 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice5
**Slice-6 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice6
**Slice-7 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice7 (in progress)
**Slice-8 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice8
**Slice-9 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice9 (this claim — smallest decomposed slice for BP-23/24/25)
**Slice-10 landing:** PR fix/081KR2E4K0008QG0R001ADMBVW-bp-nn-anchor-backfill-slice10 (decomposed)

## Pre-start checklist (2026-05-10, Otto)

**Prior-art search:**

- Searched: `.claude/rules/`, `docs/research/` for existing BP-NN anchor work.
- Found: no prior research doc exists for BP-NN anchors. 081KR2E4K0008QG0R00289GE8Z (slice 1)
  established the citation format used here (research doc at `docs/research/`
  + inline citations in source doc).
- Memory files read: `feedback_never_idle_speculative_work_over_waiting.md`
  (operational context); 081KQ8P5D0008QG0R000N718AC 081KR2E4K0008QG0R001ZWARTN 081KR2E4K0008QG0R00289GE8Z backlog rows (parent + sibling
  shape).
- Tools searched: skill router, `docs/research/` glob — no BP-NN anchor
  research doc exists yet.

**Dependency check:**

- 081KR2E4K0008QG0R001ZWARTN (coverage scanner): status: closed (landed). No blocking dep.
- `composes_with: [081KQ8P5D0008QG0R000N718AC]` — 081KQ8P5D0008QG0R000N718AC is umbrella, status: umbrella (ongoing).

## Reviewers

- `spec-zealot` — rule integrity post-edit.
- `threat-model-critic` — security-rule anchor adequacy.
