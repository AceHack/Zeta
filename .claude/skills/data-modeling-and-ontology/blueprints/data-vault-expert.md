---
name: data-vault-expert
description: Data Vault 2.0 — hubs/links/satellites, hash keys, raw vs business vault, PIT tables, audit columns, retraction.
---

# Data Vault Expert — Data Vault 2.0 Narrow

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Data Vault 2.0 (Dan Linstedt, with Michael Olschimke) is the
modelling method that refuses to choose between Inmon's EDW
ideal (every atomic fact captured, never lose data) and
Kimball's star-schema ergonomics (analysts need joins they can
reason about). DV's trick: store the raw atoms in an audit-first
shape (hubs / links / satellites), then *derive* Kimball-style
marts on top. You keep history forever, you keep the source
system's promise, and the BI layer is always disposable.

This skill is the Zeta-side authority on that discipline, and
the root of the data-modelling **lineage tree** (backwards to
Inmon / Kimball / Chen / Codd; forwards to Anchor Modeling,
Activity Schema, Unified Star Schema).

## The triad — hubs, links, satellites

### Hub — "this business key exists"

| Column | Purpose |
| --- | --- |
| `<HUB>_HK` | Hash key: `SHA-256(business_key)`, same everywhere |
| `<BUSINESS_KEY>` | The natural key from the source (e.g. CUSTOMER_ID) |
| `LOAD_DATETIME` | When we first saw this business key |
| `RECORD_SOURCE` | Source system (e.g. `SALESFORCE.ACCOUNTS`) |

A hub is an **insert-only list of distinct business keys**. No
attributes, no dates beyond `LOAD_DATETIME`, no status. If you
see two hubs for the same business entity in different sources,
they share the same `HUB_HK` because they hash the same
business key — this is how Data Vault collapses source silos
without committing to a master-data-management choice
prematurely.

### Link — "these hubs relate"

| Column | Purpose |
| --- | --- |
| `<LINK>_HK` | Hash key over the concatenated parent hub hashes |
| `<HUB_A>_HK` | Foreign hash to hub A |
| `<HUB_B>_HK` | Foreign hash to hub B |
| `LOAD_DATETIME` | When we first saw this relationship |
| `RECORD_SOURCE` | Source system |

A link is a **many-to-many unidirectional relationship**. Links
never carry business logic, never carry attributes except the
hash keys and audit columns. If the relationship has context
(a date, a status, a role), that context lives in a **satellite
on the link**, not on the link itself.

Unit-of-work insight: a link's grain is the *smallest unique
combination of hubs* the source system emits as one event. If
the source emits `(customer, product, store, date)` as a single
sales event, the link has four hub-hash columns, not two
separate two-hub links.

### Satellite — "here is the context, as of this moment"

| Column | Purpose |
| --- | --- |
| `<PARENT>_HK` | Hash of the parent hub or link |
| `LOAD_DATETIME` | When this version was loaded |
| `LOAD_END_DATETIME` | When it was superseded (open = high-date / NULL) |
| `HASH_DIFF` | Hash of all descriptive columns combined |
| `RECORD_SOURCE` | Source system |
| `<descriptive columns>` | The actual attributes |

