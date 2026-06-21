# ADR: Git-native event store with self-describing 128-bit ZetaIDs

**Status:** accepted
**Date:** 2026-05-29
**Backlog:** 081KSE6WT0008QG0R003YYC9PV

## Context & Problem Statement

Standard event-sourcing and stream-processing databases (e.g. EventStoreDB, NATS, Kafka, PostgreSQL) require dedicated server runtimes and operational infrastructure. This introduces significant cloud hosting costs, maintenance overhead, and proprietary vendor lock-in.

For the Zeta codebase—where all systems are agent-designed and vibe-coded—we require a highly performant, serverless, zero-maintenance, and completely free event store. It must function seamlessly both in the cloud (leveraging GitHub’s public open-source subsidies) and fully offline (running on bare metal homelab clusters).

To coordinate a decentralized swarm of active agent and human loops without centralized locks, we need an event store that guarantees:

1. **Absolute collision-freedom** during concurrent pushes.
2. **Deterministic chronological ordering** across independent writers.
3. **Instant, zero-lookup conceptual indexing** of related files and entities directly from the identifier space.

## Considered Options

* **Option 1: Centralized SQL/NoSQL Database (PostgreSQL/SQLite/MongoDB)** — Storing event logs inside an external database file or runtime server.
* **Option 2: Git-Native Event Store + Self-Describing 128-bit ZetaIDs** — Storing event logs as flat, append-only files inside Git, addressed by self-describing 128-bit identifiers that encode timestamp, concept category prefix, and entropy.

## Pros & Cons of the Options

### Option 1: Centralized SQL/NoSQL Database

* **Pros:** Traditional SQL query syntax, out-of-the-box secondary index support.
* **Cons:** High operational overhead, require active database server infrastructure, highly prone to merge conflicts when checking database binaries into Git.

### Option 2: Git-Native Event Store + Self-Describing 128-bit ZetaIDs

* **Pros:**
  * **100% Free:** Leverages standard Git history as an infinite, distributed, replicated database with built-in versioning and auditing for zero marginal cost.
  * **Collision-Free Pushes:** massive 128-bit address space guarantees that concurrent agent loop pushes never clash.
  * **Self-Describing Contextual Pointers:** By encoding explicit **concept category bits** (the "extra bits") directly into the 128-bit ZetaID bitfield, the ID itself resolves what entity or file type it maps to without needing an external lookup index.
* **Cons:** Querying requires scanning and parsing flat JSON files (mitigated by time-ordered path structures).

## Decision Outcome

* **Chosen Option:** Option 2: Git-Native Event Store + Self-Describing 128-bit ZetaIDs, because it enables a completely free, highly decentralized, and lock-free event sourcing architecture. By partitioning the 128-bit ZetaID space into:
  - **Timestamp bits** for chronological sorting.
  - **Category/Concept bits (the "extra bits")** for inline conceptual indexing.
  - **Entropy bits** for concurrency safety.
  
  We convert our Git repository into a lock-free, zero-coordination event-sourced graph database.
* **Consequences:**
  * **Positive:** Complete physical independence from database server infrastructure. Infinite, free database hosting backed by GitHub. Zero merge conflicts during parallel swarm writes.
  * **Negative/Costs:** Requires implementing a unified, highly optimized 128-bit `ZetaID` bit-shifting parser/serializer in both our F# Core and TypeScript libraries.
