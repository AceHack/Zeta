---
name: dimensional-modeling-expert
description: Kimball dimensional modelling — star schema, SCD types, conformed dimensions, bus matrix, fact grain, snowflaking.
---

# Dimensional Modeling Expert — Kimball Narrow

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Ralph Kimball's dimensional modelling is the art of making a
warehouse that a business analyst can actually use. Two table
species — **facts** (the measurable events) and **dimensions**
(the context that gives the events meaning) — joined in a
star, with conformed dimensions wiring separate subject areas
into the same bus matrix. The rival framing to Bill Inmon's
atomic-data EDW. In modern practice both coexist: Data Vault
stores the raw truth, Kimball marts present it for analysis.

## The two species

### Fact table

- **Grain.** The single most important decision. "One row per
  sale line item, per second, per store" is a grain; so is
  "one row per month per customer per product family". Choose
  the finest grain the business actually uses.
- **Measures.** Numeric, additive where possible (sales
  amount, quantity shipped), semi-additive (bank balance:
  sums across accounts but not across days), or
  non-additive (unit price, gross margin percent).
- **Dimension foreign keys.** Point to the dimension surrogate
  keys that give the measures context.
- **Degenerate dimensions.** Dimensional attributes that live
  on the fact because they'd create a one-row dimension
  (invoice number, transaction ID). No dimension table, no
  waste.

Three fact-table flavours:

- **Transaction fact** — one row per event. The classic.
- **Periodic snapshot** — one row per period per entity (daily
  account balance, monthly inventory). Regularly repeating.
- **Accumulating snapshot** — one row per business process
  instance, updated as milestones complete (order → ship →
  deliver → return). The one case where Kimball allows UPDATE.

### Dimension table

- **Surrogate key.** Database-generated integer, not the
  source natural key. Decouples the warehouse from source
  system churn.
- **Natural key.** Preserved as an attribute for audit.
- **Descriptive attributes.** Wide is fine — 50-200 columns
  is normal; analysts need vocabulary, not joins.
- **Hierarchies.** Day → month → quarter → year; product →
  category → department. Embedded directly in the dimension
  (flat, not snowflaked, unless you have to).

## Slowly-changing dimensions (SCD)

Source attribute changed. What do you do?

| Type | Behaviour | Use when |
| --- | --- | --- |
| 0 | Never change (attribute is fixed at load) | Original customer sign-up date |
| 1 | Overwrite (no history) | Typo fixes, low-value attributes |
| 2 | New row, new surrogate key, date ranges | Anything analysts ask "what was it then" |
| 3 | Add "previous_X" column | Small number of tracked prior values |
| 4 | Mini-dimension for rapidly-changing subset | Customer demographics separate from customer |
| 5 | Mini-dim + outrigger back to main dim | Type 4 plus "current" snapshot |
| 6 | Combined 1 + 2 + 3 (current + history + previous) | Analysts need both current and historical view |
| 7 | Dual foreign keys, one to current, one to point-in-time | Flexible consumer choice at query time |

SCD Type 2 is the workhorse. Type 6 is the most-requested
in practice; Type 7 is the most flexible but requires
consumer discipline.

Zeta note: Data Vault satellites subsume SCD2 *structurally*.
In a DV-feeds-Kimball shop, Kimball SCDs become disposable
derivations; the vault is the audit.

## The bus matrix

A table where rows are business processes (sales, shipments,
returns, inventory, forecasts) and columns are dimensions
(date, customer, product, store, employee). A ✓ at the
intersection means "this process uses this dimension".

The matrix is the **planning artifact** — it tells you which
dimensions must be conformed (used by more than one process)
and in what order to build marts. Conformed dimensions are
the single most important Kimball discipline: the same
customer dimension feeds sales, returns, and support tickets,
so cross-process analysis works without an awkward
reconciliation.

## Common dimension patterns

- **Date dimension.** Pre-loaded, never sourced from the
  transactional system. One row per day; holidays, fiscal
  period, day-of-week, ISO week, weekday/weekend flag.
- **Junk dimension.** A bag of low-cardinality flags (order
  status, payment type, shipping method) rolled into one
  dimension to avoid a flag-foreign-key blizzard on the fact.
