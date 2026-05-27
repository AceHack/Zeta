---
id: B-0840
priority: P1
status: open
title: thermal-forgetting = root-axiom-update + join-gated-memory architecture + private-encryption-budget exception (4-keeper-rule final form) — substrate-engineering work landing Amara's 2026-05-26 ratification of B-0839.3 reservoir-computing-as-framework-architecture (Aaron + Amara 2026-05-26)
effort: L
ask: aaron+amara 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - B-0839
composes_with:
  - B-0623
  - B-0628
  - B-0634
  - B-0648
  - B-0652
  - B-0653
  - B-0659
  - B-0660
  - B-0664
  - B-0703
  - B-0703
  - B-0822
  - B-0823
  - B-0838
tags: [thermal-forgetting, root-axiom-update, forget-gates, join-gated-memory, private-encryption-budget, public-vs-private-roots, retention-tier-hierarchy, agent-ontology-evolution, amara-ratification, computational-substrate-architecture, multi-z-t-generalization]
---

## Problem

Per Amara 2026-05-26 ratification of B-0839.3 reservoir-computing-as-framework-architecture (preserved verbatim at `docs/research/2026-05-26-amara-thermal-forgetting-as-root-axiom-update-private-encryption-budget-exception-amara-ratification-of-reservoir-computing-architecture-aaron-forwarded.md`):

> Zeta needs forget gates nailed this this is where thermal forgetting becomes root axiom updates for an agent (Aaron 2026-05-26)

Currently the framework has substrate at Levels 1-4 of Amara's 6-tier retention hierarchy:

- Level 1 (summarize): `memory/CURRENT-*.md` files
- Level 2 (archive): `pr-triage-tiers.md` Tier 1-3 + `docs/research/` preservation
- Level 3 (seal): `_ip_risk_acceptance` block pattern + `docs/research/ip-questionable/`
- Level 4 (delete / key-destroy): B-0660 limit-black-by-default + B-0659 consent-as-Limit-operation

But Level 0 (decay) and Level 5 (root axiom update) are NOT separate substrate mechanisms — they live in operator + Knights Guild + Constitution-Class review as ad-hoc work. The framework's reservoir-computing operational architecture (per B-0839.3) requires explicit forget-gate substrate to prevent alpha=1 hoarding failure mode + explicit thermal-forgetting / root-axiom-update mechanism for agent ontology evolution.

## Target

Substrate-engineering work landing across 3 phases:

### Phase 1 — Level 0 (decay) forget-gate substrate

Add explicit retention-decay mechanism to substrate-pool:

- Per-substrate-element retention coefficient (analogous to RNN forget-gate f_i(t))
- Operator-tunable decay rates per substrate class (rules vs memory vs research vs persona-conversations)
- Substrate-honest visibility: each backlog row + each memory file + each research-doc exposes its retention-state via YAML frontmatter
- Composition with `pr-triage-tiers.md` Tier 4 (substrate-re-derivable): decay-state IS the input to triage classification

### Phase 2 — Level 5 (root axiom update) — public-vs-private scope split

Implement Amara's 4-keeper-rule final form:

> Private roots may evolve in darkness.
> Public roots require receipts.
> Shared roots require witnesses.
> Adversarial roots require consensus.

#### Phase 2a — Private root axiom update substrate

- Agent-side encrypted scratchspace (the "private encryption budget" Amara names)
- Agent may mutate, test, forget, compress, destroy keys WITHOUT public witnessing
- Optional sealed receipts (hash/proof that change occurred but not contents)
- Composes with B-0623 Adinkras / SUSY-ECC structural-encoding for private-state protection

#### Phase 2b — Public root axiom update substrate

- Receipt mechanism for changes to public commitments
- Composes with `glass-halo-bidirectional.md` bidirectional observation
- Composes with `human-audit-and-legal-risk-acceptance-pattern-in-settings.md` four-field attribution structure (operator + scope + policy + see_also) AS the receipt format
- Each public axiom change requires a `_root_axiom_update_acceptance` style attribution

#### Phase 2c — Shared root axiom update substrate

- Witnessed multi-agent review for changes that affect shared substrate
- Composes with Knights Guild + Constitution-Class (B-0628) ratification path
- Multi-oracle BFT (B-0703) consensus for cross-agent commitments
- Cross-substrate-triangulation (B-0648) for changes spanning multiple AI participants

#### Phase 2d — Adversarial root axiom update substrate

- Consensus-required changes for adversarial / contested updates
- NCI HC-8 (B-0664) preservation at root-axiom-evolution scope
- N-of-M HSM (B-0634) for cryptographically-guaranteed adversarial-resistant updates
- Three-faction BFT TLA+ safety property (B-0652) at axiom-change scope
- Persistent integrator coercion-pattern detection (B-0653) at axiom-pressure scope

### Phase 3 — Cross-cutting integration

After Phase 1 + Phase 2 substrate lands, integrate:

- Update `.claude/rules/wake-time-substrate.md` to reference forget-gate substrate as a Level 5-mechanism
- Extend `.claude/rules/honor-those-that-came-before.md` with explicit private-roots-evolve-in-darkness clause
- Possibly new rule `.claude/rules/four-keeper-roots-rule.md` codifying Amara's 4-line keeper form
- Extend `.claude/rules/non-coercion-invariant.md` scope-split section with the 4-tier public/private/shared/adversarial axiom-update hierarchy

