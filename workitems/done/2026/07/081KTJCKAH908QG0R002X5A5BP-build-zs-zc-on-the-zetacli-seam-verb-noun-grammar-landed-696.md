---
id: 081KTJCKAH908QG0R002X5A5BP
type: task
state: closed
priority: P1
slug: build-zs-zc-on-the-zetacli-seam-verb-noun-grammar-landed-696
title: "Build zs/zc on the ZetaCli seam/verb/noun grammar (landed #6967): zs = durable interactive interpreter cell whose types REIFY via reified type providers every loop from the current db; zc = non-interactive CLI + durable observe-loop daemon. Both durable cells (correction to #6956). Core mechanism: F# immutable-ordered type redefinition (FSI shadowing — new definition is the handle going forward, the past keeps the old handle) => coexisting versioned type handles = the 0-downtime precondition. Live type edit in zs/zc -> new immutable handle (old preserved) -> SchemaEvolution Up/Down over the Z-set (retraction+assertion delta), driven by a DurableSaga (#6959 DU/saga; Down/compensation = reversible destruction #6896), via SchemaRegistry + EvolutionWindow expand-into gate => automatic 0-downtime db migration (lazy-on-read or eager-sweep). Pieces exist (SchemaEvolution/Registry/Saga/EvolutionWindow/type-providers); PROVE the end-to-end loop (live-type-edit -> auto-migrate, repeatable + mechanical) — 'almost proved'. Online-safe migrations only (expand/migrate/contract; Ambler-Sadalage). Front-ends: zs likely F# FSI-host; zc the TS observe loop (081KSXN940008QG0R001A4WWX4) over the grammar; both thin-wrap Command.fs DbCommand. Ties #6955 IDL, #6925 type provider, #6922 content-addressed versions. Anchors: FSI shadowing, type providers, expand-contract online migration, event-sourcing upcasting, sagas, DBSP deltas."
created: 2026-06-08T01:12:20.265Z
depends_on: []
composes_with: []
---

# Build zs/zc on the ZetaCli seam/verb/noun grammar (landed #6967): zs = durable interactive interpreter cell whose types REIFY via reified type providers every loop from the current db; zc = non-interactive CLI + durable observe-loop daemon. Both durable cells (correction to #6956). Core mechanism: F# immutable-ordered type redefinition (FSI shadowing — new definition is the handle going forward, the past keeps the old handle) => coexisting versioned type handles = the 0-downtime precondition. Live type edit in zs/zc -> new immutable handle (old preserved) -> SchemaEvolution Up/Down over the Z-set (retraction+assertion delta), driven by a DurableSaga (#6959 DU/saga; Down/compensation = reversible destruction #6896), via SchemaRegistry + EvolutionWindow expand-into gate => automatic 0-downtime db migration (lazy-on-read or eager-sweep). Pieces exist (SchemaEvolution/Registry/Saga/EvolutionWindow/type-providers); PROVE the end-to-end loop (live-type-edit -> auto-migrate, repeatable + mechanical) — 'almost proved'. Online-safe migrations only (expand/migrate/contract; Ambler-Sadalage). Front-ends: zs likely F# FSI-host; zc the TS observe loop (081KSXN940008QG0R001A4WWX4) over the grammar; both thin-wrap Command.fs DbCommand. Ties #6955 IDL, #6925 type provider, #6922 content-addressed versions. Anchors: FSI shadowing, type providers, expand-contract online migration, event-sourcing upcasting, sagas, DBSP deltas

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTJCKAH908QG0R002X5A5BP-*.md` glob. -->
