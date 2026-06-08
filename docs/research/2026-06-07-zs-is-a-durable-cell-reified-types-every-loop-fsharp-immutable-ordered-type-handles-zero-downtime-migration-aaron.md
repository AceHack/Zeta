# zs is a durable cell with reified types every loop; F# immutable-ordered type-handles give 0-downtime migration over zsets+sagas (Aaron, 2026-06-07)

Corrects/deepens the zs/zc split (#6956) and the IDL type-provider thread (#6925/#6945). Aaron:

> *"zs is a durable cell too, and its types update via reified type providers every loop and the current db.
> Changes to the types in the interpreter and CLI can cascade into the db with 0-downtime migrations
> automatically — we almost have this proved on how to do it repeatedly and mechanically over zsets and sagas."*
> … *"in F#, when you redefine a type it's all immutable and ordered, so that new definition becomes the handle
> going forward; the past still has the old handle."*

## Correction: zs is durable too (not just the ephemeral REPL)

#6956 framed zs = interactive/ephemeral, zc = durable. **Refined: zs is ALSO a durable cell.** The interpreter
isn't a throwaway session — it's a live, durable cell whose **types reify every loop from the current db** (via
the reified type providers, #6925/#6945). So both zs and zc are durable cells; the difference is interaction
mode (interactive interpreter vs non-interactive CLI), **not** durable-vs-ephemeral.

## The mechanism: F# type redefinition is immutable + ordered ⇒ versioned handles coexist

> *"redefine a type → it's immutable and ordered → the new definition is the handle going forward; the past
> still has the old handle."*

This is the load-bearing insight — it's how live-reification + 0-downtime migration actually work:

- **Redefining a type T doesn't mutate T — it creates a NEW T (a new handle).** Existing bindings, code, and
  data keep referring to the **old T (old handle)**; new code uses the **new T**. (F#/FSI shadowing semantics:
  the latest definition shadows for *future* references; prior references are unchanged.)
- **Immutable + ordered = event-sourcing for types.** Type versions are appended, never overwritten; each is
  immutable; they're ordered. So "the type" at any point is the latest handle, but **every prior version still
  exists and still types its data.** This is exactly the Z-set / git-native append model applied to the type
  layer (and content-addressable: each version is a ZetaId; reinterpreting the base = a Merkle branch / Higgs
  re-collapse, #6922).
- **Both handles coexist ⇒ no stop-the-world.** Old data is still validly typed (old handle); new code runs
  against the new handle. There is no moment where the schema is "in between" and the system is down — the two
  versions live side by side. That **is** the 0-downtime property.

## 0-downtime migration, "repeatedly and mechanically over zsets and sagas"

The substrate already has the pieces (Aaron: "we almost have this proved"):

- **The migration is a mechanical Z-set transformation.** `SchemaEvolution` (`Migration` with `Up`/`Down`,
  `migrate`/`migrateDown`) turns old-version data into new-version data as a deterministic function over the
  data — and over a Z-set, applying it is a delta (retraction of old shape + assertion of new shape), composable
  and replayable. `SchemaRegistry` holds the versioned migrations.
- **Wrapped in a saga for the effectful/non-idempotent part.** `DurableSaga` (+ the DU/workflow discipline,
  #6959) drives the migration durably with compensation — so a partial migration is resumable/rollback-safe
  (the `Down` inverse = the reversible-destruction covenant, #6896). Idempotent migrations (most) just converge;
  non-idempotent steps are saga-fenced.
- **Lazy or eager, both safe.** Because old + new handles coexist, you can migrate old rows **lazily on read**
  (old handle → `Up` → new handle) or **eagerly in the background** (a saga sweeping the Z-set) — either way,
  zero downtime, because nothing requires all data to be one version at once.
- **"Every loop"** = the zs/zc loop (#6965, one step at a time) re-reifies the current type from the db each
  iteration; a type change in the interpreter/CLI registers a new version (new handle) + its `Up`/`Down`
  migration, and the saga cascades it into the db without interrupting the loop.

So: **edit a type live in zs/zc → new immutable handle (old preserved) → SchemaEvolution `Up`/`Down` over the
Z-set, driven by a saga → the db migrates with 0 downtime, automatically.** F#'s immutable-ordered type
semantics are *why* it's safe; zsets+sagas are *how* it's mechanical and repeatable.

## Honest scope / peel

- **"Almost proved," not done** (Aaron's words). The pieces exist — `SchemaEvolution` (Up/Down + round-trip
  laws), `SchemaRegistry`, `DurableSaga`, reified type providers (#6925, themselves a *direction*) — but the
  end-to-end "live type edit in zs → automatic 0-downtime db migration" loop is **not yet proved end-to-end**.
  The claim is "we have the mechanism and almost the proof," not "it ships."
- F# FSI shadowing gives *new-handle-going-forward / old-handle-in-the-past* at the **interactive** layer;
  mapping that cleanly onto **persistent db schema versions** (so old *data* keeps its old handle) is the
  SchemaRegistry/content-addressed-version job — the bridge from FSI semantics to durable storage is the part to
  finish proving.
- 0-downtime requires migrations be **online-safe** (additive/expand-then-contract; the `EvolutionWindow`
  backward-projection gate already encodes "may-expand-into") — destructive migrations need the expand/migrate/
  contract dance, not a hot drop. The discipline that makes it sound.

## Ties

- **zs/zc (#6956) + one-step-at-a-time loop (#6965)** — zs is a durable cell; types reify each loop.
- **Reified F# type provider (#6925/#6945)** — reifies the current type from the db every loop.
- **F# immutable-ordered type redefinition (FSI shadowing)** — new handle forward, old handle in the past =
  versioned types, the 0-downtime precondition.
- **SchemaEvolution (Up/Down, migrate/migrateDown) + SchemaRegistry + EvolutionWindow (expand-into gate) +
  DurableSaga (#6959 DU/saga)** — the mechanical zset+saga migration; `Down`/compensation = reversible
  destruction (#6896).
- **Content-addressing / Merkle branch / Higgs reinterpret-the-base (#6922)** — each type version is content-
  addressed; reinterpreting the base is a branch.
- **Zeta IDL (#6955)** — type definitions are IDL/DynamicValue; editing the spec live is editing the type.

## Beacon anchors

- **F#/FSI type shadowing** (redefinition shadows for future refs; prior refs unchanged — immutable, ordered). ·
  **Type providers** (Syme et al.; reified/generative). · **Zero-downtime / online schema migration**
  (expand-contract / parallel-change; Ambler & Sadalage, *Refactoring Databases* 2006; "expand/migrate/
  contract"). · **Event sourcing for schema** (versioned events, upcasting old → new on read). · **Sagas /
  compensating transactions** (Garcia-Molina & Salem 1987). · **DBSP Z-set deltas** (migration as a
  retraction+assertion delta). Honest novelty: none in the primitives; the contribution is the **mechanism** —
  F#'s immutable-ordered type redefinition (new handle forward, old handle preserved) gives coexisting type
  versions (the 0-downtime precondition), and SchemaEvolution `Up`/`Down` over Z-sets driven by sagas makes the
  live-type-edit → automatic-db-migration cascade mechanical and repeatable; zs is a durable cell reifying its
  types every loop from the current db ("almost proved," end-to-end loop pending).
