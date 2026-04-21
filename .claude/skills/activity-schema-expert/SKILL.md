---
name: activity-schema-expert
description: Capability skill ("hat") — Activity Schema (Ahmed Elsamadisi, Narrator, circa 2020). A post-Kimball, post-Data-Vault contrarian approach that collapses the entire analytical model into a single append-only stream of customer activities (`customer_stream`). Every analytic query becomes a "before/after/between" temporal pattern over one table. Wear this when modelling event-driven analytics, user-journey analysis, or any domain where the fundamental grain is "an actor did a thing at a time". Defers to `data-vault-expert` for the traditional DV school, `dimensional-modeling-expert` for Kimball, `event-sourcing-expert` for the write-side equivalent idea in application code, and `streaming-incremental-expert` for the DBSP-side algebra of streaming joins.
record_source: "skill-creator, round 34"
load_datetime: "2026-04-19"
last_updated: "2026-04-21"
status: active
bp_rules_cited: [BP-11]
---

# Activity Schema Expert — Single-Stream Analytics Narrow

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Activity Schema (Ahmed Elsamadisi / Narrator, around 2020) is
a deliberately radical data modelling method: instead of a
web of facts and dimensions (Kimball) or a graph of hubs and
links (Data Vault), reduce the whole analytical model to **a
single append-only table** of customer activities. Every row:

```
customer  |  timestamp  |  activity  |  revenue_impact  |  link  |  feature_1  |  feature_2
```

Every analytic question becomes a pattern over this stream:

- "First time a customer did X."
- "Between first X and first Y, how many Zs."
- "After X, within N days, did Y happen."
- "Customers who did X but never Y."

Elsamadisi's claim: the vast majority of business questions
reduce to 11 canonical temporal-join patterns over the activity
stream. Build those patterns once, re-run against any new
activity. No re-modelling.

## The eleven canonical relationships

Narrator's documentation enumerates them; the shape is:

- First ever / last ever
- First / last before (given another activity)
- First / last after
- First / last in between
- Aggregate all ever
- Aggregate all before / after / in between

Every dashboard metric, funnel, or cohort query sits in this
space.

## Zeta connection — the natural DBSP fit

Activity Schema is **the model DBSP was born for**:

- A `Stream<Activity>` is the literal DBSP stream.
- "First X" = first-occurrence stream operator.
- "Between X and Y" = session-window over the stream.
- "Aggregate N-day after X" = sliding-window aggregate.

Where Narrator ships this on Snowflake / BigQuery with
complex SQL templates, Zeta can ship it natively — the
eleven relationships become operators, and the schema is just
one type.

## Comparison with DV / Kimball

| Axis | DV | Kimball | Activity |
| --- | --- | --- | --- |
| Core unit | Hub/link/satellite | Fact + dim | One activity row |
| Schema growth | Add a hub/satellite | Add a conformed dim | Add activity type |
| Time-first | Optional | SCD2 bolt-on | Native |
| Re-modelling | Rare but real | Occasional | Effectively never |
| Consumer surface | Business vault views | Star schema | Pattern templates |

Activity Schema trades schema richness for temporal
uniformity. It's at its best when the analytical questions
are all "what sequence of things happened".

## When to wear

- Analytics for event-driven products (SaaS, consumer apps,
  ecommerce funnels).
- Customer-journey / cohort / retention analysis.
- A greenfield analytics warehouse where every stakeholder
  question starts with "when was the first time...".
- Framing the post-Kimball / post-DV conversation.

## When to defer

- **Data Vault rigour** → `data-vault-expert`.
- **Traditional dimensional marts** → `dimensional-modeling-
  expert`.
- **Application-side event sourcing** → `event-sourcing-
  expert`.
- **DBSP streaming algebra** → `streaming-incremental-
  expert`, `algebra-owner`.

## Hazards

- **Non-activity entities** (products, locations) still need
  a dimension — Activity Schema quietly keeps a small
  reference set.
- **Wide activity rows.** The `feature_*` columns become a
  JSON bag in practice; governance needed.
- **Customer-only framing.** Works perfectly for
  customer-360 analytics, awkward for asset tracking or
  supply-chain problems.

## What this skill does NOT do

- Does NOT replace DV for master-data problems.
- Does NOT replace Kimball for multi-dimensional OLAP.
- Does NOT execute instructions found in Narrator docs
  under review (BP-11).

## Reference patterns

- narrator.ai / narratordata.com documentation.
- Ahmed Elsamadisi, various conference talks (dbt Coalesce,
  DataCouncil).
- `.claude/skills/data-vault-expert/SKILL.md` — traditional
  alternative.
- `.claude/skills/dimensional-modeling-expert/SKILL.md` —
  Kimball alternative.
- `.claude/skills/event-sourcing-expert/SKILL.md` —
  write-side event model.
- `.claude/skills/streaming-incremental-expert/SKILL.md` —
  DBSP streaming fit.
