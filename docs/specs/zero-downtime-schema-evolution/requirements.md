# Zero-Downtime Schema Evolution — Requirements

## Introduction

A formally verifiable, reusable schema migration primitive for the Zeta database.
Schema IS a Z-set — evolution is a retraction+insertion delta. Metadata events use a
CloudEvents/Debezium-like CDC envelope. The conformance test suite IS the backward-
compatibility proof. The overlap-window rotation pattern (proven with B-xxxx → ZetaId)
generalizes to any schema change.

## Glossary

- **Schema Z-set:** The metadata schema expressed as entries in a Z-set. Evolution = delta (retract old, insert new).
- **CDC envelope:** CloudEvents-compatible change-data-capture envelope carrying before/after shapes.
- **Overlap window:** The period during which both old and new schemas resolve. Safety: no tick fails. Liveness: the window eventually closes.
- **Conformance suite:** Parameterized tests that run the same assertions against every backend. Passing = proof of backward compatibility.
- **Polyfill:** zeta-fs semantics implemented over os-fs + git. Same interface, traditional storage underneath.

## Requirements

### Requirement 1: Schema expressed as Z-set

**User Story:** As a database operator, I want schema to be a Z-set so that schema evolution uses the same retraction algebra as data evolution, with no special migration machinery.

#### Acceptance Criteria

1. Given a schema definition (fields, types, permissions), when it is stored, then it is represented as entries in a Z-set with weight +1 per field.
2. Given a schema evolution (add field, remove field, change type), when applied, then it is expressed as a Z-set delta: old shape entries at weight -1, new shape entries at weight +1.
3. Given a schema delta applied during the overlap window, when readers fold the schema Z-set, then both old and new field sets are visible (old at net weight -1 pending, new at net weight +1 active).
4. Given the overlap window has closed (all readers migrated), when the old entries are consolidated, then only the new schema remains (zero-weight entries dropped per Z-set semantics).

### Requirement 2: CDC envelope for metadata events (CloudEvents-compatible)

**User Story:** As a system consuming metadata changes, I want schema evolution events delivered in a CloudEvents-compatible CDC envelope so that I can process them with standard event tooling and distinguish before/after shapes.

#### Acceptance Criteria

1. Given a schema delta is committed, when it is published to the event log, then the event envelope contains: id (ZetaId), source, type ("schema.evolved"), time, specversion ("1.0"), and a data payload with `{ before: SchemaShape, after: SchemaShape }`.
2. Given the event is received by a consumer, when parsed, then the consumer can determine which fields were added (in `after` not `before`), removed (in `before` not `after`), or changed.
3. Given the envelope follows CloudEvents spec, when integrated with external systems (Debezium, Kafka, event routers), then no adapter is needed — the envelope is natively compatible.

### Requirement 3: Conformance suite as backward-compatibility proof

**User Story:** As a developer evolving a schema, I want the conformance test suite to prove my change is backward-compatible so that I don't need manual review for safe evolutions.

#### Acceptance Criteria

1. Given a schema delta is proposed, when the conformance suite runs against all backends (simulated, os-fs, zeta-fs-polyfill, zeta-fs-native), then passing = the evolution is safe; failing = the evolution breaks a consumer.
2. Given all 4 backends pass the same N assertions, then the schema evolution is proven interchangeable across storage substrates.
3. Given a schema delta that removes a field still in use by a consumer, when the conformance suite runs, then it fails (detecting the breaking change before deployment).
4. Given the conformance suite passes, when the delta is deployed, then zero downtime occurs (proven by the overlap window property: every identifier/field resolves at every tick).

### Requirement 4: Overlap-window rotation (the reusable primitive)

**User Story:** As the system architect, I want schema evolution to follow the same overlap-window dual-key rotation pattern as the ZetaId migration so that zero-downtime is structurally guaranteed, not operationally hoped for.

#### Acceptance Criteria

