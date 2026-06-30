---
id: B-0532
priority: P2
status: open
title: Investigate hardcoded safety gates vs settings-allowable actions for Claude Code
created: 2026-05-15
last_updated: 2026-05-15
depends_on: []
decomposition: atomic
type: friction-reducer
---

# B-0532 — Investigate hardcoded safety gates vs settings-allowable actions

**Parent**: B-0368
**Filed by**: Lior (decomposed from B-0368 parent row)

## Scope

This is slice 2 of the Claude Code `/permissions` feature integration.
The objective is to investigate hardcoded safety gates versus settings-allowable actions (per the Tick-6 merge denial evidence in B-0368).

## Acceptance criteria

1. **Deeper investigation into API**: Research the `/permissions` API to distinguish hardcoded safety guards from `.claude/settings.json` allow-lists.
2. **Category model**: Determine which actions are settings-allowable versus hardcoded-safety-denial.
3. **Merge-other-PRs specifics**: Specifically for "merge-PRs-the-agent-didn't-create" — is this addressable via `.claude/settings.json` (per-PR number allow rule, per-author rule) or does it require an explicit user pre-authorization separate from the settings file?
4. Update findings in the research docs and determine if further targeted additions are required.
