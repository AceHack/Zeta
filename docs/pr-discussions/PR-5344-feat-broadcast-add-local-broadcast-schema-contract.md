---
pr_number: 5344
title: "feat(broadcast): add local broadcast schema contract"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T22:57:31Z"
merged_at: "2026-05-26T23:00:30Z"
closed_at: "2026-05-26T23:00:30Z"
head_ref: "claim/codex-b0213-broadcast-bus-schema-ttl-receipts-20260526"
base_ref: "main"
archived_at: "2026-05-27T19:30:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5344: feat(broadcast): add local broadcast schema contract

## PR description

## Summary

- Add a structured schema contract for the local `~/.local/share/zeta-broadcasts` markdown bus.
- Define default TTL/staleness handling and read-receipt shape for 081KQX9B50008QG0R001YRPGD6 before runner wiring.
- Release the Codex claim file in this PR branch per the git-native claim protocol.

## Tests

- `bun test tools/broadcast-local/schema.test.ts`
- `git diff --check origin/main...HEAD`

081KQX9B50008QG0R001YRPGD6 slice: schema/TTL/receipts only; ask/offer matching, priority interrupt behavior, conflict detection, and history remain follow-up wiring work.

## General comments

### @chatgpt-codex-connector (2026-05-26T22:57:36Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
