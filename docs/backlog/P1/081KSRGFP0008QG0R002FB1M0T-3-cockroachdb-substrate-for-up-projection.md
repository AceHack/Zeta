---
id: 081KSRGFP0008QG0R002FB1M0T
priority: P1
status: closed
title: "Ace meta-PM: CockroachDB substrate for the up-projection"
tier: substrate-engineering
effort: L
ask: aaron 2026-05-26
created: 2026-05-29
last_updated: 2026-06-13
parent: 081KSGS9H0008QG0R0031PBNGA
depends_on: [081KSKBP80008QG0R002513Q0B]
composes_with: [081KSGS9H0008QG0R0005P83AP, 081KSGS9H0008QG0R002PT5C7J]
tags: [ace-feature, meta-package-manager, cockroachdb, recursive-cte, generator-db]
---

## CockroachDB substrate for the up-projection

This backlog item is a decomposition of [081KSGS9H0008QG0R0031PBNGA](081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md), specifically for Sub-target 7.

### Problem

The meta-package manager needs a persistent, distributed, and queryable storage layer for its generator-based architecture. The REVERSE-holographic generation mechanism, which projects 2D package manager streams into a higher-dimensional view, requires a concrete engineering substrate to run on.

### Task

Implement the CockroachDB substrate for the up-projection mechanism. This involves:

1. **Schema Design**: Design and implement the graph-tables in CockroachDB to store the dependency graph (vertices for packages, edges for relationships).
2. **Generator Implementation**: Implement the up-projection using recursive Common Table Expressions (CTEs) to traverse the graph and generate the higher-dimensional dependency rows.
3. **NULL Escape Hatch**: Ensure that the recursive CTEs correctly use `NULL` as the termination signal for the generator recursion.
4. **Stream Composition**: Implement the pattern for composing streams of CTE outputs to enable the cross-package-manager merge.
5. **Time-Travel Queries**: Integrate with the time-axis substrate ([081KSGS9H0008QG0R002PT5C7J](081KSGS9H0008QG0R002PT5C7J-time-modeled-dependencies-for-helm-clusters-as-long-running-stateful-systems-require-temporal-axis-in-dependency-graph-aaron-2026-05-26.md)) by using CockroachDB's `AS OF SYSTEM TIME` feature for temporal queries.
6. **AI Runbook Integration**: Expose the recursive CTEs as a substrate that AI agents can author and use within their runbooks (composes with 081KSGS9H0008QG0R0005P83AP).

### Acceptance Criteria

* A CockroachDB schema for the dependency graph is created and versioned.
* At least one recursive CTE generator is implemented that can traverse a sample dependency graph.
* The generator correctly terminates using a `NULL` escape hatch.
* A proof-of-concept demonstrates joining the output of two separate generator streams.
* A time-travel query successfully retrieves the state of the dependency graph at a past point in time.
