---
pr_number: 3147
title: "chore(b-0441): decompose into atomic child rows 081KRHWGX0008QG0R0025PX5SZ/081KRHWGX0008QG0R0000P5YP2/081KRHWGX0008QG0R001ZJ3W8R/081KRHWGX0008QG0R001E9KEJ1"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T16:31:25Z"
merged_at: "2026-05-14T16:37:46Z"
closed_at: "2026-05-14T16:37:46Z"
head_ref: "feat/b-0441-decompose-child-rows-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T18:05:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3147: chore(b-0441): decompose into atomic child rows 081KRHWGX0008QG0R0025PX5SZ/081KRHWGX0008QG0R0000P5YP2/081KRHWGX0008QG0R001ZJ3W8R/081KRHWGX0008QG0R001E9KEJ1

## PR description

## Summary

081KRFA460008QG0R00229616S (backlog-ready-notifier background service) had slices 1+2+4 already shipped in `tools/bg/backlog-ready-notifier.ts`. The remaining implementation work was sketched as a TBD list in the parent row. This PR formalises that work into four dependency-ordered atomic child rows.

**Child rows created:**

| Row | Slice | What | Effort | Deps |
|-----|-------|------|--------|------|
| 081KRHWGX0008QG0R0025PX5SZ | 3 | Wire `isAgentQueueEmpty` guard into `pollOnce` (currently publishes unconditionally; function exists but is not called from the poll loop) | XS | none |
| 081KRHWGX0008QG0R0000P5YP2 | 5a | Assignment history dedup / cooldown (avoid re-publishing same row within configurable window) | S | none |
| 081KRHWGX0008QG0R001ZJ3W8R | 6 | launchd plist + `docs/AUTONOMOUS-LOOP.md` update (same pattern as `com.zeta.missed-substrate-detector.plist`) | XS | none |
| 081KRHWGX0008QG0R001E9KEJ1 | 5.2 | Agent-side `work-assignment` subscriber handler — explicitly referenced in 081KRFA460008QG0R002DG8KPZ as "081KRHWGX0008QG0R001E9KEJ1" but the file never existed | S | 081KRFA460008QG0R002DG8KPZ |

**Parent row updated:**
- `children:` field added to frontmatter
- TBD decomposition hint replaced with formal slice-status table
- Pre-start checklist items ticked (prior-art search, dependency check, decomposition done)

## Focused checks

```
bun test tools/bg/backlog-ready-notifier.test.ts
# 35 pass, 0 fail (existing tests; no new code changed)

bun tools/bg/audit-duplicate-row-ids.ts --once
# 599 rows with id field, no duplicate IDs
```

## Notes

- 081KRHWGX0008QG0R0025PX5SZ, 081KRHWGX0008QG0R0000P5YP2, 081KRHWGX0008QG0R001ZJ3W8R are independent of each other and can land in any order
- 081KRHWGX0008QG0R001E9KEJ1 depends on 081KRFA460008QG0R002DG8KPZ (subscriber library design pass) — blocked until 081KRFA460008QG0R002DG8KPZ merges
- The `isAgentQueueEmpty` function is already fully implemented and tested; 081KRHWGX0008QG0R0025PX5SZ is a wiring-only change (~30 lines implementation + ~40 lines tests)
- 081KRHWGX0008QG0R001ZJ3W8R uses `StartInterval: 600` (10 min) to match `DEFAULT_CONFIG.pollIntervalMin`, distinguishing it from the standing-by-detector (300s) and missed-substrate-detector (300s)

operative-authorization: aaron 2026-05-13: "Cooling period: TBD. The memory file IS the durable record"

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T16:33:32Z)

## Pull request overview

Decomposes parent backlog row 081KRFA460008QG0R00229616S (backlog-ready-notifier background service) into four atomic child rows so the remaining slices (3, 5a, 5.2, 6) can be picked up independently. No code changes — this PR adds planning documents and updates the parent row's frontmatter and slice table.

**Changes:**
- Creates four new P1 backlog rows: 081KRHWGX0008QG0R0025PX5SZ (queue-state guard wiring), 081KRHWGX0008QG0R0000P5YP2 (assignment-history cooldown), 081KRHWGX0008QG0R001ZJ3W8R (launchd plist + docs), 081KRHWGX0008QG0R001E9KEJ1 (work-assignment subscriber handler, depends on 081KRFA460008QG0R002DG8KPZ).
- Updates parent 081KRFA460008QG0R00229616S: adds `children:` frontmatter, bumps `last_updated`, replaces TBD slice list with a concrete slice-status table, and checks off pre-start checklist items.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KRHWGX0008QG0R0025PX5SZ-…2026-05-14.md | New row: wire existing `isAgentQueueEmpty` into `pollOnce`; adds `targetAgent` config + `queueBusy` PollResult field. |
| docs/backlog/P1/081KRHWGX0008QG0R0000P5YP2-…2026-05-14.md | New row: assignment-history dedup with cooldown window, atomic file write, adapter injection. |
| docs/backlog/P1/081KRHWGX0008QG0R001ZJ3W8R-…2026-05-14.md | New row: launchd plist + AUTONOMOUS-LOOP.md/README updates; `StartInterval: 600` matching default poll interval. |
| docs/backlog/P1/081KRHWGX0008QG0R001E9KEJ1-…2026-05-14.md | New row: agent-side subscriber handler for `work-assignment` topic; depends on 081KRFA460008QG0R002DG8KPZ. |
| docs/backlog/P1/081KRFA460008QG0R00229616S-…2026-05-13.md | Parent updated with `children:`, completed checklist, formalized slice-status table. |
</details>
