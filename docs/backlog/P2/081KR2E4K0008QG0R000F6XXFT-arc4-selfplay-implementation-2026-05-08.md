---
id: 081KR2E4K0008QG0R000F6XXFT
priority: P2
status: open
title: "ARC-4 — self-play implementation + training loop"
created: 2026-05-08
parent: 081KQZVQW0008QG0R0029709BP
depends_on: [081KR2E4K0008QG0R0037MW8ET]
classification: blocked-on-081KR2E4K0008QG0R0037MW8ET
decomposition: atomic
type: feature
---

# 081KR2E4K0008QG0R000F6XXFT — Self-play implementation

Implement the arena from 081KR2E4K0008QG0R0037MW8ET. Structure recognizer
generates puzzles for itself, solves them, scores.

## Acceptance criteria

- Working self-play loop in F#
- At least 10 puzzles generated and solved
- Score distribution reported
