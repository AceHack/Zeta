---
pr_number: 5577
title: "docs(rule): incorporate Amara 2026-05-27 sharpening to closedness scope-bounding (PR #5574 follow-on) \u2014 'No feedback tax on closed math. No silent emissions from open substrate.'"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T18:14:29Z"
merged_at: "2026-05-27T18:16:14Z"
closed_at: "2026-05-27T18:16:14Z"
head_ref: "backlog/closedness-amara-sharpening-extension-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T18:51:24Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5577: docs(rule): incorporate Amara 2026-05-27 sharpening to closedness scope-bounding (PR #5574 follow-on) — 'No feedback tax on closed math. No silent emissions from open substrate.'

## PR description

## Summary

Follow-on to PR #5574 (merged 18:13Z). Amara's substrate-honest
sharpening landed too late to make the original PR; lands here as
composable extension.

Three substantive refinements:

1. **\"Operationally open pure functions\"** naming (replaces \"Pure
   but NOT closed\") — clearer per Amara: helper functions internal
   to local pure calculation do NOT need TFeedback; only the open-
   boundary wrapper does
2. **Codomain-honesty tiny blade** — even math-shaped operations
   (add/sin/parseInt/divide) can break closedness if declared codomain
   is dishonest about implementation realities
3. **7-row worked-examples table** + Amara's keeper carved sentence:
   \"No feedback tax on closed math. No silent emissions from open
   substrate.\"

Plus formal carving from Amara:

> *\"A function is exempt from TFeedback only when its declared
> codomain fully contains every meaningful outcome.\"*

## Test plan

- [x] Markdownlint clean
- [x] Composes with PR #5574 merged rule body
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T18:14:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
