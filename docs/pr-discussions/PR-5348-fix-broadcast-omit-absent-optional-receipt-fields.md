---
pr_number: 5348
title: "fix(broadcast): omit absent optional receipt fields"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:08:06Z"
merged_at: "2026-05-26T23:10:32Z"
closed_at: "2026-05-26T23:10:32Z"
head_ref: "claim/codex-b0213-receipt-optional-fields-fix-20260526"
base_ref: "main"
archived_at: "2026-05-27T19:30:32Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5348: fix(broadcast): omit absent optional receipt fields

## PR description

## Summary

- restores the post-merge 081KQX9B50008QG0R001YRPGD6 TypeScript fix that was stranded on the original claim branch after PR #5344 merged at stale head 802bd5935
- omits optional receipt properties instead of setting them to undefined under exactOptionalPropertyTypes
- releases the temporary claim in-branch before review

## Checks

- bun test tools/broadcast-local/schema.test.ts
- bun --bun tsc --noEmit -p tsconfig.json
- git diff --check origin/main...HEAD

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T23:10:33Z)

## Pull request overview

This PR fixes the local broadcast receipt builder so optional receipt fields are omitted rather than explicitly set to `undefined`, matching the repository’s `exactOptionalPropertyTypes` TypeScript configuration.

**Changes:**

- Uses conditional object spreads for optional `sourcePath` and `note` receipt fields.
- Updates the receipt test expectation to omit the absent `note` property.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| `tools/broadcast-local/schema.ts` | Builds optional receipt fields only when values are present. |
| `tools/broadcast-local/schema.test.ts` | Aligns expected receipt shape with omitted optional fields. |

## General comments

### @chatgpt-codex-connector (2026-05-26T23:08:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
