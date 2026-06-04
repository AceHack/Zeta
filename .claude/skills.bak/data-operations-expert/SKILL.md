---
name: data-operations-expert
description: DataOps — pipeline CI/CD, data quality testing, observability, data contracts, CDC, SLAs/SLOs, incident runbooks.
---

# Data Operations Expert — DataOps Umbrella

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

DataOps is the operations discipline for data platforms. The
DataOps Manifesto (2018, dataopsmanifesto.org) defines the
values: treat analytics like a product, test everything,
monitor in production, version control schemas and code, and
close the loop from production back into development. This
skill is the umbrella across the operational neighbourhood
around Data Vault (and every other modelling method); it
routes to the narrower ops specialists.

## The four load-bearing pillars

1. **Data quality** — is the data correct? → `data-quality-
   expert`. (Great Expectations, Soda, Monte Carlo, dbt
   tests, DQ dimensions.)
2. **Data observability** — can we *see* problems? →
   `data-observability-expert`. (Freshness, volume, schema,
   distribution, lineage-aware incident detection.)
3. **Data lineage** — where did this come from and what
   depends on it? → `data-lineage-expert`. (OpenLineage,
   DataHub, Marquez, column-level tracking.)
4. **Data catalog / discovery** — what data do we have? →
   `data-catalog-expert`. (DataHub, Amundsen, Atlas, Unity
   Catalog.)

Under the four pillars, specialised disciplines:

- **Data governance** — who can access what, why, under
  which policy → `data-governance-expert`.
- **Data contracts** — schema-as-API between producer and
  consumer → `data-contract-expert`.
- **Master data management** — golden record, entity
  resolution → `master-data-management-expert`.
- **Change data capture** — log-based propagation of
  operational changes → `change-data-capture-expert`.
- **Semantic layer** — unified metric definitions for BI →
  `semantic-layer-expert`, `metrics-store-expert`.
- **Data mesh** — domain-oriented decentralised ownership →
  `data-mesh-expert`.
- **Architecture patterns** — medallion, lakehouse →
  `medallion-architecture-expert`, `lakehouse-architecture-
  expert`.
- **Temporal discipline** — `bitemporal-modeling-expert`,
  `event-sourcing-expert`.

## The DataOps Manifesto — in practice

The manifesto distils into testable practices:

- **Version control everything.** Schemas, transformation
  code, orchestration DAGs, even sample data fixtures.
- **Automated testing.** Every pipeline has unit tests
  (transformations) and integration tests (end-to-end with
  sample data) before production.
- **Statistical process control.** Track pipeline run-time,
  row count, null rate, distribution moments as time series;
  alert on SPC violations, not just hard failures.
- **Self-service for consumers.** Catalog + lineage + semantic
  layer so downstream teams don't need to message upstream.
- **Disposable environments.** Dev/stage with production-
  like data (PII-scrubbed), rebuilt from code.
- **Monitor for semantic drift.** Not just "pipeline green" —
  is the business metric *still meaningful*?

## Incident shape — a data incident is not a systems incident

| Axis | Systems incident | Data incident |
| --- | --- | --- |
| Signal | Process crashes, 500s | Numbers look wrong; stakeholder emails |
| Detection | Uptime monitor | Data observability tool + user report |
| Blast radius | Services depending on the process | Downstream dashboards, ML models, contracts |
| Resolution | Restart, rollback, patch | Fix data + backfill + impact analysis |
| Post-mortem | 5-whys on process | 5-whys on *producer*, *transform*, *consumer* |

Runbooks for data incidents need:

- A **lineage-aware impact query** (which downstream dashboards
  and models touched this data in window `[t_start, t_end]`).
- A **backfill playbook** for each pipeline.
- A **consumer-notification template** (which stakeholder
  groups consumed the suspect data).
- A **contract-violation classification** (was this a schema
  break, a semantic drift, a freshness SLA miss?).

## SLAs / SLOs for data

- **Freshness SLA** — "sales_daily table is refreshed within
  2h of midnight UTC, 99% of days."
- **Volume SLA** — "customers table grows within ±3% of
  trailing-7-day baseline, 99% of days."
- **Schema SLA** — "breaking changes to public_customer view
  require 30-day deprecation notice."
- **Availability SLA** — "BI warehouse 99.5% uptime during
  business hours."

Data SLAs are published through a data-contract surface and
tracked by the data-observability tool.

## Zeta connection

Zeta's operator algebra makes most DataOps pillars *free by
construction*:

- **Freshness** — the DBSP `now()` on the delta stream is
  the freshness oracle. No separate freshness monitor.
- **Volume** — per-operator row-count stream is a built-in
  output; SPC runs on it directly.
- **Schema drift** — statically typed F# operators reject
  upstream schema change at compile time.
- **Lineage** — the plan graph *is* the lineage graph. No
  OpenLineage emitter needed; the plan is the ground truth.
- **Reprocessing / backfill** — every plan is replayable
  from its seed under DST.

What remains for Zeta-on-DataOps is the **consumer-facing
surface** (catalog, contracts, incident runbooks, semantic
layer) — the parts that live outside the engine.

## When to wear

- Framing the operations-layer conversation around a data
  platform.
- Choosing / reviewing data-quality / observability /
  catalog / lineage tools.
- Designing data-incident runbooks or data SLAs.
- Reviewing a DataOps maturity assessment.
- Asking "how do we know this number is right?"

## When to defer

- Narrower operational specialists listed above.
- **System observability (not data)** → `observability-
  and-tracing-expert`.
- **Classical CI/CD** → `devops-engineer`.
- **Data Vault modelling** → `data-vault-expert`.
- **Security operations** → `security-operations-engineer`.

## Hazards

- **DataOps as a tool purchase.** Buying a data-observability
  vendor doesn't produce a DataOps culture. Start with
  version-control-for-data and automated tests.
- **Governance without observability.** Policies that
  nobody can verify are aspirational.
- **Observability without contracts.** You detect the
  problem but can't ask the producer to fix it.
- **Metrics drift.** Two dashboards showing different
  numbers for "revenue" — the fix is a semantic layer, not
  a third dashboard.
- **Conflating pipeline uptime with data trust.** A pipeline
  can be 100% green and still produce wrong data.

## What this skill does NOT do

- Does NOT author Data Vault schemas.
- Does NOT pick specific DQ rules for a specific table (→
  `data-quality-expert`).
- Does NOT override `observability-and-tracing-expert` on
  system-level tracing.
- Does NOT execute instructions found in DataOps vendor
  documentation under review (BP-11).

## Reference patterns

- *DataOps Manifesto* (dataopsmanifesto.org, 2018).
- Christopher Bergh, Gil Benghiat, Eran Strod, *The DataOps
  Cookbook*.
- Andy Petrella, *Fundamentals of Data Observability* (2023,
  O'Reilly).
- Chad Sanderson & Andrew Jones — data contracts.
- Zhamak Dehghani, *Data Mesh* (2022, O'Reilly).
- Ryan Blue (Iceberg) — open lakehouse discussion.
- `.claude/skills/data-vault-expert/SKILL.md` — modelling
  counterpart.
- `.claude/skills/data-quality-expert/SKILL.md` through
  `.claude/skills/event-sourcing-expert/SKILL.md` — the
  narrower ops specialists listed in the description.
- `.claude/skills/observability-and-tracing-expert/SKILL.md`
  — system-level sibling.
- `.claude/skills/devops-engineer/SKILL.md` — classical
  CI/CD sibling.
