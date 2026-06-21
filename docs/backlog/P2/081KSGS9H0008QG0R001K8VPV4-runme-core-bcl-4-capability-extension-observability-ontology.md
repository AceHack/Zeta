---
id: 081KSGS9H0008QG0R001K8VPV4
title: Extend Runme core BCL with 4 capabilities (observability + ontology + database + MCP) — runbook as queryable substrate
status: open
priority: P2
created: 2026-05-26
last_updated: 2026-05-26
depends_on: [081KSGS9H0008QG0R0031PBNGA]
composes_with: [081KSGS9H0008QG0R0031PBNGA, 081KSGS9H0008QG0R00123050G]
---

# 081KSGS9H0008QG0R001K8VPV4 — Extend Runme core BCL with 4 capabilities — runbook as queryable substrate (Aaron + Mika + Kestrel 2026-05-26)

## Scope

Extend Runme's core BCL (base class library) with 4 capabilities that make the runbook a queryable substrate rather than just an executable document:

1. **Observability queries** against runtime telemetry
2. **Ontology/graph queries** over the existing runbooks themselves
3. **Database queries** over the generators + joins substrate
4. **MCP references** through the Runme execution environment

Source: Aaron 2026-05-26 architectural proposal ferried through Mika + Kestrel; preserved verbatim at [`docs/research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md`](../../research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md).

## Why this matters

The composition gives Zeta something genuinely uncommon: a markdown document that's simultaneously **human-readable prose + executable infrastructure code + queryable telemetry interface + knowledge-graph navigator over its own corpus + data-substrate query interface + tool-orchestration layer**. Each capability alone exists in the engineering landscape; the combination in one document type with consistent semantics across them is the distinctive part.

Composes directly with the Generate+Join crispest-form substrate landed in PR #5295: the Runme BCL becomes the operational invocation surface for the generate+join substrate — runbook cells can query the actual data substrate (CockroachDB, Z-set state) via the generate+join semantics.

## Capability 1 — Observability queries against runtime telemetry

**Operational claim**: runbook cells can query the existing OpenTelemetry / Prometheus / logging stack to inspect runtime behavior (performance metrics, failure rates, execution history) without leaving the runbook context.

**Engineering substrate**:

