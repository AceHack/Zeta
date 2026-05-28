---
pr_number: 5451
title: "docs(CLAUDE.md): heartbeat-via-commit = externalized idle counter for standing-by-failure N=6"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T13:36:58Z"
merged_at: "2026-05-27T13:39:11Z"
closed_at: "2026-05-27T13:39:11Z"
head_ref: "otto-cli/claude-md-heartbeat-via-commit-1335z"
base_ref: "main"
archived_at: "2026-05-27T19:23:50Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5451: docs(CLAUDE.md): heartbeat-via-commit = externalized idle counter for standing-by-failure N=6

## PR description

## Summary

Lands a new CLAUDE.md Conventions bullet: **Heartbeat-via-commit = externalized
idle counter**. The AgencySignature v1 trailer block on every commit +
`git log --since="2min ago" origin/main` IS the externalized counter for the
N=6 brief-ack threshold in `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`.

## Why

Kira 2026-05-27 caught Otto-CLI emitting 100+ consecutive "Quiet." brief-acks
across autonomous-loop cron ticks; the rule's N=6 counter never fired because
it lived only in the narrative self-model. Aaron's substrate-honest direction:
*"you usally remember to heartbeat i commit therefore i am do you still
remember to do this you could use this for counting"* + *"we have had
heartbeats since day one alsmost look at our agencysignature class and such"*.

The agent cannot reliably count itself. Externalize the counter to git via the
AgencySignature v1 trailer block that already lands on every commit.

## What

- New CLAUDE.md Conventions bullet (16 lines added).
- Names `tools/hygiene/audit-agencysignature-main-tip.ts --since --max` as the query.
- Cites `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
  + `.claude/rules/substrate-or-it-didnt-happen.md` + AgencySignature spec §10
  for the 10-field trailer block.

## Composes with

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (N=6 counter)
- `.claude/rules/substrate-or-it-didnt-happen.md` (commits durable; narrative weather)
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` (authoring path)
- `docs/research/2026-04-26-gemini-deep-think-agencysignature-...md` §10 (trailer spec)

## Test plan

- [x] CLAUDE.md renders; bullet appears at bottom of Conventions section
- [x] Commit body parses 11 trailers cleanly via `git log -1 --pretty='%(trailers)'`
- [x] Worktree authored in isolation (`/private/tmp/zeta-otto-cli-claude-md-heartbeat-1335Z`, detached HEAD off origin/main, never touched operator primary checkout)
- [x] Post-commit ls-tree count = 61 (matches origin/main; no canary corruption)
- [ ] AgencySignature audit on merged squash-commit: `bun tools/hygiene/audit-agencysignature-main-tip.ts --commit <merge-sha>`

## AgencySignature trailer block on this commit

```
Agency-Signature-Version: 1
Agent: Otto
Agent-Runtime: Claude Code
Agent-Model: Claude Opus 4.7
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: explicit
Human-Review-Evidence: chat
Action-Mode: human-directed
Task: none
Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>
```

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

## General comments

### @chatgpt-codex-connector (2026-05-27T13:37:04Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
