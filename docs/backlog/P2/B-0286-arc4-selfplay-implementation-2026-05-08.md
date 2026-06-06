---
id: B-0286
zetaid: 081KR2E4K0008QG0R000F6XXFT
priority: P2
status: open
title: "ARC-4 — self-play implementation + training loop"
created: 2026-05-08
parent: B-0252
depends_on: [B-0285]
classification: blocked-on-B-0285
decomposition: atomic
type: feature
---

# B-0286 — Self-play implementation

Implement the arena from B-0285. Structure recognizer
generates puzzles for itself, solves them, scores.

## Acceptance criteria

- Working self-play loop in F#
- At least 10 puzzles generated and solved
- Score distribution reported