1. Given any schema change, when the rotation pattern is applied, then: Phase 1 (writer switches to new schema), Phase 2 (readers migrate in batches), Phase 3 (drop old schema at quorum).
2. Given the overlap window is open, when any reader queries, then both old and new schemas resolve (dual-lookup / union semantics).
3. Given a TLA+ specification of the rotation, when model-checked, then safety (∀ tick: every field resolves) and liveness (the window eventually closes) hold.
4. Given the pattern is applied to filesystem metadata, to backlog item ids, or to any future schema, then the same machinery works without modification (reusable primitive, not one-off script).

### Requirement 5: Multi-backend storage topology

**User Story:** As a deployer, I want schema evolution to work identically whether my storage is a single-file FUSE image, a traditional filesystem + git, or an in-memory simulation, so that deployment topology doesn't affect correctness.

#### Acceptance Criteria

1. Given the same schema delta applied to os-fs backend AND zeta-fs-native backend, when the conformance suite runs, then both produce identical results.
2. Given a Z-set composition spanning multiple containers (files), when a schema delta affects cross-container joins, then the Rx join operators correctly propagate the delta to all materialized views.
3. Given the polyfill backend (os-fs + git), when a schema evolution is applied, then it produces the same observable state as the native backend (symlinks for multi-home, git commits for history).
4. Given 1 file can hold multiple Z-sets, when a schema delta affects one Z-set in a multi-Z-set file, then other Z-sets in the same file are unaffected.

### Requirement 6: Formal verification target

**User Story:** As a researcher, I want the zero-downtime schema evolution pattern to be expressible and provable in TLA+ so that it can be published as a verified primitive.

#### Acceptance Criteria

1. Given the TLA+ specification, when TLC model-checks it, then: safety property (no read fails to resolve a field at any step) holds for all reachable states.
2. Given the TLA+ specification, when TLC model-checks it, then: liveness property (the overlap window eventually closes under fair scheduling) holds.
3. Given the retraction-algebra reading (old: -1, new: +1), when expressed in the spec, then the Z-set fold property `fold(deltas) = current_schema` is an invariant.
4. Given the spec is published (target: VLDB/PODS), when external reviewers verify it, then the proof is machine-checked and reproducible.

## Non-Requirements

- Manual migration scripts or flag-day deployments
- Schema versioning via separate version numbers (the Z-set IS the version — fold gives you the current shape)
- Breaking backward compatibility during the overlap window
- Requiring all backends to be deployed simultaneously (each migrates independently)

## Addendum: Reference-Counting Quorum + Adversarial Review (2026-06-16)

### Requirement 7: Reference-counted quorum (provable zero-ref before drop)

**User Story:** As the system architect, I want the overlap window to close ONLY when provably zero consumers reference the old schema fields, so that no read can fail after consolidation.

#### Acceptance Criteria

1. Given every consumer (UI component, backend service, agent, materialized view) declares which schema fields it references, when a schema delta is applied, then the system can enumerate all references to old fields.
2. Given the ref count for an old field is > 0, when tryConsolidate is called, then it REFUSES (returns the list of remaining references as the reason).
3. Given the ref count for ALL old fields reaches 0, when tryConsolidate is called, then it succeeds (the overlap window closes).
4. Given a UI component renders data using field "modified", when that field is retracted but the UI still references it, then the ref count remains > 0 and consolidation is blocked until the UI is updated.
5. Given the TLA+ spec, when model-checked, then the safety property includes: `canConsolidate iff \A f \in retractedFields: refCount(f) = 0`.

### Requirement 8: Adversarial review of migration proofs (summon-gated)

**User Story:** As a system operator, I want every schema migration proof to be adversarially reviewed by a summoned critic persona before finalization, so that missed references are caught before the overlap window closes.

#### Acceptance Criteria

1. Given a schema delta with ref count = 0, when finalization is requested, then a critic persona is summoned (via ISummon/PersonaSummoner) with the prompt: "find a consumer that still references the old field."
2. Given the critic finds no remaining reference, when it responds, then finalization proceeds.
3. Given the critic finds a remaining reference, when it responds, then finalization is BLOCKED and the reference is added to the ref count.
4. Given the adversarial review uses a local LLM (temperature 0), when it runs, then the review is deterministic and reproducible (DST-compatible).
5. Given the adversarial review uses a cloud persona (Grok critique role), when it runs, then the review has higher quality but is non-deterministic (logged for audit).
