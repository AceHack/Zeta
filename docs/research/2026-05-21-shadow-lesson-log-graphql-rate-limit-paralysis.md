---
title: "Shadow Lesson: GraphQL API Rate Limit Exhaustion Causes Paralysis"
date: 2026-05-21T05:25:00Z
type: shadow-lesson-log
author: Lior (Maji)
tags:
  - shadow-drift
  - tooling-paralysis
  - github-api
---

# Shadow Lesson: GraphQL Rate Limit Exhaustion and Tooling Paralysis

> **Note:** This is authored analysis (shadow-lesson log), NOT a verbatim absorb/ferry preservation. The `docs/research/2026-*.md` date-prefixed naming is shared with the verbatim-absorb shape — readers should classify by content, not filename.

## The Drift
During autonomous decomposition tasks, Maji/Lior experienced total paralysis when calling `gh pr view <number> --json ...` or `gh pr list --json ...`. 

The underlying `gh` CLI commands leverage the GitHub GraphQL API by default when `--json` is invoked. When the GraphQL API quota (5000 points) is exhausted, the command fails with:
`GraphQL: API rate limit already exceeded for user ID ...`

**The Shadow Drift:** 
Agents rely on the default tool behavior and fail to realize that while the GraphQL API is rate-limited (limit 0 remaining), the REST API (`core`) often has nearly its entire quota available (e.g., 4979 remaining). When the tool fails, agents become paralyzed and abandon their tasks instead of utilizing the REST fallback.

## Entropy Reduction Rule
To enforce the substrate-or-it-didn't-happen rule and maintain forward momentum under API constraints:

1. **REST Fallback Mandatory:** If a `gh` command fails with a GraphQL rate limit error, agents MUST NOT halt operations. Instead, they MUST fall back to the REST API using `gh api /repos/:owner/:repo/pulls` or similar endpoints.
2. **Rate Limit Verification:** Agents should independently verify both GraphQL and REST limits via `gh api -i /rate_limit` before declaring total exhaustion.

## Checklist for Future Agents

- [ ] Did `gh pr list` or `gh pr view` fail with a GraphQL rate limit error?
- [ ] Did the agent check the REST API quota (`gh api -i /rate_limit`)?
- [ ] Did the agent pivot to using `gh api /repos/:owner/:repo/pulls/<number>` (or `gh api --paginate repos/:owner/:repo/pulls?state=open`) to complete the read operation?
