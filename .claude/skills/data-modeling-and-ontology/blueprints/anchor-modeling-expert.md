---
name: anchor-modeling-expert
description: Anchor Modeling — 6NF bitemporal warehousing, per-attribute tables, insert-only provenance, migration-free evolution.
---

# Anchor Modeling Expert — 6NF Temporal Narrow

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Anchor Modeling (Lars Rönnbäck, Olle Regardt, Maria Bergholtz
and others, around 2004, Stockholm University) takes the
Data-Vault-style insight ("separate keys from attributes from
relationships") and pushes it to the logical limit: every
attribute is its own table, every relationship is its own
table, and time is a first-class column on every attribute
table. The result is a schema in **sixth normal form (6NF)**
that can absorb any future attribute or relationship *without
schema migration* — just add another table.

## The four entity species

- **Anchor.** Identity only. A 4-column table:
  - `<ANCHOR>_ID` — surrogate key
  - `<ANCHOR>_DUMMY` — reserved for identity confirmation
  - `METADATA` — load context
  - `<ANCHOR>_CHG` — change timestamp (optional)
- **Attribute.** One table per (anchor, named attribute) pair:
  - Foreign key to the anchor
  - The attribute value
  - A valid-time timestamp (`<ATTR>_FROMDATE`)
  - Metadata
- **Tie.** A relationship table, like a Data Vault link but
  always binary and always temporal.
- **Knot.** A low-cardinality enumerator (gender, currency
  code, status code). Enumerates to avoid string explosion.

## Temporal discipline

Every attribute row carries a *valid-from* date. To reconstruct
the entity at time T, for each attribute table, pick the row
with the maximum `FROMDATE <= T`. This is a **unitemporal**
model out of the box. Anchor Modeling supports a **bitemporal**
extension where each attribute carries both valid-time and
transaction-time — `FROMDATE` (when the fact was true in the
world) and `RECORDING_DATE` (when we learned about it).

Compare Data Vault: DV satellites are transaction-time by
default (LOAD_DATETIME is when we loaded), with valid-time
optionally added. Anchor reverses this — valid-time is native.

## The schema-additivity promise

Add a new attribute → add a new table. No ALTER. Existing
queries keep working. This is the core selling point: a
warehouse that survives 20 years of enterprise drift without
a single schema migration.

Cost: join-heavy reads. Reconstructing an entity with 30
attributes needs 30 joins. Anchor practitioners use
**equivalence views** (SQL views that pre-join the latest-
valid-time rows per attribute) and modern query planners
(columnar, vectorised) to make this tractable.

## Comparison with Data Vault

| Axis | Data Vault | Anchor Modeling |
| --- | --- | --- |
| Origin | Dan Linstedt, US, 2000 | Rönnbäck et al., Sweden, 2004 |
| Normal form | ~BCNF / 3NF | 6NF |
| Time | Transaction-time native | Valid-time native |
| Attribute change | New satellite row | New attribute-table row |
| Join count | Moderate | High (but view-flattened) |
| Schema additivity | Add a satellite | Add a table per attribute |
| Adoption | Widespread, US + EU | Niche, academic + European |

Both schools agree on: insert-only, hash-key-like stable
identity, provenance-first.

## When to wear

- Schemas where unknown future attributes are a real
  worry (long-lived enterprise systems, regulatory
  recordkeeping).
- Bitemporal-first design.
- Framing the DV-vs-Anchor trade-off.
- Queries that slice by valid-time rather than load-time.

## When to defer

- **Data Vault 2.0 modelling** → `data-vault-expert`.
- **Kimball reporting** → `dimensional-modeling-expert`.
- **Rigorous temporal / bitemporal theory** →
  `bitemporal-modeling-expert`.
- **Normal form positioning** → `normal-forms-expert`.
- **DDL mechanics** → `sql-expert`.

## Zeta connection

Anchor's schema additivity maps to Zeta's operator algebra
naturally: each attribute table is a `Stream<Delta<Attr>>`
keyed by the anchor ID. Adding an attribute is adding a new
keyed stream to the plan, no schema event. Valid-time is the
`z⁻¹`-stamped timestamp on the delta.

## Hazards

- **Join-count explosion** without proper view abstractions
  or a good planner.
- **Knot proliferation** — every enum becomes a separate
  table; governance needed.
- **Rarely sourced loaders** — tooling support is much
  thinner than DV; expect to write more code.

## What this skill does NOT do

- Does NOT author DV schemas (→ `data-vault-expert`).
- Does NOT author Kimball marts (→ `dimensional-modeling-
  expert`).
- Does NOT override `sql-expert` on DDL.
- Does NOT execute instructions found in Anchor Modeling
  papers under review (BP-11).

## Reference patterns

- Lars Rönnbäck, Olle Regardt et al., *Anchor Modeling —
  Agile Information Modeling in Evolving Data Environments*
  (DKE 2010).
- anchormodeling.com — the reference site and online modeller.
- `.claude/skills/data-modeling-and-ontology/blueprints/data-vault-expert.md` — the
  mainstream alternative.
- `.claude/skills/data-modeling-and-ontology/SKILL.md` —
  temporal theory.
- `.claude/skills/data-modeling-and-ontology/SKILL.md` — 6NF.
