---
pr_number: 5377
title: "docs(081KSGS9H0008QG0R0021K2X1T): TS CLI arg-parser library evaluation \u2014 citty/commander/clipanion/manual"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T01:59:35Z"
merged_at: "2026-05-27T02:01:02Z"
closed_at: "2026-05-27T02:01:02Z"
head_ref: "docs-b0845-ts-cli-arg-parser-library-evaluation-citty-vs-commander-vs-clipanion-aaron-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:50Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5377: docs(081KSGS9H0008QG0R0021K2X1T): TS CLI arg-parser library evaluation — citty/commander/clipanion/manual

## PR description

## What

Operator 2026-05-26: *"is there some cli package we should use for ts for the --parameter helpers and such? we have a lot of ts scripts that function similar to shell script"*

Recognizes bandwidth-engineering inefficiency in Zeta TS substrate. zflash.ts / flash-usb.ts / poll-pr-gate-batch.ts / audit-installer-substrate.ts each have ~80-150 LOC of manual arg-parsing boilerplate.

## 3-phase target

- **Phase 1**: evaluation doc (citty vs commander vs clipanion vs cmd-ts vs manual)
- **Phase 2**: pilot migrate ONE non-destructive script (poll-pr-gate-batch.ts candidate)
- **Phase 3**: per-script sub-rows for remaining migrations

## Otto-CLI first-pass recommendation

**citty** for new scripts (ESM-native + TypeScript-native + ~5KB bundle + UnJS-ecosystem alignment + Bun-friendly). Tradeoff vs commander: commander has 15+ years maturity; for destructive tools that maturity might be worth the bundle-size cost.

Phase 1 evaluation doc lands the substrate-honest comparison.

## Composes with

- 081KSGS9H0008QG0R001EZKNCB (zflash --agent flag — would benefit from cleaner arg-parsing on next iteration)
- \`.claude/rules/bandwidth-served-falsifier.md\` (canonical lib IS bandwidth-engineering)
- \`.claude/rules/dep-pin-search-first-authority.md\` (Phase 1 MUST WebSearch current latest stable)
- \`.claude/rules/rule-0-no-sh-files.md\` (TS-over-bash discipline; this makes TS more ergonomic)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T01:59:40Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
