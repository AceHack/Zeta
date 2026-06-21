---
id: 081KS923C0008QG0R0032VJZPF
priority: P2
status: open
title: "Soraya round-42 hand-off — register 11 unregistered formal-verification specs in verification-registry.md (Class 0 drift)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: drift-cleanup
composes_with:
  - .claude/skills/verification-drift-auditor/SKILL.md
  - docs/research/verification-registry.md
  - docs/research/proof-tool-coverage.md
---

# 081KS923C0008QG0R0032VJZPF — Register 11 unregistered formal-verification specs (Soraya round-42 hand-off)

## Origin

Soraya's first autonomous routing tick (2026-05-23 — round 42 of her cadence) surfaced a **Class 0 drift gap at portfolio scale**. The hand-off path she named explicitly: advisory-only tool permissions prevent her from authoring the registry rows herself; Kenji is the right architect to land them.

## Finding

`docs/research/verification-registry.md` covers **7 artifacts** (2 Lean + 5 TLA+). On-disk portfolio: **20** model-checked artifacts (17 TLA+/Lean + 3 Alloy). **11 specs are unregistered** — every one is a Class 0 drift per the registry's own definition ("Any verification artifact that lands without a row here is a Class 0 drift").

Portfolio coverage ratio dropped from **0.83 (round 21)** to **0.52 (round 42)** — spec-intake outpacing registry intake.

## The 11 unregistered specs

- `InfoTheoreticSharder` — TLA+ AND Alloy (round-21 dispatch; both half-pairs unregistered)
- `EngagementLiveness`
- `BftConsensus`
- `FeatureFlagsResolution`
- `AsyncStreamEnumerator`
- `ChaosEnvDeterminism`
- `ConsistentHashRebalance`
- `DictionaryStripedCAS`
- `RecursiveCountingLFP`
- `RecursiveSignedSemiNaive`
- `ThreeColoring` (Alloy)

Additionally, **5 of 7 already-registered rows show "Last audit: None yet — registered 2026-05-03"** — past the 5-10 round cadence. Audit debt accumulating in parallel.

## Acceptance criteria

1. Each of the 11 specs gets a registry row in `docs/research/verification-registry.md` using the internal-correctness template:
   - Artifact (path)
   - Internal correctness target (which property class)
   - Internal correctness claim (what's proven)
   - Spec-vs-implementation alignment (which code paths it gates)
   - Last audit: None yet — registered 2026-05-23
2. `docs/research/proof-tool-coverage.md` updated to reflect on-disk reality (currently cites 14 TLA+ specs; on-disk is 16 + 3 Alloy)
3. Coverage-ratio metric refreshed: numerator ≈ 15 paths gated, denominator now ≈ 29 → ratio 0.52 is the new baseline for round 42

## Soraya's TLA+-hammer guard (preserved for future-Kenji reference)

Tempting framing this round: "RecursiveSignedSemiNaive's Z3 cross-check for S2 is unfilled per the notebook — write the Z3 lemma." Soraya REJECTED this for this tick: it's a Round-42 target (single P0 property, S effort, well-scoped) but does NOT generalize. The registry-coverage gap is portfolio-scale and is the precondition for the auditor catching any future Lean-3.2-style mislabelling drift on the 11 unregistered specs. Fix the meta-surface first; the Z3 lemma stays on deck.

## Effort

M (one evening per Soraya's estimate). Author: original spec owners or `verification-drift-auditor` under a backfill pass.

## Composes with

- `.claude/skills/verification-drift-auditor/SKILL.md` — the procedural surface Soraya routed to (under-utilized, not new tooling needed)
- `docs/research/verification-registry.md` — the substrate this row fills
- `docs/research/proof-tool-coverage.md` — paired update target
- `memory/soraya/NOTEBOOK.md` — Soraya self-committed to append round-42 entry next tick

## Substrate-honest framing

The portfolio isn't short on specs; it's short on **provenance metadata for the specs it already has**. Authoring more TLA+ before registering what exists is the TLA+-hammer failure mode at meta-scope. This row is the meta-surface fix.
