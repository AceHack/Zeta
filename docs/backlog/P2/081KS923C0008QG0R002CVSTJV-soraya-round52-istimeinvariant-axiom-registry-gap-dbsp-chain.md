---
id: 081KS923C0008QG0R002CVSTJV
priority: P2
status: open
title: "Soraya round-52 hand-off — register `IsTimeInvariant` axiom in verification-registry (Class 1/2 statement+paper-drift on a load-bearing axiom that BOTH registered DBSP theorems depend on)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: drift-cleanup
composes_with:
  - tools/lean4/Lean4/DbspChainRule.lean
  - docs/research/verification-registry.md
  - docs/research/chain-rule-proof-log.md
---

# 081KS923C0008QG0R002CVSTJV — Register `IsTimeInvariant` axiom (Soraya round-52 hand-off)

## Origin

Soraya's seventh autonomous routing tick (2026-05-23 — round 52, post-PR #4789 merge of 081KS923C0008QG0R000ECG5EC). Distinct axis from 081KS923C0008QG0R0032VJZPF (portfolio coverage), 081KS923C0008QG0R002RH3EH8 (Lean exploratory artifact), 081KS923C0008QG0R000ECG5EC (TLA+ runnability).

## Finding

`tools/lean4/Lean4/DbspChainRule.lean:272` defines:

```lean
structure IsTimeInvariant (f : ...) where
  commute_zInv : ∀ s n, f (zInv s) n = zInv (f s) n
```

This is a **de facto axiom** (no proof obligation; callers discharge per-operator). Both registered theorems in `verification-registry.md` (`chain_rule_proposition_3_2` row + `Dop_LTI_commute` row) take `IsTimeInvariant` as hypothesis — but the axiom itself has **no registry row**.

The artifact's own header (lines 50-51, 201-203) carries **strikethrough revision history**: `~~Prop 3.5 unspoken premise~~ → Theorem 3.3 explicit` (corrected round 35, 2026-05-05). **The drift class this row is designed to catch already empirically fired on THIS exact axiom** — registry rows are the structural prevention mechanism, currently missing for the axiom.

## Distinct from prior session findings

- 081KS923C0008QG0R0032VJZPF (round 42, expanded 49): TLA+/Alloy portfolio coverage — different tool stack
- 081KS923C0008QG0R002RH3EH8 (round 50): Lean ImaginaryStack/ToyModel exploratory artifact — different artifact, sorry-bearing
- 081KS923C0008QG0R000ECG5EC (round 51): TLA+ `.cfg` runnability — different tool + axis (runnability vs registry)

This row: registered THEOREMS depend on an UNREGISTERED axiom in the same artifact. New axis.

## Routing decision (Soraya)

- **Primary tool**: Lean 4 (axiom IS the right encoding — `structure` with a property field is the Mathlib-idiomatic representation of a class-with-axioms)
- **Cross-check**: NONE today — the axiom is structural, not pointwise-algebraic. Z3/FsCheck don't apply. Paper-fidelity cross-check is human-grade (registry audit by `verification-drift-auditor`)
- **Wrong-tool cost at TOOL axis**: zero. Cost lives at **REGISTRY axis** — without a row, paper-statement drift (the round-35 `Prop 3.5 → Theorem 3.3` correction class) goes uncaught next iteration. Strikethrough revision in the file header is empirical proof this drift class is real on THIS axiom.

## TLA+-hammer guard

N/A — finding is Lean axiom-registry hygiene, not state-machine vs algebraic routing.

## Acceptance criteria

1. New row in `docs/research/verification-registry.md` for `Dbsp.ChainRule.IsTimeInvariant`:
   - Artifact path: `tools/lean4/Lean4/DbspChainRule.lean:272`
   - Paper anchor: Budiu et al. 2023 ([arXiv:2203.16684](https://arxiv.org/abs/2203.16684)), Theorem 3.3 (Linear) — *"For an LTI operator Q we have Q^Δ = Q"*
   - Axiom statement: `commute_zInv : ∀ s n, f (zInv s) n = zInv (f s) n`
   - Preconditions diff vs paper: paper's "Linear Time-Invariant" condition is per-operator; Lean encodes as structure-field discharged at instance site
   - Cross-reference back-pointers added to existing two theorem rows' Preconditions-diff sections (instead of inlining the same hypothesis prose twice)
   - Last audit: None yet — registered 2026-05-23
   - Drift history: round-35 paper-citation correction (Prop 3.5 → Theorem 3.3) — preserved as audit-cadence anchor
2. Follow-up consideration (out of scope for this row): `IsCausal`, `IsLinear`, `IsPointwiseLinear` structures carry similar de-facto-axiom status; if this row lands cleanly, future Soraya round can extend to all four (separate B-NNNN)

## Effort

S (one registry row + 2 back-pointer cross-references). Assignee: kenji.

## Composes with

- [`tools/lean4/Lean4/DbspChainRule.lean`](../../../tools/lean4/Lean4/DbspChainRule.lean) — target artifact line 272
- [`docs/research/verification-registry.md`](../../research/verification-registry.md) — substrate this row fills
- [`docs/research/chain-rule-proof-log.md`](../../research/chain-rule-proof-log.md) — round-35 paper-drift audit trail (empirical anchor for why registry rows matter)
- 081KS923C0008QG0R0032VJZPF (round 42, expanded 49) — different axis (portfolio coverage)
- 081KS923C0008QG0R002RH3EH8 (round 50) — different artifact (Lean ImaginaryStack/ToyModel)
- 081KS923C0008QG0R000ECG5EC (round 51) — different tool (TLA+) + axis (runnability)
- `memory/soraya/NOTEBOOK.md` round-52 entry (pending append)

## Substrate-honest framing

The artifact is well-formed Lean (DbspChainRule is CI-type-checked, no `sorry`, no `admit`). The gap is purely registry-hygiene: a load-bearing axiom that both registered theorems depend on is itself unregistered. The fix is one row + two back-pointers; bounded engineering work that closes the auditor's blind spot on this specific axiom's paper-drift class (which has already fired empirically once, on this same axiom, per the round-35 strikethrough revision history).