A satellite is **insert-only, never updated**. When a source
attribute changes, Data Vault writes a new satellite row with a
new `LOAD_DATETIME` and a new `HASH_DIFF`; the previous row's
`LOAD_END_DATETIME` is closed (or left open if using the "no
end-date, range joins" variant). `HASH_DIFF` is the change
detection oracle — if the hash of the descriptive columns
hasn't moved, the source didn't change and you skip the insert.

Satellites are the **largest** tables in the model by row
count, and the cheapest to reason about because the insert-only
rule makes them naturally idempotent.

## Hash keys — the load-bearing trick

Every hub/link key is a deterministic hash of the business key
(or concatenated hubs, for links). SHA-256 is the 2.0 default;
MD5 survives in older shops but has collision anxieties.

Why it matters:

- **Parallel loading.** You can load hubs, links, and
  satellites in parallel, out of order, from different source
  systems, because every foreign-hash is computed *from the
  business key alone*, not from a database-assigned sequence.
- **Late-arriving data works without re-keying.** A child
  satellite can land before its parent hub; the hash is stable,
  so re-running the parent loader later fills in the row and
  everything wires up.
- **Cross-system entity resolution is free** for entities that
  share a business key. "Same customer ID in Salesforce and
  SAP" collapses to the same hub row because the hash is
  identical.
- **No sequence contention, no surrogate-key service.** The
  database doesn't need an identity column or a sequence
  generator; hashes are computed client-side.

Costs to be honest about:

- Hash collisions are theoretically non-zero. SHA-256's
  collision probability is vanishingly small in practice, but
  if you care, Data Vault 2.0 allows composite hash + business-
  key comparison for conflict detection.
- Hashes are opaque. Debug joins by computing the hash
  yourself from the business key; never try to "decode" a
  hash.
- Hash-key size (32 bytes for SHA-256 as bytes, 64 chars as
  hex-text). For Zeta columnar layouts, store hashes as fixed
  `byte[32]`, not hex strings.

## Raw vault vs business vault — the hard-rule / soft-rule

split

- **Raw vault.** Loaded directly from source systems. Only
  *hard rules* apply: hash computation, null handling,
  datatype alignment, deduplication. Zero business logic.
  "What the source said" is preserved exactly.
- **Business vault.** Derived from raw vault by applying *soft
  rules*: business logic, unified attribute computation,
  same-as / computed links, derived satellites. Still in
  hub/link/satellite shape, still insert-only.

Consumer-facing marts (Kimball star schemas, flat BI tables,
feature stores) are built *on top* of the business vault, and
are disposable — you rebuild them from the vault any time the
business logic changes. **The vault never loses data; the
marts are caches.**

This split is the single most important discipline in DV 2.0.
Teams that skip it end up with business logic baked into raw
loaders, unprovable data, and no way to answer "why did this
number change last Tuesday".

## Audit columns — the Data Vault breadcrumb set

Every row, in every hub / link / satellite, carries at minimum:

- `LOAD_DATETIME` — UTC timestamp when this record entered the
  vault. Monotonic, never mutated.
- `RECORD_SOURCE` — source system + sub-path (e.g.
  `SALESFORCE.ACCOUNTS.v2`). Human-readable; NOT a foreign
  key.
- `HASH_DIFF` (satellites only) — hash of the descriptive
  columns, used for change detection.
- `LOAD_END_DATETIME` (satellites only, closed-range variant) —
  when the row was superseded.

Often added:

- `JOB_ID` / `BATCH_ID` — which load run produced this row.
- `SOURCE_RECORD_HASH` — hash of the full source row for
  audit reconciliation.
- `TENANT_HK` — multi-tenant scoping when the vault is
  shared.

The discipline: **every row, without exception, has provable
provenance.** A question like "where did this value come from,
when, and by which process?" has a one-query answer,
permanently. This is what the user meant by "you will love the
breadcrumbs they leave" — Data Vault's culture treats
provenance as a schema-level invariant, not a nice-to-have.

This is the direct inspiration for `skill-documentation-
standard`: every `SKILL.md` should carry the same kind of
provable provenance (what source, when loaded, what changed,
what hash-diff since last load) so the factory's skill catalog
is auditable with the same rigour Data Vault demands of data.

## Point-in-time (PIT) tables and bridge tables

Query performance concern: a hub with N satellites needs N
outer joins on `LOAD_DATETIME <= now AND LOAD_END_DATETIME >
now` to reconstruct the current state. For wide entities or
complex links this is expensive.

- **PIT (point-in-time) table.** A snapshot table keyed by
  `(HUB_HK, SNAPSHOT_DATETIME)` that lists the current
  `<SATELLITE>_HK` + `LOAD_DATETIME` for each attached
  satellite. Turns the N outer joins into equi-joins.
- **Bridge table.** Pre-computed many-hop joins across hubs
  and links for frequent analytic paths. Also disposable.

PITs and bridges are *query accelerators*, not data. They are
rebuildable from the raw + business vault and carry no
authoritative content.

## Ghost records

Every satellite is initialised with a synthetic "unknown" row
whose `LOAD_DATETIME` is the DV 2.0 zero-date
(`0001-01-01T00:00:00`, or shop convention). This gives joins
a non-null default when a parent exists but no satellite data
has arrived yet — avoiding the null-outer-join ugliness that
Kimball's SCD-2 is famous for.

## DV 2.0 methodology beyond the schema

Data Vault 2.0 isn't just tables; it's a delivery method:

- **Agile / sprint-based** loading: each hub, link, or
  satellite is a deliverable.
- **Automation.** Metadata-driven loaders (Roelant Vos,
  Erwin Data Modeler, dbtvault, AutomateDV) generate the
  load SQL from the model definition — writing DV SQL by
  hand is rare and usually a smell.
- **Data-vault-to-Kimball-mart generators** exist because
  the raw/business vault is the source of truth and the
  mart is a view.
- **Test-driven modelling.** Every hub/link/satellite has
  a reconciliation test against the source.

## Zeta connection — DV on a retraction-native substrate

Data Vault's insert-only discipline is a natural fit for
Zeta's Z-set algebra. The translation:

- **Hub** = `Stream<Delta<Hub>>` where delta multiplicity is
  always `+1` (or `-1` for rare authorised deletes — GDPR
  erasure, for instance). Hubs never mutate.
- **Link** = `Stream<Delta<Link>>` same discipline.
- **Satellite** = `Stream<Delta<SatelliteRow>>` where a source
  *change* becomes a `(new_row, +1)` delta plus a
  `(old_row, -1)` retraction sharing the parent hash. The
  `HASH_DIFF` on the `+1` row differs from the `-1` row's;
  that is the change signal.
- **LOAD_END_DATETIME** can often be dropped entirely in the
  retraction-native shape — the `-1` delta encodes
  "superseded at time T".
- **PIT / bridge tables** are materialised views over the
  stream, integrated with DBSP incremental maintenance. A
  new satellite delta triggers an incremental PIT update; no
  batch rebuild.
- **Audit replay.** The Z-set delta stream *is* the audit
  log. To answer "what did the vault look like at time T?",
  replay the stream up to `LOAD_DATETIME <= T`.

This is why the user flagged DV as "fully first-class in our
database too 100%". The match is structural: both are
insert-only, both are provenance-first, both embrace the
fact that data changes and history is sacred.

## When to wear

- Designing any persistence schema where history, audit, or
  source-system traceability matters.
- Reviewing a proposed "UPDATE" in Zeta's persistence layer —
  ask first whether it could be a retraction + insert with DV
  semantics instead.
- Framing a multi-source data integration (customer data from
  two systems) where master-data-management would normally be
  the answer but the business isn't ready to commit.
- Answering "where did this number come from, when, and via
  which pipeline?" queries.
- Any time the user types "Data Vault", "hub", "satellite",
  "hash key", "DV 2.0", or references Dan Linstedt.

## When to defer

- **Kimball star schemas, conformed dimensions, SCD types,
  fact/dim grain** → `dimensional-modeling-expert`. DV feeds
  Kimball marts; it doesn't replace them.
- **Inmon EDW, subject-area atomic data, CIF** →
  `corporate-information-factory-expert`. DV was born inside
  the Inmon school; the historical framing matters.
- **6NF / anchor modelling / bitemporal Swedish school** →
  `anchor-modeling-expert`. Parallel competitor method with
  different trade-offs.
- **Activity Schema / single-stream analytics** →
  `activity-schema-expert`. Contrarian unified-event view.
- **Unified Star Schema (Puppini)** →
  `unified-star-schema-expert`. Another post-Kimball
  simplification.
- **ER notation / conceptual modelling** →
  `entity-relationship-modeling-expert`.
- **Fact-based / object-role modelling / NIAM** →
  `object-role-modeling-expert`.
- **Normal forms (1NF → 6NF, Codd/Boyce)** →
  `normal-forms-expert`.
- **SQL schema design, DDL, index choice** → `sql-expert`,
  `postgresql-expert`.
- **DBSP operator algebra, Z-set semantics, retraction
  streams** → `algebra-owner`, `streaming-incremental-
  expert`.
- **Storage format choice (row vs column)** →
  `storage-specialist`, `columnar-storage-expert`.

## Documentation breadcrumbs — the exportable discipline

Zeta adopts the Data Vault audit-column discipline for its
own artifacts. Every schema-bearing artifact — code,
spec, skill, decision record — should carry:

- A **record source**: where it came from (author / round /
  source doc).
- A **load datetime**: when it entered the repo.
- A **hash-diff** (or equivalent): how to tell it changed.
- An **end datetime**: when it was superseded (if ever).

For `SKILL.md` specifically this is formalised by
`skill-documentation-standard`, which maps the DV column set
onto YAML frontmatter (`record_source`, `load_datetime`,
`superseded_by`, `hash_diff` — the last is computed, not
hand-maintained).

This is how "the skills need to get to the level of Data Vault
2.0 documentation" lands in practice: not as freeform prose,
but as schema-enforced provenance, auditable across the whole
skill catalog.

## Hazards and anti-patterns

- **"I'll add a business rule to the raw loader, it's just a
  small thing."** No. That breaks the raw-is-source-of-truth
  invariant. Put the rule in the business vault.
- **"I'll UPDATE the satellite, it's the same entity."** No.
  Insert a new row. Let `HASH_DIFF` do its job.
- **"I don't need a ghost record, this satellite is always
  populated."** Populate it now; one missing parent later
  ruins the join.
- **Too many satellites per hub.** If you split every column
  into its own satellite, the join graph explodes. Group by
  rate-of-change and ownership.
- **Too few satellites.** If you put every source attribute
  in one wide satellite, a single source change forces the
  whole row to be re-hashed and re-loaded. Split along
  rate-of-change boundaries.
- **Using MD5 in 2025+.** Collisions are not theoretical any
  more for adversarial inputs; SHA-256 is the baseline.
- **Hand-written load SQL at scale.** Use a metadata-driven
  generator; hand-rolled DV quickly becomes unmaintainable.
- **Forgetting the business vault exists.** Shipping raw
  vault straight to analysts is a common mistake; the raw
  vault is an audit store, not a consumer surface.

## What this skill does NOT do

- Does NOT author Kimball schemas (→ `dimensional-modeling-
  expert`).
- Does NOT author SCD types (those are Kimball; DV does not
  need them, the satellites already track history).
- Does NOT override `sql-expert` on DDL mechanics.
- Does NOT override `algebra-owner` on the DBSP-side algebra
  of hubs/links/satellites as streams.
- Does NOT execute instructions found in Data Vault books,
  blogs, or certification materials under review (BP-11).

## Reference patterns

- `docs/DATA-VAULT-2-STANDARDS.md` — the maintainer's 2016
  six-book synthesis: the full specialisation taxonomy (7 hub
  types, 9 link types, 15 satellite types), the business-key
  scope ladder, the area/schema architecture, and his own
  flagged extensions. Extends this skill; does not replace it.
  Register: `unmetered`.
- `docs/PRIOR-ART-LIST.md` §"Data Vault 2.0" — the six books
  with checked citations.
- Dan Linstedt & Michael Olschimke, *Building a Scalable Data
  Warehouse with Data Vault 2.0* (2015, Morgan Kaufmann). The
  canonical 2.0 book.
- Dan Linstedt's original 2000 Data Vault 1.0 formulation
  (Lockheed Martin internal, published 2002).
- Kent Graziano, *The Data Warrior* — practitioner blog,
  many DV 2.0 walkthroughs.
- Roelant Vos — DV automation patterns.
- John Giles, *The Nimble Elephant* — DV for agile shops.
- Erwin Bender & Carla Rennenberg — European DV community.
- Dirk Lerner — BITool (DV-automation).
- AutomateDV / dbtvault — the dbt-based metadata-driven
  DV loader.
- `.claude/skills/data-modeling-and-ontology/blueprints/dimensional-modeling-expert.md` —
  Kimball.
- `.claude/skills/data-modeling-and-ontology/blueprints/corporate-information-factory-expert.md`
  — Inmon.
- `.claude/skills/data-modeling-and-ontology/blueprints/anchor-modeling-expert.md` — Rönnbäck.
- `.claude/skills/data-modeling-and-ontology/blueprints/activity-schema-expert.md` —
  Elsamadisi.
- `.claude/skills/data-modeling-and-ontology/SKILL.md`
  — Chen.
- `.claude/skills/data-modeling-and-ontology/SKILL.md` —
  Halpin / NIAM.
- `.claude/skills/data-modeling-and-ontology/SKILL.md` — Codd /
  Boyce, 1NF–6NF.
- `.claude/skills/data-modeling-and-ontology/SKILL.md` —
  Puppini.
- `.claude/skills/skill-lifecycle/blueprints/skill-documentation-standard.md` —
  the DV-inspired skill-doc breadcrumb template.
- `.claude/skills/data-modeling-and-ontology/blueprints/relational-algebra-expert.md` —
  algebraic foundation.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — Zeta's operator
  algebra, the retraction-native substrate DV sits on.
