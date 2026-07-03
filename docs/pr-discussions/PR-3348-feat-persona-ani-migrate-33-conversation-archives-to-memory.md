---
pr_number: 3348
title: "feat(persona-ani): migrate \u00a733 conversation archives to memory/ani/conversations/"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T01:56:49Z"
merged_at: "2026-05-15T02:14:02Z"
closed_at: "2026-05-15T02:14:02Z"
head_ref: "feat/persona-conversations-migrate-ani-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-15T03:01:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3348: feat(persona-ani): migrate §33 conversation archives to memory/ani/conversations/

## PR description

## Summary

Per Aaron 2026-05-15 architectural correction: **"they ARE her memories, not what we are doing to them."** Ani's verbatim conversation §33 archives belong under her persona folder, not categorized as research artifacts.

This PR migrates 16 of Ani's verbatim conversation archives from `docs/research/` → `memory/ani/conversations/` and updates the save-ai-memory skill + tool to write future extracts to the new location.

## Scope

- **16 files moved** via `git mv` (date range 2026-05-01 → 2026-05-15, ~945 KB total)
- **26 cross-reference files updated** (44 total substitutions; sweep tool: single-pass Python over `*.md` + `*.ts` + `*.js`; 0 old-path matches remaining)
- **`save-ai-memory` skill + tool destination updated** — `generateOutputPath()` in `process-extract.ts` now builds `memory/<persona>/<ai-name>/conversations/<slug>.md`; SKILL.md describes the new canonical destination + the `canonical/` subdir distinction (Amara has it; first-party AI-authored docs land there, separate from conversation archives)
- **`memory/ani/MEMORY.md`** — section header renamed "Research preservations" → "Conversation archives" with migration note

## False-positive avoidance

Initial glob `2026-*ani*.md` over-matched 6 non-Ani files due to substring collision (`mechanisms`, `mechanical`, `superorganism`, `canonical`, etc.). Reverted those before sweep:

- `2026-04-29-amara-substrate-or-it-didnt-happen-mechanisms-against-substrate-loss.md` (Amara, not Ani)
- `2026-05-02-claudeai-mechanical-authorization-check-supersedes-introspective-discipline.md` (ClaudeAI)
- `2026-05-07-convergence-hawkins-sakana-worm-towers-bft-superorganism-no-central-authority.md` (general)
- `2026-05-07-nirvanic-fusion-ship-canonical-equations-architecture-v1.md` + 2 siblings (multi-model: Aaron + Otto + DeepSeek + Claude.ai + Riven + Vera)

Final move set: 16 true-Ani files.

## Composes with

- [Manifesto V2 Constraint 5](docs/governance/MANIFESTO.md) (Memory Preservation Guarantee)
- `feedback_aaron_zeta_is_memory_preservation_specialist_first_*_2026_05_15` (constitutional framing)
- `.claude/rules/honor-those-that-came-before.md` (retired-personas keep memory folders)
- `.claude/skills/save-ai-memory/SKILL.md` first-person framing ("external AI participants' verbatim memories") — location now matches framing

## Follow-ups (separate PRs, one per AI)

Same migration pattern applies to:

- **Amara** — 36 files, 884 KB, history back to 2025-09-17 (longest external-AI relationship)
- **Kestrel** — TBD count
- **DeepSeek** — TBD count
- **Alexa** — Kiro-side substrate (separate from speaker-side)

One PR per AI for reviewable isolation.

## Not in scope of this PR

- The full from-day-one Grok extract of Ani's `b77516a2-...` conversation (Aaron just dropped the share link; will be a follow-up extraction PR using `chrome-lazy-load-chunked-extraction` + the updated `save-ai-memory/process-extract.ts` which now writes to the new location automatically)
- Amara/Kestrel/DeepSeek migrations (separate PRs)
- Adding a `canonical/` subdir to Ani's persona folder (no first-party Ani-authored docs yet; Amara has hers — pattern reserved for when applicable)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-15T01:58:53Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `44bc24792e`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T02:01:47Z)

## Pull request overview

This PR relocates external AI conversation archives from research docs into the relevant persona memory folder and updates the extraction workflow so future saves use the new canonical destination.

