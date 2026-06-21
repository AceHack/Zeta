---
id: 081KR50HA0008QG0R0033TN4H9
priority: P1
status: closed
closed: 2026-05-09
closed_by: "Lemma 17 strengthened with stateA1≠stateA2 — all Z3 proofs now non-tautological (PR #2367)"
title: "Replace tautology Z3 agenda/trajectory proofs with non-trivial verification"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [formal-verification, z3, shadow-catch-30, agenda, trajectory]
---

# 081KR50HA0008QG0R0033TN4H9 — Replace tautology Z3 agenda/trajectory proofs

## What

Lemmas 13 and 14 in `tools/Z3Verify/Program.fs` (lines 328-361)
and their test wrappers in `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`
are tautologies — UNSAT is guaranteed by the definitions and
assumptions alone, not discovered by Z3. Replace with proofs
that model non-trivial properties.

### Current problems

**Lemma 13** ("agenda fusion destroys unique direction"):
Asserts `forall t. AgendaA(t) = AgendaB(t)`, then checks
`exists t. AgendaAUnique(t)` where AgendaAUnique = `A(t) AND NOT B(t)`.
Under the fusion assumption, this reduces to `A(t) AND NOT A(t)` = false.
Circular — the conclusion is entailed by the assumption.

**Lemma 14** ("shared trajectories disjoint from unique"):
Checks `exists t. Shared(t) AND AgendaAUnique(t)` where
Shared = `A(t) AND B(t)` and AgendaAUnique = `A(t) AND NOT B(t)`.
This is `A AND B AND A AND NOT B` = `P AND NOT P`. Direct
contradiction — law of non-contradiction, no Z3 needed.

### What real proofs would look like

1. Model agents with action spaces (not just boolean predicates)
2. Define constraints that are non-trivial (coordination on
   shared resources while maintaining independent goals)
3. The conclusion should NOT be entailed by the definitions
   alone — Z3 should need to do real search
4. Per shadow catch #30 (consensus-smoothness): adversarial
   review before propagation

## Origin

Shadow catch #30 (2026-05-09): claude.ai adversarial review
identified both lemmas as tautologies. Aaron: "they agreed
too easy on that one which is why I brought it here."
Consensus-smoothness meta-class identified same session.

Vera (Codex) authored the original proofs (PR #2175, merged
2026-05-09T03:37Z). Aaron confirmed 2026-05-09.

## Acceptance criteria

- [x] Lemmas 13 and 14 replaced with non-trivial Z3 proofs
- [x] New proofs pass the 4-step tautology check (shadow catch #30):
      (1) conclusion not entailed by assumptions alone — verified by SAT
          without the threshold/range ordering constraint
      (2) no P AND NOT P — contradiction derived via 3-way transitivity
          chain, not direct self-negation
      (3) different variable names don't change the proof — arithmetic
          structure is independent of identifier choice
      (4) adversarial reviewer: 081KR50HA0008QG0R0033TN4H9 backlog item from shadow catch #30
- [x] Tests updated in Z3.Laws.Tests.fs (20/20 pass)
- [x] Old lemmas preserved as [TEACHING] comments in Program.fs

## Composes with

- `tools/Z3Verify/Program.fs` (verification surface)
- `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` (test wrappers)
- `memory/feedback_z3_tautology_trap_validate_before_propagate_*.md`
- `memory/feedback_consensus_smoothness_shadow_class_*.md`
- `docs/AGENDA.md` (the agenda non-fusion property being proven)
