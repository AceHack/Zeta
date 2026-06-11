---
id: B-0171.3
zetaid: 081KSNY2Z0008QG0R0016VFTRX
priority: P1
status: open
title: "OpenSpec catch-up - author Retraction-Native Semantics spec"
created: 2026-05-28
last_updated: 2026-05-31
parent: B-0171
depends_on: [B-0171.1]
classification: buildable-now
decomposition: atomic
owners: [lior]
type: spec-authoring
---

# B-0171.3 — Author Retraction-Native Semantics spec

This task implements the third item from the Phase 1 audit of the OpenSpec catch-up project (B-0171). It involves creating a formal specification for Retraction-Native Semantics.

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