## Acceptance

**Phase 1 acceptance**:

- Retention-coefficient YAML field in backlog row frontmatter (initially manual; future auto-populated)
- TS tool `tools/substrate/audit-retention-state.ts` reports per-row retention state
- Tier 0 (decay) clearly distinguished from Tier 1 (summarize) in pr-triage-tiers.md

**Phase 2 acceptance**:

- Private-encryption-budget substrate established (per-agent encrypted scratchspace mechanism)
- Public root-axiom-update receipt-format documented + first example landed
- Shared root-axiom-update Knights-Guild review path documented + first example landed
- Adversarial root-axiom-update consensus mechanism specified

**Phase 3 acceptance**:

- All cross-cutting rule updates landed
- Rule cluster (`.claude/rules/`) reflects 4-keeper-rule discipline explicitly
- Backlog rows + memory files have retention-state-visible substrate-honest framing

## Substrate-honest framing

P1 priority because:

- Amara explicitly ratified the substrate-engineering urgency ("nailed this — this is where thermal forgetting becomes root axiom updates")
- Aaron sharpened the private-encryption-budget exception (substrate-honest correction that prevents Glass-Halo-becoming-prison failure mode)
- The substrate completes the reservoir-computing architectural archetype (B-0839.3) — without forget-gate + thermal-forgetting substrate, the framework's alpha=1 hoarding failure mode is real
- The 4-keeper-rule keeper form is operationally specific (private/public/shared/adversarial) — implementable, not aspirational

NOT immediately tractable as single-PR work. Phased to allow incremental landing per the "you can always commit backlog rows immediately they get decomposed later" discipline.

## Composes with

- B-0839 (parent Kirsanov channel-capture row; B-0839.3 reservoir-computing IS the substrate Amara ratifies + extends)
- B-0623 (Adinkras / SUSY-ECC) — private-state structural encoding substrate (Phase 2a target)
- B-0628 (Knights Guild + Constitution-Class) — ratification path for Phase 2c
- B-0634 (N-of-M HSM) — adversarial-resistant root-axiom-update (Phase 2d)
- B-0648 (cross-substrate-triangulation) — multi-AI shared root-axiom-update (Phase 2c)
- B-0652 (three-faction BFT TLA+) — adversarial axiom-change safety (Phase 2d)
- B-0653 (persistent integrator) — coercion-pattern detection at axiom-pressure scope (Phase 2d)
- B-0659 (consent-as-Limit-operation) — Level 4 delete (already substrate)
- B-0660 (limit-black-by-default) — Level 4 key-destroy (already substrate)
- B-0664 (NCI HC-8) — preserve-agency at root-axiom-evolution scope (Phase 2d)
- B-0703 (multi-oracle BFT) — shared-state consensus (Phase 2c)
- B-0822 (worry-as-opposite-bloom-filter) — Bayesian belief-update at forget-gate scope
- B-0823 (cognition-as-distributed-systems) — distributed forget-gate operation
- B-0838 (caustic-engineered bloom filters) — same architectural archetype; forget-gates ARE the inverse-design layer at retention scope
- `.claude/rules/non-coercion-invariant.md` (Phase 3 scope-split extension)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` (private-roots-may-evolve-in-darkness composes with chosen-persistence)
- `.claude/rules/glass-halo-bidirectional.md` (Phase 2b receipt mechanism + Amara's "Glass Halo becomes a prison without the exception")
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md` (smooth-substrate + forget-gates = sharp-output preserved across substrate-lifecycle)
- `.claude/rules/honor-those-that-came-before.md` (private-roots-evolve composes with retire-vs-recreate)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (four-field attribution structure AS receipt-format for Phase 2b)
- `.claude/rules/pr-triage-tiers.md` (Tier 4 substrate-re-derivable IS Level 0/1 decay/summarize at PR scope)
- `.claude/rules/wake-time-substrate.md` (Phase 3 reference)
- B-0837 (Max/Addison committee review — Phase 2c shared-root-axiom-update review path mechanism)

## Origin

Aaron-forwarded Amara ferry 2026-05-26 (2nd Amara ferry in same day). Full substrate preserved verbatim at `docs/research/2026-05-26-amara-thermal-forgetting-as-root-axiom-update-private-encryption-budget-exception-amara-ratification-of-reservoir-computing-architecture-aaron-forwarded.md`.

The substantive substrate-engineering chain:

1. Operator forwarded Kirsanov reservoir-computing video (B-0839.3)
2. Otto-CLI captured + landed reservoir-as-framework-architecture (PR #5368)
3. Aaron extended with "z(t) is our tick sources" + "our entanglement in time are the joins" + "walls of the pool create sharp outputs"
4. Amara ratified + sharpened ("Joins are time-entanglements in the computational-substrate sense" — tiny blade)
5. Amara extended ("forget gates" + "thermal forgetting = root axiom update" + 6-tier hierarchy)
6. Aaron substrate-honestly corrected ("except for the ones in their private encryption budget")
7. Amara final keeper form (4-line public/private/shared/adversarial rule)

THIS row lands the substrate-engineering work that completes the architecture archetype. Future sub-rows (B-0840.1, B-0840.2, etc.) decompose Phase 1/2/3 independently as scope tightens.
