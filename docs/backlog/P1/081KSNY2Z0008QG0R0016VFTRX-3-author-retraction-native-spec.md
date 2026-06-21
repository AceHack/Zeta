---
id: 081KSNY2Z0008QG0R0016VFTRX
priority: P1
status: closed
closed: 2026-06-12
closed_by: "openspec/specs/retraction-native/spec.md"
title: "OpenSpec catch-up - author Retraction-Native Semantics spec"
created: 2026-05-28
last_updated: 2026-06-12
parent: 081KQNJ500008QG0R001N94412
depends_on: [081KSNY2Z0008QG0R003YZ3JXC]
classification: buildable-now
decomposition: atomic
owners: [lior]
type: spec-authoring
---

# 081KSNY2Z0008QG0R0016VFTRX — Author Retraction-Native Semantics spec

This task implements the third item from the Phase 1 audit of the OpenSpec catch-up project (081KQNJ500008QG0R001N94412). It involves creating a formal specification for Retraction-Native Semantics.

## Scope

This task is focused on creating the inventory-discovered OpenSpec document
for retraction-native semantics. The spec will define:

- The core principles of retraction-native operations.
- The guarantees that the system provides for retractions (e.g., clean reverts, history preservation).
- The relationship between retraction-native semantics and the Z-Set algebra.

The core concepts are documented in the ADR at `docs/DECISIONS/2026-04-24-graph-substrate-zset-backed-retraction-native.md`. This task is about formalizing those concepts in an OpenSpec document.

## Acceptance Criteria

- A new spec file `openspec/specs/retraction-native/spec.md` is created. The
  existing `README.md` may remain as background material, but it is not
  discovered by `tools/openspec/inventory.ts`.
- `tools/openspec/inventory.ts` maps `retraction-native` in either
  `CAPABILITY_MODULE_MAP` or `CAPABILITY_ARTIFACT_MAP`, so
  `bun tools/openspec/inventory.ts --enforce --fail-on-unmapped-specs`
  continues to pass after the new `spec.md` is added.
- The spec formally defines the principles of retraction-native semantics.
- The spec documents the guarantees and operational constraints of retractions.
- The spec references the Z-Set algebra spec and the founding ADR.