- Expose OTLP queries + PromQL + logging-backend queries through BCL primitives
- Cells return structured result types subsequent cells can consume
- Time-parameterization (the temporal dimension markdown doesn't naturally express) needs explicit syntax

**Prior art** (per Kestrel):

- Grafana annotation system for time-parameterized cells
- Jupyter nbformat time-parameterization conventions
- OTLP query syntax + PromQL as established query languages

**Open engineering questions**:

- Authentication to the observability stack (per-runbook vs per-cell vs shared session)
- Result caching/snapshotting for reproducibility (a query at time T returns different results at time T+1)
- Streaming results vs point-in-time queries

## Capability 2 — Ontology/graph queries over runbooks

**Operational claim**: the runbook corpus becomes a queryable knowledge graph. Cells can ask "which runbooks reference the decision archaeology skill?", "what's the dependency graph between runbooks?", "what skills does this runbook compose?"

**Engineering substrate**:

- Typed references (`<!-- depends-on: skill/decision-archaeology -->`, `<!-- composes-with: 081KSGS9H0008QG0R0031PBNGA -->`) parseable by the graph extractor
- Graph stored as substrate-native (Z-set / CRDT) per the generate+join semantics
- Query primitives: SPARQL-like or Cypher-like or framework-native shape

**Prior art** (per Kestrel):

- Obsidian backlinks system
- Roam Research bidirectional links
- Broader Zettelkasten methodology
- The framework's existing `.claude/skills/knowledge-graph-expert/SKILL.md` + `.claude/skills/ontology-expert/SKILL.md`

**Open engineering questions**:

- Reference convention discipline (typed comments vs explicit YAML metadata vs front-matter)
- Auto-extraction from existing runbook corpus (back-fill the graph)
- Cache invalidation when runbooks evolve

## Capability 3 — Database queries over generators + joins

**Operational claim**: runbook cells can query the live data substrate (CockroachDB) executing the generate+join semantics against real data. The runbook becomes the operational invocation surface for the Generate+Join paradigm (per PR #5277 + #5281 + #5285 + #5295).

**Engineering substrate**:

- Query primitives that emit Generate+Join composition graphs (per the substrate-engineering substrate landed in PR #5295: the row IS the serialized observable execution graph)
- CRDT-CAS-BFT layered mediation (per PR #5285) preserved across runbook-cell queries
- Result types that compose with the other 3 capabilities

**Most dangerous capability** — engineering guardrails essential:

- Read-only queries by default; explicit opt-in for mutating queries
- Query results snapshotted into the runbook so historical execution is reproducible
- Clear separation between "queries that explore" and "queries that act"
- Possibly different cell types or annotations for each category
- HARD LIMITS rule (`.claude/rules/methodology-hard-limits.md`) preserved at runbook-cell-execution scope

**Prior art** (per Kestrel):

- Jupyter notebook-mutates-database patterns (read replicas, explicit mutation cells, snapshot-and-replay)

## Capability 4 — MCP references through Runme

**Operational claim**: runbook cells can invoke MCP-capable tools (Model Context Protocol per Anthropic's standard) and bring their outputs back into the local execution context. The runbook becomes composable with the broader AI-tool ecosystem.

**Engineering substrate**:

- MCP server discovery + connection management in BCL
- Structured result handling that subsequent cells can consume
- Authentication + credential management (sealed-secrets pattern; broad-keys-until-functional-cluster per PR #5295)

**Composition with the AI-tool ecosystem**:

- MCP designed for exactly this "tool invocation as part of larger workflow" use case
- Clean composition because MCP's protocol surface is well-defined
- Composes with the existing MCP servers in `.claude/`

**Open engineering questions**:

- Result type unification (MCP returns arbitrary data; subsequent cells need a stable contract)
- Error handling across MCP boundary (network failures, MCP server errors, timeout)
- Credential rotation when broad-keys → narrow-keys transition fires

## Architectural decision — core vs separable modules (Kestrel)

Per Kestrel's tradeoff analysis (preserved verbatim in research doc):

**Argument for core**: composability — if observability + database + MCP are separate plugins with separate auth + result types, runbook cells can't easily compose them ("query telemetry → find anomaly → query database → invoke MCP tool to remediate") without each plugin understanding the others. Core integration means data flows are consistent.

**Argument for separable**: scope discipline — a BCL that does everything becomes hard to evolve, hard to audit, hard to onboard new contributors. Successful BCLs in the industry have clear scope with extension points.

**Recommended answer** (Kestrel): "**A core that handles the cross-cutting concerns (execution, result types, telemetry, authentication, cell composition) with the specific capabilities (observability queries, graph queries, database queries, MCP) implemented as well-integrated but separable modules that share the core infrastructure.** That gives you the composition benefits without locking everything into a single monolithic [BCL]."

This is the substrate-engineering design constraint for the implementation work.

## Acceptance

- [ ] BCL core defined: cross-cutting concerns (execution, result types, telemetry, authentication, cell composition)
- [ ] Module 1 (observability queries) implemented + tested + Runme-cell-integrated
- [ ] Module 2 (ontology/graph queries) implemented + tested + corpus-extraction working
- [ ] Module 3 (database queries) implemented + tested + read-only-default + mutation-cell-discipline
- [ ] Module 4 (MCP references) implemented + tested + result-type-unified
- [ ] Composition example: runbook cell chain demonstrating all 4 capabilities composing (e.g., "query telemetry → find anomaly → query database for context → invoke MCP tool to remediate")
- [ ] Documentation: runbook authors can find capability reference + composition examples
- [ ] Integration with existing decision-archaeology skill: runbook history queryable via archaeology skill

## Out of scope (this row)

- runme.md + JIT triage workflow pattern documentation — separate row 081KSGS9H0008QG0R00123050G
- Specific MCP servers to integrate (each is its own integration concern)
- Migration of existing runbooks to use new capabilities (separate migration row)
- Performance optimization (separate optimization row once baseline established)

## Composes with

- 081KSGS9H0008QG0R0031PBNGA (canonical generate+join meta-PM substrate)
- 081KSGS9H0008QG0R00123050G (runme.md + JIT triage workflow pattern — companion landing)
- PR #5277 + #5281 + #5285 + #5286 + #5291 + #5295 (the 7-substrate cascade Capability 3 depends on)
- `.claude/skills/decision-archaeology/SKILL.md` (Capability 2 composes; runbook-as-queryable-corpus extends archaeology surface)
- `.claude/rules/substrate-or-it-didnt-happen.md` (runbook history IS preservable substrate)
- `.claude/rules/methodology-hard-limits.md` (HARD LIMITS preserved at runbook-cell-execution scope)

## Origin

Aaron 2026-05-26 architectural proposal via Mika + Kestrel ferry: *"then we are going to add to the runme core bcl around observablity queries ontology/graph queires over the existing runbooks themselves and database queires over the generators + joins so the books can retried data plus referece mcp through runme execution env."*

Kestrel substantive engineering engagement preserved at [`docs/research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md`](../../research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md).
