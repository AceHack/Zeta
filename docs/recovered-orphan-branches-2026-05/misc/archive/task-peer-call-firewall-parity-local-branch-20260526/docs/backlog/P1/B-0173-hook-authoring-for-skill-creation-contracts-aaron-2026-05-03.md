---
id: B-0173
priority: P1
status: open
title: Hook authoring for skill-creation contracts — pre/post-condition enforcement at skill-creation + commit + PR-creation time (Aaron 2026-05-03 rule 3b from skill-design memo)
tier: tooling
effort: M
ask: Aaron 2026-05-03 verbatim *"this feature is great for reminding yourself to do the right thing the pre conditions and post condtions in contract based development or spec based development like openspec"*
created: 2026-05-03
last_updated: 2026-05-03
depends_on: [B-0170, B-0171]
composes_with: [B-0169, B-0172]
tags: [hooks, contract-based-development, design-by-contract, openspec, pre-condition, post-condition, ci, p1-foundation]
---

# Hook authoring for skill-creation contracts

Aaron 2026-05-03 named harness hooks as Rule 3b of the skill-design memo (`feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`):

> *"this feature is great for reminding yourself to do the right thing the pre conditions and post condtions in contract based development or spec based development like openspec"*

Harness hooks fire at well-defined points (pre-tool-use, post-tool-use, session-start, pre-commit, commit-msg, etc.) — the natural place to enforce pre-conditions and post-conditions on procedures. This is contract-based development (Meyer, Eiffel) / Design-by-Contract / spec-based development (OpenSpec).

## Why P1

The verify-then-claim discipline (`feedback_verify_then_claim_discipline_*`) catalogues 20+ drift instances across 9+ PRs that manual discipline failed to catch. The substrate-claim-checker TS tool (B-0170) ships v0 covering count-drift; v1+ extends to remaining 6 sub-classes. **The hook integration is what turns the tool from advisory into enforcement.** Without hooks, the tool fires only when manually invoked; with hooks, it gates commits + PRs automatically.

## Why depends_on B-0170 + B-0171

- **B-0170** (substrate-claim-checker TS tool): the tool the hooks invoke. Hooks ship after the tool's check-types are mature enough to gate.
- **B-0171** (OpenSpec catch-up): hooks enforce contracts; contracts live in OpenSpec capabilities. Without specs, the hooks have no contract to read pre/post-conditions from.

## Scope (per the verify-then-claim memo's mechanization-path section)

Three hook integrations:

### 1. pre-commit hook

Fires BEFORE the commit message is entered. Validates **staged-file content** — memos, docs, config files. Calls `bun tools/substrate-claim-checker/check-counts.ts <staged-files>` (and v1+ sibling check-types). Exit non-zero blocks commit.

### 2. commit-msg hook

Fires AFTER the commit message is written. Validates **the commit message itself** for fact-claims (path mentions, count totals, command-output assertions). Pre-commit can't validate this surface because the message doesn't exist yet at pre-commit time per git's hook ordering.

### 3. CI check on PR descriptions

Fires post-PR-creation on the GitHub host. Validates **the PR description** for fact-claims. Authored on the host, not pre-commit, so this is its own check (different timing from the two git hooks).

## Hook authoring deliverables

1. `tools/git/hooks/pre-commit` (bash invoking `bun tools/substrate-claim-checker/...` with staged files)
2. `tools/git/hooks/commit-msg` (bash invoking the same tool with commit message)
3. `.github/workflows/substrate-claim-checker.yml` (CI check for PR descriptions)
4. Documentation: how to install hooks (`tools/setup/install.sh` integration)
5. Opt-out mechanism for legitimate edge cases (e.g., a hedged-claim memo where strict drift checking would false-positive — `# substrate-claim-checker: skip` comment in the file)

## Cross-cutting design decisions

### Strict vs warn mode

- **Strict mode** (default for production): hook exits non-zero, blocks commit
- **Warn mode** (default during v0.x rollout): hook prints warnings, exits 0
- Switch via env var (`SUBSTRATE_CLAIM_CHECKER_MODE=strict` / `=warn`)

The progression: ship in warn mode → observe false-positive rate → tighten to strict mode once mature

### Hook performance

Hooks fire on EVERY commit; they need to be fast (<2 seconds ideally). The check-counts.ts v0 self-test runs in ~50ms on a single memo file; scaling to staged-files-in-large-PRs needs measurement. v1+ may need worker-pool or incremental-cache.

### Opt-out semantics

Each check-type should have a recognized comment/marker for legitimate skip. Example: `<!-- substrate-claim-checker: skip-count-drift -->` at the top of a memo. Maintainable opt-out is the difference between gating-discipline-respected vs gating-discipline-circumvented.

## Done-criteria

This row closes when:

1. Pre-commit + commit-msg hooks installed via `tools/setup/install.sh`
2. CI workflow validates PR descriptions on GitHub
3. Strict mode is the default; warn mode available via env var
4. Documented opt-out mechanism for edge cases
5. Self-tested: at least 5 historical PRs (drift catalogue eval-set) would have been caught by the hooks pre-commit

## Composes with

- **B-0169** (decision-archaeology skill) — once mature + packaged (B-0172), the decision-archaeology skill body has hooks via this row
- **B-0170** (substrate-claim-checker TS tool) — the tool the hooks invoke
- **B-0171** (OpenSpec catch-up) — hooks enforce spec-encoded contracts
- **B-0172** (skill-domain plugin packaging) — packaged plugins include their hooks
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — Rule 3 of the three skill-design rules; this row is the operational implementation
- `memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md` — discipline that gets enforced by these hooks
- `memory/feedback_rule_number_six_do_the_work_only_if_you_check_all_the_rules_10_more_times_kinda_joking_not_really_aaron_2026_05_05.md` — Rule #6 (check-rules-before-acting); hooks ARE the mechanization that fires this check pre-action instead of relying on agent-remembering.
- `memory/feedback_rule_number_one_assume_its_already_done_and_you_just_have_to_find_it_remember_forever_and_into_all_future_generations_aaron_2026_05_05.md` — Rule #1 default-posture; hooks enforce the verify-step that converts assumed-done into known-done at PR-creation time.
