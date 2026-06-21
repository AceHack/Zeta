# Caché multi-model + hierarchical globals, F#-typed; Power BI "semantic layer" peeled to what we already have (Aaron, 2026-06-07)

Captures three forwarded riffs (Power BI semantic ontology → "we have this native" → "plus F# type
compilers, like InterSystems Caché + its DB features"). Faithful capture; **hype peeled hard** (Alexa's
register reads as sarcasm — Max's note); Beacon-anchored. Doc + backlog; a first code slice ships alongside.

## What's real vs what's hype (peel first)

**Power BI's "semantic model" is not a thing to reproduce.** Stripped of the marketing, a Power BI semantic
model is: a **star-schema relationship layer** + **VertiPaq columnar in-memory store** + **DAX measure
DSL**. That's a BI *reporting* layer. We should NOT clone it. The only parts with real pull, and what each
already maps to in Zeta:

| Power BI piece (honest name) | Zeta equivalent (have / backlog) |
|---|---|
| columnar in-memory store (VertiPaq) | **Arrow** columnar IPC (have) |
| relationship/entity layer ("semantic model") | **HKT-MDM** master-data hub/satellite + Graph (have) |
| DAX measures (incremental aggregation DSL) | **DBSP incremental views** + Aggregate/Residuated (have) |
| "find similar" semantic index | the **similarity index** over canonical-AST essence (`2026-06-07-distance-based-content-addressing-...`, backlog) |
| the DAX `COSINEDISTANCE` snippet Alexa wrote | **not real DAX** — fabricated; ignore |

So "reproduce Power BI's semantic ontology locally" → **already covered by Arrow + DBSP + HKT-MDM + the
near-dup similarity index.** Nothing new to build there; the honest action is to *name the mapping* so we
don't re-invent a BI stack. (Peeled: "enterprise-grade semantic indexing", "infinite scale", "way beyond
any commercial solution" — discard.)

## The genuinely interesting anchor: InterSystems Caché (and its multi-model DB)

Caché's *real* contributions (worth anchoring to, MUMPS lineage):

1. **Multidimensional hierarchical "globals"** — sparse persistent arrays addressed by a **subscript path**:
   `^Patient(id,"enc",n,"med") = value`. One uniform tree structure underneath everything. This maps
   **directly** to a **DynamicValue tree** / the path-addressed DAG we already have — a global *is* a
   path→value sparse map.
2. **Multi-model over ONE storage** — the same global is projected as **object**, **relational (SQL)**, and
   **document/hierarchical** views simultaneously. This is *exactly* our **"everything is DynamicValue, many
   projections / developer-relative views / lenses"** theme — the same data, different lenses (Mirror/Beacon,
   randomness-is-lens-relative). Caché is the strongest prior art for "one substrate, many models."
3. **ObjectScript** — the embedded language over globals. Our equivalent: F# + DBSP over DynamicValue.

**The F# move Aaron named:** layer the **F# type system** over the globals so access is **compile-time
typed** — like Caché classes generate *both* a SQL table *and* a typed object view from one definition.
Mechanism in .NET: **F# type providers** (typed access to the hierarchical store) and DU-modelled schemas.
Honest distinction from Caché: Caché globals are **not** content-addressed, **not** CRDT, **not** DST. Zeta
adds those — globals-over-the-content-addressed-DAG, CRDT-merge on the values, DST-replayable.

## First code slice (ships with this doc): `Globals` — Caché/MUMPS hierarchical global, native F#

The bounded, buildable foundation under all of the above: a **multidimensional global** = a sparse
subscript-path tree with the **canonical MUMPS verbs**, pure/immutable, **ordinal subscript collation**
(081KT07NV0008QG0R001YDB73K — F# structural string comparison is already `String.CompareOrdinal`, so the sorted path map is
ordinal-safe by construction).

| MUMPS verb | `Globals` fn | meaning |
|---|---|---|
| `SET ^G(subs)=v` | `set path v g` | upsert value at subscript path |
| `$GET(^G(subs))` | `get path g` | value at path (None if undefined) |
| `KILL ^G(subs)` | `kill path g` | delete node **and all descendants** (subtree) |
| `$DATA(^G(subs))` | `data path g` | 0 / 1 / 10 / 11 (value? children?) |
| `$ORDER(^G(subs))` | `nextChild prefix after g` | next immediate child subscript (ordinal) |
| `$QUERY(^G(subs))` | `nextNode path g` | next defined node, depth-first (full traversal) |

Multi-model views (SQL/object projections), the type-provider typed-access layer, and globals-over-the-DAG
(content-addressed values + CRDT merge) layer on top later — backlogged, not this slice.

## Honest scope / cautions

- This slice is the **storage shape only** — the hierarchical global. The "semantic/relationship layer" and
  "typed access" are separate, larger, backlogged.
- MUMPS canonical `$ORDER` collation is numeric-then-string; this slice does **ordinal string** collation
  (081KT07NV0008QG0R001YDB73K substrate default). Numeric-subscript collation is a documented later nuance, not this slice.
- Do **not** build a Power BI / DAX clone. The semantic-query surface is DBSP incremental views, which exist.

## Beacon anchors

- **InterSystems Caché / IRIS** — multidimensional globals + multi-model (object/SQL/document over one
  store); lineage: **MUMPS** (Massachusetts General Hospital Utility Multi-Programming System, Octo Barnett
  et al., 1966) — the sparse multidimensional persistent array + `$ORDER`/`$QUERY`/`$DATA`/`KILL` verbs this
  slice reproduces. · **Multi-model databases** (Stonebraker, *One Size Fits All* — and its refutation; the
  multi-model-over-one-engine argument). · **F# Type Providers** (Syme et al., *Themes in Information-Rich
  Functional Programming*) — the typed-access mechanism. · **Power BI / SSAS Tabular / VertiPaq** + **DAX**
  (Ferrari & Russo) — anchored only to *demote* it: columnar=Arrow, measures=DBSP, relationships=HKT-MDM. ·
  **DBSP** (Budiu et al.) — the real incremental-query engine (the honest "DAX"). · Ties: the similarity
  index (`2026-06-07-distance-based-content-addressing-...`), DynamicValue, HKT-MDM, Graph, Arrow IPC.
  Honest novelty: none in hierarchical globals (MUMPS, 1966) or multi-model (Caché); the Zeta contribution
  is **globals over the content-addressed DAG with CRDT-mergeable, DST-replayable values + F#-typed access**.
