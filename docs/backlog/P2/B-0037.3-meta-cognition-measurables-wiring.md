---
id: B-0037.3
zetaid: 081KR7JY10008QG0R000XPVJ0W
priority: P2
status: closed
title: "B-0037.3 — Meta-cognition measurables wired into alignment-trajectory dashboard"
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0037.1]
parent: B-0037
classification: blocked
type: measurables
effort: M

---

# B-0037.3 — Meta-cognition measurables wired into alignment-trajectory dashboard

**Slice of:** [B-0037](B-0037-meta-cognition-first-class-factory-discipline.md)

## What

Wire the six meta-cognition measurables from B-0037.1 into the
`docs/ALIGNMENT.md` measurability framework (§ "Per-round metrics"):

- `self-corrections-per-round`
- `overclaim-self-tags-per-round`
- `revision-blocks-per-round`
- `decohere-star-self-detected-events-count`
- `meta-check-execution-rate`
- `meta-drift-detection-lag-rounds`

Each measurable needs: definition, measurement procedure (what to grep/count
in the commit stream), target direction (rising / falling / 100%), and
honest "don't know yet" annotation where the measurement procedure is not
yet automated.

## Why

Depends on B-0037.1 (taxonomy names the measurables). ALIGNMENT.md is the
authoritative surface for measurability claims; adding here makes the
meta-cognition discipline part of Zeta's primary-research-focus trajectory.

## Acceptance criteria

1. `docs/ALIGNMENT.md` §"Per-round metrics" subsection lists all six
   measurables with definitions and measurement procedures.
2. At least three measurables have concrete grep commands or counting
   procedures; remaining are honestly labelled "not yet automated."
3. No existing measurables in ALIGNMENT.md are removed or modified beyond
   adding the new section.
4. `dotnet build -c Release` unaffected.

## Out of scope

- Distributed-vs-concentrated ADR (B-0037.4).
- Automating the measurements (future child of B-0037.3 if needed).

## Resolution

Closed 2026-05-16 via picking up the #2-Ready overlay (the
`classification: blocked` field was stale because B-0037.1 merged
earlier this session via PR #3859; B-0037.2 closed in PR #3888
landed the related ROUND-HISTORY.md template).

**Deliverable shipped this PR**:

`docs/ALIGNMENT.md` §"Measurability — what we count" → §"Per-round
metrics" → appended a "Per-round meta-cognition measurables" subsection
with all 6 measurables from B-0037.1 taxonomy:

- `self-corrections-per-round` (concrete grep: dated revision blocks)
- `overclaim-self-tags-per-round` (concrete grep: `overclaim` matches)
- `revision-blocks-per-round` (concrete grep: same broader pattern)
- `decohere-star-self-detected-events-count` (concrete grep: `decohere\*` matches)
- `meta-check-execution-rate` (honestly labelled not-yet-automated)
- `meta-drift-detection-lag-rounds` (honestly labelled not-yet-automated)

**Acceptance check**:

- ✅ ALIGNMENT.md §"Per-round metrics" lists all 6 measurables with
  definitions + measurement procedures
- ✅ 4 of 6 measurables have concrete grep commands (above 3-required threshold)
- ✅ No existing measurables modified — pure additive subsection
- ✅ `dotnet build -c Release` unaffected — pure doc addition

**Composes with**: B-0037.2 closed PR #3888 (the round-close meta-check template that this row's `meta-check-execution-rate` measurable cites). B-0037.4 (distributed-vs-concentrated ADR) remains separate scope.
