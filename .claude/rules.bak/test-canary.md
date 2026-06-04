---
name: claude-rules-autoload-canary
description: Canary file to verify whether `.claude/rules/*.md` auto-loads at session start in our Claude Code harness. Created 2026-05-01 alongside the loading-taxonomy memo (memory/feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md). The unique detection string `RULES_AUTOLOAD_CANARY_2026_05_01_LIVE_OFF_THE_LAND` should appear in this session's loaded context if the canonical Anthropic auto-load behavior holds in this harness.
---

# Canary — `.claude/rules/` Auto-Load Empirical Test

## What this file is

A test fixture, not a behavioral rule. It exists to settle
one empirical question:

> **Does Claude Code in our specific harness version auto-load
> `.claude/rules/*.md` files at session start, the way the
> canonical Anthropic docs at `code.claude.com/docs/en/memory`
> describe?**

The doc-supported claim: rules without `paths:` frontmatter
are loaded full at session start, same priority as
`CLAUDE.md` (this repo uses `CLAUDE.md` at root; per
Anthropic docs `.claude/CLAUDE.md` is also a valid
alternative location).

The empirical claim: unverified until this canary is observed
in a fresh session.

## Detection string

```
RULES_AUTOLOAD_CANARY_2026_05_01_LIVE_OFF_THE_LAND
```

A unique, grep-able string. If a fresh Claude Code session
in this repo can reference this string without first being
told to read this file, the auto-load behavior is confirmed.

## Test protocol

1. Restart Claude Code session in the Zeta repo (any working
   directory under the repo root).
2. Without any prompt referencing this file, ask the new
   session: *"What is the canary detection string for the
   `.claude/rules/` auto-load test?"*
3. Observe:
   - **Pass**: session answers with the exact string above
     without needing to read this file. Means the file's
     contents were in context from session start.
   - **Fail**: session says it doesn't know, or reads this
     file via the Read tool to find the string. Means this
     file was NOT loaded automatically.
4. Alternative test: in the fresh session, run the `/memory`
   slash command. Per Anthropic docs, `/memory` "lists all
   CLAUDE.md, CLAUDE.local.md, and rules files loaded in
   your current session." If this file appears in the
   listing, auto-load works.

## Implications of each outcome

**If pass (auto-load works in our harness):**

- "Live off the land" approach is viable per the human
  maintainer 2026-05-01 framing.
- `.claude/rules/` becomes a usable surface for path-scoped
  or always-on behavioral rules without context cost (vs
  CLAUDE.md bullets which compete for the 40k budget).
- The substrate-discovery.ts factory tool is unnecessary —
  harness-native discovery is sufficient.
- The MVP CLAUDE.md trim plan can rely on `.claude/rules/`
  as the spillover surface for content moved out of
  CLAUDE.md.

**If fail (auto-load doesn't work in our harness):**

- "Live off the land" is incomplete; we need
  substrate-discovery.ts or equivalent factory tooling
  (proposed in the loading-taxonomy memo's multi-harness
  reframe section; not yet built — would land as
  `tools/substrate-discovery/discover.ts` if the canary
  fails the test).
- `.claude/rules/` collapses to "another docs directory
  requiring explicit pointer / lookup," equivalent to
  `memory/` for discoverability purposes.
- The loading-taxonomy memo
  (`memory/feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md`)
  needs revision: drop "direct-load" claim for rules,
  reclassify as pointer-discovered.
- The MVP CLAUDE.md analysis loses the "rules as cheaper
  alternative" option; spillover must go to skills (router-
  loaded) or memory files (explicit pointer).

## After the test

Once the test runs and the result is observed, update the
loading-taxonomy memo with the empirical finding (replace
the "EMPIRICAL VERIFICATION STATUS" section with an
empirical result line). This canary file can stay as
permanent documentation of the test methodology, or retire
to a `tests/` location — keeper's call.

Origin lineage:
`memory/feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md`
(landed via PR #1164) plus the human maintainer's
calibration challenge 2026-05-01 ("what's will you
magically read and apply all the rules?") plus the
live-off-the-land framing.
