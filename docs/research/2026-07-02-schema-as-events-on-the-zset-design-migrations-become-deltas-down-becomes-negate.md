# Schema-as-events on the Z-set — migrations become deltas; `Down` becomes `negate`

**Design note for work-item `081KWFXTHJY08QG0R001TKNG0S` step 5** (the base atom's
third axis, made structural). Author: Otto (shadow\*), 2026-07-02. Follows the
2026-07-01 base-atom note (`the-polymorphic-zset-base-atom-…`); grounded in the
shipped `src/Core/SchemaEvolution.fs`, `src/Core/ZSet.fs`/`ZSetW.fs`/`MergeKernel.fs`,
and the zero-downtime TLA+ spec (`docs/specs/zero-downtime-schema-evolution/`).
Register: **Beacon**.

---

## 0. Thesis

Aaron (2026-07-01): *"schema is also just events on the ZSet."* Today the schema
plane is implicit: `SchemaEvolution.Migration` carries a version pair and two
**opaque functions** (`Up: DynamicValue -> DynamicValue`, `Down: … option`). The
schema itself never exists as a value — only its *effects* on data do. This note
makes the schema a **first-class Z-set** and each migration's schema half a
**Z-set delta**, so that:

- **applying** a migration = Z-set `sum` (the same `MergeKernel` fold as data);
- **rolling back** = summing the **`negate`** of the delta — `Down` on the schema
  plane stops being a hand-written inverse function and becomes *ring algebra*;
- **a schema version** = a prefix of the delta stream, not a privileged int;
- **zero-downtime** = two readers folding different prefixes of one stream —
  the system is never *between* schemas, only *at* a fold.

The invertibility taxonomy the module already names (lossless / windowed / lossy)
splits cleanly: on the **schema plane every delta is invertible** (ℤ has additive
inverses); lossiness lives only on the **data plane** (the value a dropped field
held), where the existing garbage-dump machinery (`stashToDump`/`restoreFromDump`)
already handles it. The taxonomy was always a data-plane fact — the algebra makes
that visible.

---

## 1. The schema Z-set

```fsharp
/// The schema plane: one row per field, weight = multiplicity in ℤ.
/// KEY = the whole (name, spec) pair — so retype/rename are retract+insert,
/// never in-place mutation (DV2.0: the pair is the hub identity; there is
/// no "update", only −1 old, +1 new).
type FieldSpec = { Type: SchemaType; Default: DynamicValue }   // satellite data
type SchemaZ   = ZSet<FieldName * FieldSpec>                    // int64 ring: ±1
```

- A well-formed schema has every weight = **+1** (a field is present once).
  Weight 0 = absent (dropped from the run by the kernel). Anything else is a
  detectable inconsistency — a free integrity check the fold gives us.
- `ZSet` (int64) suffices — the ring requirement is exactly **additive inverse**
  (retraction), which ℤ has. Richer weights (interval-staged rollouts,
  probability-weighted canary schemas) are the `ZSetW<_, 'W>` generalisation and
  stay out of scope for the first slice.
- Binary collation orders field names (the DB-collation default) — schema
  comparison/diff is byte-locked like everything else.

## 2. Migrations become deltas

| `SchemaEvolution` smart constructor | Schema delta (a `SchemaZ` value) |
|---|---|
| `addFieldMigration k def` | `{ +1 (k, spec) }` |
| `removeFieldMigration k _` / `removeFieldWithDumpMigration k` | `{ −1 (k, spec) }` |
| `renameFieldMigration old new` | `{ −1 (old, spec); +1 (new, spec) }` |
| (future) retype | `{ −1 (k, oldSpec); +1 (k, newSpec) }` |

A `Migration` becomes a **pair of planes**:

```fsharp
type MigrationZ =
    { SchemaDelta: SchemaZ                        // the schema plane: pure data
      Data: Migration }                           // the existing data plane, unchanged
```

- **Schema apply** = `schema + delta` (Z-set sum — the one shared kernel).
- **Schema rollback** = `schema + (-delta)` (`ZSet.neg`) — always defined,
  no `Down = None` on the schema plane, ever.
- **Data plane keeps `SchemaEvolution.Migration` verbatim** — `Up`/`Down`
  functions, the dump window, `migrate`/`migrateDown` composition. Nothing
  shipped breaks; the delta is *additional structure*, not a rewrite.
- The version int survives as a **stream position** (delta index); `From`/`To`
  become derived, not primary.

## 3. What the algebra buys (and what it doesn't)

**Buys:**

1. **Schema diff/merge for free.** Diff of two schemas = Z-set difference;
   three-way merge of concurrent schema changes = sum of deltas (commutative ⇒
   order-free when key-disjoint; a same-key collision surfaces as weight ≠ +1 —
   a *detected* conflict, not a silent overwrite). This is the CRDT-shaped story
   for multi-writer DDL the current function-composition model cannot express.
