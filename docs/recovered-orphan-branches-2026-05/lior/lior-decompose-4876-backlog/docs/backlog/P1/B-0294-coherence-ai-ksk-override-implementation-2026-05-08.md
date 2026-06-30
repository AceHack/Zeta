---
id: B-0294
priority: P1
status: open
title: "Coherence AI — KSK override implementation"
created: 2026-05-08
parent: B-0245
depends_on: [B-0293]
classification: blocked-on-B-0293
decomposition: atomic
type: feature
---

# B-0294 — KSK override

Implement the KSK override path: N-of-M multi-sig
authorization for bypassing consent gate in emergency.

## Acceptance criteria

- F# types for KSK authorization (signers, threshold, scope)
- Tests for N-of-M threshold logic
