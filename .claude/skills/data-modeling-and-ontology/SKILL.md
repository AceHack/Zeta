---
name: data-modeling-and-ontology
description: Data modeling, warehousing, ontology — Data Vault/dimensional/anchor, master data, lineage, taxonomy, knowledge graphs.
---

# data modeling and ontology

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`data-vault-expert`](blueprints/data-vault-expert.md) — Data Vault 2.0 — hubs/links/satellites, hash keys, raw vs business vault, PIT tables, audit columns, retraction.
- [`anchor-modeling-expert`](blueprints/anchor-modeling-expert.md) — Anchor Modeling — 6NF bitemporal warehousing, per-attribute tables, insert-only provenance, migration-free evolution.
- [`dimensional-modeling-expert`](blueprints/dimensional-modeling-expert.md) — Kimball dimensional modelling — star schema, SCD types, conformed dimensions, bus matrix, fact grain, snowflaking.
- [`activity-schema-expert`](blueprints/activity-schema-expert.md) — Activity Schema — single-stream analytics, customer_stream, temporal patterns, post-Kimball event modelling.
- [`master-data-management-expert`](blueprints/master-data-management-expert.md) — Master data management — golden record, entity resolution, survivorship, MDM styles, dedup, stewardship, GDPR.
- [`corporate-information-factory-expert`](blueprints/corporate-information-factory-expert.md) — Inmon CIF — EDW, subject-oriented atomic store, dependent data marts, Inmon vs Kimball debate, DW/BI 2.0.
- [`data-governance-expert`](blueprints/data-governance-expert.md) — Data governance — stewardship, data contracts, GDPR/HIPAA/SOC2, policy-as-code, RBAC/ABAC, data classification, DSAR.
- [`data-lineage-expert`](blueprints/data-lineage-expert.md) — Data lineage — PROV-O, OpenLineage, column-level provenance, impact analysis, root-cause tracing, retraction-lineage.
- [`data-operations-expert`](blueprints/data-operations-expert.md) — DataOps — pipeline CI/CD, data quality testing, observability, data contracts, CDC, SLAs/SLOs, incident runbooks.
- [`controlled-vocabulary-expert`](blueprints/controlled-vocabulary-expert.md) — Controlled vocabulary — SKOS, preferred/non-preferred labels, scope notes, term lifecycle, synonym expansion, ISO 25964.
- [`taxonomy-expert`](blueprints/taxonomy-expert.md) — "Hierarchical classification — faceted taxonomy, controlled vocabularies, ontology contrast, parent/child relations."
- [`ontology-expert`](blueprints/ontology-expert.md) — Formal knowledge representation — RDF/OWL/SHACL, description logic, upper ontologies, matching, competency questions.
- [`ontology-landing-expert`](blueprints/ontology-landing-expert.md) — Ontology landing — recompilation amortisation, retraction-safe replacement, let-it-emerge vs big-reveal dynamics.
- [`paced-ontology-landing`](blueprints/paced-ontology-landing.md) — Ontology landing workflow — incremental migration across docs/skills/decisions, retraction path, maintainer opt-in gate.
- [`knowledge-graph-expert`](blueprints/knowledge-graph-expert.md) — "Knowledge graphs — RDF/property graphs, SPARQL/Cypher/GQL, Neo4j/Neptune/JanusGraph, supernodes, schema design."
- [`relational-algebra-expert`](blueprints/relational-algebra-expert.md) — Relational algebra — Codd operators, equivalence rewrite laws, DBSP mapping, retraction-native semantics, proof anchors.
