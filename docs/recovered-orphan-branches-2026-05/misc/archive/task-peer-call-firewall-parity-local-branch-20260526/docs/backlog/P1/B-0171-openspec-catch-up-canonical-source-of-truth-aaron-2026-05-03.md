---
id: B-0171
priority: P1
status: open
title: OpenSpec catch-up — restore OpenSpec capabilities as canonical source-of-truth (Aaron 2026-05-03 architectural-debt naming; "if we deleted everything other than it [OpenSpec]")
tier: foundation
effort: L
ask: Aaron 2026-05-03 verbatim *"openspec which we are way behind on, that's suppsed to be our source of truth lol, if we were to delete everyting other than it"*
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [B-0058, B-0169, B-0170, B-0172, B-0173, B-0190]
tags: [openspec, source-of-truth, foundation, architectural-debt, contract-based-development, spec-based-development, p1-foundation]
---

# OpenSpec catch-up — restore OpenSpec as canonical source-of-truth

Aaron 2026-05-03, in the autonomous-loop maintainer channel via the skill-design memo (`feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`), named OpenSpec catch-up as load-bearing architectural debt:

> *"openspec which we are way behind on, that's suppsed to be our source of truth lol, if we were to delete everyting other than it"*

The intended state per `openspec/README.md`: capabilities under `openspec/specs/**` carry behavioral specs that the code is supposed to satisfy. Specs are canonical; code + skills + memos + docs all derive from / serve / reference the specs.

**Current state (2026-05-03):** specs are sparse; most discipline lives outside specs (memos, CLAUDE.md, GOVERNANCE.md). The *"if we deleted everything but OpenSpec, the project would be lost"* test FAILS today.

This row tracks the catch-up work needed to restore OpenSpec as actual source-of-truth.

## Why P1 (foundation)

- Aaron's same-tick framing names OpenSpec catch-up as **load-bearing prerequisite** for Rule 3 (skill-domain packaging + harness hooks for contracts) to fully operationalize
- The skill-design rules in `feedback_skills_as_carved_sentences_*` recursively compose at the spec layer: skill body / command / skill domain / cross-skill contracts / **spec** — without the spec layer current, the recursion is incomplete
- Contract-based development (Meyer, Eiffel) / Design-by-Contract / spec-based development is what hooks-as-pre/post-conditions plug into; without specs, the contracts have no reference

## Scope (incremental, not big-bang)

The catch-up is **NOT** a single big-bang spec authoring pass. It's incremental backfilling of the most load-bearing capability surfaces FIRST, then extending coverage. Per Aaron's *"foundation right and deliberate"* guidance, quality > coverage.

### Phase 1 — Inventory + sequencing

1. Audit current `openspec/specs/**` — what capabilities exist? what's stale? what's empty?
2. Compare against the project's actual hot-path code (Z-set algebra, DBSP operators, retraction-native semantics, tick-history schema)
3. Identify the top-10 capabilities by load-bearing-weight — these are the catch-up targets
4. Sequence: spec the most-foundational first (algebra > operators > DBSP > retraction-native > tick-history > backlog row schema > skill-router shape > harness contracts)

### Phase 2 — Author the top-10 specs

Per `openspec/README.md` modified-fork conventions (no archive, no change-history). Each spec lands its own PR. Reviewer surface: spec-zealot (Viktor) — adversarial pass on each spec.

### Phase 3 — Cross-reference + tooling

- Update `CLAUDE.md` + `AGENTS.md` to make OpenSpec the FIRST-READ surface (above current load order)
- Add CI check: every load-bearing change references a spec in `openspec/specs/**`
- Add `tools/openspec/` tooling for spec-to-code drift detection (probably builds on `tools/substrate-claim-checker/` v1+)

### Phase 4 — Validation

The *"if we deleted everything but OpenSpec, the project would be lost"* test is the acceptance criterion. When all 4 phases complete, that test should NOT fail.

## Why this matters now

- Multiple just-landed memos (`feedback_skills_as_carved_sentences_*`, `feedback_multi_harness_alignment_convergence_*`, `feedback_git_native_backlog_management_*`, `feedback_verify_then_claim_*`) reference OpenSpec as the long-term canonical surface. Each adds substrate that should eventually have spec backing.
- The substrate-claim-checker tool (B-0170) v1+ work for hook integration depends on contract-based development, which depends on specs being current.
- Plugin packaging (B-0172) depends on specs as the contract carriers.

## Out of scope

- Adopting upstream OpenSpec workflow as-is (the project uses a modified fork; modifications stay)
- Single big-bang spec authoring (incremental per Phase 1-4 above)
- Replacing CLAUDE.md / AGENTS.md / GOVERNANCE.md (OpenSpec is the *contract* layer; those remain the *behavioral guidance* + *governance* layers — they reference the contracts)

## Composes with

- **B-0058** (AI ethics + safety research track) — alignment specs are one class of OpenSpec capability that needs catch-up
- **B-0169** (decision-archaeology skill) — once specs are current, `docs/DECISIONS/` ADRs cross-reference specs; decision-archaeology composes naturally
- **B-0170** (substrate-claim-checker TS tool) — v1+ hook integration depends on specs as contract carriers
- **B-0172** (skill-domain plugin packaging) — skill domains expose contracts; contracts live in specs
- **B-0173** (hook authoring for skill-creation contracts) — pre/post-conditions are spec-encoded; hooks read them
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — the memo naming this catch-up as load-bearing
- `openspec/README.md` — the canonical-intent doc; reading order is OpenSpec first per the future state
- `memory/feedback_rule_number_two_assume_its_on_backlog_and_find_it_with_all_dependencies_and_updates_and_clean_up_the_dependson_chain_aaron_2026_05_05.md` — Rule #2 (assume-it's-on-backlog + walk depends_on); OpenSpec catch-up IS the spec-side analogue (assume the contract already exists, find it, walk its composes-with chain).
- `memory/feedback_rule_number_three_assume_an_orthogonal_trajectory_already_exists_for_the_thing_find_it_aaron_2026_05_05.md` — Rule #3 (assume-trajectory-exists); OpenSpec catch-up is itself the spec-class trajectory anchor.

## Done-criteria

This row closes when:

1. The top-10 load-bearing capability surfaces have current OpenSpec specs (Phase 2 complete)
2. CI gate enforces "every load-bearing change references a spec" (Phase 3 complete)
3. CLAUDE.md + AGENTS.md updated to make OpenSpec FIRST-READ (Phase 3 complete)
4. The *"delete everything but OpenSpec"* test passes (Phase 4 complete)

Until done, this row stays open. Per Aaron's *"WONT-DO is 99% deferral, not forever — we will likely do everything eventually"*, the catch-up is on the long arc.
