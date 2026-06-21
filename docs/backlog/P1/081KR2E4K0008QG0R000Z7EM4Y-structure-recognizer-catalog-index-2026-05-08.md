---
id: 081KR2E4K0008QG0R000Z7EM4Y
priority: P1
status: closed
title: "Structure recognizer — shape-indexed catalog without labels"
created: 2026-05-08
last_updated: 2026-05-09
parent: 081KQZVQW0008QG0R002QZAFB2
depends_on: [081KR2E4K0008QG0R0031E5PR8]
classification: closed
decomposition: atomic
closed_by: "StructureCatalog.fs — shape-indexed catalog with add, queryByShape, queryBySimilarity, count; 9 tests"
owners: [architect, performance-engineer]
type: feature
---

# 081KR2E4K0008QG0R000Z7EM4Y — Shape-indexed catalog

Build a catalog that indexes code structures by
fingerprint, not by name/label. Query by shape.

## Acceptance criteria

- Catalog data structure defined
- Query function: given a shape, return matching structures
- At least one test with real Zeta code as input
