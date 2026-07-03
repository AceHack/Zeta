---
pr_number: 4312
title: "fix(hygiene): clear 2026-05-18 tick-link drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-19T02:38:29Z"
merged_at: "2026-05-19T02:41:32Z"
closed_at: "2026-05-19T02:41:32Z"
head_ref: "claim/task-fix-20260518-tick-shard-links"
base_ref: "main"
archived_at: "2026-05-19T06:59:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4312: fix(hygiene): clear 2026-05-18 tick-link drift

## PR description

## What changed

- Fixes 15 repo-relative links in 2026-05-18 tick shards by correcting path depth from five `..` segments to six where needed.
- Converts one user-scope memory path that points outside repo-canonical history from a markdown link into plain code text.
- Releases the claim `task-fix-20260518-tick-shard-links` in the same branch history.

## Why

Adjacent archive/research PRs (#4306, #4308, #4309 and siblings) were all failing `lint (tick-shard relative-paths)` on the same shared 2026-05-18 hygiene-history debt, not on their branch payloads.

## Verification

- `bun tools/hygiene/audit-tick-shard-relative-paths.ts --enforce --baseline tools/hygiene/audit-tick-shard-relative-paths.baseline.json`
- `git diff --check`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-19T02:40:25Z)

## Pull request overview

This PR fixes broken repo-relative links in 2026-05-18 hygiene tick shards by correcting path depth to reach the repository root and avoiding a non-repo-canonical user-scope memory link.

**Changes:**

- Updates `.claude/rules` and `docs/backlog` relative links from five to six `..` segments where needed.
- Converts one out-of-repo user-scope memory reference from a markdown link to plain code text.
- Keeps the hygiene-history archival content intact while making link-audit enforcement pass for these touched shards.

### Reviewed changes

Copilot reviewed 9 out of 9 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `docs/hygiene-history/ticks/2026/05/18/2012Z.md` | Corrects repo-root-relative rule and backlog links. |
| `docs/hygiene-history/ticks/2026/05/18/2029Z.md` | Removes an invalid markdown link to user-scope memory outside repo history. |
| `docs/hygiene-history/ticks/2026/05/18/2037Z.md` | Corrects stale-armed-PR rule link depth. |
| `docs/hygiene-history/ticks/2026/05/18/2040Z.md` | Corrects backlog and rule link depths. |
| `docs/hygiene-history/ticks/2026/05/18/2051Z.md` | Corrects blocked-green-CI rule link depths. |
| `docs/hygiene-history/ticks/2026/05/18/2057Z.md` | Corrects rule links used in operational guidance. |
| `docs/hygiene-history/ticks/2026/05/18/2100Z.md` | Corrects refresh-world-model rule link depth. |
| `docs/hygiene-history/ticks/2026/05/18/2109Z.md` | Corrects bounded-wait rule link depth. |
| `docs/hygiene-history/ticks/2026/05/18/2112Z-otto-cli-secondary.md` | Corrects claim-coordination rule link depth. |
</details>

## General comments

### @chatgpt-codex-connector (2026-05-19T02:38:34Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
