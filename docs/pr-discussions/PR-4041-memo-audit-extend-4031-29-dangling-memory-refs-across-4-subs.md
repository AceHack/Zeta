---
pr_number: 4041
title: "memo(audit): extend #4031 \u2014 29 dangling memory refs across 4 substrate surfaces (systemic, not rule-local)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T04:23:58Z"
merged_at: "2026-05-17T04:27:52Z"
closed_at: "2026-05-17T04:27:52Z"
head_ref: "memo/audit-dangling-memory-refs-extended-29-across-4-surfaces-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T07:02:59Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4041: memo(audit): extend #4031 — 29 dangling memory refs across 4 substrate surfaces (systemic, not rule-local)

## PR description

## Summary

Extension of audit [#4031](https://github.com/Lucent-Financial-Group/Zeta/pull/4031) (which found 5 dangling rule→memory refs in `.claude/rules/`). Extending the scan to 4 other substrate surfaces revealed **29 dangling refs total** — 6× scaling, systemic across the substrate, not rule-local.

| Surface | Dangling / Unique |
|---------|-------------------|
| `.claude/agents/` | 0 / 0 |
| `.claude/skills/` | 1 / 14 |
| `docs/research/` | 8 / 186 |
| `docs/backlog/` | 17 / 200 |
| `memory/<persona>/` | 3 / 58 |
| **TOTAL** | **29 dangling** |

(The `.claude/rules/` original 5 are already addressed by #4031 + #4033 + #4038 chain.)

## Audit-method gap also documented

Original `sort -u` audit-form hides multi-citation edges (the bug that caused #4036 r1 to miss the m-acc rule's citation site that #4038 r2 had to back-fill). Better audit tracks file:line pairs, not deduplicated filenames.

## Not P0; filed as substrate-engineer candidate

`tools/hygiene/audit-dangling-memory-refs.ts` + CI integration would mechanize the discipline at substrate-level rather than discipline-level.

## Test plan

- [x] `git diff origin/main..HEAD --name-only` returns only the new memo file
- [x] Tree canary clean (53 entries)
- [ ] CI green on docs-only PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T04:25:53Z)

## Pull request overview

Documentation-only memo under `memory/` that extends the audit from PR #4031 to additional substrate surfaces, reporting 29 dangling memory-file references across 4 surfaces.

**Changes:**

- Adds a new project-type memory file documenting the systemic dangling-ref pattern.
- Records the extended audit command and the `sort -u` methodology gap.
