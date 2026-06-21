---
id: 081KQNJ500008QG0R001VGMS5G
priority: P2
status: open
title: Skill-domain plugin packaging — package mature skill domains as Claude Code plugins (Aaron 2026-05-03 rule 3a from skill-design memo)
tier: tooling
effort: M
ask: Aaron 2026-05-03 verbatim *"look at packaking skill domains a plugins or other packagin so we can take advantage of hooks in harnesses"*
created: 2026-05-03
last_updated: 2026-05-03
depends_on: [081KQNJ500008QG0R001N94412, 081KQNJ500008QG0R003ZC6PK8]
composes_with: [081KQJZR90008QG0R002D6XYHB, 081KQNJ500008QG0R003SCWBDV]
tags: [skill-domain, plugin, packaging, claude-code, foundation, p2-promotion-trigger-pending]
type: friction-reducer
---

# Skill-domain plugin packaging

Aaron 2026-05-03 named plugin-packaging as Rule 3a of the skill-design memo (`feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`):

> *"look at packaking skill domains a plugins or other packagin so we can take advantage of hooks in harnesses"*

Claude Code installs plugins under `~/.claude/plugins/cache/<plugin-name>/` (per `docs/research/codex-builtins-skills-vs-plugins-factory-integration-2026-04-24.md`). When a skill domain matures (per the future-skill-domain memos' promotion-trigger criteria — 3+ worked examples per skill candidate + 1+ judgment-disagreement per expert candidate), packaging the whole domain as a plugin lets it ship as one unit including its hooks.

## Why P2 (promotion-trigger pending)

This row is P2 not P1 because the promotion-trigger has not yet fired for ANY skill domain. The two named-but-future domains (git-native-backlog-management + multi-harness-alignment-convergence) are still in the "down pat" phase per Aaron's framing — neither has the 3+-worked-examples-per-skill nor the 1+-judgment-disagreement-per-expert evidence base required.

When promotion-trigger DOES fire on a skill domain, this row becomes the implementation work.

## Why depends_on 081KQNJ500008QG0R001N94412 + 081KQNJ500008QG0R003ZC6PK8

- **081KQNJ500008QG0R001N94412** (OpenSpec catch-up): plugins package skill domains' contracts; contracts live in specs; specs need to be current first.
- **081KQNJ500008QG0R003ZC6PK8** (hook authoring): the value of plugin packaging is that hooks ship inside the package; without hooks, packaging is bare-skill-grouping.

## Scope (when promotion-trigger fires)

Per Claude Code plugin convention (installed at `~/.claude/plugins/cache/<plugin-name>/`; the source bundle has the manifest at `.claude-plugin/plugin.json`):

1. Each plugin bundle contains:
   - `.claude-plugin/plugin.json` — manifest with name + description + author (minimal fields per the upstream Claude Code spec)
   - `skills/<skill>/SKILL.md` files (the procedure-skills of the domain) under conventional subdirectories
   - `agents/<agent>.md` files (the named-persona-experts) under conventional subdirectories
   - One or more hook configurations (per 081KQNJ500008QG0R003ZC6PK8)
   - Tools under `tools/` (TS files per Aaron skill-design rule 2)
   - References to OpenSpec capabilities the plugin contracts against (per 081KQNJ500008QG0R001N94412)
2. Codex equivalent uses `.codex-plugin/plugin.json` with richer fields (semver + interface block + URLs + category) per the cross-harness research at `docs/research/codex-builtins-skills-vs-plugins-factory-integration-2026-04-24.md`
3. Cross-harness portability documentation: how Codex / Cursor / Gemini-CLI consume the equivalent substrate (per Aaron 2026-05-02 *"skills are for everyone and even other agent harnesses"*)

## Cross-harness consideration

Per Aaron 2026-05-02 corrective: skills propagate across team + harnesses. Plugin packaging is harness-specific by definition (Claude Code plugins use a particular structure). The packaging design needs:

- A canonical "skill-domain bundle" format that's harness-agnostic at the substrate layer (the SKILL.md files, agent.md files, tools/, and OpenSpec references)
- Per-harness packaging adapters that read the canonical bundle and emit harness-specific package formats (Claude Code plugin / Codex equivalent / Cursor / Gemini-CLI)

The canonical bundle format itself is part of this row's scope; per-harness adapters are downstream rows.

## Done-criteria

This row closes when:

1. Promotion-trigger has fired on at least 1 skill domain (per future-skill-domain memos' criteria)
2. Canonical "skill-domain bundle" format is documented + at least one domain is packaged
3. Claude Code plugin adapter exists + the packaged domain installs as a plugin
4. Cross-harness portability documentation covers at least 2 harnesses (Claude Code + 1 other)

## Composes with

- **081KQJZR90008QG0R002D6XYHB** (decision-archaeology skill) — likely first skill packaged once mature
- **081KQNJ500008QG0R003SCWBDV** (substrate-claim-checker TS tool) — tool that lives inside the packaged skill domain
- **081KQNJ500008QG0R001N94412** (OpenSpec catch-up) — plugin contracts reference OpenSpec capabilities
- **081KQNJ500008QG0R003ZC6PK8** (hook authoring for skill-creation contracts) — hooks ship inside the plugin package
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — Rule 3a of the three skill-design rules
- `memory/feedback_git_native_backlog_management_long_arc_future_skill_domain_aaron_2026_05_02.md` — first future-skill-domain memo
- `memory/feedback_multi_harness_alignment_convergence_design_future_skill_domain_aaron_2026_05_03.md` — second future-skill-domain memo