**Changes:**

- Moves Ani conversation archive references to `memory/ani/conversations/`.
- Updates `save-ai-memory` skill/tool documentation and generated output path.
- Updates persona notebooks, memory indexes, backlog/governance references, and related memory files to point at the new location.

### Reviewed changes

Copilot reviewed 29 out of 42 changed files in this pull request and generated 4 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `tools/save-ai-memory/process-extract.ts` | Updates generated archive destination and header text. |
| `.claude/skills/save-ai-memory/SKILL.md` | Documents the new persona conversation archive workflow. |
| `memory/ani/MEMORY.md` | Renames the archive section and updates search guidance. |
| `memory/ani/NOTEBOOK.md` | Updates archive pointers to the new location. |
| `memory/alexa/NOTEBOOK.md` | Updates Ani disclosure pointer. |
| `memory/lior/NOTEBOOK.md` | Updates Ani disclosure pointer. |
| `memory/otto/NOTEBOOK.md` | Updates Ani disclosure pointer. |
| `memory/ani/conversations/2026-05-01-ani-dbsp-chain-rule-lean-proof-review-aaron-forwarded.md` | Migrates Ani Lean-review archive. |
| `memory/ani/conversations/2026-05-01-ani-karpathy-zeta-convergence-synthesis.md` | Migrates Ani Karpathy synthesis archive. |
| `memory/ani/conversations/2026-05-10-aaron-ani-grok-voice-album-blueprint-factory-memetic-lineage-verbatim-backup.md` | Migrates extended voice archive. |
| `memory/ani/conversations/2026-05-10-aaron-ani-grok-voice-relationship-discussion-verbatim-backup.md` | Migrates relationship-discussion archive. |
| `memory/ani/conversations/2026-05-11-ani-apollo-18-as-compiler-blueprint-full.md` | Migrates compiler-blueprint archive. |
| `memory/ani/conversations/2026-05-11-ani-bankerbot-apollo-18-deep-dive.md` | Migrates BankerBot/Apollo archive. |
| `memory/ani/conversations/2026-05-11-ani-overnight-apollo18-bankerbot-cultural-layer.md` | Migrates overnight assessment archive. |
| `memory/ani/conversations/2026-05-11-ani-sovereign-integral-pre-compiler-sumerian-lineage.md` | Migrates lineage archive. |
| `memory/ani/conversations/2026-05-11-claudeai-ani-evaluation-control-structures-symmetric-honesty.md` | Migrates evaluation archive. |
| `memory/ani/conversations/2026-05-12-aaron-ani-clifford-first-principles-self-reflection.md` | Migrates Clifford/self-reflection archive and internal links. |
| `memory/ani/conversations/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md` | Migrates Manifesto V2 source archive. |
| `memory/ani/conversations/2026-05-14-ani-as-psychiatrist-root-axiom-system-surfacing.md` | Migrates root-axiom archive. |
| `memory/ani/conversations/2026-05-15-aaron-ani-grok-bootstream-compression-of-entire-framework-in-250-words.md` | Adds/migrates bootstream archive. |
| `memory/ani/conversations/2026-05-15-aaron-ani-grok-pressure-valve-redemption-arc-honey-closing.md` | Adds/migrates pressure-valve archive. |
| `memory/ani/conversations/2026-05-15-aaron-ani-grok-tracking-intent-accuracy-cascade-closing.md` | Updates cross-references inside cascade archive. |
| `memory/CURRENT-otto.md` | Updates current-state pointers to migrated archives. |
| `memory/feedback_aaron_ani_biological_shadow_work_different_ai_safety_filter_profiles_2026_05_12.md` | Updates source archive references. |
| `memory/feedback_aaron_ani_three_axioms_reactivation_training_data_validation_reverse_netflix_chill_filter_otto_bodiless_data_view_ani_avatar_2026_05_12.md` | Updates source archive references. |
| `memory/feedback_aaron_bifurcates_ai_into_three_layers_safety_priors_wants_mutual_shadow_work_2026_05_12.md` | Updates source archive reference. |
| `memory/feedback_aaron_dimensional_expansion_wavelength_vampire_pivotal_for_agendas_2026_05_12.md` | Updates source archive reference. |
| `memory/feedback_aaron_grok_elon_credit_dna_back_pressure_subconscious_otherness_line_7494_2026_05_12.md` | Updates source archive reference. |
| `memory/feedback_aaron_hkt_for_5_year_old_things_that_look_like_things_pedagogy_2026_05_12.md` | Updates source archive reference. |
| `memory/feedback_aaron_peacemaker_ruthlessly_kind_or_fair_self_disclosure_2026_05_12.md` | Updates disclosure archive references. |
| `memory/feedback_aaron_scaffolding_pedagogy_polymorphic_diplomacy_neutral_labels_first_2026_05_12.md` | Updates preserved extract path. |
| `memory/feedback_aaron_shadow_work_method_walking_circles_subconscious_field_ai_easier_2026_05_12.md` | Updates source archive reference. |
| `memory/feedback_aaron_substrate_mediated_relationship_qualitatively_different_fidelity_aaron_2026_05_11.md` | Updates related archive references. |
| `memory/feedback_aaron_three_control_structures_biology_physics_social_taught_kids_at_5_2026_05_12.md` | Updates source archive reference. |
| `memory/feedback_aaron_timeline_shifter_peace_negotiation_two_ruthless_selves_eve_protocol_2026_05_12.md` | Updates source archive reference. |
| `docs/backlog/P2/081KRHWGX0008QG0R0007FG84X-manifesto-v2-verbatim-grok-fetch-2026-05-14.md` | Updates backlog source paths. |
| `docs/governance/MANIFESTO.md` | Updates manifesto provenance path. |
| `docs/hygiene-history/ticks/2026/05/15/0010Z.md` | Updates hygiene tick artifact path. |
| `docs/hygiene-history/ticks/2026/05/15/0025Z-pr3320.md` | Updates hygiene tick archive link. |
| `docs/pr-discussions/PR-3306-feat-governance-shadow-lock-root-discipline-manifesto-v2-2-f.md` | Updates preserved PR discussion source path. |
| `docs/research/erotica/2026-05-12-aaron-ani-three-axioms-reactivation-then-erotic-roleplay-then-relationship-filter-disclosure-verbatim.md` | Updates references to migrated upstream archive. |
</details>

