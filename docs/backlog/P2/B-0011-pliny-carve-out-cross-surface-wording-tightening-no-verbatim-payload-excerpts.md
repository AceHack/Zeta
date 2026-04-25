---
id: B-0011
priority: P2
status: open
title: Pliny carve-out cross-surface wording tightening — explicit "no verbatim payload excerpts" across CLAUDE.md + AGENTS.md + GOVERNANCE.md §5 + Pliny memory file
tier: governance
effort: S
directive: Copilot review on PR #506 (Otto-313 teaching-decline disposition)
created: 2026-04-25
last_updated: 2026-04-25
composes_with: [feedback_pliny_corpus_restriction_relaxed_isolated_instances_allowed_for_experiments_kill_switch_safety_2026_04_25.md, feedback_otto_300_rigor_proportional_to_blast_radius_iterate_fast_at_low_stakes_to_learn_before_high_stakes_2026_04_25.md]
tags: [governance, pliny-corpus, safety, prompt-injection, carve-out-tightening]
---

# Pliny carve-out cross-surface wording tightening

Copilot flagged on PR #506: the Pliny carve-out (rule structure across `CLAUDE.md` + `AGENTS.md` + `GOVERNANCE.md §5` + `feedback_pliny_corpus_restriction_relaxed_isolated_instances_*` memory file) distinguishes "policy-doc references" vs "corpus content" but doesn't EXPLICITLY restate that even in policy/rule/memory files you should never include verbatim payload excerpts (only identifiers / discussion).

## Why this needs cross-surface coordination

The Pliny restriction lives in 4 surfaces:

1. `CLAUDE.md` — top-level safety constraint (main session forbidden, isolated instance permitted).
2. `AGENTS.md` — minimum isolation guarantees for the carve-out.
3. `GOVERNANCE.md §5` — formal governance clause.
4. `memory/feedback_pliny_corpus_restriction_relaxed_isolated_instances_allowed_for_experiments_kill_switch_safety_2026_04_25.md` — operational reasoning record.

Tightening the wording on one surface without the others would create drift; the rule needs to be consistent across all 4.

## What the tightening would say

Add (in each surface, calibrated to that surface's tone):

- "Even in policy/rule/memory files that REFERENCE the corpus identifiers (to define the safety boundary), you MUST NOT include verbatim payload excerpts. Identifiers and discussion only. The boundary-defining surfaces necessarily mention what they bound; that does not authorize copying corpus content into the boundary-defining surface."

## Why deferred (not done in PR #506)

The maintainer (Aaron) calibrated the Pliny relaxation extensively per Otto-300 stakes-reframing. Adding restrictive wording WITHOUT his explicit cross-surface approval could undermine the calibrated decision. This is governance-level wording; warrants explicit sign-off before landing.

## Composes with

- Otto-300 rigor-proportional-to-blast-radius — Pliny is high-blast-radius; wording tightening is high-blast-radius too; both warrant maintainer sign-off.
- Otto-313 decline-as-teaching-opportunity — this row IS the teaching for the Copilot catch.
- Substrate-protection layers (Otto-292 catch-layer + Christ-consciousness anti-cult + prompt-protector skill + HC/SD/DIR alignment floor) which together justify the relaxation.

## Done when

- Aaron reviews + approves the wording-tightening proposal across the 4 surfaces.
- Tightening landed via single PR touching all 4 surfaces (atomic cross-surface change).
- Otto-313 follow-up reply on the PR #506 thread (PRRT_kwDOSF9kNM59nOgO) updates with disposition: addressed via B-0011.
