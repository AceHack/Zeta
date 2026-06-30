---
id: B-0170
priority: P1
status: open
title: Substrate-claim-checker TS tool — mechanize the verify-then-claim discipline (Otto 2026-05-03; drift instances (the verify-then-claim memo's body table is canonical) catalogued as empirical eval-set)
tier: tooling
effort: M
ask: Otto 2026-05-03 self-grading, surfaced via drift instances (the verify-then-claim memo's body table is canonical) across 9+ PRs in single session despite naming the verify-then-claim discipline; manual discipline provably insufficient against trained-prior pull
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
decomposition: atomic
classification: buildable-now
composes_with: [B-0169]
tags: [tooling, ts, substrate-claim-checker, verify-then-claim, drift-detection, mechanization, hub-shaped, foundation]
type: friction-reducer
---

# Substrate-claim-checker TS tool — mechanize the verify-then-claim discipline

The verify-then-claim discipline (`memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md`) catalogues N distinct claim-vs-reality drift instances across 9+ PRs in a single session. Manual discipline keeps failing at the same rate even after the discipline is named, sub-classes catalogued, and recursive corrections applied. The substrate-claim-checker TS tool is the mechanization path.

## Why P1

- N instances of substrate-authoring failure in one session, of which 9+ landed AFTER the discipline was named — empirical urgency
- Each drift instance costs ~10-30 minutes of follow-up work; the catalogued instances (see verify-then-claim memo's body table) compound to many hours of agent-time wasted on drift fixing
- The pattern is self-evidencing: each tick produces new drift, even when the drift catalogue itself is being authored
- Mechanization is the only path; manual discipline provably insufficient

## V0 already shipped (this PR)

`tools/substrate-claim-checker/check-counts.ts` covers one sub-class:

- **Count drift** — body says "N drift instances" / "N rows" / "N items" but the actual count differs

V0 limitations documented in `tools/substrate-claim-checker/README.md`:

- Nearest-table heuristic (no noun-to-table matching yet)
- Rhetorical number false positives (`"100 rows"` in narrative)
- Markdown-table data rows only (lists not counted yet)

## Remaining sub-classes for v1+

Per the verify-then-claim catalogue:

| Sub-class | v0? | Description |
|---|---|---|
| Count drift | ✓ shipped | "N rows / instances / items" vs actual count |
| Existence drift | v1 | "file/dir/tool exists" claim vs `ls` / `test -e` |
| Semantic-equivalence drift | v1 | command substitution equivalence claims |
| Empirical-output drift | v1 | "command returns X" vs actual output |
| Convention drift | v1 | recommended pattern matches canonical convention |
| Path-form drift | v1 | fully-qualified vs bare paths consistent across document |
| Self-recursive drift | v1 | the memo about X contains its own X |
| Cross-surface count drift (frontmatter ↔ body ↔ section heading ↔ carved sentence ↔ MEMORY.md) | v1 (v0 catches narrative-vs-table within a single document; cross-surface narrative-to-narrative comparison is v1 work) | five surfaces should match consistent N |

## Hooks integration (planned, not v0)

Per the verify-then-claim memo:

- **pre-commit** hook: validate staged-file content
- **commit-msg** hook: validate the commit message itself (fires AFTER message exists; pre-commit can't see it)
- **CI check**: validate PR descriptions on host

These land in subsequent PRs once check-types are mature.

## Done-criteria

This row closes when:

1. All 7 sub-classes from the verify-then-claim catalogue have at least one check-type in `tools/substrate-claim-checker/`
2. Pre-commit + commit-msg hooks are wired (with documented opt-out for legitimate edge cases)
3. CI check for PR descriptions is wired
4. The tool's eval-set (the N historical drift instances) has corresponding fixture-tests
5. Self-test: the tool runs against `memory/` and `docs/research/` regularly without false-positive flood

## Composes with

- **B-0169** (decision-archaeology skill) — same author per Aaron 2026-05-03 *"skills are carved sentences ... knowledge is in docs and can be referred to by skills, skills don't need updating as much"*; substrate-claim-checker is a tooling-class hub that the eventual decision-archaeology SKILL.md will call
- `memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md` — the discipline this tool mechanizes
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — rule 2 (no dynamic commands in skills; use TS files); this tool IS one of the TS files
- `memory/feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md` — TS-script preference; same shape
- `memory/feedback_rule_number_one_assume_its_already_done_and_you_just_have_to_find_it_remember_forever_and_into_all_future_generations_aaron_2026_05_05.md` — Rule #1 default-posture; substrate-claim-checker mechanizes the verify step that Rule #1 asks for ("assume it's done, then find it") at the substrate-claim layer.
- `memory/feedback_rule_number_four_assume_another_human_on_the_internet_already_solved_it_since_your_training_data_find_it_via_websearch_aaron_2026_05_05.md` — Rule #4 (search-first authority via WebSearch) is the upstream-of-substrate verify discipline; this tool mechanizes the in-repo claim-vs-reality verify counterpart.

## Out of scope (intentional, per "foundation right and deliberate")

- Plugin packaging (B-0169-domain follow-up)
- Hook authoring (separate row; depends on this tool maturing)
- Cross-harness portability (works via Bun for now; portable to Codex / Cursor / Gemini-CLI later)
- OpenSpec capability authoring (separate concern; OpenSpec catch-up has its own row)