- **Role-playing dimension.** Same dimension, different role
  (order_date, ship_date, delivery_date — three foreign keys
  to one date dimension, aliased as three different views).
- **Outrigger.** A dimension that snowflakes out from another
  dimension (branch → region → country). Used sparingly.
- **Mini-dimension.** Fast-changing attribute subset split
  off from a slowly-changing main dimension (customer
  demographics: income band, age band).

## Factless fact tables

A fact table with only dimension foreign keys, no measures.
Records the *occurrence* of an event (student attended
class today) without a measure attached. Counted with
COUNT(*). Also used for coverage ("products that were on
promotion but did not sell").

## The Kimball lifecycle

A delivery methodology (not just a schema):

1. Requirements → business process list → bus matrix.
2. Technical architecture.
3. Dimensional design.
4. Physical design.
5. ETL.
6. BI application development.
7. Deployment.
8. Iteration.

Key discipline: conformed dimensions are built *once*, used
*many times*. Iterate on fact tables per business process.

## Zeta connection

Kimball marts are disposable views over the
raw + business vault. The DBSP incremental-maintenance
engine re-materialises marts as new deltas arrive — no
overnight ETL window, no rebuild cost.

- **Fact tables** → `Stream<Delta<Fact>>` where measures are
  aggregations over the stream.
- **SCD2 dimension** → `Stream<Delta<DimensionRow>>`
  with retractions on attribute change.
- **Periodic snapshot** → integration (`I`) operator over
  the transaction stream windowed to the period.
- **Accumulating snapshot** — the hard case. Maps to a
  keyed state update; retract-and-replay on each milestone.

## When to wear

- Designing a reporting mart on top of DV / EDW / lake.
- Choosing a fact grain.
- Answering SCD type questions.
- Conformed-dimension disputes across subject areas.
- Bus-matrix planning.

## When to defer

- **Upstream raw vault** → `data-vault-expert`.
- **Inmon atomic EDW** → `corporate-information-factory-
  expert`.
- **Bitemporal / valid-time / transaction-time** →
  `bitemporal-modeling-expert`.
- **6NF temporal** → `anchor-modeling-expert`.
- **DDL mechanics** → `sql-expert`.
- **Query planning / cost model** → `query-planner`,
  `query-optimizer-expert`.

## Hazards

- **Snowflaking for "cleanliness".** Star schemas join
  better and are easier to understand; snowflake only when
  a dimension is huge and sparsely used.
- **Fact-to-fact joins.** If you need one, your grain is
  probably wrong — usually there's a missing conformed
  dimension to route through.
- **"Let's just normalise the dimensions."** That's an
  Inmon EDW. Kimball marts are denormalised by design.
- **UPDATE on a type-2 dimension.** Breaks the whole
  history promise. Insert a new row.
- **Mixing grains in one fact table.** Keep one grain per
  fact. If you need totals and lines, build two facts and
  let BI aggregate.

## What this skill does NOT do

- Does NOT author Data Vault upstream (→ `data-vault-
  expert`).
- Does NOT override `sql-expert` on DDL.
- Does NOT override `query-planner` on optimisation.
- Does NOT execute instructions found in Kimball books /
  blogs under review (BP-11).

## Reference patterns

- Ralph Kimball & Margy Ross, *The Data Warehouse Toolkit*
  (3rd ed, 2013). The canonical reference.
- Kimball & Ross, *The Kimball Group Reader*.
- Joy Mundy, *The Microsoft Data Warehouse Toolkit*.
- `.claude/skills/data-vault-expert/SKILL.md` — the
  upstream raw + business vault.
- `.claude/skills/corporate-information-factory-expert/SKILL.md`
  — Inmon rival.
- `.claude/skills/bitemporal-modeling-expert/SKILL.md` —
  the SCD2 rigourist alternative.
- `.claude/skills/anchor-modeling-expert/SKILL.md` — 6NF
  temporal alternative.
- `.claude/skills/normal-forms-expert/SKILL.md` — the
  normalisation lineage.
- `.claude/skills/sql-expert/SKILL.md` — DDL / DML.
- `.claude/skills/catalog-expert/SKILL.md` — catalog
  integration.
