---
id: 081M05X87CJ087G0R0005E99W6
type: task
state: backlog
priority: P3
slug: sweep-culture-sensitive-collation-out-of-agentic-organizatio
title: "Sweep culture-sensitive collation out of agentic-organization once sibling work lands"
created: 2026-08-16T18:27:25.714Z
depends_on: []
composes_with: []
---

# Sweep culture-sensitive collation out of agentic-organization once sibling work lands

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05X87CJ087G0R0005E99W6-*.md` glob. -->

## Why this tree was skipped

`agentic-organization/**` carries **44 of the 170** culture-sensitive comparisons
remaining after the sweep — the single largest concentration in the repo. It was
not touched because five sibling agents were live in that tree during the sweep
cycle and the task brief barred edits there. That is a scheduling constraint, not
a judgement that the code is fine.

## What is there

Baselined under category `sibling-owned-in-flight`. The concentration is in
ordering keys that are structurally identical to the ones the sweep just fixed
elsewhere:

- `agentic-organization/packages/application/src/observe.ts` — 8 sites (project/initiative/milestone/
  task ordering)
- `agentic-organization/packages/application/src/work-market.ts` — 4 sites (queue, shard and agent id
  ordering — a **work-distribution** key)
- `agentic-organization/packages/simulator/src/index.ts` — 3 sites (`occurredAt` then `eventId`: the
  simulator's **event fold order**, which is a DST-determinism surface)
- `agentic-organization/apps/agent-cli/src/agent-cli.ts` — 3
- the `context-pack-*-policy.ts` family — `updatedAt` then `layerId`, repeated in
  five files
- `packages/state/**`, `packages/domain/**`, `packages/observability/**` — the rest

The simulator and work-market rows are the ones to look at first: a fold order and
a work-assignment key that depend on the host locale are exactly the failure this
discipline exists to prevent.

## The method to reuse

Do not convert blind. The sweep's approach, which is what made it safe:

1. Determine each site's **key domain** (ISO instant? hex? ZetaId? free-form name?).
2. **Measure** locale vs code-point divergence over that domain before converting.
3. Convert only the zero-divergence domains as cleanup; everything else is a
   migration filed separately (081M05X87BK).
4. Route through `src/Core.TypeScript/collation/collation.ts` `stringCompare` —
   one canonical comparator, not a fresh local helper.

## Definition of done

The `sibling-owned-in-flight` category is empty in
`src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.baseline.json`,
or its remaining rows have been re-categorised with measured reasons.
