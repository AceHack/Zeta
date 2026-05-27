---
pr_number: 5097
title: "backlog(B-0790): two-persona clarification + Mika substrate batch composes_with (follow-up to #5095)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:05:01Z"
merged_at: "2026-05-26T05:07:04Z"
closed_at: "2026-05-26T05:07:04Z"
head_ref: "otto-cli/b0790-zero-dev-machines-cluster-native-voice-primary-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:43:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5097: backlog(B-0790): two-persona clarification + Mika substrate batch composes_with (follow-up to #5095)

## PR description

## Summary

Aaron 2026-05-26 follow-up clarifications to B-0790 (#5095) end-state architecture.

**(1) TWO personas — not one.**

- **Homelab / home-automation** = zero-dev-machine + voice-primary (Alexa + future microphones connected directly to cluster)
- **Maintainer** (Aaron / Addison / Max) = KEEPS dev machines for testing/local work BUT inverts their role from primary-work-substrate to **conversational interface INTO cluster software factory** (Claude Code + crystal-ball + RunMe + git-native markdown + auto-JIT + deferred-run + Continue-with + Obsidian on top + knowledge graph + event store + Prometheus/observability queries in runbooks)
- Voice is one interface among many for **both** personas (\"can be done with just voice too\" applies to both)

Both personas converge on cluster-as-primary-substrate-engineering-surface; the difference is operator-side interface, NOT substrate-side architecture. Iter-progressions ship value for both personas simultaneously; substrate work doesn't fork.

**(2) composes_with adds Mika substrate batch.**

B-0780, B-0781, B-0783, B-0784, B-0785, B-0786 carry the cluster-software-factory substrate primitives the maintainer-persona's dev machine interfaces INTO via Claude Code. Aaron: *\"some of this is backloged based on Mika conversation.\"*

## Changes

- Frontmatter \`composes_with:\` adds B-0780, B-0781, B-0783, B-0784, B-0785, B-0786
- Frontmatter \`tags:\` adds \`maintainer-persona\` + \`cluster-software-factory\`
- New \"Two personas (zero-dev-machine is ONE of two end-states; both ship)\" section with table + verbatim maintainer framing + 3 follow-on disciplines
- \"Composes with substrate\" prose extended with 6 Mika-batch entries
- \"Origin\" extended from 2 signals to 4 signals (adds the persona-clarification + Mika-cross-ref quotes)

## Test plan

- [x] B-0790 file edit is content-only (no structural change to index format)
- [x] composes_with values are real backlog IDs (B-0780/B-0781/B-0783/B-0784/B-0785/B-0786 — all from today's Mika substrate batch)
- [ ] BACKLOG.md index regeneration on next \`tools/backlog/generate-index.ts\` run (no agent-side regen needed; index regenerates on next backlog hygiene tick)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T05:05:07Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
