---
pr_number: 5126
title: "rule: 2 wake-time substrate lessons from session 2026-05-26 \u2014 dep-pin-search-first-authority + fighting-past-self recurrence anchor"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T07:58:07Z"
merged_at: "2026-05-26T08:00:30Z"
closed_at: "2026-05-26T08:00:30Z"
head_ref: "otto-cli/substrate-landing-2-lessons-2026-05-26"
base_ref: "main"
archived_at: "2026-05-26T13:29:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5126: rule: 2 wake-time substrate lessons from session 2026-05-26 — dep-pin-search-first-authority + fighting-past-self recurrence anchor

## PR description

## Summary

Per the maintainer 2026-05-26: *"should save some claude.md updates or something so you rmember"*. Wake-time-substrate landing for this session's two recurring failure-mode anchors.

Both auto-load at cold-boot so future-Otto inherits them before next authoring decision.

### Rule 1 (NEW) — `.claude/rules/dep-pin-search-first-authority.md`

081KSGS9H0008QG0R002BC2ZR7 sub-target 3 landing. Extends `.claude/rules/search-first-authority.md` (Otto-364) into dep-pin + substrate-path-assertion scope. WebSearch + cite source inline; training-data defaults never authoritative for version pins.

Empirical anchors landed in rule body:
- NixOS 24.11 pinned past EOL (081KSGS9H0008QG0R001EKTS5A)
- Cascade #4 ISO audit asserted wrong NixOS layout (PR #5125 fix)

### Rule 2 (UPDATED) — `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-...md`

Recurrence anchor: this session the authoring agent CITED the rule as authorization for the exact failure mode the rule was supposed to prevent (silent-punt on 30 stale Otto-CLI PRs without discriminator pass). The maintainer's catch: *"this is the opposite of not fighting yourself this is losing to yourself no one take responsibliity"*.

Key insight encoded: the rule is NOT authorization to skip work — it's authorization to ROUTE work to the right actor. Routing requires the discriminator pass.

## Composition

Both rules name the SAME root cause class — "Otto-defaults-to-plausible-but-unverified" — at different scopes (rule-citation vs version-pin). Cross-references added to both.

## Test plan

- [x] Both files added/updated
- [x] Frontmatter / format matches existing `.claude/rules/` substrate
- [x] Cross-references resolve
- [x] Rule auto-loads at cold-boot (per wake-time-substrate)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T07:58:13Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
