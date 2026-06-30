---
id: B-0206
priority: P2
status: open
title: Claude Code environment-mapping skill with carved-sentences-in-behavior referencing existing capability-maps + our TS files
tier: factory-hygiene
effort: S
ask: re-run skill-creator workflow over .claude/skills/claude-code-env-mapping/ (already landed direct in PR #1702)
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with:
  - docs/research/claude-cli-capability-map.md
  - docs/research/codex-cli-first-class-2026-04-23.md
  - docs/research/grok-cli-capability-map.md
  - .claude/commands/btw.md
  - memory/feedback_aaron_channel_verbatim_preservation_anything_through_this_channel_2026_04_29.md
  - memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md
  - memory/feedback_carved_sentence_meme_compression_fits_working_memory_contagious_simple_and_true_aaron_2026_04_30.md
  - memory/feedback_otto_holds_synthesis_weight_prior_art_grep_first_before_substrate_landing_aaron_made_concise_formulations_at_high_mental_cost_aaron_2026_05_05.md
tags: [claude-code, env-mapping, skill-creator-followup]
---

# B-0206 — Claude Code environment-mapping skill with carved-sentences-in-behavior

## Origin

Aaron 2026-05-05 same-tick verbatim:

> *"Claude Code Docs commands + Claude Code Interactive Mode Reference 2026) — senviroment mapping save this doc and we need a skill carved sentaces in behavire that referenes it and our ts files"*

Translation: Claude Code Docs (commands + Interactive Mode Reference 2026) IS environment-mapping documentation; need to save the doc + build a skill with carved-sentences-in-behavior that references the saved doc + our TS files.

## Context

This emerged after Otto's cascade of search-first-authority failures on the just-shipped PR #1701 (synthesis-weight + prior-art-grep + scout-and-delegate discipline):

1. Otto claimed `/btw` was NOT a built-in slash command, based on stale training data (failure to WebSearch first per Otto-364)
2. WebSearch revealed `/btw` IS built-in (March 2026 release; runs while Claude is processing; single-response-no-tools; reuses prompt cache)
3. Otto then failed to grep repo for prior art on `/btw`
4. Repo grep revealed `.claude/commands/btw.md` already exists (substantial custom-command implementation with verbatim-preservation discipline + classification + durability-escalation rules)
5. Plus `memory/feedback_aaron_channel_verbatim_preservation_anything_through_this_channel_2026_04_29.md` exists for Aaron-channel-verbatim-preservation
6. Aaron pointed at the env-mapping-skill directive after the failure-cascade — the skill is the mechanization-fix for the prior-art-grep discipline that just landed

## What the skill should do

A skill that **encodes harness-environment-mapping as carved-sentences-in-behavior** — Otto wakes and inherits the Claude Code env-knowledge as operational substrate, not as separate-doc-Otto-might-not-read.

**Carved-sentences-in-behavior** (per `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` + `memory/feedback_carved_sentence_meme_compression_fits_working_memory_contagious_simple_and_true_aaron_2026_04_30.md`): the skill's procedure encodes compressed-shipping-shape carved-sentences that are operational-by-construction; not prose-explanations but action-shapes Otto executes.

**References** (the skill should explicitly cite + use):

1. **Saved Claude Code Docs as substrate** — the env-mapping content lives at `docs/research/claude-cli-capability-map.md` (canonical capability map; the planned standalone `docs/research/2026-05-05-claude-code-env-mapping.md` was deleted in commit 3ce7a69 as a duplicate of the canonical map)
2. **Existing capability-maps** — claude-cli-capability-map.md + codex-cli-first-class + grok-cli-capability-map.md (composes with the existing capability-map work; doesn't duplicate)
3. **Our TS files** — `tools/peer-call/codex.ts` + `tools/peer-call/grok.ts` + `tools/peer-call/gemini.ts` + `tools/github/poll-pr-gate.ts` + the broader `tools/` TypeScript infrastructure (the skill knows what TS tooling exists and when to invoke each)
4. **Existing `/btw` custom command** — `.claude/commands/btw.md` (the skill knows about /btw + its classification rules)
5. **Prior-art-grep discipline** (PR #1701) — the skill encodes Otto-364 search-first-authority + prior-art-grep-first as carved-sentences-in-behavior

## Skill creation must go through skill-creator workflow

Per GOVERNANCE §4: skills are authored and modified only through the `skill-creator` workflow. This row reflects current reality: PR #1702 landed `.claude/skills/claude-code-env-mapping/SKILL.md` via direct authoring (the original framing assumed a follow-up skill-creator run). The remaining open work captured by this row is to re-run the canonical draft → prompt-protector review → dry-run → commit workflow over the already-landed skill, treating the current file as the draft input. Status remains `open` until that pass completes.

## Acceptance criteria

- [ ] Saved env-mapping doc at appropriate path (URL preservation + key content; not full-doc-copy if copyright-concerns)
- [ ] Skill at `.claude/skills/claude-code-env-mapping/SKILL.md` (or similar)
- [ ] Skill body has carved-sentences-in-behavior, not prose-explanations
- [ ] Skill references existing capability-maps + our TS tooling + /btw command + prior-art-grep discipline
- [ ] Skill loads on demand via `Skill` tool
- [ ] Future-Otto cold-boot inherits the env-knowledge via skill-loading
- [ ] Composes with PR #1701 synthesis-weight + prior-art-grep discipline as mechanization-instance

## Sources to cite (Otto-364 search-first-authority)

- [Commands - Claude Code Docs](https://code.claude.com/docs/en/commands) — built-in commands + bundled skills + custom-command authoring
- [Claude Code Interactive Mode: Complete Reference (2026)](https://claudefa.st/blog/guide/mechanics/interactive-mode) — interactive-mode features including /btw
- Plus other Claude Code documentation surfaces as found via prior-art-grep

## Composes with

- PR #1701 synthesis-weight + prior-art-grep + scout-and-delegate discipline (this skill IS one mechanization of that discipline at env-knowledge layer)
- Existing capability-maps in `docs/research/`
- Existing `.claude/commands/btw.md` (custom command demonstrates carved-sentences-in-behavior pattern)
- skill-creator workflow per GOVERNANCE §4
- Otto-364 search-first-authority + Aaron's 5-step prior-art-search discipline