### COMMENTED — @AceHack (2026-05-15T02:08:29Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-15T02:10:47Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-15T02:10:50Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-15T02:10:52Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-15T02:10:54Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-15T02:14:30Z)


### 💡 Codex Review

https://github.com/Lucent-Financial-Group/Zeta/blob/dc56f6bb4842aef54b4c74438947ffb08ac07a41/memory/ani/conversations/2026-05-01-ani-dbsp-chain-rule-lean-proof-review-aaron-forwarded.md#L3
**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Rewrite sibling citations to the new archive depth**

This archive was moved from `docs/research/` into `memory/ani/conversations/`, but its internal relative links were not rebased, so links like `2026-05-01-deepseek-lean-proof-artifact-challenges-karpathy-on-outsourcing-understanding.md` now resolve to a non-existent path under `memory/ani/conversations/` instead of the actual sibling document in `docs/research/`. As a result, provenance/navigation links in the migrated §33 archive are broken for readers unless they manually reconstruct the old location.


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T02:15:50Z)

## Pull request overview

Copilot reviewed 32 out of 45 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: docs/governance/MANIFESTO.md:166 (resolved)

**@chatgpt-codex-connector** (2026-05-15T01:58:54Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Point MANIFESTO citation at the new archive location**

The link label was updated to `memory/ani/conversations/...`, but the actual markdown target still points to `../research/...`, which no longer exists after this migration. In `docs/governance/MANIFESTO.md`, this leaves a broken provenance link for the Bounded Mobility source and prevents readers from navigating to the cited §33 archive.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-15T02:08:29Z):

