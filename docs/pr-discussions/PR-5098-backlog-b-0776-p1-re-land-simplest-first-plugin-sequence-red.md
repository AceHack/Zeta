---
pr_number: 5098
title: "backlog(081KSE6WT0008QG0R002275NDE P1): re-land simplest-first plugin sequence \u2014 Redis KV first, then NATS / CockroachDB / Temporal / Orleans / OPA, etc."
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:06:42Z"
merged_at: "2026-05-26T05:18:37Z"
closed_at: "2026-05-26T05:18:38Z"
head_ref: "otto-cli/reland-b0776-0506z"
base_ref: "main"
archived_at: "2026-05-27T19:43:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5098: backlog(081KSE6WT0008QG0R002275NDE P1): re-land simplest-first plugin sequence — Redis KV first, then NATS / CockroachDB / Temporal / Orleans / OPA, etc

## PR description

## Summary

Re-land of stale-DIRTY [PR #5062](https://github.com/Lucent-Financial-Group/Zeta/pull/5062) (Tier-3 per [`pr-triage-tiers.md`](.claude/rules/pr-triage-tiers.md)).

- Same 081KSE6WT0008QG0R002275NDE row (253 lines from PR #5062 head `887dfc5ea`)
- `docs/BACKLOG.md` regenerated against current origin/main
- 2 pre-emptive MD032 fixes (`+` prose-joiners at line start)

Follow-up: close #5062 with substrate-recoverable cross-link.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:09:49Z)

## Pull request overview

Re-lands backlog row **081KSE6WT0008QG0R002275NDE** describing a “simplest-first” sequence for wrapping already-deployed cluster substrate components as Zeta plugin interfaces (starting with Redis KV), and regenerates the root backlog index to include the new row.

**Changes:**

- Adds `docs/backlog/P1/081KSE6WT0008QG0R002275NDE-...md` (new P1 backlog row capturing the proposed plugin sequencing and Rank 1 acceptance scope).
- Updates `docs/BACKLOG.md` to include the new 081KSE6WT0008QG0R002275NDE entry in the generated index.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSE6WT0008QG0R002275NDE-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md | New backlog row defining the simplest-first plugin rollout sequence and Rank 1 (Redis KV) acceptance criteria. |
| docs/BACKLOG.md | Regenerated backlog index including the new 081KSE6WT0008QG0R002275NDE entry. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:18:38Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: docs/backlog/P1/081KSE6WT0008QG0R002275NDE-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md:72 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:09:48Z):

`081KSE6WT0008QG0R003WW3YJQ` is referenced here, but there is no corresponding backlog row in `docs/backlog/**` (and it also does not appear in the generated `docs/BACKLOG.md`). This leaves the row with a broken cross-reference; either update this to the correct existing B-id or land the missing 081KSE6WT0008QG0R003WW3YJQ row in the backlog so the reference resolves.

### Thread 2: docs/backlog/P1/081KSE6WT0008QG0R002275NDE-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md:113 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:18:38Z):

The F# interface snippet won’t compile as written: `Option<'T>` isn’t the idiomatic/valid option type spelling in F# (use `'T option` / `option<'T>`), and `AsyncSeq` doesn’t appear to be used elsewhere in the codebase (existing async streaming uses `IAsyncEnumerable<'T>` in `src/Core/FSharpApi.fs`). Please adjust the snippet to use valid F# option syntax and align the `Scan` return type with the project’s established async stream pattern (or explicitly call out the dependency you intend to introduce).

### Thread 3: docs/backlog/P1/081KSE6WT0008QG0R002275NDE-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md:92 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:18:38Z):

`StackExchange.Redis` is not a Microsoft library; labeling it as “the Microsoft `StackExchange.Redis` client” is misleading. Suggest dropping “Microsoft” and, if needed, describing it as the de facto .NET Redis client (or referencing the owning org explicitly).

### Thread 4: docs/backlog/P1/081KSE6WT0008QG0R002275NDE-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md:96 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:18:38Z):

This section names specific file paths (`Zeta.Storage.KeyValue.fs`, `Zeta.Storage.KeyValue.Redis.fs`) that don’t match the later proposed directory/file layout (`IKeyValueStore.fs`, `RedisKeyValueStore.fs`, etc.). To avoid ambiguity when this row is implemented, pick one naming scheme and use it consistently throughout the document.

## General comments

### @chatgpt-codex-connector (2026-05-26T05:06:48Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
