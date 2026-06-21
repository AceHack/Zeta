---
id: 081KR2E4K0008QG0R0031E5PR8
priority: P1
status: closed
closed: 2026-05-08
closed_by: "StructureFingerprint.fs — 10 shapes, extractSignals, classify, fingerprint, similarity; 16 tests"
title: "Structure recognizer — fingerprint library for codebase shapes"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQZVQW0008QG0R002QZAFB2
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect, formal-verification-expert]
---

# 081KR2E4K0008QG0R0031E5PR8 — Fingerprint library

Define structure fingerprints for common codebase shapes
(operator algebra, state machine, pipeline, pub/sub).
F# types + pattern-matching functions.

## Acceptance criteria

- Types at src/Core/StructureFingerprint.fs
- At least 5 fingerprint patterns defined
- Tests verifying pattern recognition