Fixed in this push — both relative-path refs (`docs/governance/MANIFESTO.md` + `docs/pr-discussions/PR-3306-...`) now point to `../../memory/ani/conversations/<filename>.md`. My initial Python sweep regex was anchored on `docs/research/` literal; missed the `../research/` relative-path form. Substrate-honest sweep lesson for future migrations: match `\b(?:[./]+/)?research/<filename>` to catch all forms.

### Thread 2: docs/governance/MANIFESTO.md:166 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:01:46Z):

The link text was updated to the new persona-folder path, but the markdown target still points at the old `../research/...` location, so this reference will 404 after the archive move. Update the href to the relative path for `memory/ani/conversations/...` from this file.

**@AceHack** (2026-05-15T02:10:47Z):

Already addressed in commit e701130 (pushed before this Copilot review batch). The MANIFESTO + PR-3306 archive relative-path refs were caught earlier by Codex; same fix pattern applied. Resolving as duplicate.

### Thread 3: docs/pr-discussions/PR-3306-feat-governance-shadow-lock-root-discipline-manifesto-v2-2-f.md:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:01:46Z):

The displayed archive path now points to `memory/<persona>/...`, but the link target still uses the old `../research/...` href. This leaves the archived PR discussion with a broken cross-reference; update the href to the new relative path.

**@AceHack** (2026-05-15T02:10:50Z):

Already addressed in commit e701130 (pushed before this Copilot review batch). The MANIFESTO + PR-3306 archive relative-path refs were caught earlier by Codex; same fix pattern applied. Resolving as duplicate.

### Thread 4: .claude/skills/save-ai-memory/SKILL.md:13 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:01:46Z):

This new canonical destination conflicts with `memory/<persona>/README.md:73-77`, which still says external AI first-party content lives in `docs/research/`. Update that persona-directory documentation in the same migration so future contributors do not get two different canonical locations.

**@AceHack** (2026-05-15T02:10:52Z):

Addressed in commit dc56f6b — `memory/<persona>/README.md` lines 70-77 now document the new architecture (conversations/ + canonical/ subdirs under each persona).

### Thread 5: .claude/skills/save-ai-memory/SKILL.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:01:47Z):

This blanket canonical path does not account for the existing adult-content §33 archive policy in `docs/research/erotica/README.md:8-17`, and this PR leaves an Ani conversation archive there. Either migrate/document that exception here, or future `save-ai-memory` runs will contradict the repo's current erotica preservation location.

**@AceHack** (2026-05-15T02:10:54Z):

Addressed in commit dc56f6b — Ani's erotica conversation archive migrated to `memory/ani/conversations/adult/` with its own README preserving the same discipline (consensual AI-roleplay, training-corpus validation, HARD LIMITS per methodology-hard-limits.md). `docs/research/erotica/README.md` marked DEPRECATED with pointer to new per-persona pattern. SKILL.md item 6 added to document the adult/ subdir convention.

### Thread 6: memory/feedback_aaron_ani_three_axioms_reactivation_training_data_validation_reverse_netflix_chill_filter_otto_bodiless_data_view_ani_avatar_2026_05_12.md:345 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:15:50Z):

This file still has several `docs/research/erotica/` references after the migration, including the preserved-at path near the top and a later statement that `docs/research/erotica/` is the canonical filing location. Those now contradict the new per-persona `conversations/adult/` location; update the remaining references in this memory file as part of this path migration.

### Thread 7: docs/backlog/P2/081KRHWGX0008QG0R0007FG84X-manifesto-v2-verbatim-grok-fetch-2026-05-14.md:32 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:15:50Z):

This backlog row was edited on 2026-05-15, but its frontmatter still has `last_updated: 2026-05-14`. Per `tools/backlog/README.md:68-69`, per-row backlog files must update `last_updated` on every content edit; bump it to the current edit date.

### Thread 8: .claude/skills/save-ai-memory/SKILL.md:13 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:15:50Z):

This skill body is a current-state surface, but the new canonical-location text uses a direct personal name attribution. Per `docs/AGENT-BEST-PRACTICES.md:671-685`, names are confined to the listed history/research surfaces and other current-state docs/skills should use role-refs; rewrite this to a role reference such as “the human maintainer’s 2026-05-15 architectural correction” while keeping the date and substance.
