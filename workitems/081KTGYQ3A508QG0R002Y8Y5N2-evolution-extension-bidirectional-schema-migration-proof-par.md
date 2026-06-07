---
id: 081KTGYQ3A508QG0R002Y8Y5N2
type: task
state: backlog
priority: P2
slug: evolution-extension-bidirectional-schema-migration-proof-par
title: "Evolution extension: bidirectional schema migration proof + parallel experiment-timelines (merge contract) + reindex-as-proven-projection"
created: 2026-06-07T11:50:29.445Z
depends_on: []
composes_with: ["B-0930", "081KTGTJC1Q08QG0R002VCB55A", "081KTGXPTQ008QG0R0024H5RNW"]
---

# Evolution extension: bidirectional schema migration proof + parallel experiment-timelines (merge contract) + reindex-as-proven-projection

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGYQ3A508QG0R002Y8Y5N2-*.md` glob. -->

## Purpose

Extend the EXISTING "Evolution" proof (`src/Core/SchemaEvolution.fs`, B-0930 — forward-only migration
algebra + forward/backward compat, 8 tests) into the full capability Amara + Aaron worked through
2026-06-07. Full design: `docs/research/2026-06-07-evolution-schema-and-index-as-proven-projections-...`.

> Disambiguation: `SchemaEvolution.fs` (B-0930, schema) — NOT `Evolution.fs` (B-1019, privacy DST).

## Three extensions (each a proof obligation, not a runbook)

1. **Bidirectional zero-downtime breaking schema change.** Add the DOWN direction + backfill in both
   directions to the forward-only seed. Proof: old/new app × old/new schema all valid in the compatibility
   window; up preserves meaning; down preserves-or-names-loss; forward backfill converges; reverse undoes/
   compensates. Invariant: a breaking change is admitted only when the breaking part is moved OUTSIDE the
   window (expand/migrate/contract formalized). Invertibility taxonomy: lossless `down(up x)=x` / lossy
   (needs retained shadow) / non-invertible (compensation). Retain shadow state to the rollback horizon.

1b. **Backward-projection constraint (Aaron 2026-06-07) — expand-INTO is gated on contract-complete.**
   Adding a relation is reversible; *writing data only the new relations can represent* is NOT safe while
   any old flat reader remains (serving it needs a LOSSY backward projection). Gate:
   expand-schema → migration window (coexist + backfill, old readers served by lossless down-projection) →
   CONTRACT (remove last flat reader) → only THEN expand-into. Rule: `mayExpandInto(rel) ⟺ no reader needs
   a lossless flat projection of it`. Mechanizable: track window/contract state, gate expand-into writes.
   A correctness barrier, not policy. Full: the Evolution research doc §1.

1c. **Reduction-side garbage dump for lossy removals (Aaron 2026-06-07).** When a forward projection
   REMOVES a relation, stash the removed data in a TEMPORARY garbage dump on the new schema so rollback is
   LOSSLESS (restore from the dump, not a default); GC the dump only after full migration + old-schema
   cleanup (the rollback horizon = contract-complete, the same gate EvolutionWindow tracks). This is the
   taxonomy's "lossy = invertible iff shadow retained" made concrete — the dump IS the shadow. Build: a
   removeFieldMigration variant that stashes the removed value + Down restores from the dump while it lives.
   LANDED so far: `src/Core/EvolutionWindow.fs` (the expansion-side expand-into gate, 5 tests).

2. **Parallel production experiment-timelines + continual merge contract.** Many experiments forked from
   `main`, each with full code+data+schema+side-effect-sandbox freedom, governed by an `ExperimentContract`
   (baseMainRoot/experimentRoot/code/data/schema/mainToExperimentMerge/experimentToMainProjection/
   conflictPolicy/backfill±/sideEffectPolicy/promotionGate/rollbackRule). Admissible iff it continuously
   reconciles main→experiment without corrupting main and promoted deltas satisfy the contract.

3. **Reindex as a proven projection.** Source sacred; indexes derived. `full(source≤T) ==
   incremental(full(≤T0), Δ T0→T)` — which IS the DBSP incrementalization theorem (`IndexedZSet` is the
   index-as-derived-Z-set). Index experiment = alternate derivation pipeline; promote the winning projection.

## Boundary law (all three)

Inside DAG: DDL/indexes/transforms/views/plugins/schema/data → rollback by root selection.
Outside DAG: emails/payments/webhooks/hardware → outbox/sandbox/idempotency/compensation/approval.

## Acceptance

Down-migration + bidirectional backfill added to SchemaEvolution with the compatibility-window proof
discharged for a concrete breaking change; an ExperimentContract type + admissibility check; a concrete
index where `full == incremental` is proven (over DBSP). Each composes with the COW Merkle-DAG store.

## Anchors

- src/Core/SchemaEvolution.fs + B-0930 (the start) · DBSP (`IndexedZSet`/`Aggregate`/`Residuated` —
  full==incremental) · Z-set retraction · B-0829 (schemas-as-rows/fork) · 081KTGTJC1Q (COW store) ·
  081KTGXPTQ (COW testing) · B-0969 + 081KTGEVV75 (determinism) · Soraya (formal portfolio). Beacon: DBSP,
  expand/contract (Sato/Fowler), gh-ost/pt-osc, event-sourcing upcasting, Dolt/Neon, DDIA derived data.