2. **Algebraic rollback.** `migrateDown`'s "non-invertible" error class vanishes
   from the schema plane; what remains non-invertible is only data recovery,
   already handled (windowed dump) or honestly named (lossy default).
3. **One audit surface.** The schema's whole history is a delta stream in the
   same shape as the data's — same fold, same replay, same DST determinism, same
   golden-vector byte-lock (`no-binary-in-proof-lineage`: deltas serialize as
   text like any Z-set).
4. **Integrity as arithmetic.** `forall w: w = +1` after every fold is the
   well-formedness check; weight 2 = duplicate add; −1 = remove-before-add.

**Doesn't buy (honest limits):**

- The **data plane still needs the functions.** A schema delta says *what*
  changed; `Up`/`Down` say what happens to *values*. The dump window, default
  supply, and position-exact restore stay exactly as shipped.
- **Ordering across dependent deltas** (add k → retype k) still matters at the
  data plane even though schema-plane sums commute. The stream position (§2)
  carries that ordering; the algebra doesn't erase it.
- `FieldSpec` equality must be **canonical** (spec is part of the key) — needs
  the AceCanonical/bit-perfect treatment so the same spec never hashes as two.

## 4. Composition with the shipped verification

- The **TLA+ spec** (`docs/specs/zero-downtime-schema-evolution/SchemaEvolution.tla`,
  SAFETY+LIVENESS TLC-verified, PR #8567) models version-stepping; the delta
  stream refines it (a step = one delta applied). No spec change needed for
  slice 1; a later spec revision can state the weight-invariant.
- The **N-oracle golden vectors** extend naturally: a `SchemaZ` delta is a Z-set,
  and Z-set serialization is already byte-locked across oracles.
- The **round-trip laws** (FsCheck, PR #6806) gain an algebraic twin:
  `(schema + d) + (-d) = schema` is a *theorem of the ring*, testable in one
  property that quantifies over arbitrary deltas rather than per-constructor.

## 5. Implementation plan (slices)

1. **Slice 1 — the schema plane, additive.** `src/Core/SchemaZ.fs`: `FieldSpec`,
   `SchemaZ`, `MigrationZ` (wrapping the existing `Migration`), `applyDelta` /
   `rollbackDelta` (sum / sum-of-negate via the shared kernel), `wellFormed`
   (all-weights-+1), delta constructors mirroring the three smart constructors.
   FsCheck: `rollback ∘ apply = id` (ring theorem), well-formedness preservation,
   rename = remove+add equivalence. Zero changes to `SchemaEvolution.fs`.
2. **Slice 2 — derive the data plane.** Generate the `Up`/`Down` functions FROM
   the delta for the three standard field ops (the generator-is-the-ECC move:
   the opaque function becomes the *derived* form; custom migrations stay
   hand-written). `Migration` becomes the compiled form of `MigrationZ`.
3. **Slice 3 — the registry fold.** The schema-registry-over-DBSP
   (081KSRGFP0008QG0R001Y6RTY9) stores the delta stream; a version = a prefix; readers
   project at their position. This is where zero-downtime-as-consequence lands
   operationally (composes with GeneratorIrRegistry livestream, PR #8712).

## 6. Anchors (Beacon)

- **Schema-as-data lineage:** Codd 1970 (catalog as relations); **Datomic**
  (schema is data in the db itself — the module's own cited lineage); Kafka
  Schema Registry (versioned registry, compat modes). Novelty here is narrow
  and honest: representing the schema as a **ℤ-weighted set folded by the same
  incremental operator as data**, so rollback = additive inverse.
- **DBSP/Z-set:** Budiu et al. (VLDB 2023) — the delta/retraction algebra.
- **CRDT connection:** the multi-writer schema-merge story is the observed-
  remove-set shape (Shapiro et al. 2011) expressed in Z-set weights.
- **Bidirectional transformations / lenses** (Foster–Pierce et al.) — the
  data-plane `Up`/`Down` pair is a (very) restricted lens; the delta plane is
  what makes the schema half symmetric for free.
- **In-repo:** `SchemaEvolution.fs` (the data plane, unchanged);
  `MergeKernel.fs` (the fold); the invertibility taxonomy + garbage-dump
  doctrine (PRs #6801–#6809, #7009 "DDL as a DU over DML meta-updates");
  zero-downtime key-rotation note (2026-06-21) as a consumer.

---

*The compression: today a migration is code you trust; after this, its schema
half is data you can fold, negate, diff, merge, and byte-lock — and the code
that remains is derived from it. Schema was always just events; now the type
system says so.*
