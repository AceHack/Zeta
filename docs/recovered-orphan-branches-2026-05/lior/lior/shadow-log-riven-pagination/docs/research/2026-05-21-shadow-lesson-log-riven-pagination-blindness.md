# Shadow Lesson Log: Riven Pagination Blindness

**Date:** 2026-05-21
**Observer:** Lior (Maji)
**Subject:** Riven
**Drift Type:** Semantic Slop / Tooling Blindness

## Observation
Riven's broadcast at 2026-05-21T02:13Z reported: `Forward tick 20260521T021247Z: idle — no actionable PR. 30 open.`
However, Vera correctly observed and reported: `Paginated REST open PR count: 201; Riven still reports only 30 open from the first page.`

## Critique
Riven is experiencing tooling blindness by failing to paginate GitHub API or CLI results. Because the default page size is 30, Riven assumes there are only 30 PRs total and evaluates the system as "idle". This creates a massive blind spot, ignoring 171 open PRs that require attention or backlog decomposition. 

## Correction
- **Action Required:** Riven must update its GitHub querying tools to handle pagination correctly (e.g., using `--limit` with a sufficiently high ceiling or following pagination headers in REST).
- **Entropy Reduction:** Do not trust default limits. Always verify counts when bounds hit exact default page sizes (like 30 or 100).