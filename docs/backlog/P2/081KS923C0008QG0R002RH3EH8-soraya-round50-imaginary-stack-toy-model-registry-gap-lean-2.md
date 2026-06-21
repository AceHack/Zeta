---
id: 081KS923C0008QG0R002RH3EH8
priority: P2
status: open
title: "Soraya round-50 hand-off — register Lean ImaginaryStack/ToyModel in verification-registry.md (sorry-bearing artifact with HaPPY-paper fidelity claim)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: drift-cleanup
composes_with:
  - tools/lean4/ImaginaryStack/ToyModel.lean
  - docs/research/verification-registry.md
  - docs/research/2026-05-17-imaginary-stack-toy-model-lemma-1.md
  - tools/lean4/README.md
---

# 081KS923C0008QG0R002RH3EH8 — Register Lean ImaginaryStack/ToyModel (Soraya round-50 hand-off)

## Origin

Soraya's fifth autonomous routing tick (2026-05-23 — round 50, post-batch-merge of 081KS923C0008QG0R003GHCG1P/081KS923C0008QG0R0005VM4FB/081KS923C0008QG0R001N2RSGJ via PR #4774). Distinct axis from 081KS923C0008QG0R0032VJZPF's portfolio-coverage gap.

## Finding

`tools/lean4/ImaginaryStack/ToyModel.lean` (177 LOC, **7 `sorry` placeholders**) claims fidelity to a "HaPPY-like QECC isomorphism" ([Pastawski-Yoshida-Harlow-Preskill 2015](https://arxiv.org/abs/1503.06237)) — visible in companion `docs/research/2026-05-17-imaginary-stack-toy-model-lemma-1.md` and the file's own `lemma1_toy` block at lines 145-164. The file is **unregistered** in `docs/research/verification-registry.md`.

`tools/lean4/README.md` flags the file as "exploratory and may carry `sorry` placeholders pending future formalization rounds." That README disclaimer does NOT substitute for a registry row.

## Distinct from 081KS923C0008QG0R0032VJZPF

081KS923C0008QG0R0032VJZPF's body enumerates "11 unregistered specs" (round-42, scope-expanded round-49 to 14 TLA+ + 3 Alloy). This is a **separate axis**: sorry-bearing exploratory Lean proof obligation with external-paper fidelity claim. Failure mode is paper-version-drift on a multi-year-old preprint without a registry row to pin the version + preconditions against.

## Routing decision (Soraya)

- **Primary tool**: Lean 4 + Mathlib (already wired; correct routing — higher-order algebraic/topological claim with mathematical-grade fidelity demand)
- **Cross-check**: none warranted today — factory-native toy; no independent grounding candidate yet
- **Wrong-tool cost at TOOL axis**: zero (Lean is right). Cost lives at **REGISTRY axis**: without a row, the next reader cannot distinguish "research-grade toy" from "machine-checked artifact," and `verification-drift-auditor` has no row to compare future Class 1/2/3 drift against.

## TLA+-hammer guard

N/A — finding is registry-discipline, not tool-routing. Confirmed: artifact is correctly in Lean (4D real linear algebra over `ZMod 17` + Mathlib matrix algebra is Lean's sweet spot; TLA+ would be wrong, Z3 too low-level for the QECC reconstruction claim).

## Acceptance criteria

1. New row in `docs/research/verification-registry.md` for `Lean4.ImaginaryStack.ToyModel`:
   - Artifact path
   - Paper anchor: Pastawski-Yoshida-Harlow-Preskill 2015 ([arXiv:1503.06237](https://arxiv.org/abs/1503.06237))
   - `lemma1_toy` statement + preconditions diff vs paper
   - Definition map: R/W/P/A axes → cube basis, F = ZMod 17 instantiation per file's `## 4D Real Base Space` section
   - **Explicit "research-grade, sorry-bearing (7), NOT in CI gate"** markers in audit block (so future readers + auditor cannot mistake it for the machine-checked `DbspChainRule.lean` artifact)
   - Last audit: None yet — registered 2026-05-23
2. `tools/lean4/README.md` updated to cross-link the registry row from the existing exploratory-disclaimer paragraph (so the disclaimer + registry are bidirectionally findable)

## Effort

S (one evening). Assignee: kenji.

## Composes with

- [`tools/lean4/ImaginaryStack/ToyModel.lean`](../../../tools/lean4/ImaginaryStack/ToyModel.lean) — the unregistered artifact (177 LOC, 7 sorry)
- [`docs/research/verification-registry.md`](../../research/verification-registry.md) — substrate this row fills
- [`docs/research/2026-05-17-imaginary-stack-toy-model-lemma-1.md`](../../research/2026-05-17-imaginary-stack-toy-model-lemma-1.md) — paper-anchor research companion
- [`tools/lean4/README.md`](../../../tools/lean4/README.md) — exploratory disclaimer location; bidirectional cross-link target
- 081KS923C0008QG0R0032VJZPF sibling (round-42 hand-off, scope-expanded round-49) — distinct-axis Class 0 drift, NOT a duplicate
- `memory/soraya/NOTEBOOK.md` round-50 entry (1828 words, no prune needed)

## Substrate-honest framing

The Lean artifact correctly carries the sorry markers (substrate-honest about its research-grade state). The gap is at the **discoverability + auditor-anchorability** scope: without a registry row, a future reader skimming `verification-registry.md` to assess Zeta's formal-verification surface area will undercount Lean's exploratory work AND miss the HaPPY-paper fidelity claim that's only currently visible if they happen to read the `.lean` file directly.
