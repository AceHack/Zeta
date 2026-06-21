---
id: 081KSNY2Z0008QG0R003YZ3JXC
priority: P1
status: open
title: "OpenSpec catch-up - author Z-Set Algebra spec"
created: 2026-05-28
last_updated: 2026-05-28
parent: 081KQNJ500008QG0R001N94412
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [lior]
type: spec-authoring
---

# 081KSNY2Z0008QG0R003YZ3JXC — Author Z-Set Algebra spec

This task implements the first item from the Phase 1 audit of the OpenSpec catch-up project (081KQNJ500008QG0R001N94412). It involves creating a formal specification for the Z-Set and IndexedZSet data structures.

## Scope

This task is focused on creating the OpenSpec document for the Z-Set algebra. The spec will define:

- The core Z-Set data structure.
- The IndexedZSet data structure.
- The key operations for both data structures — for Z-Set: `add`, `sub`, `neg`, `scale`, `map`, `filter`, `flatMap`, `cartesian`, `join`, `distinct`, `distinctIncremental`; for IndexedZSet: `indexWith`, `add`, `neg`, `join`, `tupleCount`, `toZSet`. (There is no `reduce` operator; aggregation is expressed via `map`/`flatMap` composed with `add`.)
- The algebraic properties and laws that these operations must satisfy.

The implementation already exists in `src/Core/ZSet.fs` and `src/Core/IndexedZSet.fs`. This task is about formally documenting the existing behavior.

## Acceptance Criteria

- A new capability lands at `openspec/specs/z-set-algebra/spec.md` (the canonical OpenSpec discovery path — `tools/openspec/inventory.ts` reads `<capability>/spec.md`, so a `README.md` would be invisible to coverage), with a language-agnostic base spec plus a `profiles/fsharp.md` carrying the F# signatures.
- The base spec formally defines the Z-Set and IndexedZSet data structures as behavioral requirements (RFC-2119 + WHEN/THEN scenarios).
- The F# profile documents the signatures and semantics of the core operators (including the `'K : not null` constraint on `indexWith`).
- The spec lists the key algebraic properties (associativity, commutativity, distributivity, group inverse, join bilinearity) of the operators.
